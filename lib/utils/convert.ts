import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"
import mediaInfoFactory from "mediainfo.js"

import { FfpmegCommandFactory } from "./command-factory"
import { ConvertWorkerPool } from "./convert-worker-pool"
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

// type ChunkWorkerResultSuccess = {
//   success: true
//   outputFileName: string
//   log: string
//   outputFile: Uint8Array | string
// }
// type ChunkWorkerResultError = {
//   success: false
//   error: string
// }

// type ChunkWorkerResult = ChunkWorkerResultSuccess | ChunkWorkerResultError

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

function getTypeFromMimeType(
  mimeType: string,
  fallback: string = "mp4"
): string {
  if (!mimeType || mimeType === "") {
    return fallback // Fallback to a default MIME type, e.g., 'mp4'
  }

  const parts = mimeType.split("/")
  if (parts.length === 2) {
    return parts[1] // Return the second part (the file type)
  }
  throw new Error("Invalid MIME type")
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
  console.log(action.file_type.includes("image"))
  if (action.file_type.includes("image")) {
    const { file, to, file_name, file_type } = action
    const input = getFileExtension(file_name)
    const output = removeFileExtension(file_name) + "." + to
    ffmpeg.writeFile(input, await fetchFile(file))
    const ffmpeg_cmd = ["-i", input, output]
    await ffmpeg.exec(ffmpeg_cmd)

    const data = (await ffmpeg.readFile(output)) as any
    const blob = new Blob([data], { type: file_type.split("/")[0] })
    const url = URL.createObjectURL(blob)
    return { url, output }
  } else {
    console.time("convert")
    const { to, file_name } = action
    const format = await getFileMetadata(action.file)
    console.log("format: ", format)
    console.time("get duration")
    const duration1 = await getTimeMetadata(action.file)
    console.log("meta data: ", duration1)
    console.timeEnd("get duration")
    const chunkDuration = Math.ceil(duration1 / 5)
    console.time("get chunks")
    const fileChunks = await chunkFiles(
      ffmpeg,
      chunkDuration,
      duration1,
      action
    )
    console.log("fileChunks: ", fileChunks)
    console.timeEnd("get chunks")
    console.time("get chunks with Workers")
    const fileChunksWithWorker = await chunkFiles(
      ffmpeg,
      chunkDuration,
      duration1,
      action
    )
    console.log("fileChunksWithWorker: ", fileChunksWithWorker)
    console.timeEnd("get chunks with Workers")
    let outputFileName = ""

    if (to === "mp4v") {
      outputFileName = removeFileExtension(file_name) + "." + "mp4"
    } else {
      outputFileName = removeFileExtension(file_name) + "." + to
    }
    console.time("convert chunks")
    const taskPromises = assignWorkerToChunk(ffmpeg, fileChunks, to)
    console.timeEnd("convert chunks")
    // Wait for all tasks to finish and collect output file names
    console.time("resolved chunks")
    const convertedChunks = await Promise.all(taskPromises)
    console.timeEnd("resolved chunks")
    console.time("combined chunks")
    // Now concatenate the chunks using FFmpeg
    const fileListName = "file_list.txt"
    const finalBlobData = await concatChunkToFinalFile(
      fileListName,
      convertedChunks,
      ffmpeg,
      outputFileName
    )
    console.timeEnd("combined chunks")
    const finalBlob = new Blob([finalBlobData], { type: `video/${to}` })
    const url = URL.createObjectURL(finalBlob)

    // Clean up intermediate files
    for (const chunkFile of convertedChunks) {
      await ffmpeg.deleteFile(chunkFile)
    }
    await ffmpeg.deleteFile(fileListName)

    console.timeEnd("convert")
    // Return the URL to the reassembled file
    return { url, output: outputFileName }
  }
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
  console.log("fileChunks: ", fileChunks)
  const workerPool = new ConvertWorkerPool(5, false)
  workerPool.init()
  const taskPromises = fileChunks.map((chunk, i) => {
    const chunkInputFileName = `chunk_${i}.blob`
    const chunkOutputFileName = `chunk_${i}.${outputFormat}`

    // Skip the metadata chunk
    if (chunk.type === "application/json") {
      console.log("Skipping metadata chunk:", chunk)
      return Promise.resolve("")
    }

    const originalType = getTypeFromMimeType(chunk.type || "") // Handle empty MIME types
    console.log("originalType: ", originalType)

    const ffmpeg_cmd_chunk = FfpmegCommandFactory.getFfmpegCommand(
      outputFormat ? outputFormat : "mp4",
      chunkInputFileName,
      chunkOutputFileName,
      originalType
    )
    // console.log("ffmpeg_cmd_chunk: ", ffmpeg_cmd_chunk)

    return workerPool.addTask(async (worker) => {
      // Convert the chunk using the worker
      const result = await convertChunkWithWorker(worker, {
        fileChunk: chunk,
        inputName: chunkInputFileName,
        outputName: chunkOutputFileName,
        ffmpegCommand: ffmpeg_cmd_chunk,
      })
      if (result.success) {
        await ffmpeg.writeFile(result.outputFileName, result.outputFile)
        return result.outputFileName
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
// Define the specific track types that may contain a Duration property
interface VideoTrack {
  "@type": "Video"
  Duration?: number
}

interface AudioTrack {
  "@type": "Audio"
  Duration?: number
}

interface GeneralTrack {
  "@type": "General"
  Duration?: number
}

/**
 * Get the duration and other metadata of a media file using MediaInfo.js.
 * @param file The media file (audio/video).
 * @returns Metadata including duration in seconds and other properties.
 */
export async function getTimeMetadata(file: File) {
  // Create the MediaInfo instance
  const mediaInfo = await mediaInfoFactory({
    format: "object", // Output the result as an object
    locateFile: (path: string) => `/MediaInfoModule.wasm`, // WASM location in public folder
  })

  // Analyze the file using the size and chunk reading method
  const result = await mediaInfo.analyzeData(
    () => file.size, // Function to get the file size
    async (size: number, offset: number) => {
      // Function to read the file as a Uint8Array for MediaInfo to process
      const chunk = file.slice(offset, offset + size) // Get a file slice
      const arrayBuffer = await chunk.arrayBuffer() // Convert it to ArrayBuffer
      return new Uint8Array(arrayBuffer) // Convert to Uint8Array and return
    }
  )
  // Ensure result.media and tracks are defined
  const res = result.media
  if (!res || !res.track) {
    throw new Error("Media information is not available.")
  }
  const generalTrack = res.track.find(
    (track): track is GeneralTrack => track["@type"] === "General"
  )
  console.log("generalTrack: ", generalTrack)
  if (!generalTrack || !generalTrack.Duration) {
    throw new Error("Duration not found in the 'General' track")
  }
  // Return the duration in seconds (it's already provided in seconds in your data)
  const durationInSeconds = generalTrack.Duration
  return durationInSeconds
}

// Function to extract metadata using MediaInfo.js
async function getFileMetadata(file: File) {
  const mediaInfo = await mediaInfoFactory({
    format: "object",
    locateFile: (path: string) => `/MediaInfoModule.wasm`, // Path to wasm file
  })

  const result = await mediaInfo.analyzeData(
    () => file.size,
    async (size, offset) => {
      const chunk = file.slice(offset, offset + size)
      const arrayBuffer = await chunk.arrayBuffer()
      return new Uint8Array(arrayBuffer)
    }
  )
  console.log("META DATA: ", result)

  // Ensure media and tracks exist
  if (!result.media || !result.media.track) {
    throw new Error("Media information is not available.")
  }
  const VideoTrack = result.media.track.find(
    (track) => track["@type"] === "Video"
  )
  const AudioTrack = result.media.track.find(
    (track) => track["@type"] === "Audio"
  )
  if (!VideoTrack || !VideoTrack.Format) {
    throw new Error("Duration not found in the 'General' track")
  }
  if (!AudioTrack || !AudioTrack.Format) {
    throw new Error("Duration not found in the 'General' track")
  }
  const format = `Video format: ${VideoTrack.Format} \n Audio format: ${AudioTrack.Format}`
  return format
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
): Promise<Blob[]> {
  const numberOfChunks = Math.ceil(totalDuration / chunkDuration)
  const inputName = `input.${action.from}`
  const inputBuffer = await action.file.arrayBuffer()

  // Write the input file to the FFmpeg virtual filesystem
  ffmpeg.writeFile(inputName, new Uint8Array(inputBuffer))

  const outputNameTemplate = `output_%03d.${action.from}`

  // FFmpeg command to split the video into chunks without re-encoding
  const ffmpegCmd = [
    "-i",
    inputName, // Input file
    "-c",
    "copy", // Copy codec (no re-encoding)
    "-f",
    "segment", // Use segment format
    "-segment_time",
    chunkDuration.toString(), // Set chunk duration
    "-reset_timestamps",
    "1", // Reset timestamps for each chunk
    outputNameTemplate, // Output file template
  ]

  // Execute the FFmpeg command
  await ffmpeg.exec(ffmpegCmd)

  // Collect the output chunks
  const chunks: Blob[] = []

  for (let i = 0; i < numberOfChunks; i++) {
    const outputName = `output_${i.toString().padStart(3, "0")}.${action.from}`

    try {
      // Read each chunk from FFmpeg virtual filesystem
      const outputChunk = await ffmpeg.readFile(outputName)

      // Create a Blob from the Uint8Array for each chunk
      const outputBlob = new Blob([outputChunk], { type: action.file_type })
      chunks.push(outputBlob)

      // Clean up by deleting the chunk from the virtual filesystem
      await ffmpeg.deleteFile(outputName)
    } catch (err) {
      console.error(`Error reading chunk ${i}:`, err)
    }
  }

  // Clean up by deleting the input file from the virtual filesystem
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

/**
 * Convert a chunk using a worker and return the result.
 * @param worker - The Worker instance to handle the conversion.
 * @param data - The data to be sent to the worker for processing.
 * @returns A Promise that resolves with the WorkerResult (either success or error).
 */
function chunkFileWithWorker(worker: Worker, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<any>) => {
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
