import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

interface WorkerMessage {
  file: File
  outputFormat: string
  fileName: string
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { file, outputFormat, fileName } = event.data

  // Create FFmpeg instance
  const ffmpeg = new FFmpeg()

  try {
    await ffmpeg.load() // Load FFmpeg core (WASM)

    const inputFileName = `input.${file.type.split("/")[1]}`

    // Write the file into FFmpeg's virtual memory
    ffmpeg.writeFile(inputFileName, await fetchFile(file))

    // Run the FFmpeg command to convert the file
    await ffmpeg.exec(["-i", inputFileName, `output.${outputFormat}`])

    // Read the converted file from FFmpeg's memory
    const outputData = await ffmpeg.readFile(`output.${outputFormat}`)
    const blob = new Blob([outputData], { type: file.type })

    // Send the converted file URL back to the main thread
    self.postMessage({
      fileName,
      url: URL.createObjectURL(blob),
      success: true,
    })
  } catch (error: any) {
    // If something goes wrong, send the error message back
    self.postMessage({ error: error.message, success: false })
  }
}
