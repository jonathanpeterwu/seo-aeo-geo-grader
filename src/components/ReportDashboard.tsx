"use client"

import { useState } from "react"
import { AnalysisReport } from "@/types"

const CATEGORY_LABELS: Record<string, string> = {
  SEO: "SEO",
  AEO: "AEO",
  CTA: "CTA",
  GEO: "GEO",
  AI_DISCOVERY: "AI Discovery",
}

const GRADE_STYLES: Record<string, string> = {
  A: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800",
  B: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
  C: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800",
  D: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800",
}

export default function ReportDashboard({
  report,
}: {
  report: AnalysisReport
}) {
  const [email, setEmail] = useState("")
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  async function handleDownloadPdf() {
    setDownloading(true)
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      })
      if (!res.ok) throw new Error("PDF generation failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `seo-aeo-geo-report-${new URL(report.url).hostname}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert("Failed to download PDF")
    } finally {
      setDownloading(false)
    }
  }

  async function handleEmailReport(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEmailSending(true)
    setEmailStatus(null)
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send")
      }
      setEmailStatus("Report sent!")
      setEmail("")
    } catch (err) {
      setEmailStatus(
        err instanceof Error ? err.message : "Failed to send email"
      )
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Overall Grade */}
      <div className="text-center">
        <div
          className={`mx-auto inline-flex items-center gap-4 rounded-xl border-2 px-8 py-6 ${GRADE_STYLES[report.overallGrade]}`}
        >
          <span className="text-6xl font-bold">{report.overallGrade}</span>
          <div className="text-left">
            <div className="text-3xl font-semibold">
              {report.overallPercentage}%
            </div>
            <div className="text-sm opacity-75">
              {report.overallScore}/{report.overallMaxScore} points
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500 break-all dark:text-gray-400">{report.url}</p>
      </div>

      {/* Category Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {report.categories.map((cat) => (
          <div
            key={cat.category}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {CATEGORY_LABELS[cat.category] ?? cat.category}
                <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                  {cat.score}/{cat.maxScore}pt
                </span>
              </h3>
              <span
                className={`rounded-md border px-2 py-1 text-sm font-bold ${GRADE_STYLES[cat.grade]}`}
              >
                {cat.grade} ({cat.percentage}%)
              </span>
            </div>
            <div className="space-y-2">
              {cat.checks.map((check) => {
                const isFull = check.score === check.maxScore
                const isPartial =
                  check.score > 0 && check.score < check.maxScore
                return (
                  <div key={check.id} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 text-sm font-bold ${
                        isFull
                          ? "text-green-500"
                          : isPartial
                            ? "text-amber-500"
                            : "text-red-500"
                      }`}
                    >
                      {isFull ? "\u2713" : isPartial ? "\u25CB" : "\u2717"}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {check.name}
                        </span>
                        <span
                          className={`ml-2 text-xs font-semibold ${
                            isFull
                              ? "text-green-600 dark:text-green-400"
                              : isPartial
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-400"
                          }`}
                        >
                          {check.score}/{check.maxScore}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {check.details}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Export Report
        </h3>
        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="rounded-lg bg-gray-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            {downloading ? "Generating..." : "Download PDF"}
          </button>

          <form onSubmit={handleEmailReport} className="flex flex-1 gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email PDF report to..."
              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-800"
            />
            <button
              type="submit"
              disabled={emailSending || !email.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {emailSending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
        {emailStatus && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{emailStatus}</p>
        )}
      </div>
    </div>
  )
}
