"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { SiteRecord } from "@/types"

const gradeColor: Record<string, string> = {
  A: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800",
  B: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
  C: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800",
  D: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800",
}

export default function DomainDetailPage() {
  const params = useParams()
  const domain = params.domain as string
  const [site, setSite] = useState<SiteRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/sites/${encodeURIComponent(domain)}`)
        if (!res.ok) {
          setError("Domain not found in index.")
          return
        }
        const data = await res.json()
        setSite(data.site)
      } catch {
        setError("Failed to load domain data.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [domain])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (error || !site) {
    return (
      <div>
        <Link
          href="/sites"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Back to Directory
        </Link>
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error || "Domain not found."}
        </div>
      </div>
    )
  }

  const latest = site.latestSnapshot
  const history = [...site.history].reverse()

  return (
    <div>
      <Link
        href="/sites"
        className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        &larr; Back to Directory
      </Link>

      {/* Header */}
      <div className="mt-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            {site.domain}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            First scanned {new Date(site.firstSeen).toLocaleDateString()} &middot;{" "}
            {site.analyzeCount} scan(s) total
          </p>
        </div>
        <div className="text-right">
          <span
            className={`inline-block rounded-lg border px-4 py-2 text-3xl font-bold ${gradeColor[latest.overallGrade]}`}
          >
            {latest.overallGrade}
          </span>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {latest.overallScore}/{latest.overallMaxScore} ({latest.overallPercentage}%)
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Latest Category Scores
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {latest.categoryScores.map((cat) => (
            <div
              key={cat.category}
              className={`rounded-lg border p-3 text-center ${gradeColor[cat.grade]}`}
            >
              <div className="text-xs font-medium opacity-75">
                {cat.category}
              </div>
              <div className="text-xl font-bold">{cat.grade}</div>
              <div className="text-xs">
                {cat.score}/{cat.maxScore} ({cat.percentage}%)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score History */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-50">
          Score History
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">URL</th>
                {["SEO", "AEO", "CTA", "GEO", "AI_DISCOVERY"].map((cat) => (
                  <th key={cat} className="px-4 py-3 font-medium">
                    {cat === "AI_DISCOVERY" ? "AI Disc." : cat}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {history.map((snap, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(snap.analyzedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-bold ${gradeColor[snap.overallGrade]}`}
                    >
                      {snap.overallGrade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {snap.overallScore}/{snap.overallMaxScore} (
                    {snap.overallPercentage}%)
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-500 dark:text-gray-400">
                    {snap.url}
                  </td>
                  {["SEO", "AEO", "CTA", "GEO", "AI_DISCOVERY"].map((cat) => {
                    const cs = snap.categoryScores.find(
                      (c) => c.category === cat
                    )
                    return (
                      <td
                        key={cat}
                        className="px-4 py-3 text-gray-600 dark:text-gray-400"
                      >
                        {cs ? `${cs.score}/${cs.maxScore}` : "--"}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Re-analyze CTA */}
      <div className="mt-8 text-center">
        <Link
          href={`/?url=${encodeURIComponent(`https://${site.domain}`)}`}
          className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Re-analyze {site.domain}
        </Link>
      </div>
    </div>
  )
}
