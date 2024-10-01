import { FFmpeg } from "@ffmpeg/ffmpeg"
import { toBlobURL } from "@ffmpeg/util"

export class FFmpegFactory {
  private static instance: FFmpeg | null = null
  private static baseURL = "https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd"

  public static async create(): Promise<FFmpeg> {
    if (FFmpegFactory.instance) return FFmpegFactory.instance

    try {
      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${FFmpegFactory.baseURL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${FFmpegFactory.baseURL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      })

      FFmpegFactory.instance = ffmpeg
      return ffmpeg
    } catch (error) {
      console.error("Failed to load FFmpeg:", error)
      throw new Error("FFmpeg loading failed")
    }
  }

  public static resetInstance(): void {
    FFmpegFactory.instance = null // Optionally allow resetting the instance
  }
}
