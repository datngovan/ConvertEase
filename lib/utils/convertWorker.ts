/// <reference lib="webworker" />
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

interface WorkerMessage {
  fileChunk: Blob
  inputName: string
  outputName: string
  ffmpegCommand: string[]
}

self.onmessage = async function (e: MessageEvent<WorkerMessage>) {
  const { fileChunk, inputName, outputName, ffmpegCommand } = e.data
  const ffmpeg = new FFmpeg()

  try {
    await ffmpeg.load()

    let log = ""
    ffmpeg.on("log", ({ message }) => {
      log += message + "\n"
    })
    // Write the input file (chunk) to the FFmpeg virtual file system
    await ffmpeg.writeFile(inputName, await fetchFile(fileChunk))

    // Execute the conversion
    await ffmpeg.exec(ffmpegCommand)
    // Read the converted file from FFmpeg's virtual file system
    const outputFile = await ffmpeg.readFile(outputName)

    // Check if the outputFile is Uint8Array (binary data) or a string (text data)
    if (typeof outputFile === "string") {
      // Handle the case where the output is a string (e.g., text-based file)
      self.postMessage({
        success: true,
        outputFileName: outputName,
        log: log,
        outputFile, // Send string file data directly
      })
    } else if (outputFile instanceof Uint8Array) {
      // Handle the case where the output is Uint8Array (binary data)
      self.postMessage(
        {
          success: true,
          outputFileName: outputName,
          log: log,
          outputFile, // Send Uint8Array containing the file data
        },
        [outputFile.buffer]
      ) // Transfer the buffer (ArrayBuffer) to avoid copying
    } else {
      throw new Error("Unsupported file format returned from ffmpeg.readFile()")
    }
  } catch (error: any) {
    self.postMessage({
      success: false,
      error: `Conversion failed: ${error.message}`,
    })
  }
}
