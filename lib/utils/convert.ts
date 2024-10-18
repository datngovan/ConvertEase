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

export default async function convertFile(
  ffmpeg: FFmpeg,
  action: Action
): Promise<{ url: string; output: string }> {
  const { file, to, file_name, file_type } = action

  const inputExtension = getFileExtension(file_name)
  let outputFileName = ""
  if (to === "m4v") {
    outputFileName = removeFileExtension(file_name) + "." + "mp4"
  } else {
    outputFileName = removeFileExtension(file_name) + "." + to
  }

  // Write the input file to ffmpeg memory
  const inputFileName = `input.${inputExtension}`
  const ffmpeg_cmd = FfpmegCommandFactory.getFfmpegCommand(
    to ? to : "mp4",
    inputFileName,
    outputFileName
  )
  try {
    ffmpeg.writeFile(inputFileName, await fetchFile(file))
    // Listen for logging events from FFmpeg
    ffmpeg.on("log", ({ message }) => {
      console.log(`[FFmpeg log]: ${message}`)
    })
    try {
      // Execute FFmpeg command
      console.log("Executing FFmpeg command:", ffmpeg_cmd)
      await ffmpeg.exec(ffmpeg_cmd)
      // List files in the root directory after conversion
      const directoryContents = await listDirectoryContents(ffmpeg, "/")
      console.log("Directory contents after conversion:", directoryContents)
      console.log("FFmpeg command executed successfully")
    } catch (error) {
      console.error("FFmpeg execution error: ", error)
    }
    // Read the output file from ffmpeg memory
    console.log("Reading output file:", outputFileName)
    let outputData = null
    try {
      outputData = await ffmpeg.readFile(outputFileName)
    } catch (error) {
      console.error("ReadFile Error:", error)
    }

    if (!outputData || outputData.length === 0) {
      console.error(
        "File conversion failed: Output file not generated or is empty"
      )
      throw new Error("File conversion failed")
    }

    console.log("Output file read successfully:", outputData)
    const blob = new Blob([outputData], { type: file_type.split("/")[0] })
    console.log("Blob created successfully")
    const url = URL.createObjectURL(blob)

    return { url, output: outputFileName }
  } catch (error) {
    console.error(error)
    throw new Error("File Converion fail")
  }
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
