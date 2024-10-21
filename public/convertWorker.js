import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

self.onmessage = async function (e) {
  try {
    const { chunk, chunkIndex, format, fileType } = e.data;

    // Initialize ffmpeg in the worker (or pass from main thread)

  // Initialize ffmpeg instance in the worker
  const ffmpeg = new FFmpeg()
  await ffmpeg.load()

    const inputName = `chunk_${chunkIndex}.blob`;
    const outputName = `chunk_${chunkIndex}.${format}`;

    // Write the chunk to ffmpeg memory
    ffmpeg.writeFile(inputName, chunk);

    // Convert the chunk
    await ffmpeg.exec([
      "-i", inputName,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-c:a", "aac",
      outputName,
    ]);

    // Read the converted chunk
    const convertedChunk = await ffmpeg.readFile(outputName);
    const convertedBlob = new Blob([convertedChunk], { type: fileType });

    // Post the result back to the main thread
    self.postMessage({ chunkIndex, convertedBlob });

    // Clean up
    ffmpeg.deleteFile(inputName);
    ffmpeg.deleteFile(outputName);
  } catch (error) {
    console.error("Error inside worker:", error);
    self.postMessage({ error: error.message });
  }
};
