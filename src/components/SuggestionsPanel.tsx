"use client"

import Link from "next/link"
import { Suggestion } from "@/lib/suggestions"

const PRIORITY_STYLES = {
  high: "bg-red-50 border-red-200 text-red-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-blue-50 border-blue-200 text-blue-800",
}

const EFFORT_LABELS = {
  quick: "Quick fix",
  moderate: "Moderate effort",
  significant: "Significant effort",
}

export function SuggestionsPanel({
  suggestions,
  suggestionCount,
  isPaid,
}: {
  suggestions: Suggestion[] | null
  suggestionCount: number
  isPaid: boolean
}) {
  if (suggestionCount === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5">
        <h3 className="text-lg font-semibold text-green-800">
          Perfect Score — No Suggestions
        </h3>
        <p className="mt-1 text-sm text-green-700">
          All checks passed. Your page is fully optimized for search, answer
          engines, and generative engines.
        </p>
      </div>
    )
  }

  // Free users see the teaser
  if (!isPaid || !suggestions) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Suggested Fixes
          </h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {suggestionCount} improvement{suggestionCount !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          We found {suggestionCount} actionable improvement
          {suggestionCount !== 1 ? "s" : ""} for this page. Upgrade to see
          prioritized fix suggestions with code examples.
        </p>

        {/* Blurred preview */}
        <div className="relative mt-4">
          <div className="space-y-2 blur-sm select-none" aria-hidden="true">
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <div className="font-medium">High priority fix...</div>
              <div className="text-sm text-gray-600">
                Detailed suggestion with code examples and impact...
              </div>
            </div>
            <div className="rounded border border-amber-200 bg-amber-50 p-3">
              <div className="font-medium">Medium priority fix...</div>
              <div className="text-sm text-gray-600">
                Step-by-step instructions for improvement...
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Link
              href="/pricing"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700"
            >
              Unlock Suggestions — $99
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Paid users see full suggestions
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Suggested Fixes
        </h3>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          {suggestions.length} improvement{suggestions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-4 space-y-3">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className={`rounded-lg border p-4 ${PRIORITY_STYLES[s.priority]}`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{s.title}</h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded bg-white/60 px-1.5 py-0.5">
                  {s.priority}
                </span>
                <span className="rounded bg-white/60 px-1.5 py-0.5">
                  {EFFORT_LABELS[s.effort]}
                </span>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm opacity-90">
              {s.description}
            </p>
            <p className="mt-2 text-xs font-medium opacity-75">{s.impact}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
