"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AnalysisReport } from "@/types"
import { Suggestion } from "@/lib/suggestions"
import ReportDashboard from "@/components/ReportDashboard"
import { SuggestionsPanel } from "@/components/SuggestionsPanel"
import { AIEngineDiagnostics } from "@/components/AIEngineDiagnostics"
import { AIDiscoveryPanel } from "@/components/AIDiscoveryPanel"

function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    localStorage.setItem("theme", next ? "dark" : "light")
  }

  return (
    <button
      onClick={toggle}
      className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
      aria-label="Toggle dark mode"
    >
      {dark ? "\u2600\uFE0F Light" : "\uD83C\uDF19 Dark"}
    </button>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  )
}

function HomeContent() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [suggestionCount, setSuggestionCount] = useState(0)
  const [currentPlan, setCurrentPlan] = useState("free")
  const [sessionId, setSessionId] = useState("")
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    let id = localStorage.getItem("grader-session-id")
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem("grader-session-id", id)
    }
    setSessionId(id)

    const upgraded = searchParams.get("upgraded")
    if (upgraded) {
      const planNames: Record<string, string> = {
        site_pass: "Full Site Pass",
        pro: "Pro",
        agency: "Agency",
      }
      setUpgradeMessage(
        `Payment successful! You're now on the ${planNames[upgraded] || upgraded} plan. Enter a URL to start grading.`
      )
      setCurrentPlan(upgraded)
      window.history.replaceState({}, "", "/")
    }
  }, [searchParams])

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
        <ThemeToggle />
        <Link
          href="/pricing"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Pricing &rarr;
        </Link>
      </div>

      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          SEO / AEO / GEO Grader
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
          100-point weighted scoring across Search, Answer Engine, Generative
          Engine, and AI Discovery optimization. Free for any home page.
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
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-lg shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-800"
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
        <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            {creditsRemaining !== null
              ? creditsRemaining > 0
                ? `${creditsRemaining} page credit(s) remaining`
                : "Home pages are always free"
              : "Home page analysis is free"}
          </span>
          {currentPlan !== "free" && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
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
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            <p className="text-gray-600 dark:text-gray-400">Fetching and analyzing page...</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
              Checking robots.txt, sitemap, meta tags, schema, content...
            </p>
          </div>
        </div>
      )}

      {/* Upgrade success */}
      {upgradeMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {upgradeMessage}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="space-y-6">
          <ReportDashboard report={report} />
          {report.aiDiscovery && (
            <AIDiscoveryPanel discovery={report.aiDiscovery} />
          )}
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
        <div className="mt-12 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-50">
            Scoring Rubric — 100pt Weighted
          </h2>

          <div className="mb-6 grid grid-cols-4 gap-3 text-center text-sm">
            {[
              { grade: "A", range: "≥ 90%", pts: "≥90pt", color: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800" },
              { grade: "B", range: "≥ 75%", pts: "≥75pt", color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800" },
              { grade: "C", range: "≥ 58%", pts: "≥58pt", color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800" },
              { grade: "D", range: "< 58%", pts: "<58pt", color: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800" },
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

          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">SEO — 25pt</h3>
              <p>Title (5), Meta description (5), Canonical URL (3), robots.txt (5), XML Sitemap (4), Sitemap freshness (3 tiered)</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">AEO — 25pt</h3>
              <p>
                JSON-LD (5), Open Graph (3), FAQ/Speakable (5 tiered),
                Schema stack depth (5), Content freshness (4 tiered), Outbound citations (3 tiered)
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">CTA — 5pt</h3>
              <p>Clear call-to-action present on page</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">GEO — 25pt</h3>
              <p>
                Links (7 tiered), Clean copy (5),
                Content depth (5 tiered), Statistics (4 tiered), H2 headings (4 tiered)
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Discovery — 20pt</h3>
              <p>
                AI bot access (6 tiered), llms.txt (5 tiered), llms-full.txt (4 tiered),
                security.txt (2), Extractable blocks (3 tiered)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
