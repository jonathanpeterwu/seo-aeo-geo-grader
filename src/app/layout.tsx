import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SEO/AEO/GEO Grader — Free Website Analysis",
  description:
    "Grade your website across SEO, AEO, and GEO with 12 automated checks. Free home page analysis with PDF reports.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
