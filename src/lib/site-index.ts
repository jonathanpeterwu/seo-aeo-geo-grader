import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import {
  AnalysisReport,
  SiteRecord,
  SiteSnapshot,
  SiteIndexSummary,
} from "@/types"

const DATA_DIR = join(process.cwd(), ".data")
const INDEX_FILE = join(DATA_DIR, "site-index.json")
const MAX_HISTORY = 50 // keep last 50 snapshots per domain

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function readIndex(): Record<string, SiteRecord> {
  ensureDataDir()
  if (!existsSync(INDEX_FILE)) return {}
  try {
    const raw = readFileSync(INDEX_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeIndex(index: Record<string, SiteRecord>) {
  ensureDataDir()
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8")
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function reportToSnapshot(report: AnalysisReport): SiteSnapshot {
  return {
    url: report.url,
    analyzedAt: report.analyzedAt,
    overallScore: report.overallScore,
    overallMaxScore: report.overallMaxScore,
    overallPercentage: report.overallPercentage,
    overallGrade: report.overallGrade,
    categoryScores: report.categories.map((c) => ({
      category: c.category,
      score: c.score,
      maxScore: c.maxScore,
      percentage: c.percentage,
      grade: c.grade,
    })),
  }
}

export function indexReport(report: AnalysisReport): SiteRecord {
  const index = readIndex()
  const domain = extractDomain(report.url)
  const snapshot = reportToSnapshot(report)
  const now = report.analyzedAt

  const existing = index[domain]
  if (existing) {
    existing.lastSeen = now
    existing.analyzeCount++
    existing.latestSnapshot = snapshot
    existing.history.push(snapshot)
    // Trim history to max
    if (existing.history.length > MAX_HISTORY) {
      existing.history = existing.history.slice(-MAX_HISTORY)
    }
    index[domain] = existing
  } else {
    index[domain] = {
      domain,
      firstSeen: now,
      lastSeen: now,
      analyzeCount: 1,
      latestSnapshot: snapshot,
      history: [snapshot],
    }
  }

  writeIndex(index)
  return index[domain]
}

export function getSiteRecord(domain: string): SiteRecord | null {
  const index = readIndex()
  const normalized = domain.replace(/^www\./, "")
  return index[normalized] || null
}

export function listSites(options?: {
  sortBy?: "lastSeen" | "score" | "domain" | "analyzeCount"
  order?: "asc" | "desc"
  limit?: number
  offset?: number
  search?: string
}): { sites: SiteIndexSummary[]; total: number } {
  const index = readIndex()
  let records = Object.values(index)

  // Search filter
  if (options?.search) {
    const q = options.search.toLowerCase()
    records = records.filter((r) => r.domain.toLowerCase().includes(q))
  }

  // Sort
  const sortBy = options?.sortBy || "lastSeen"
  const order = options?.order || "desc"
  records.sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case "score":
        cmp = a.latestSnapshot.overallPercentage - b.latestSnapshot.overallPercentage
        break
      case "domain":
        cmp = a.domain.localeCompare(b.domain)
        break
      case "analyzeCount":
        cmp = a.analyzeCount - b.analyzeCount
        break
      case "lastSeen":
      default:
        cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()
    }
    return order === "desc" ? -cmp : cmp
  })

  const total = records.length
  const offset = options?.offset || 0
  const limit = options?.limit || 50
  const page = records.slice(offset, offset + limit)

  const sites: SiteIndexSummary[] = page.map((r) => {
    const prev = r.history.length >= 2 ? r.history[r.history.length - 2] : null
    return {
      domain: r.domain,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      analyzeCount: r.analyzeCount,
      latestGrade: r.latestSnapshot.overallGrade,
      latestScore: r.latestSnapshot.overallScore,
      latestPercentage: r.latestSnapshot.overallPercentage,
      scoreChange: prev
        ? r.latestSnapshot.overallPercentage - prev.overallPercentage
        : null,
    }
  })

  return { sites, total }
}

export function getSiteCount(): number {
  const index = readIndex()
  return Object.keys(index).length
}
