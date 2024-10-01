export default function compressFileName(fileName: string): string {
  // Define the maximum length for the substring
  const maxSubstrLength = 18

  // Trim the input fileName to remove unwanted spaces
  const trimmedFileName = fileName.trim()

  // If the fileName is shorter than the maximum length, return it as is
  if (trimmedFileName.length <= maxSubstrLength) return trimmedFileName

  // Extract the file extension (if any)
  const fileParts = trimmedFileName.split(".")
  const hasExtension = fileParts.length > 1
  const fileExtension = hasExtension ? fileParts.pop() || "" : ""
  const fileNameWithoutExtension = fileParts.join(".")

  // Adjust the remaining length after accounting for ellipsis and extension
  const remainingLength = maxSubstrLength - (fileExtension.length + 3) // 3 for "..."

  // Calculate the length of the start and end parts
  const startLength = Math.floor(remainingLength / 2)
  const endLength = remainingLength - startLength

  // Create the compressed fileName
  const compressedFileName =
    fileNameWithoutExtension.substring(0, startLength) +
    "..." +
    fileNameWithoutExtension.slice(-endLength) +
    (fileExtension ? `.${fileExtension}` : "")

  return compressedFileName
}
