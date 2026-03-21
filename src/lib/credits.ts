interface CreditEntry {
  used: number
  limit: number
  analyzedUrls: string[]
}

const store = new Map<string, CreditEntry>()

const FREE_LIMIT = 1

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.origin + parsed.pathname.replace(/\/+$/, "")
  } catch {
    return url
  }
}

function isHomePage(url: string): boolean {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, "")
    return path === "" || path === "/"
  } catch {
    return false
  }
}

function getEntry(sessionId: string): CreditEntry {
  if (!store.has(sessionId)) {
    store.set(sessionId, { used: 0, limit: FREE_LIMIT, analyzedUrls: [] })
  }
  return store.get(sessionId)!
}

export function canAnalyze(sessionId: string, url: string): boolean {
  if (isHomePage(url)) return true

  const entry = getEntry(sessionId)
  const normalized = normalizeUrl(url)

  // Already analyzed this URL in this session — allow re-run
  if (entry.analyzedUrls.includes(normalized)) return true

  return entry.used < entry.limit
}

export function consumeCredit(sessionId: string, url: string): void {
  if (isHomePage(url)) return

  const entry = getEntry(sessionId)
  const normalized = normalizeUrl(url)

  if (!entry.analyzedUrls.includes(normalized)) {
    entry.used++
    entry.analyzedUrls.push(normalized)
  }
}

export function getRemaining(sessionId: string): number {
  const entry = getEntry(sessionId)
  return Math.max(0, entry.limit - entry.used)
}

export function isHomePageUrl(url: string): boolean {
  return isHomePage(url)
}
