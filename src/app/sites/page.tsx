"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { SiteIndexSummary } from "@/types"

const gradeColor: Record<string, string> = {
  A: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950 dark:border-green-800",
  B: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950 dark:border-blue-800",
  C: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800",
  D: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-800",
}

type SortField = "lastSeen" | "score" | "domain" | "analyzeCount"

export default function SitesPage() {
  const [sites, setSites] = useState<SiteIndexSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalIndexed, setTotalIndexed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<SortField>("lastSeen")
  const [order, setOrder] = useState<"asc" | "desc">("desc")
  const [offset, setOffset] = useState(0)
  const limit = 25

  const fetchSites = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      sortBy,
      order,
      limit: String(limit),
      offset: String(offset),
    })
    if (search) params.set("search", search)

    try {
      const res = await fetch(`/api/sites?${params}`)
      const data = await res.json()
      setSites(data.sites)
      setTotal(data.total)
      setTotalIndexed(data.totalIndexed)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [sortBy, order, offset, search])

  useEffect(() => {
    fetchSites()
  }, [fetchSites])

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setOrder(order === "desc" ? "asc" : "desc")
    } else {
      setSortBy(field)
      setOrder("desc")
    }
    setOffset(0)
  }

  function sortArrow(field: SortField) {
    if (sortBy !== field) return ""
    return order === "desc" ? " \u2193" : " \u2191"
  }

  const hasNext = offset + limit < total
  const hasPrev = offset > 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Back to Grader
        </Link>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {totalIndexed} domain(s) indexed
        </span>
      </div>

      <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
        Site Directory
      </h1>
      <p className="mb-6 text-gray-600 dark:text-gray-400">
        Every domain analyzed by the grader, with score history and trends.
      </p>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
          placeholder="Search domains..."
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-blue-800"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <tr>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => handleSort("domain")}
              >
                Domain{sortArrow("domain")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => handleSort("score")}
              >
                Grade{sortArrow("score")}
              </th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Trend</th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => handleSort("analyzeCount")}
              >
                Scans{sortArrow("analyzeCount")}
              </th>
              <th
                className="cursor-pointer px-4 py-3 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => handleSort("lastSeen")}
              >
                Last Scanned{sortArrow("lastSeen")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  Loading...
                </td>
              </tr>
            ) : sites.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  {search
                    ? "No domains match your search."
                    : "No domains indexed yet. Grade a URL to get started."}
                </td>
              </tr>
            ) : (
              sites.map((site) => (
                <tr
                  key={site.domain}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sites/${site.domain}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {site.domain}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-xs font-bold ${gradeColor[site.latestGrade]}`}
                    >
                      {site.latestGrade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {site.latestScore}/{100} ({site.latestPercentage}%)
                  </td>
                  <td className="px-4 py-3">
                    {site.scoreChange !== null ? (
                      <span
                        className={
                          site.scoreChange > 0
                            ? "text-green-600 dark:text-green-400"
                            : site.scoreChange < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-400"
                        }
                      >
                        {site.scoreChange > 0 ? "+" : ""}
                        {site.scoreChange}%
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {site.analyzeCount}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(site.lastSeen).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={!hasPrev}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={!hasNext}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
