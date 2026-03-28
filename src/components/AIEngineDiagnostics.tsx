"use client"

import { AIEngineDiagnosticResult } from "@/types"

const READINESS_STYLES = {
  strong: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-300",
  moderate: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300",
  weak: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-300",
}

const READINESS_LABELS = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
}

const ENGINE_DESCRIPTIONS: Record<string, string> = {
  ChatGPT:
    "Uses Bing index. Prefers FAQ schema, 40-60w extractable blocks, UGC signals, fresh content.",
  Gemini:
    "AI Overviews. Schema stack (Article+FAQ+Breadcrumb+Org) gives 2-3x citation boost.",
  Perplexity:
    "Most aggressive freshness penalty. Needs \u22653 outbound citations, FAQ schema, source attributions.",
  Bing: "Uses IndexNow for fast discovery. Prefers structured data, tables, recent content.",
}

export function AIEngineDiagnostics({
  diagnostics,
}: {
  diagnostics: AIEngineDiagnosticResult[]
}) {
  if (!diagnostics || diagnostics.length === 0) return null

  const avgScore = Math.round(
    diagnostics.reduce((sum, d) => sum + d.score, 0) / diagnostics.length
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AI Engine Readiness
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Avg: {avgScore}% — not scored in rubric
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {diagnostics.map((d) => (
          <div
            key={d.engine}
            className={`rounded-lg border p-4 ${READINESS_STYLES[d.readiness]}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">{d.engine}</h4>
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-semibold dark:bg-black/30">
                {READINESS_LABELS[d.readiness]} ({d.score}%)
              </span>
            </div>
            <p className="mb-3 text-xs opacity-75">
              {ENGINE_DESCRIPTIONS[d.engine]}
            </p>

            {d.signals.length > 0 && (
              <div className="mb-2">
                {d.signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <span className="mt-0.5 text-green-600 dark:text-green-400">{"\u2713"}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {d.gaps.length > 0 && (
              <div>
                {d.gaps.map((g, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <span className="mt-0.5 text-red-500 dark:text-red-400">{"\u2717"}</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        <strong>Cross-platform tip:</strong> FAQ schema, fresh{" "}
        <code className="rounded bg-gray-200 px-1 dark:bg-gray-700">dateModified</code>, and 3+ outbound citations to authoritative
        sources improve citation likelihood across all four engines.
      </div>
    </div>
  )
}
