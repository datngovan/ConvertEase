import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"

import { FfpmegCommandFactory } from "./command-factory"
import { WorkerPool } from "./worker-pool"

type convertOutput = {
  url: string
  output: string
}
type WorkerResultSuccess = {
  success: true
  outputFileName: string
  log: string
  outputFile: Uint8Array | string
}
type WorkerResultError = {
  success: false
  error: string
}

type WorkerResult = WorkerResultSuccess | WorkerResultError

type FileData = Uint8Array | string
/**
 * Get the file extension.
 * @param file_name File name.
 * @returns File extension or empty string if not found.
 */
function getFileExtension(file_name: string): string {
  const regex = /(?:\.([^.]+))?$/ // Matches the last dot and everything after it
  const match = regex.exec(file_name)
  return match && match[1] ? match[1] : ""
}

/**
 * Remove file extension.
 * @param file_name File name.
 * @returns File name without extension.
 */
function removeFileExtension(file_name: string): string {
  const lastDotIndex = file_name.lastIndexOf(".")
  return lastDotIndex !== -1 ? file_name.slice(0, lastDotIndex) : file_name
}

/**
 * Convert file to other type.
 * @param ffmpeg Wasm FFpmeg instance.
 * @param action Action was pass in by user can be (image, audio, video).
 * @returns A promise type convertOutput.
 */
export default async function convertFile(
  ffmpeg: FFmpeg,
  action: Action
): Promise<convertOutput> {
  const { to, file_name } = action
  const duration = await getFileDuration(ffmpeg, action)
  const fileChunks = await chunkFiles(ffmpeg, 5, duration, action)
  let outputFileName = ""

  if (to === "mp4v") {
    outputFileName = removeFileExtension(file_name) + "." + "mp4"
  } else {
    outputFileName = removeFileExtension(file_name) + "." + to
  }
  const taskPromises = assignWorkerToChunk(ffmpeg, fileChunks, to)
  // Wait for all tasks to finish and collect output file names
  const convertedChunks = await Promise.all(taskPromises)
  // Now concatenate the chunks using FFmpeg
  const fileListName = "file_list.txt"
  const finalBlobData = await concatChunkToFinalFile(
    fileListName,
    convertedChunks,
    ffmpeg,
    outputFileName
  )
  const finalBlob = new Blob([finalBlobData], { type: `video/${to}` })
  const url = URL.createObjectURL(finalBlob)

  // Clean up intermediate files
  for (const chunkFile of convertedChunks) {
    await ffmpeg.deleteFile(chunkFile)
  }
  await ffmpeg.deleteFile(fileListName)

  // Return the URL to the reassembled file
  return { url, output: outputFileName }
}

/**
 * Join the chunks to final file.
 * @param fileListName Name of the file contain list of chunks name.
 * @param chunksNameList List of the chunks name.
 * @param ffmpeg FFmpeg instance.
 * @param outputFileName Output file name.
 * @returns A promise type File Data.
 */
async function concatChunkToFinalFile(
  fileListName: string,
  chunksNameList: string[],
  ffmpeg: FFmpeg,
  outputFileName: string
): Promise<FileData> {
  // Now concatenate the chunks using FFmpeg
  let fileListContent = chunksNameList
    .map((chunk) => `file '${chunk}'`)
    .join("\n")
  await ffmpeg.writeFile(
    fileListName,
    new TextEncoder().encode(fileListContent)
  )
  // Read the final concatenated file
  let finalBlobData
  const concatCommand = [
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    fileListName,
    "-c",
    "copy", // Copy streams without re-encoding
    outputFileName,
  ]
  try {
    let concatLog = ""
    ffmpeg.on("log", ({ message }) => {
      concatLog += message + "\n"
    })
    const concatResult = await ffmpeg.exec(concatCommand)

    if (concatResult !== 0) {
      console.error("FFmpeg concat failed with log:", concatLog)
      throw new Error(`FFmpeg concat failed`)
    }
  } catch (error) {
    console.error("Error concatenating chunks:", error)
    throw new Error("Chunk concatenation failed")
  }

  try {
    finalBlobData = await ffmpeg.readFile(outputFileName)
  } catch (error) {
    console.error("Error reading concatenated file:", error)
    throw new Error("Error reading concatenated file")
  }
  return finalBlobData
}

/**
 * Assign worker to chunks
 * @param ffmpeg FFmpeg instance.
 * @param fileChunks File chunks array.
 * @param outputFormat Format type of output file.
 * @returns A promise name of the output file.
 */

function assignWorkerToChunk(
  ffmpeg: FFmpeg,
  fileChunks: Blob[],
  outputFormat: string | undefined
): Promise<string>[] {
  const workerPool = new WorkerPool(3)
  workerPool.init()
  const taskPromises = fileChunks.map((chunk, i) => {
    const chunkInputFileName = `chunk_${i}.blob`
    const chunkOutputFileName = `chunk_${i}.${outputFormat}`
    const ffmpeg_cmd_chunk = FfpmegCommandFactory.getFfmpegCommand(
      outputFormat ? outputFormat : "mp4",
      chunkInputFileName,
      chunkOutputFileName
    )

    return workerPool.addTask(async (worker) => {
      // Convert the chunk using the worker
      const result = await convertChunkWithWorker(worker, {
        fileChunk: chunk,
        inputName: chunkInputFileName,
        outputName: chunkOutputFileName,
        ffmpegCommand: ffmpeg_cmd_chunk,
      })
      if (result.success) {
        // Write the output file (Uint8Array) back to FFmpeg's virtual file system
        await ffmpeg.writeFile(result.outputFileName, result.outputFile)
        return result.outputFileName // Return the output file name to be used later
      } else {
        throw new Error(`Chunk ${i + 1} conversion failed: ${result.error}`)
      }
    })
  })
  return taskPromises
}

/**
 * Get the durantion of the file if audio/video
 * @param ffmpeg FFmpeg instance.
 * @param action Action.
 * @returns Duration of the file.
 */
async function getFileDuration(
  ffmpeg: FFmpeg,
  action: Action
): Promise<number> {
  const inputFileName = action.file_name
  const inputArrayBuffer = await action.file.arrayBuffer() // Convert the input file to ArrayBuffer

  // Write the input file to the virtual filesystem
  ffmpeg.writeFile(inputFileName, new Uint8Array(inputArrayBuffer))

  let ffmpegOutput = "" // To store FFmpeg logs

  // Set up FFmpeg logger using .on to capture the metadata output
  ffmpeg.on("log", ({ message }) => {
    // FFmpeg outputs metadata to stderr (fferr)
    ffmpegOutput += message + "\n" // Collect the log messages
  })

  // Execute the FFmpeg command to probe the file and get metadata
  const resultCode = await ffmpeg.exec([
    "-i",
    inputFileName,
    "-f",
    "null",
    "-", // Null output just to print metadata
  ])

  if (resultCode !== 0) {
    throw new Error("FFmpeg command failed.")
  }
  // Extract the duration from the collected log output (look for the Duration line)
  const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/
  const match = durationRegex.exec(ffmpegOutput)
  if (!match) {
    throw new Error("Unable to determine video duration.")
  }

  // Parse the duration (hours, minutes, seconds, microseconds)
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)

  // Convert to total seconds
  const totalDuration = hours * 3600 + minutes * 60 + seconds

  // Clean up the input file after extracting metadata
  await ffmpeg.deleteFile(inputFileName)
  return totalDuration // Return the duration in seconds
}

/**
 * Chunk file into small chunk if audio/video
 * @param ffmpeg FFmpeg instance.
 * @param chunkDuration Chunk duration.
 * @param totalDuration File duration.
 * @param action Action.
 * @returns TODO
 */
async function chunkFiles(
  ffmpeg: FFmpeg,
  chunkDuration: number,
  totalDuration: number,
  action: Action
) {
  // Load the input file from the Blob
  const inputBuffer = await action.file.arrayBuffer()
  // Write the input file directly into ffmpeg (use Blob or ArrayBuffer input)
  const inputName = action.file.name
  ffmpeg.writeFile(inputName, new Uint8Array(inputBuffer))

  const chunks: Blob[] = []
  const index = Math.ceil(totalDuration / chunkDuration)
  for (let i = 0; i < index; i++) {
    const start = i * chunkDuration
    const end = Math.min(start + chunkDuration, totalDuration)
    const outputName = `output_${index}.${action.to}`
    const chunkEnd = (end - start).toString()
    const args = [
      "-analyzeduration",
      "50M", // Reduce analyzeduration
      "-probesize",
      "20M", // Reduce probesize
      "-i",
      inputName,
      "-preset",
      "ultrafast",
      "-ss",
      start.toString(),
      "-t",
      chunkEnd,
      "-map_metadata",
      "0",
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-copyts",
      "-c:v",
      "libx264", // Re-encode video for the target format
      "-c:a",
      "aac", // Re-encode audio for the target format
      "-pix_fmt",
      "yuv420p", // Set pixel format
      "-force_key_frames",
      `expr:gte(t,n_forced*${start})`, // Ensure keyframe at the start
      "-movflags",
      "frag_keyframe+empty_moov+faststart",
      outputName,
    ]
    let ffmpegOutput = ""

    ffmpeg.on("log", ({ message }) => {
      // We're interested in the error logs
      ffmpegOutput += message + "\n" // Capture the log output
    })

    // Create each chunk based on start time and duration
    const result = await ffmpeg.exec(args)
    if (result !== 0) {
      console.error("FFmpeg command failed with code:", result)
      console.error("FFmpeg log output:", ffmpegOutput)
      throw new Error(`FFmpeg fails with code ${result}`)
    }
    // Read the output chunk from the virtual filesystem
    const chunkData = ffmpeg.readFile(outputName)
    const outputBlob = new Blob([await chunkData], {
      type: action.file_type,
    })

    // Push the chunk Blob to the chunks array
    chunks.push(outputBlob)
    // Remove the chunk file from the virtual filesystem to free memory
    await ffmpeg.deleteFile(outputName)
    // Ensure memory is freed up
  }
  // Remove the input file from the virtual filesystem
  await ffmpeg.deleteFile(inputName)
  return chunks
}
/**
 * Convert a chunk using a worker and return the result.
 * @param worker - The Worker instance to handle the conversion.
 * @param data - The data to be sent to the worker for processing.
 * @returns A Promise that resolves with the WorkerResult (either success or error).
 */
function convertChunkWithWorker(
  worker: Worker,
  data: any
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const { success } = e.data

      if (success) {
        resolve(e.data as WorkerResultSuccess)
      } else {
        console.error(
          "Chunk conversion failed:",
          (e.data as WorkerResultError).error
        )
        reject(new Error((e.data as WorkerResultError).error))
      }
    }

    worker.onerror = (err) => {
      console.error("Worker error:", err.message)
      reject(new Error(`Worker error: ${err.message}`))
    }

    // Send data to the worker for chunk conversion
    worker.postMessage(data)
  })
}
