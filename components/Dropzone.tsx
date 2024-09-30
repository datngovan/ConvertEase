"use client"

import ReactDropzone from "react-dropzone"

export default function Dropzone() {
  return (
    <ReactDropzone onDrop={(acceptedFiles) => console.log(acceptedFiles)}>
      {({ getRootProps, getInputProps }) => (
        <section>
          <div
            {...getRootProps()}
            className=" flex h-72 cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed border-secondary bg-background shadow-sm lg:h-80 xl:h-96"
          >
            <input {...getInputProps()} />
            <p>Drag 'n' drop some files here, or click to select files</p>
          </div>
        </section>
      )}
    </ReactDropzone>
  )
}
