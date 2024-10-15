// imports
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile } from "@ffmpeg/util"

function getFileExtension(file_name: string): string {
  const regex = /(?:\.([^.]+))?$/ // Matches the last dot and everything after it
  const match = regex.exec(file_name)
  return match && match[1] ? match[1] : "" // Return file extension or empty if none found
}

function removeFileExtension(file_name: string): string {
  const lastDotIndex = file_name.lastIndexOf(".")
  return lastDotIndex !== -1 ? file_name.slice(0, lastDotIndex) : file_name // Remove file extension if exists
}

function splitFileIntoChunks(file: File, chunkSize: number): Blob[] {
  const chunks: Blob[] = []
  let offset = 0

  // Loop to slice the file into chunks
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize)
    chunks.push(chunk)
    offset += chunkSize
  }

  return chunks
}

function combineChunks1(chunks: Blob[], fileType: string): Blob {
  return new Blob(chunks, { type: fileType })
}

export default async function convertFile(
  ffmpeg: FFmpeg,
  action: Action
): Promise<{ url: string; output: string }> {
  const { file, to, file_name, file_type } = action
  const CHUNK_SIZE = 200 * 1024 // Chunk size in bytes (10KB)
  const chunks = splitFileIntoChunks(file, CHUNK_SIZE) // Split the file into chunks
  console.log(`chunks: `, chunks)
  const result: Blob[] = []

  const inputExtension = getFileExtension(file_name)
  const outputFileName = removeFileExtension(file_name) + "." + to

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`chunks ${i + 1}: `, chunks[i])
    const chunkInputFileName = `input_chunk_${i}.${inputExtension}`
    const chunkOutputFileName = `output_chunk_${i}.${to}`

    // Step 1: Write each chunk to FFmpeg's virtual file system
    ffmpeg.writeFile(chunkInputFileName, await fetchFile(chunk))

    // Step 2: Construct FFmpeg command for each chunk
    let ffmpeg_cmd: string[] = []
    if (to === "3gp") {
      ffmpeg_cmd = [
        "-i",
        chunkInputFileName,
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
        chunkOutputFileName,
      ]
    } else {
      ffmpeg_cmd = ["-i", chunkInputFileName, chunkOutputFileName]
    }

    // Step 3: Execute FFmpeg command for each chunk
    await ffmpeg.exec(ffmpeg_cmd)

    // Step 4: Read the converted chunk and store it
    const outputChunkData = await ffmpeg.readFile(chunkOutputFileName)
    console.log("file_type", `image/${to}`)
    const chunkBlob = new Blob([outputChunkData], {
      type: `image/${to}`,
    })
    console.log(`chunkBlob ${i}`, chunkBlob)
    result.push(chunkBlob) // Store each converted chunk
  }

  // Step 5: Combine all the processed chunks into a single Blob
  console.log(`result `, result)
  const finalBlob = combineChunks1(result, `image/${to}`)
  console.log(`finalBlob `, finalBlob)
  // Step 6: Create a URL for the combined file
  const url = URL.createObjectURL(finalBlob)

  // Clean up the FFmpeg virtual file system (optional, but recommended for large files)
  // You might want to clean up the chunks after you're done

  return { url, output: outputFileName }
}

function splitImageIntoChunks(
  image: HTMLImageElement,
  rows: number,
  cols: number
): HTMLCanvasElement[] {
  const canvasChunks: HTMLCanvasElement[] = []
  const chunkWidth = Math.floor(image.width / cols)
  const chunkHeight = Math.floor(image.height / rows)

  // Create canvas elements for each chunk
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")!

      canvas.width = chunkWidth
      canvas.height = chunkHeight

      // Draw the chunk onto the canvas
      context.drawImage(
        image,
        col * chunkWidth,
        row * chunkHeight, // Source x and y
        chunkWidth,
        chunkHeight, // Source width and height
        0,
        0, // Destination x and y
        chunkWidth,
        chunkHeight // Destination width and height
      )

      canvasChunks.push(canvas)
    }
  }

  return canvasChunks
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: string = "image/png"
): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), format)
  })
}
function combineChunks(
  chunks: HTMLCanvasElement[],
  rows: number,
  cols: number
): HTMLCanvasElement {
  const chunkWidth = chunks[0].width
  const chunkHeight = chunks[0].height

  // Create a new canvas for the combined image
  const combinedCanvas = document.createElement("canvas")
  combinedCanvas.width = chunkWidth * cols
  combinedCanvas.height = chunkHeight * rows

  const context = combinedCanvas.getContext("2d")!

  // Draw each chunk onto the combined canvas
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const chunk = chunks[row * cols + col]
      context.drawImage(chunk, col * chunkWidth, row * chunkHeight)
    }
  }

  return combinedCanvas
}

export async function processImage(
  action: Action,
  rows: number,
  cols: number
): Promise<{ url: string; output: string }> {
  // Step 1: Load the image file into an HTMLImageElement
  const image = await loadImageFromFile(action.file)

  // Step 2: Split the image into chunks
  const chunks = splitImageIntoChunks(image, rows, cols)

  // Step 3: Optionally, convert each chunk (e.g., to PNG or JPG)
  const convertedChunks = await Promise.all(
    chunks.map((chunk) => canvasToBlob(chunk, `image/${action.to}`))
  )

  // Step 4: Recombine the converted chunks back into a single image
  const recombinedCanvas = combineChunks(chunks, rows, cols)

  // Step 5: Convert the recombined canvas into a Blob
  let url: string = ""
  try {
    const finalBlob = await canvasToBlob(recombinedCanvas, `image/${action.to}`)
    url = URL.createObjectURL(finalBlob)
  } catch (err) {
    console.error(err)
  }
  return { url, output: `output.${action.to}` }
}

// Helper function to load an image from a file
async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.src = url
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => reject(e)
  })
}

export { getFileExtension, removeFileExtension }
