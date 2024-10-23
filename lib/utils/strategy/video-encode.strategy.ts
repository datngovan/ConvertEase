// encodingStrategies.ts

export interface EncodingStrategy {
  setAudioCodec(): string[]
  setVideoCodec(): string[]
}

export class H264AACStrategy implements EncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "aac"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "h264"]
  }
}

// export class XvidMP3Strategy implements EncodingStrategy {
//   setAudioCodec(): string[] {
//     // Use 'libmp3lame' instead of 'mp3' for better compatibility with FFmpeg
//     return ["-c:a", "libmp3lame"]
//   }

//   setVideoCodec(): string[] {
//     // Use 'libxvid' instead of 'xvid' for video
//     return ["-c:v", "libxvid"]
//   }
// }

export class VP8VorbisStrategy implements EncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "libvorbis"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "vp8"]
  }
}

export class WMVStrategy implements EncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "wmav2"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "wmv2"]
  }
}

export class RawVideoStrategy implements EncodingStrategy {
  private useH264: boolean

  constructor(useH264: boolean = true) {
    this.useH264 = useH264
  }

  setAudioCodec(): string[] {
    return ["-an"] // No audio for raw video
  }

  setVideoCodec(): string[] {
    return this.useH264 ? ["-c:v", "h264"] : ["-c:v", "hevc"]
  }
}

export class FLVStrategy implements EncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "mp3"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "flv"]
  }
}

export class TheoraVorbisStrategy implements EncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "libvorbis"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "libtheora"]
  }
}

export class H264AACMP3Strategy implements EncodingStrategy {
  private useAAC: boolean

  constructor(useAAC: boolean = true) {
    this.useAAC = useAAC
  }

  setAudioCodec(): string[] {
    return this.useAAC ? ["-c:a", "aac"] : ["-c:a", "mp3"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "h264"]
  }
}

export class SameCodecStrategy implements EncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "copy"]
  }

  setVideoCodec(): string[] {
    return ["-c:v", "copy"]
  }
}
