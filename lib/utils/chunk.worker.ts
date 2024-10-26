/// <reference lib="webworker" />
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"

interface WorkerMessage {
  file: File
  chunkIndex: number
  chunkDuration: number
  totalDuration: number
  action: Action
}

self.onmessage = async function (e: MessageEvent<WorkerMessage>) {
  const { file, chunkIndex, chunkDuration, totalDuration, action } = e.data
  console.log({ file, chunkIndex, chunkDuration, totalDuration, action })
  const ffmpeg = new FFmpeg()

  try {
    await ffmpeg.load()

    const inputName = `input_${chunkIndex}.${action.from}`
    const inputBuffer = await file.arrayBuffer()
    ffmpeg.writeFile(inputName, new Uint8Array(inputBuffer))

    const start = chunkIndex * chunkDuration
    const end = Math.min(start + chunkDuration, totalDuration)
    const chunkEnd = (end - start).toString()
    console.log(action)
    const outputName = `output_${chunkIndex}.${action.from}`
    console.log("outputName: ", outputName)

    const args = [
      "-analyzeduration",
      "50M",
      "-probesize",
      "20M",
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
      "libx264", // Use H.264 video encoding
      "-c:a",
      "aac", // Use AAC audio encoding
      outputName,
    ]

    let log = ""
    ffmpeg.on("log", ({ message }) => {
      log += message + "\n"
    })
    await ffmpeg.exec(args)
    console.log(log)

    const outputChunk = await ffmpeg.readFile(outputName)

    // Create a Blob from the Uint8Array and pass it to the main thread
    const outputBlob = new Blob([outputChunk], { type: action.file_type })

    self.postMessage(
      {
        success: true,
        outputName,
        chunkIndex,
        chunk: outputBlob, // Pass Blob instead of Uint8Array
      },
      []
    ) // No need to transfer Blob buffers, just pass the Blob object itself

    // Clean up virtual file system to free memory
    await ffmpeg.deleteFile(inputName)
    await ffmpeg.deleteFile(outputName)
  } catch (error: any) {
    self.postMessage({
      success: false,
      chunkIndex,
      error: error.message,
    })
  }
}
