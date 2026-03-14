import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import * as React from "react"

const Toaster = ({ ...props }: ToasterProps) => {
  // Detect theme from document class (set by ThemeContext)
  const [theme, setTheme] = React.useState<"light" | "dark">("light")
  
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "oklch(0.22 0.06 155)",
          "--success-border": "oklch(0.42 0.14 162 / 60%)",
          "--success-text": "oklch(0.92 0.08 155)",
          "--error-bg": "oklch(0.22 0.06 20)",
          "--error-border": "oklch(0.55 0.18 20 / 60%)",
          "--error-text": "oklch(0.92 0.08 20)",
          "--info-bg": "oklch(0.22 0.04 240)",
          "--info-border": "oklch(0.50 0.12 240 / 60%)",
          "--info-text": "oklch(0.92 0.04 240)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
