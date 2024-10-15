import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

import { FFmpegFactory } from "./load-ffmeg"

interface WorkerMessage {
  file: Blob
  outputFormat: string
  fileName: string
}
let ffmpegInstance: FFmpeg | null = null

const getFFmpegInstance = async (): Promise<FFmpeg> => {
  ffmpegInstance = new FFmpeg()
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd"
  await ffmpegInstance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  })
  return ffmpegInstance
}
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { file, outputFormat, fileName } = event.data
  console.log({ file, outputFormat, fileName })

  try {
    const ffmpeg = await FFmpegFactory.create() // Singleton FFmpeg instance in the worker

    const inputFileName = `input.${file.type.split("/")[1]}`
    await ffmpeg.writeFile(inputFileName, await fetchFile(file))

    await ffmpeg.exec([
      "-i",
      inputFileName,
      "-preset",
      "ultrafast",
      `output.${outputFormat}`,
    ])

    const outputData = await ffmpeg.readFile(`output.${outputFormat}`)
    console.log(`outputData `, outputData)
    const blob = new Blob([outputData], { type: file.type })

    self.postMessage({
      fileName,
      url: URL.createObjectURL(blob),
      success: true,
    })
  } catch (error: any) {
    self.postMessage({ error: error.message, success: false })
  }
}
