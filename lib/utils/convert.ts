// imports
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

import { FfpmegCommandFactory } from "./command-factory"

function getFileExtension(file_name: string): string {
  const regex = /(?:\.([^.]+))?$/ // Matches the last dot and everything after it
  const match = regex.exec(file_name)
  return match && match[1] ? match[1] : "" // Return file extension or empty if none found
}

function removeFileExtension(file_name: string): string {
  const lastDotIndex = file_name.lastIndexOf(".")
  return lastDotIndex !== -1 ? file_name.slice(0, lastDotIndex) : file_name // Remove file extension if exists
}

// export default async function convertFile(
//   ffmpeg: FFmpeg,
//   action: Action
// ): Promise<{ url: string; output: string }> {
//   const { file, to, file_name, file_type } = action

//   const inputExtension = getFileExtension(file_name)
//   let outputFileName = ""
//   if (to === "m4v") {
//     outputFileName = removeFileExtension(file_name) + "." + "mp4"
//   } else {
//     outputFileName = removeFileExtension(file_name) + "." + to
//   }

//   // Write the input file to ffmpeg memory
//   const inputFileName = `input.${inputExtension}`
//   const ffmpeg_cmd = FfpmegCommandFactory.getFfmpegCommand(
//     to ? to : "mp4",
//     inputFileName,
//     outputFileName
//   )
//   try {
//     ffmpeg.writeFile(inputFileName, await fetchFile(file))
//     // Listen for logging events from FFmpeg
//     ffmpeg.on("log", ({ message }) => {
//       console.log(`[FFmpeg log]: ${message}`)
//     })
//     try {
//       // Execute FFmpeg command
//       console.log("Executing FFmpeg command:", ffmpeg_cmd)
//       await ffmpeg.exec(ffmpeg_cmd)
//       // List files in the root directory after conversion
//       const directoryContents = await listDirectoryContents(ffmpeg, "/")
//       console.log("Directory contents after conversion:", directoryContents)
//       console.log("FFmpeg command executed successfully")
//     } catch (error) {
//       console.error("FFmpeg execution error: ", error)
//     }
//     // Read the output file from ffmpeg memory
//     console.log("Reading output file:", outputFileName)
//     let outputData = null
//     try {
//       outputData = await ffmpeg.readFile(outputFileName)
//     } catch (error) {
//       console.error("ReadFile Error:", error)
//     }

//     if (!outputData || outputData.length === 0) {
//       console.error(
//         "File conversion failed: Output file not generated or is empty"
//       )
//       throw new Error("File conversion failed")
//     }

//     console.log("Output file read successfully:", outputData)
//     const blob = new Blob([outputData], { type: file_type.split("/")[0] })
//     console.log("Blob created successfully")
//     const url = URL.createObjectURL(blob)

//     return { url, output: outputFileName }
//   } catch (error) {
//     console.error(error)
//     throw new Error("File Converion fail")
//   }
// }

export default async function convertFile(ffmpeg: FFmpeg, action: Action) {
  const duration = await getFileDuration(ffmpeg, action)
  const files = await chunkFiles(ffmpeg, 5, duration, action)
  console.log("files: ", files)
}

async function getFileDuration(
  ffmpeg: FFmpeg,
  action: Action
): Promise<number> {
  console.log("action.file: ", action.file)
  const inputFileName = "input.mp4"
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
  console.log(ffmpegOutput)
  // Extract the duration from the collected log output (look for the Duration line)
  const durationRegex = /Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/
  const match = durationRegex.exec(ffmpegOutput)
  console.log("match: ", match)
  if (!match) {
    throw new Error("Unable to determine video duration.")
  }

  // Parse the duration (hours, minutes, seconds, microseconds)
  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const seconds = parseInt(match[3], 10)
  const microseconds = parseInt(match[4], 10)

  // Convert to total seconds
  const totalDuration =
    hours * 3600 + minutes * 60 + seconds + microseconds / 1000000

  // Clean up the input file after extracting metadata
  ffmpeg.deleteFile(inputFileName)
  console.log("totalDuration: ", totalDuration)
  return totalDuration // Return the duration in seconds
}

async function listDirectoryContents(ffmpeg: FFmpeg, path: string = "/") {
  try {
    // List the directory contents
    const directoryContents = await ffmpeg.listDir(path)
    console.log(`Contents of directory "${path}":`, directoryContents)
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
  console.log("inputName: ", inputName)
  ffmpeg.writeFile(inputName, new Uint8Array(inputBuffer))

  const chunks: Blob[] = []
  const index = Math.round(totalDuration / chunkDuration)
  for (let i = 0; i < index; i++) {
    const start = i * chunkDuration
    const end = Math.min((i + 1) * chunkDuration, totalDuration - start)
    const outputName = `output_${index}.${action.to}`
    const args = [
      "-i",
      inputName,
      "-ss",
      start.toString(), // Start time for this chunk
      "-t",
      end.toString(), // Duration of the chunk
      "-map_metadata",
      "0", // Copy metadata from input
      "-c",
      "copy", // Copy without re-encoding
      "-movflags",
      "frag_keyframe+empty_moov",
      outputName, // Output file for each chunk
    ]
    console.log("args: ", args)
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
      type: `video/${action.to}`,
    })

    // Push the chunk Blob to the chunks array
    chunks.push(outputBlob)
    // Remove the chunk file from the virtual filesystem to free memory
    ffmpeg.deleteFile(outputName)
  }
  // Remove the input file from the virtual filesystem
  ffmpeg.deleteFile(inputName)
  return chunks
}
