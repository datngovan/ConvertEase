import { Linkedin } from "lucide-react"

export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: "ConvertEase",
  description: "Front-end tool to simply without any sercurity problems",
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
    {
      title: "Policy",
      href: "/privacy-policy",
    },
  ],
  links: {
    Linkedin: "https://www.linkedin.com/in/dat-ngo-517a5b222/",
    github: "https://github.com/datngovan",
  },
}
