// encodingStrategyFactory.ts
import {
  EncodingStrategy,
  FLVStrategy,
  H264AACMP3Strategy,
  H264AACStrategy,
  RawVideoStrategy,
  SameCodecStrategy,
  TheoraVorbisStrategy,
  VP8VorbisStrategy,
  WMVStrategy,
  XvidMP3Strategy,
} from "./video-encode.strategy"

// Define the codec groups
const H264AACGroup = ["mp4", "m4v", "mp4v", "mov", "3gp", "3g2"]
const XvidMP3Group = ["avi"]
const VP8VorbisGroup = ["webm"]
const H264AACMP3Group = ["mkv"]
const WMVGroup = ["wmv"]
const FLVGroup = ["flv"]
const TheoraVorbisGroup = ["ogv"]
const RawVideoGroup = ["h264", "264", "hevc", "265"]

export class EncodingStrategyFactory {
  static getStrategy(inputType: string, targetType: string): EncodingStrategy {
    console.log(`${inputType} - ${targetType}`)
    console.log(this.isSameCodecGroup(inputType, targetType))
    if (this.isSameCodecGroup(inputType, targetType)) {
      return new SameCodecStrategy()
    }

    // Otherwise, return the appropriate strategy based on the target type
    switch (targetType) {
      case "mp4":
      case "m4v":
      case "mp4v":
      case "mov":
      case "3gp":
      case "3g2":
        return new H264AACStrategy()
      case "avi":
        return new XvidMP3Strategy()
      case "webm":
        return new VP8VorbisStrategy()
      case "mkv":
        return new H264AACMP3Strategy()
      case "wmv":
        return new WMVStrategy()
      case "flv":
        return new FLVStrategy()
      case "ogv":
        return new TheoraVorbisStrategy()
      case "h264":
      case "264":
      case "hevc":
      case "265":
        return new RawVideoStrategy()
      default:
        throw new Error("Unsupported file type")
    }
  }

  // Helper function to check if both input and target types belong to the same codec group
  private static isSameCodecGroup(
    inputType: string,
    targetType: string
  ): boolean {
    const codecGroups = [
      H264AACGroup,
      XvidMP3Group,
      VP8VorbisGroup,
      H264AACMP3Group,
      WMVGroup,
      FLVGroup,
      TheoraVorbisGroup,
      RawVideoGroup,
    ]

    // Check if both types exist in the same group
    return codecGroups.some(
      (group) => group.includes(inputType) && group.includes(targetType)
    )
  }
}
