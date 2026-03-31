-- Site Index Schema for Cloudflare D1
-- Stores all analyzed domains with score history

CREATE TABLE IF NOT EXISTS sites (
  domain        TEXT PRIMARY KEY,
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL,
  analyze_count INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  domain              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  analyzed_at         TEXT NOT NULL,
  overall_score       INTEGER NOT NULL,
  overall_max_score   INTEGER NOT NULL,
  overall_percentage  INTEGER NOT NULL,
  overall_grade       TEXT NOT NULL,
  category_scores     TEXT NOT NULL,  -- JSON array
  FOREIGN KEY (domain) REFERENCES sites(domain) ON DELETE CASCADE
);

-- Query indexes
CREATE INDEX IF NOT EXISTS idx_sites_last_seen ON sites(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_domain ON snapshots(domain);
CREATE INDEX IF NOT EXISTS idx_snapshots_analyzed_at ON snapshots(domain, analyzed_at DESC);
