import { JetBrains_Mono as FontMono, Inter as FontSans } from "next/font/google"

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  preload: false, // Prevent fetching during build
})

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
  preload: false, // Prevent fetching during build
})
