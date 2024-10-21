// imports

import { rejects } from "assert"
import { resolve } from "path"
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

import { FfpmegCommandFactory } from "./command-factory"
import { WorkerPool } from "./worker-pool"

function getFileExtension(file_name: string): string {
  const regex = /(?:\.([^.]+))?$/ // Matches the last dot and everything after it
  const match = regex.exec(file_name)
  return match && match[1] ? match[1] : "" // Return file extension or empty if none found
}

function removeFileExtension(file_name: string): string {
  const lastDotIndex = file_name.lastIndexOf(".")
  return lastDotIndex !== -1 ? file_name.slice(0, lastDotIndex) : file_name // Remove file extension if exists
}

export default async function convertFile(
  ffmpeg: FFmpeg,
  action: Action
): Promise<{ url: string; output: string }> {
  const { to, file_name } = action
  const duration = await getFileDuration(ffmpeg, action)
  console.log("duration: ", duration)
  const fileChunks = await chunkFiles(ffmpeg, 5, duration, action)
  // const convertedChunks: string[] = [] // Store chunk output file names
  let outputFileName = ""

  if (to === "mp4v") {
    outputFileName = removeFileExtension(file_name) + "." + "mp4"
  } else {
    outputFileName = removeFileExtension(file_name) + "." + to
  }
  // async function convertChunkswithWorker(fileChunks: Blob[],  to: string) {
  //   const convertedChunks: string[] = [];
  // }
  // Convert chunks individually
  // const worker = new Worker(new URL("./convertWorker.ts", import.meta.url))
  const workerPool = new WorkerPool(3)
  workerPool.init()
  console.log(workerPool.workers)
  const taskPromises = fileChunks.map((chunk, i) => {
    const chunkInputFileName = `chunk_${i}.blob`
    const chunkOutputFileName = `chunk_${i}.${to}`
    const ffmpeg_cmd_chunk = FfpmegCommandFactory.getFfmpegCommand(
      to ? to : "mp4",
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

      console.log("result: ", result)

      if (result.success) {
        console.log(`Chunk ${i + 1} converted successfully.`)

        // Write the output file (Uint8Array) back to FFmpeg's virtual file system
        await ffmpeg.writeFile(result.outputFileName, result.outputFile)

        return result.outputFileName // Return the output file name to be used later
      } else {
        throw new Error(`Chunk ${i + 1} conversion failed: ${result.error}`)
      }
    })
  })

  // Wait for all tasks to finish and collect output file names
  const convertedChunks = await Promise.all(taskPromises)
  console.log("convertedChunks: ", convertedChunks)
  // for (let i = 0; i < fileChunks.length; i++) {
  //   const chunk = fileChunks[i]
  //   const chunkInputFileName = `chunk_${i}.blob`
  //   const chunkOutputFileName = `chunk_${i}.${to}`
  //   const ffmpeg_cmd_chunk = FfpmegCommandFactory.getFfmpegCommand(
  //     to ? to : "mp4",
  //     chunkInputFileName,
  //     chunkOutputFileName
  //   )

  //   await ffmpeg.writeFile(chunkInputFileName, await fetchFile(chunk))
  //   workerPool.addTask(() => {
  //     return new Promise(async (resolve, reject) => {
  //       const worker = workerPool.workers[i % 3]
  //       try {
  //         const result = await convertChunkWithWorker(worker, {
  //           fileChunk: chunk,
  //           inputName: chunkInputFileName,
  //           outputName: chunkOutputFileName,
  //           ffmpegCommand: ffmpeg_cmd_chunk,
  //         })
  //         console.log("result: ", result)
  //         if (result.success) {
  //           console.log(`Chunk ${i + 1} converted successfully.`)
  //           await ffmpeg.writeFile(result.outputFileName, result.outputFile)
  //           convertedChunks.push(result.outputFileName)
  //           resolve()
  //         } else {
  //           reject(
  //             new Error(`Chunk ${i + 1} conversion failed: ${result.error}`)
  //           )
  //         }
  //       } catch (error) {
  //         console.error(`Error converting chunk ${i + 1}:`, error)
  //         throw new Error(`Chunk ${i + 1} conversion failed`)
  //       }
  //     })
  //   })
  //   // Clean up the input chunk to save memory
  //   await ffmpeg.deleteFile(chunkInputFileName)
  //   // List directory contents
  //   const directoryContents = await ffmpeg.listDir("/")
  //   console.log("Directory Contents:", directoryContents)
  // }

  // // Once all tasks are complete, terminate the workers
  // Promise.all(workerPool.taskQueue).then(() => {
  //   workerPool.terminateAll()
  //   console.log("All chunks converted and workers terminated.")
  // })
  // Now concatenate the chunks using FFmpeg
  const fileListName = "file_list.txt"
  let fileListContent = convertedChunks
    .map((chunk) => `file '${chunk}'`)
    .join("\n")
  console.log("fileListContent: ", fileListContent)
  await ffmpeg.writeFile(
    fileListName,
    new TextEncoder().encode(fileListContent)
  )
  // Log directory contents after writing the input file
  const listAfterWrite = await ffmpeg.listDir("/")
  console.log("Directory after input file is written:", listAfterWrite)

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
  console.log("concatCommand: ", concatCommand)

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

    console.log("Concatenation complete")
  } catch (error) {
    console.error("Error concatenating chunks:", error)
    throw new Error("Chunk concatenation failed")
  }

  // Read the final concatenated file
  let finalBlobData
  try {
    finalBlobData = await ffmpeg.readFile(outputFileName)
  } catch (error) {
    console.error("Error reading concatenated file:", error)
    throw new Error("Error reading concatenated file")
  }

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

async function listDirectoryContents(ffmpeg: FFmpeg, path: string = "/") {
  try {
    // List the directory contents
    const directoryContents = await ffmpeg.listDir(path)
    return directoryContents
  } catch (error) {
    console.error(`Error listing contents of directory "${path}":`, error)
    return []
  }
}

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
  console.log(index)
  for (let i = 0; i < index; i++) {
    const start = i * chunkDuration
    const end = Math.min(start + chunkDuration, totalDuration)
    const outputName = `output_${index}.${action.to}`
    const chunkEnd = (end - start).toString()
    console.log("data: ", `${start} - ${chunkEnd}`)
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
 * TODO later edit the data type
 * @param worker
 * @param data
 */
function convertChunkWithWorker(worker: Worker, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const { success, outputFile, outputFileName, log } = e.data

      if (success) {
        console.log("Chunk conversion success:", log)
        resolve({ success: true, outputFile, outputFileName })
      } else {
        console.error("Chunk conversion failed:", e.data.error)
        reject(new Error(e.data.error))
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
