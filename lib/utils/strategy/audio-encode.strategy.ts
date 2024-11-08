// Audio encoding strategy interface
interface AudioEncodingStrategy {
  setAudioCodec(): string[]
}

// Strategy for MP3 audio
class Mp3Strategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "mp3"]
  }
}

// Strategy for WAV audio
class WavStrategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "pcm_s16le"] // WAV typically uses PCM encoding
  }
}

// Strategy for OGG audio
class OggStrategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "libvorbis"]
  }
}

// Strategy for AAC audio
class AacStrategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "aac"]
  }
}

// Strategy for WMA audio
class WmaStrategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "wmav2"]
  }
}

// Strategy for FLAC audio
class FlacStrategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "flac"]
  }
}

// Strategy for M4A audio
class M4aStrategy implements AudioEncodingStrategy {
  setAudioCodec(): string[] {
    return ["-c:a", "aac"] // M4A typically uses AAC encoding
  }
}
class AudioEncodingStrategyFactory {
  static getStrategy(targetAudioType: string): AudioEncodingStrategy {
    switch (targetAudioType) {
      case "mp3":
        return new Mp3Strategy()
      case "wav":
        return new WavStrategy()
      case "ogg":
        return new OggStrategy()
      case "aac":
        return new AacStrategy()
      case "wma":
        return new WmaStrategy()
      case "flac":
        return new FlacStrategy()
      case "m4a":
        return new M4aStrategy()
      default:
        throw new Error("Unsupported audio format")
    }
  }
}
