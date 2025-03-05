"use client"

// imports
import { useEffect, useRef, useState } from "react"
import { Action } from "@/type"
import ReactDropzone from "react-dropzone"
import { BiError } from "react-icons/bi"
import { FiUploadCloud } from "react-icons/fi"
import { HiOutlineDownload } from "react-icons/hi"
import { ImSpinner3 } from "react-icons/im"
import { LuFileSymlink } from "react-icons/lu"
import { MdClose, MdDone } from "react-icons/md"

import byteConvert from "@/lib/utils/byte-convert"
import compressFileName from "@/lib/utils/compress-file-name"
import convertFile from "@/lib/utils/convert"
import fileToIcon from "@/lib/utils/file-to-icon"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"

import { Button } from "./ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Skeleton } from "./ui/skeleton"

const extensions = {
  image: [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "ico",
    "tif",
    "tiff",
    "svg",
    "raw",
    "tga",
  ],
  video: [
    "mp4",
    "m4v",
    "mp4v",
    "3gp",
    "3g2",
    "avi",
    "mov",
    "wmv",
    "mkv",
    "flv",
    "ogv",
    "webm",
    "h264",
    "264",
    "hevc",
    "265",
  ],
  audio: ["mp3", "wav", "ogg", "aac", "wma", "flac", "m4a"],
}

export default function Dropzone() {
  // State hooks
  const { toast } = useToast()
  const [isHover, setIsHover] = useState(false)
  const [actions, setActions] = useState<Action[]>([])
  const [isReady, setIsReady] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const ffmpegRef = useRef<any>(null)
  const [defaultValues, setDefaultValues] = useState("video")

  // Lazy load FFmpeg
  useEffect(() => {
    const loadFFmpeg = async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg")
      ffmpegRef.current = FFmpeg
      setIsLoaded(true)
    }
    loadFFmpeg()
  }, [])

  // Reset state
  const reset = () => {
    setIsDone(false)
    setActions([])
    setFiles([])
    setIsReady(false)
    setIsConverting(false)
  }

  // Download a single file
  const download = (action: Action) => {
    const a = document.createElement("a")
    a.style.display = "none"
    a.href = action.url
    a.download = action.output
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(action.url)
    document.body.removeChild(a)
  }

  // Download all files
  const downloadAll = () => {
    actions.forEach((action) => {
      if (!action.is_error) {
        download(action)
      }
    })
  }

  // Convert files
  const convert = async () => {
    console.time("convert All")
    setActions(actions.map((elt) => ({ ...elt, is_converting: true })))
    setIsConverting(true)

    for (const action of actions) {
      try {
        const { url, output } = await convertFile(ffmpegRef.current, action)
        setActions((prev) =>
          prev.map((elt) =>
            elt.file_name === action.file_name
              ? {
                  ...elt,
                  is_converted: true,
                  is_converting: false,
                  url,
                  output,
                }
              : elt
          )
        )
      } catch (err) {
        console.error(err)
        setActions((prev) =>
          prev.map((elt) =>
            elt.file_name === action.file_name
              ? {
                  ...elt,
                  is_converted: false,
                  is_converting: false,
                  is_error: true,
                }
              : elt
          )
        )
      }
    }

    setIsDone(true)
    setIsConverting(false)
    console.timeEnd("convert All")
  }

  // Handle file upload
  const handleUpload = (data: File[]) => {
    setFiles(data)
    setActions(
      data.map((file) => ({
        file_name: file.name,
        file_size: file.size,
        from: file.name.split(".").pop() || "",
        to: undefined,
        file_type: file.type,
        file,
        is_converted: false,
        is_converting: false,
        is_error: false,
      }))
    )
  }

  // Update selected format for conversion
  const updateAction = (file_name: string, to: string) => {
    setActions((prev) =>
      prev.map((action) =>
        action.file_name === file_name ? { ...action, to } : action
      )
    )
  }

  // Delete action
  const deleteAction = (action: Action) => {
    setActions((prev) =>
      prev.filter((elt) => elt.file_name !== action.file_name)
    )
    setFiles((prev) => prev.filter((elt) => elt.name !== action.file_name))
  }

  return (
    <ReactDropzone
      onDrop={handleUpload}
      onDragEnter={() => setIsHover(true)}
      onDragLeave={() => setIsHover(false)}
      accept={{
        "image/*": extensions.image.map((ext) => `.${ext}`),
        "audio/*": extensions.audio.map((ext) => `.${ext}`),
        "video/*": extensions.video.map((ext) => `.${ext}`),
      }}
      onDropRejected={() => {
        setIsHover(false)
        toast({
          variant: "destructive",
          title: "Error uploading your file(s)",
          description: "Allowed Files: Audio, Video, and Images.",
          duration: 5000,
        })
      }}
    >
      {({ getRootProps, getInputProps }) => (
        <div
          {...getRootProps()}
          className="bg-background h-72 lg:h-80 xl:h-96 rounded-3xl shadow-sm border-secondary border-2 border-dashed cursor-pointer flex items-center justify-center"
        >
          <input {...getInputProps()} />
          <div className="space-y-4 text-foreground">
            {isHover ? (
              <>
                <div className="justify-center flex text-6xl">
                  <LuFileSymlink />
                </div>
                <h3 className="text-center font-medium text-2xl">
                  Yes, right there
                </h3>
              </>
            ) : (
              <>
                <div className="justify-center flex text-6xl">
                  <FiUploadCloud />
                </div>
                <h3 className="text-center font-medium text-2xl">
                  Click, or drop your files here
                </h3>
              </>
            )}
          </div>
        </div>
      )}
    </ReactDropzone>
  )
}
