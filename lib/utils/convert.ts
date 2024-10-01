// imports
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

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
  const outputFileName = removeFileExtension(file_name) + "." + to

  // Write the input file to ffmpeg memory
  const inputFileName = `input.${inputExtension}`
  ffmpeg.writeFile(inputFileName, await fetchFile(file))

  // Construct FFmpeg command based on the target format
  let ffmpeg_cmd: string[] = []
  if (to === "3gp") {
    ffmpeg_cmd = [
      "-i",
      inputFileName,
      "-r",
      "20",
      "-s",
      "352x288",
      "-vb",
      "400k",
      "-acodec",
      "aac",
      "-strict",
      "experimental",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-ab",
      "24k",
      outputFileName,
    ]
  } else {
    ffmpeg_cmd = ["-i", inputFileName, outputFileName]
  }

  // Execute FFmpeg command
  await ffmpeg.exec(ffmpeg_cmd)

  // Read the output file from ffmpeg memory
  const outputData = await ffmpeg.readFile(outputFileName)
  const blob = new Blob([outputData], { type: file_type.split("/")[0] })
  const url = URL.createObjectURL(blob)

  return { url, output: outputFileName }
}
