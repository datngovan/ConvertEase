"use client"

// imports
import { useEffect, useRef, useState } from "react"
import { Action } from "@/type"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import ReactDropzone from "react-dropzone"
import { BiError } from "react-icons/bi"
import { FiUploadCloud } from "react-icons/fi"
import { HiOutlineDownload } from "react-icons/hi"
import { ImSpinner3 } from "react-icons/im"
import { LuFileSymlink } from "react-icons/lu"
import { MdClose, MdDone } from "react-icons/md"

import byteConvert from "@/lib/utils/byte-convert"
import compressFileName from "@/lib/utils/compress-file-name"
import fileToIcon from "@/lib/utils/file-to-icon"
import { FFmpegFactory } from "@/lib/utils/load-ffmeg"
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

interface WorkerResult {
  url: string
  fileName: string
  success: boolean
  error?: string
}

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
  // variables & hooks
  const { toast } = useToast()
  const [is_hover, setIsHover] = useState<boolean>(false)
  const [actions, setActions] = useState<Action[]>([])
  const [is_ready, setIsReady] = useState<boolean>(false)
  const [files, setFiles] = useState<Array<any>>([])
  const [is_loaded, setIsLoaded] = useState<boolean>(false)
  const [is_converting, setIsConverting] = useState<boolean>(false)
  const [is_done, setIsDone] = useState<boolean>(false)
  const ffmpegRef = useRef<any>(null)
  const [defaultValues, setDefaultValues] = useState<string>("video")
  const [selcted, setSelected] = useState<string>("...")
  const accepted_files = {
    "image/*": [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".ico",
      ".tif",
      ".tiff",
      ".raw",
      ".tga",
    ],
    "audio/*": [],
    "video/*": [],
  }

  // functions
  const reset = () => {
    setIsDone(false)
    setActions([])
    setFiles([])
    setIsReady(false)
    setIsConverting(false)
  }

  const downloadAll = (): void => {
    for (let action of actions) {
      !action.is_error && download(action)
    }
  }

  const download = (action: Action) => {
    const a = document.createElement("a")
    a.style.display = "none"
    a.href = action.url
    a.download = action.output

    document.body.appendChild(a)
    a.click()

    // Clean up after download
    URL.revokeObjectURL(action.url)
    document.body.removeChild(a)
  }

  // Web Worker integration for multi-file conversion
  const convert = async (): Promise<any> => {
    console.log(1, actions)
    let tmp_actions = actions.map((elt) => ({
      ...elt,
      is_converting: true,
    }))
    setActions(tmp_actions)
    setIsConverting(true)

    // Create a worker for each file and handle conversions in parallel
    const workerPromises: Promise<WorkerResult>[] = tmp_actions.map(
      (action) => {
        return new Promise((resolve, reject) => {
          const worker = new Worker(
            new URL("../lib/utils/ffmeg.worker.ts", import.meta.url)
          )

          worker.postMessage({
            file: action.file,
            outputFormat: action.to,
            fileName: action.file_name,
          })

          worker.onmessage = (event: MessageEvent<any>) => {
            const { url, fileName, success, error } = event.data

            if (success) {
              resolve({ url, fileName, success })
            } else {
              reject({ error, fileName })
            }
          }

          worker.onerror = (err) => reject(err)
        })
      }
    )

    // Wait for all conversions to complete
    try {
      const convertedFiles = await Promise.all(workerPromises)
      convertedFiles.forEach(({ url, fileName }) => {
        tmp_actions = tmp_actions.map((elt) =>
          elt.file_name === fileName
            ? { ...elt, is_converted: true, is_converting: false, url }
            : elt
        )
        setActions(tmp_actions)
      })
      setIsDone(true)
    } catch (error) {
      console.error("Error during file conversion:", error)
    } finally {
      setIsConverting(false)
    }
  }

  const handleUpload = (data: Array<any>): void => {
    handleExitHover()
    setFiles(data)
    const tmp: Action[] = []
    data.forEach((file: any) => {
      tmp.push({
        file_name: file.name,
        file_size: file.size,
        from: file.name.slice(((file.name.lastIndexOf(".") - 1) >>> 0) + 2),
        to: null,
        file_type: file.type,
        file,
        is_converted: false,
        is_converting: false,
        is_error: false,
      })
    })
    setActions(tmp)
  }

  const handleHover = (): void => setIsHover(true)
  const handleExitHover = (): void => setIsHover(false)

  const updateAction = (file_name: String, to: String) => {
    setActions(
      actions.map((action): Action => {
        if (action.file_name === file_name) {
          console.log("FOUND")
          return {
            ...action,
            to,
          }
        }

        return action
      })
    )
    checkIsReady()
  }

  // const checkIsReady = (): void => {
  //   let tmp_is_ready = true
  //   actions.forEach((action: Action) => {
  //     if (!action.to) tmp_is_ready = false
  //   })
  //   setIsReady(tmp_is_ready)
  // }
  const checkIsReady = (): void => {
    console.log("Checking if ready to convert...") // Add log to check when the function is called
    let tmp_is_ready = true
    actions.forEach((action: Action) => {
      if (!action.to) {
        console.log(`Action missing output format: ${action.file_name}`) // Log which file doesn't have an output format
        tmp_is_ready = false
      }
    })
    console.log("Is ready:", tmp_is_ready) // Log the final state of `is_ready`
    setIsReady(tmp_is_ready)
  }

  const deleteAction = (action: Action): void => {
    setActions(actions.filter((elt) => elt !== action))
    setFiles(files.filter((elt) => elt.name !== action.file_name))
  }

  useEffect(() => {
    console.log("Actions changed:", actions) // Log whenever actions are updated
    if (!actions.length) {
      console.log("No actions, resetting state.")
      setIsDone(false)
      setFiles([])
      setIsReady(false)
      setIsConverting(false)
    } else checkIsReady()
  }, [actions])

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const ffmpeg_response: FFmpeg = await FFmpegFactory.create()
    ffmpegRef.current = ffmpeg_response
    setIsLoaded(true)
  }

  // returns
  if (actions.length) {
    return (
      <div className="space-y-6">
        {actions.map((action: Action, i: any) => (
          <div
            key={i}
            className="w-full py-4 space-y-2 lg:py-0 relative cursor-pointer rounded-xl border h-fit lg:h-20 px-4 lg:px-10 flex flex-wrap lg:flex-nowrap items-center justify-between"
          >
            {!is_loaded && (
              <Skeleton className="h-full w-full -ml-10 cursor-progress absolute rounded-xl" />
            )}
            <div className="flex gap-4 items-center">
              <span className="text-2xl text-orange-600">
                {fileToIcon(action.file_type)}
              </span>
              <div className="flex items-center gap-1 w-96">
                <span className="text-md font-medium overflow-x-hidden">
                  {compressFileName(action.file_name)}
                </span>
                <span className="text-muted-foreground text-sm">
                  ({byteConvert(action.file_size)})
                </span>
              </div>
            </div>

            {action.is_error ? (
              <Badge variant="destructive" className="flex gap-2">
                <span>Error Converting File</span>
                <BiError />
              </Badge>
            ) : action.is_converted ? (
              <Badge variant="default" className="flex gap-2 bg-green-500">
                <span>Done</span>
                <MdDone />
              </Badge>
            ) : action.is_converting ? (
              <Badge variant="default" className="flex gap-2">
                <span>Converting</span>
                <span className="animate-spin">
                  <ImSpinner3 />
                </span>
              </Badge>
            ) : (
              <div className="text-muted-foreground text-md flex items-center gap-4">
                <span>Convert to</span>
                <Select
                  onValueChange={(value) => {
                    if (extensions.audio.includes(value)) {
                      setDefaultValues("audio")
                    } else if (extensions.video.includes(value)) {
                      setDefaultValues("video")
                    }
                    setSelected(value)
                    updateAction(action.file_name, value)
                  }}
                  value={selcted}
                >
                  <SelectTrigger className="w-32 outline-none focus:outline-none focus:ring-0 text-center text-muted-foreground bg-background text-md font-medium">
                    <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent className="h-fit">
                    {action.file_type.includes("image") && (
                      <div className="grid grid-cols-2 gap-2 w-fit">
                        {extensions.image.map((elt, i) => (
                          <div key={i} className="col-span-1 text-center">
                            <SelectItem value={elt} className="mx-auto">
                              {elt}
                            </SelectItem>
                          </div>
                        ))}
                      </div>
                    )}
                    {action.file_type.includes("video") && (
                      <Tabs defaultValue={defaultValues} className="w-full">
                        <TabsList className="w-full">
                          <TabsTrigger value="video" className="w-full">
                            Video
                          </TabsTrigger>
                          <TabsTrigger value="audio" className="w-full">
                            Audio
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="video">
                          <div className="grid grid-cols-3 gap-2 w-fit">
                            {extensions.video.map((elt, i) => (
                              <div key={i} className="col-span-1 text-center">
                                <SelectItem value={elt} className="mx-auto">
                                  {elt}
                                </SelectItem>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="audio">
                          <div className="grid grid-cols-3 gap-2 w-fit">
                            {extensions.audio.map((elt, i) => (
                              <div key={i} className="col-span-1 text-center">
                                <SelectItem value={elt} className="mx-auto">
                                  {elt}
                                </SelectItem>
                              </div>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    )}
                    {action.file_type.includes("audio") && (
                      <div className="grid grid-cols-2 gap-2 w-fit">
                        {extensions.audio.map((elt, i) => (
                          <div key={i} className="col-span-1 text-center">
                            <SelectItem value={elt} className="mx-auto">
                              {elt}
                            </SelectItem>
                          </div>
                        ))}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {action.is_converted ? (
              <Button variant="outline" onClick={() => download(action)}>
                Download
              </Button>
            ) : (
              <span
                onClick={() => deleteAction(action)}
                className="cursor-pointer hover:bg-muted rounded-full h-10 w-10 flex items-center justify-center text-2xl text-foreground"
              >
                <MdClose />
              </span>
            )}
          </div>
        ))}
        <div className="flex w-full justify-end">
          {is_done ? (
            <div className="space-y-4 w-fit">
              <Button
                size="lg"
                className="rounded-xl font-semibold relative py-4 text-md flex gap-2 items-center w-full"
                onClick={downloadAll}
              >
                {actions.length > 1 ? "Download All" : "Download"}
                <HiOutlineDownload />
              </Button>
              <Button
                size="lg"
                onClick={reset}
                variant="outline"
                className="rounded-xl"
              >
                Convert Another File(s)
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              disabled={!is_ready || is_converting}
              className="rounded-xl font-semibold relative py-4 text-md flex items-center w-44"
              onClick={convert}
            >
              {is_converting ? (
                <span className="animate-spin text-lg">
                  <ImSpinner3 />
                </span>
              ) : (
                <span>Convert Now</span>
              )}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <ReactDropzone
      onDrop={handleUpload}
      onDragEnter={handleHover}
      onDragLeave={handleExitHover}
      accept={accepted_files}
      onDropRejected={() => {
        handleExitHover()
        toast({
          variant: "destructive",
          title: "Error uploading your file(s)",
          description: "Allowed Files: Audio, Video and Images.",
          duration: 5000,
        })
      }}
      onError={() => {
        handleExitHover()
        toast({
          variant: "destructive",
          title: "Error uploading your file(s)",
          description: "Allowed Files: Audio, Video and Images.",
          duration: 5000,
        })
      }}
    >
      {({ getRootProps, getInputProps }) => (
        <div
          {...getRootProps()}
          className=" bg-background h-72 lg:h-80 xl:h-96 rounded-3xl shadow-sm border-secondary border-2 border-dashed cursor-pointer flex items-center justify-center"
        >
          <input {...getInputProps()} />
          <div className="space-y-4 text-foreground">
            {is_hover ? (
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
