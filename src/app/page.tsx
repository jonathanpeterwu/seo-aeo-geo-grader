"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AnalysisReport } from "@/types"
import { Suggestion } from "@/lib/suggestions"
import ReportDashboard from "@/components/ReportDashboard"
import { SuggestionsPanel } from "@/components/SuggestionsPanel"
import { AIEngineDiagnostics } from "@/components/AIEngineDiagnostics"

export default function Home() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestionCount, setSuggestionCount] = useState(0)
  const [currentPlan, setCurrentPlan] = useState("free")
  const [sessionId, setSessionId] = useState("")
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)

  useEffect(() => {
    let id = localStorage.getItem("grader-session-id")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("grader-session-id", id)
    }
    setSessionId(id)
  }, [])

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !sessionId) return

    let normalizedUrl = url.trim()
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "https://" + normalizedUrl
    }

    setLoading(true)
    setError(null)
    setReport(null)
    setSuggestions(null)

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, sessionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Analysis failed")
        return
      }

      setReport(data.report)
      setSuggestions(data.suggestions)
      setSuggestionCount(data.suggestionCount)
      setCreditsRemaining(data.creditsRemaining)
      setCurrentPlan(data.currentPlan)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Nav */}
      <div className="mb-6 flex items-center justify-between">
        <div />
        <Link
          href="/pricing"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Pricing &rarr;
        </Link>
      </div>

      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          SEO / AEO / GEO Grader
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          21-point weighted scoring across Search, Answer Engine, and Generative
          Engine optimization. Free for any home page.
        </p>
      </div>

      {/* URL Input */}
      <form onSubmit={handleAnalyze} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter a URL to grade (e.g. example.com)"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-lg shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Analyzing..." : "Grade"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
          <span>
            {creditsRemaining !== null
              ? creditsRemaining > 0
                ? `${creditsRemaining} page credit(s) remaining`
                : "Home pages are always free"
              : "Home page analysis is free"}
          </span>
          {currentPlan !== "free" && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {currentPlan === "site_pass"
                ? "Site Pass"
                : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
            </span>
          )}
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            <p className="text-gray-600">Fetching and analyzing page...</p>
            <p className="mt-1 text-sm text-gray-400">
              Checking robots.txt, sitemap, meta tags, schema, content...
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="space-y-6">
          <ReportDashboard report={report} />
          {report.aiEngineDiagnostics && (
            <AIEngineDiagnostics diagnostics={report.aiEngineDiagnostics} />
          )}
          <SuggestionsPanel
            suggestions={suggestions}
            suggestionCount={suggestionCount}
            isPaid={currentPlan !== "free"}
          />
        </div>
      )}

      {/* Rubric */}
      {!report && !loading && (
        <div className="mt-12 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Scoring Rubric — 21pt Weighted
          </h2>

          <div className="mb-6 grid grid-cols-4 gap-3 text-center text-sm">
            {[
              { grade: "A", range: "≥ 90%", pts: "≥19pt", color: "text-green-600 bg-green-50 border-green-200" },
              { grade: "B", range: "≥ 75%", pts: "≥16pt", color: "text-blue-600 bg-blue-50 border-blue-200" },
              { grade: "C", range: "≥ 58%", pts: "≥13pt", color: "text-amber-600 bg-amber-50 border-amber-200" },
              { grade: "D", range: "< 58%", pts: "<13pt", color: "text-red-600 bg-red-50 border-red-200" },
            ].map((g) => (
              <div
                key={g.grade}
                className={`rounded-lg border p-3 ${g.color}`}
              >
                <div className="text-2xl font-bold">{g.grade}</div>
                <div className="font-medium">{g.range}</div>
                <div className="text-xs opacity-75">{g.pts}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900">SEO — 7pt</h3>
              <p>Title (2), Meta description (2), robots.txt (2), XML Sitemap (1)</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AEO — 5pt</h3>
              <p>
                JSON-LD structured data (2), Open Graph tags (1),
                FAQ/Speakable schema (2, partial 1 if &lt;3 FAQs)
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">CTA — 1pt</h3>
              <p>Clear call-to-action present on page</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">GEO — 8pt</h3>
              <p>
                Links (3, tiered: ≥5/≥3/&gt;0), Clean copy (2),
                Content depth ≥1,200w (1), Statistics (1), H2 headings ≥3 (1)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
