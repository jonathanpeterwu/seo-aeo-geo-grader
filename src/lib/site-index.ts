import {
  AnalysisReport,
  SiteRecord,
  SiteSnapshot,
  SiteIndexSummary,
} from "@/types"

/* ─── D1 Database Interface ─── */

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(col?: string): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

/* ─── In-memory fallback for local dev ─── */

interface MemRow {
  [key: string]: unknown
}

class MemPreparedStatement implements D1PreparedStatement {
  private db: MemDB
  private sql: string
  private params: unknown[] = []

  constructor(db: MemDB, sql: string) {
    this.db = db
    this.sql = sql
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.params = values
    return this
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.all<T>()
    return result.results[0] || null
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    const results = this.db.execute<T>(this.sql, this.params)
    return { results, success: true, meta: {} }
  }

  async run(): Promise<D1Result> {
    this.db.execute(this.sql, this.params)
    return { results: [], success: true, meta: {} }
  }
}

class MemDB implements D1Database {
  private sites: Map<string, MemRow> = new Map()
  private snapshots: MemRow[] = []
  private nextId = 1

  prepare(query: string): D1PreparedStatement {
    return new MemPreparedStatement(this, query)
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = []
    for (const stmt of statements) {
      results.push(await stmt.all<T>() as D1Result<T>)
    }
    return results
  }

  execute<T = MemRow>(sql: string, params: unknown[]): T[] {
    const trimmed = sql.trim().toUpperCase()

    if (trimmed.startsWith("INSERT INTO SITES")) {
      return this.insertSite(params) as T[]
    }
    if (trimmed.startsWith("UPDATE SITES")) {
      return this.updateSite(params) as T[]
    }
    if (trimmed.startsWith("INSERT INTO SNAPSHOTS")) {
      return this.insertSnapshot(params) as T[]
    }
    if (trimmed.startsWith("SELECT") && trimmed.includes("FROM SITES") && trimmed.includes("WHERE DOMAIN")) {
      return this.selectSite(params) as T[]
    }
    if (trimmed.startsWith("SELECT") && trimmed.includes("FROM SNAPSHOTS")) {
      return this.selectSnapshots(params) as T[]
    }
    if (trimmed.startsWith("SELECT COUNT")) {
      return this.countSites(sql, params) as T[]
    }
    if (trimmed.startsWith("SELECT") && trimmed.includes("FROM SITES")) {
      return this.selectSites(sql, params) as T[]
    }
    if (trimmed.startsWith("DELETE FROM SNAPSHOTS")) {
      return this.trimSnapshots(params) as T[]
    }
    return []
  }

  private insertSite(params: unknown[]): MemRow[] {
    const [domain, firstSeen, lastSeen, count] = params as string[]
    this.sites.set(domain as string, {
      domain, first_seen: firstSeen, last_seen: lastSeen, analyze_count: count
    })
    return []
  }

  private updateSite(params: unknown[]): MemRow[] {
    const [lastSeen, count, domain] = params as [string, number, string]
    const site = this.sites.get(domain)
    if (site) {
      site.last_seen = lastSeen
      site.analyze_count = count
    }
    return []
  }

  private insertSnapshot(params: unknown[]): MemRow[] {
    const [domain, url, analyzedAt, score, maxScore, pct, grade, cats] = params
    this.snapshots.push({
      id: this.nextId++, domain, url, analyzed_at: analyzedAt,
      overall_score: score, overall_max_score: maxScore,
      overall_percentage: pct, overall_grade: grade, category_scores: cats
    })
    return []
  }

  private selectSite(params: unknown[]): MemRow[] {
    const site = this.sites.get(params[0] as string)
    return site ? [site] : []
  }

  private selectSnapshots(params: unknown[]): MemRow[] {
    const domain = params[0] as string
    return this.snapshots
      .filter((s) => s.domain === domain)
      .sort((a, b) => String(a.analyzed_at).localeCompare(String(b.analyzed_at)))
      .slice(-(params[1] as number || 50))
  }

  private countSites(sql: string, params: unknown[]): MemRow[] {
    if (params.length > 0) {
      const q = `%${(params[0] as string).toLowerCase()}%`
      const count = [...this.sites.values()].filter(
        (s) => (s.domain as string).toLowerCase().includes(q.replace(/%/g, ""))
      ).length
      return [{ count }]
    }
    return [{ count: this.sites.size }]
  }

  private selectSites(sql: string, params: unknown[]): MemRow[] {
    let results = [...this.sites.values()]

    // Search filter
    if (sql.toUpperCase().includes("WHERE DOMAIN LIKE")) {
      const q = (params[0] as string).replace(/%/g, "").toLowerCase()
      results = results.filter((s) => (s.domain as string).toLowerCase().includes(q))
      params = params.slice(1)
    }

    // Sort (parsed from SQL ORDER BY)
    const orderMatch = sql.match(/ORDER BY (\w+)\s+(ASC|DESC)/i)
    if (orderMatch) {
      const [, col, dir] = orderMatch
      results.sort((a, b) => {
        const va = a[col] as string | number
        const vb = b[col] as string | number
        const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)
        return dir.toUpperCase() === "DESC" ? -cmp : cmp
      })
    }

    // Pagination
    const limitMatch = sql.match(/LIMIT (\?)\s+OFFSET (\?)/i)
    if (limitMatch) {
      const limit = params[params.length - 2] as number
      const offset = params[params.length - 1] as number
      results = results.slice(offset, offset + limit)
    }

    return results
  }

  private trimSnapshots(params: unknown[]): MemRow[] {
    const [domain, keepCount] = params as [string, number]
    const domainSnaps = this.snapshots.filter((s) => s.domain === domain)
    if (domainSnaps.length > keepCount) {
      const cutoff = domainSnaps[domainSnaps.length - keepCount].id as number
      this.snapshots = this.snapshots.filter(
        (s) => s.domain !== domain || (s.id as number) >= cutoff
      )
    }
    return []
  }
}

/* ─── Singleton in-memory DB for local dev ─── */

let memDb: MemDB | null = null
function getMemDb(): D1Database {
  if (!memDb) memDb = new MemDB()
  return memDb
}

/* ─── DB accessor ─── */

export function getDb(env?: { DB?: D1Database }): D1Database {
  // Production: use Cloudflare D1 binding
  if (env?.DB) return env.DB
  // Local dev: use in-memory fallback
  return getMemDb()
}

/* ─── Helpers ─── */

const MAX_HISTORY = 50

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

/* ─── Public API ─── */

export async function indexReport(
  report: AnalysisReport,
  db: D1Database
): Promise<SiteRecord> {
  const domain = extractDomain(report.url)
  const snapshot = reportToSnapshot(report)
  const now = report.analyzedAt

  // Check if domain exists
  const existing = await db
    .prepare("SELECT domain, first_seen, last_seen, analyze_count FROM sites WHERE domain = ?")
    .bind(domain)
    .first<{ domain: string; first_seen: string; last_seen: string; analyze_count: number }>()

  if (existing) {
    // Update existing site
    await db
      .prepare("UPDATE sites SET last_seen = ?, analyze_count = ? WHERE domain = ?")
      .bind(now, existing.analyze_count + 1, domain)
      .run()
  } else {
    // Insert new site
    await db
      .prepare("INSERT INTO sites (domain, first_seen, last_seen, analyze_count) VALUES (?, ?, ?, ?)")
      .bind(domain, now, now, 1)
      .run()
  }

  // Insert snapshot
  await db
    .prepare(
      "INSERT INTO snapshots (domain, url, analyzed_at, overall_score, overall_max_score, overall_percentage, overall_grade, category_scores) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      domain,
      snapshot.url,
      snapshot.analyzedAt,
      snapshot.overallScore,
      snapshot.overallMaxScore,
      snapshot.overallPercentage,
      snapshot.overallGrade,
      JSON.stringify(snapshot.categoryScores)
    )
    .run()

  // Trim old snapshots beyond MAX_HISTORY
  await db
    .prepare(
      "DELETE FROM snapshots WHERE domain = ? AND id NOT IN (SELECT id FROM snapshots WHERE domain = ? ORDER BY analyzed_at DESC LIMIT ?)"
    )
    .bind(domain, domain, MAX_HISTORY)
    .run()

  // Return the full record
  return (await getSiteRecord(domain, db))!
}

export async function getSiteRecord(
  domain: string,
  db: D1Database
): Promise<SiteRecord | null> {
  const normalized = domain.replace(/^www\./, "")

  const site = await db
    .prepare("SELECT domain, first_seen, last_seen, analyze_count FROM sites WHERE domain = ?")
    .bind(normalized)
    .first<{ domain: string; first_seen: string; last_seen: string; analyze_count: number }>()

  if (!site) return null

  const snapshotRows = await db
    .prepare(
      "SELECT url, analyzed_at, overall_score, overall_max_score, overall_percentage, overall_grade, category_scores FROM snapshots WHERE domain = ? ORDER BY analyzed_at ASC LIMIT ?"
    )
    .bind(normalized, MAX_HISTORY)
    .all<{
      url: string
      analyzed_at: string
      overall_score: number
      overall_max_score: number
      overall_percentage: number
      overall_grade: string
      category_scores: string
    }>()

  const history: SiteSnapshot[] = snapshotRows.results.map((row) => ({
    url: row.url,
    analyzedAt: row.analyzed_at,
    overallScore: row.overall_score,
    overallMaxScore: row.overall_max_score,
    overallPercentage: row.overall_percentage,
    overallGrade: row.overall_grade as SiteSnapshot["overallGrade"],
    categoryScores: JSON.parse(row.category_scores),
  }))

  const latestSnapshot = history[history.length - 1]

  return {
    domain: site.domain,
    firstSeen: site.first_seen,
    lastSeen: site.last_seen,
    analyzeCount: site.analyze_count,
    latestSnapshot,
    history,
  }
}

export async function listSites(
  db: D1Database,
  options?: {
    sortBy?: "lastSeen" | "score" | "domain" | "analyzeCount"
    order?: "asc" | "desc"
    limit?: number
    offset?: number
    search?: string
  }
): Promise<{ sites: SiteIndexSummary[]; total: number }> {
  const sortBy = options?.sortBy || "lastSeen"
  const order = options?.order || "desc"
  const limit = options?.limit || 50
  const offset = options?.offset || 0

  // Map sort fields to SQL columns
  const sortColumn: Record<string, string> = {
    lastSeen: "last_seen",
    domain: "domain",
    analyzeCount: "analyze_count",
    score: "last_seen", // score sort needs join; fallback to last_seen
  }
  const col = sortColumn[sortBy] || "last_seen"
  const dir = order.toUpperCase()

  const binds: unknown[] = []
  let whereClause = ""

  if (options?.search) {
    whereClause = "WHERE domain LIKE ?"
    binds.push(`%${options.search.toLowerCase()}%`)
  }

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM sites ${whereClause}`)
    .bind(...binds)
    .first<{ count: number }>()
  const total = countResult?.count || 0

  // Get paginated results
  const rows = await db
    .prepare(
      `SELECT domain, first_seen, last_seen, analyze_count FROM sites ${whereClause} ORDER BY ${col} ${dir} LIMIT ? OFFSET ?`
    )
    .bind(...binds, limit, offset)
    .all<{ domain: string; first_seen: string; last_seen: string; analyze_count: number }>()

  // For each site, get latest 2 snapshots to compute trend
  const sites: SiteIndexSummary[] = await Promise.all(
    rows.results.map(async (row) => {
      const snaps = await db
        .prepare(
          "SELECT overall_score, overall_percentage, overall_grade FROM snapshots WHERE domain = ? ORDER BY analyzed_at DESC LIMIT 2"
        )
        .bind(row.domain)
        .all<{ overall_score: number; overall_percentage: number; overall_grade: string }>()

      const latest = snaps.results[0]
      const prev = snaps.results[1] || null

      return {
        domain: row.domain,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
        analyzeCount: row.analyze_count,
        latestGrade: (latest?.overall_grade || "D") as SiteIndexSummary["latestGrade"],
        latestScore: latest?.overall_score || 0,
        latestPercentage: latest?.overall_percentage || 0,
        scoreChange: prev
          ? (latest?.overall_percentage || 0) - prev.overall_percentage
          : null,
      }
    })
  )

  // Re-sort by score if needed (can't do in SQL without a join)
  if (sortBy === "score") {
    sites.sort((a, b) => {
      const cmp = a.latestPercentage - b.latestPercentage
      return order === "desc" ? -cmp : cmp
    })
  }

  return { sites, total }
}

export async function getSiteCount(db: D1Database): Promise<number> {
  const result = await db
    .prepare("SELECT COUNT(*) as count FROM sites")
    .first<{ count: number }>()
  return result?.count || 0
}
