// FfpmegCommandFactory.ts
export class FfpmegCommandFactory {
  static getFfmpegCommand(
    format: string,
    inputFileName: string,
    outputFileName: string
  ): string[] {
    switch (format) {
      case "m4v":
        return [
          "-i",
          inputFileName,
          "-vcodec",
          "mpeg4", // MPEG-4 Visual codec for MP4V
          "-acodec",
          "aac", // AAC codec for audio
          outputFileName,
        ]
      case "3gp":
        return [
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
      case "3g2":
        return [
          "-i",
          inputFileName,
          "-r",
          "20", // Set frame rate for mobile
          "-s",
          "352x288", // Set resolution to something typical for mobile
          "-vb",
          "400k", // Set video bitrate
          "-acodec",
          "aac", // Audio codec should be AAC or AMR-NB
          "-ac",
          "1", // Mono audio (most common for 3G2)
          "-ar",
          "8000", // Sample rate for mobile audio
          "-ab",
          "24k", // Set audio bitrate
          outputFileName,
        ]
      default:
        return ["-i", inputFileName, outputFileName] // Default command for unknown formats
    }
  }
}
