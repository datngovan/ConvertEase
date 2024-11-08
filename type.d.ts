export type Action = {
  file: File
  file_name: string
  file_size: number
  from: string
  to: string | undefined
  file_type: string
  is_converting?: boolean
  is_converted?: boolean
  is_error?: boolean
  url?: any
  output?: any
  reencodeFirstChunk?: boolean
}
