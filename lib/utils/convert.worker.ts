/// <reference lib="webworker" />
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

interface WorkerMessage {
  fileChunk: Blob
  inputName: string
  outputName: string
  ffmpegCommand: string[]
}

// FFmpeg instance to be shared across chunk processing
const ffmpeg = new FFmpeg()
let isFFmpegLoaded = false

// Load FFmpeg only once
async function initializeFFmpeg() {
  if (!isFFmpegLoaded) {
    await ffmpeg.load()
    isFFmpegLoaded = true
  }
}

// Message event handler for chunk processing
self.onmessage = async function (e: MessageEvent<WorkerMessage>) {
  const { fileChunk, inputName, outputName, ffmpegCommand } = e.data
  console.log(ffmpegCommand)
  try {
    // Ensure FFmpeg is loaded once
    await initializeFFmpeg()

    let log = ""
    ffmpeg.on("log", ({ message }) => {
      log += message + "\n"
    })
    console.time("write input")
    // Write the input file (chunk) to FFmpeg's virtual file system
    await ffmpeg.writeFile(inputName, await fetchFile(fileChunk))
    console.timeEnd("write input")
    console.time("exc input")
    // Execute the conversion
    await ffmpeg.exec(ffmpegCommand)
    console.timeEnd("exc input")
    console.time("read out")
    // Read the converted file from FFmpeg's virtual file system
    const outputFile = await ffmpeg.readFile(outputName)
    console.timeEnd("read out")
    console.time("send out")
    // Handle the case where the output is Uint8Array (binary data)
    if (outputFile instanceof Uint8Array) {
      self.postMessage(
        {
          success: true,
          outputFileName: outputName,
          log: log,
          outputFile, // Send Uint8Array containing the file data
        },
        [outputFile.buffer] // Transfer the buffer to avoid copying
      )
    } else {
      // Handle the case where the output is a string (e.g., text-based file)
      self.postMessage({
        success: true,
        outputFileName: outputName,
        log: log,
        outputFile, // Send string file data directly
      })
    }
  } catch (error: any) {
    // Post error message back to the main thread
    self.postMessage({
      success: false,
      error: `Conversion failed: ${error.message}`,
    })
  }
  console.timeEnd("send out")
  // Cleanup after chunk processing
  await ffmpeg.deleteFile(inputName)
  await ffmpeg.deleteFile(outputName)
}
