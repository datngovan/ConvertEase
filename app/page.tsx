import Link from "next/link"

import { siteConfig } from "@/config/site"
import { buttonVariants } from "@/components/ui/button"
import Dropzone from "@/components/Dropzone"

export default function IndexPage() {
  return (
    <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
      <div className="flex max-w-[1200px] flex-col items-center gap-2">
        <h1 className="text-center text-3xl font-extrabold leading-tight tracking-tighter md:text-4xl">
          Free Unlimited File Converter
        </h1>
        <p className="max-w-[1000px] text-center text-lg text-muted-foreground">
          Unleash your creativity and potential with ConvertEase - The ultimate
          tool for unlimited and free multimedia convertion. Convert your
          images, audio, and videos effortlessly, without any ads and
          restrictions. Start now and evaluate your work and content.
        </p>
      </div>
      <Dropzone />
    </section>
  )
}
