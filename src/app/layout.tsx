import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SEO/AEO/GEO Grader — Free Website Analysis",
  description:
    "Grade your website across SEO, AEO, GEO, and AI Discovery with a 100-point weighted rubric. Free home page analysis with PDF reports.",
}

// Inline script to apply dark mode before React hydrates (no flash)
const darkModeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e) {}
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="min-h-screen">
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
