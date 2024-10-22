// chunkWorker.ts

/// <reference lib="webworker" />
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

interface WorkerMessage {
  inputBuffer: ArrayBuffer
  chunkIndex: number
  chunkDuration: number
  totalDuration: number
  action: Action
}

self.onmessage = async function (e: MessageEvent<WorkerMessage>) {
  const { inputBuffer, chunkIndex, chunkDuration, totalDuration, action } =
    e.data
  const ffmpeg = new FFmpeg()

  try {
    await ffmpeg.load()

    const inputName = `input_${chunkIndex}.${action.file_type}`
    ffmpeg.writeFile(inputName, new Uint8Array(inputBuffer))

    const start = chunkIndex * chunkDuration
    const end = Math.min(start + chunkDuration, totalDuration)
    const chunkEnd = (end - start).toString()
    const outputName = `output_${chunkIndex}.${action.to}`

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
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      outputName,
    ]

    await ffmpeg.exec(args)

    const outputChunk = await ffmpeg.readFile(outputName)

    self.postMessage(
      {
        success: true,
        chunkIndex,
        chunk: outputChunk,
      },
      [outputChunk]
    ) // Transfer the buffer to avoid cloning

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
