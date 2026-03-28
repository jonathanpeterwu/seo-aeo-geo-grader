# SEO / AEO / GEO Grader

Free website grader that scores any URL across **SEO**, **AEO** (Answer Engine Optimization), **GEO** (Generative Engine Optimization), and **AI Discovery** using a 100-point weighted rubric. Includes AI engine readiness diagnostics for ChatGPT, Gemini, Perplexity, and Bing.

**[Live Demo →](#)** (deploy your own below)

## Features

- **100pt weighted scoring** across 5 categories (SEO 25pt, AEO 25pt, CTA 5pt, GEO 25pt, AI Discovery 20pt)
- **AI engine readiness** diagnostics for ChatGPT, Gemini, Perplexity, Bing (flagged, not scored)
- **PDF report** generation with full breakdown
- **Email delivery** of PDF reports
- **Pricing tiers**: Free home page → $99 site pass → $49/mo Pro → $149/mo Agency
- **Suggested fixes** with priority, effort, and point-impact (gated behind $99+)
- **Integration stubs** for GSC, Perplexity, Ahrefs, GitHub auto-fix, CMS edits

## Scoring Rubric

| Category | Points | Checks |
|----------|--------|--------|
| **SEO** | 25 | Title (5), Meta description (5), Canonical URL (3), robots.txt (5), XML Sitemap (4), Sitemap freshness (3 tiered) |
| **AEO** | 25 | JSON-LD (5), Open Graph (3), FAQ/Speakable (5 tiered), Schema stack depth (5), Content freshness (4 tiered), Outbound citations (3 tiered) |
| **CTA** | 5 | Call-to-action present (5) |
| **GEO** | 25 | Links (7 tiered), Clean copy (5), Depth (5 tiered), Stats (4 tiered), H2s (4 tiered) |
| **AI Discovery** | 20 | AI bot access (6 tiered), llms.txt (5 tiered), llms-full.txt (4 tiered), security.txt (2), Extractable blocks (3 tiered) |

**Grades:** A ≥ 90% | B ≥ 75% | C ≥ 58% | D < 58%

## Quick Start

```bash
# Clone
git clone https://github.com/jonathanpeterwu/seo-aeo-geo-grader.git
cd seo-aeo-geo-grader

# Install
npm install

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter a URL to grade.

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Stripe (for payments)

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | For payments | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | For payments | Webhook signing secret (`whsec_...`) |
| `STRIPE_PRICE_SITE_PASS` | For payments | Price ID for $99 one-time site pass |
| `STRIPE_PRICE_PRO` | For payments | Price ID for $49/mo Pro subscription |
| `STRIPE_PRICE_AGENCY` | For payments | Price ID for $149/mo Agency subscription |
| `NEXT_PUBLIC_APP_URL` | For payments | Your app URL for Stripe redirects |

**Without Stripe keys:** The app runs in dev mode — plan upgrades happen instantly without payment (for development/testing).

**To set up Stripe:**
1. Create products + prices in [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Copy the price IDs to `.env.local`
3. Set up the webhook endpoint: `https://your-app.vercel.app/api/webhook`
4. Select events: `checkout.session.completed`, `customer.subscription.deleted`, `invoice.payment_failed`

**Local webhook testing:**
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

### Email (optional)

| Variable | Required | Description |
|----------|----------|-------------|
| `SMTP_HOST` | For email | SMTP server (default: smtp.gmail.com) |
| `SMTP_PORT` | For email | SMTP port (default: 587) |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password or app password |
| `SMTP_FROM` | For email | From address |

Email is optional — PDF download and all grading works without it.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jonathanpeterwu/seo-aeo-geo-grader)

Or manually:

```bash
npm i -g vercel
vercel
```

Add SMTP environment variables in Vercel dashboard → Settings → Environment Variables if you want email delivery.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **HTML Parsing:** Cheerio
- **PDF:** jsPDF
- **Email:** Nodemailer

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Grade a URL (returns report + AI diagnostics) |
| POST | `/api/report` | Generate PDF from report data |
| POST | `/api/email` | Email PDF report |
| POST | `/api/checkout` | Create Stripe Checkout Session (or dev-mode instant upgrade) |
| POST | `/api/webhook` | Stripe webhook (payment confirmation, subscription events) |

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/analyze/              # Main grading endpoint
│   ├── api/checkout/             # Plan upgrade
│   ├── api/email/                # Email PDF delivery
│   ├── api/report/               # PDF generation
│   ├── pricing/                  # Pricing page
│   └── page.tsx                  # Home page with grader
├── components/
│   ├── AIEngineDiagnostics.tsx   # Per-engine readiness cards
│   ├── ReportDashboard.tsx       # Score + category cards
│   └── SuggestionsPanel.tsx      # Fix suggestions (gated)
├── lib/
│   ├── grader.ts                 # 100pt weighted scoring engine
│   ├── suggestions.ts            # Actionable fix generator
│   ├── credits.ts                # Plan-aware credit system
│   ├── pdf.ts                    # PDF report generation
│   ├── email.ts                  # Email delivery
│   ├── fetcher.ts                # Page/robots/sitemap fetcher
│   ├── plans.ts                  # Pricing tier config
│   ├── parsers/
│   │   ├── ai-engines.ts        # AI engine signal detection
│   │   ├── content.ts           # Words, links, CTA, banned words
│   │   ├── meta.ts              # Title, description, OG tags
│   │   ├── robots.ts            # robots.txt parser
│   │   ├── schema.ts            # JSON-LD, FAQ, Speakable
│   │   └── sitemap.ts           # XML sitemap parser
│   └── integrations/
│       ├── gsc.ts               # Google Search Console (Pro)
│       ├── perplexity.ts        # Citation tracking (Pro)
│       ├── ahrefs.ts            # Backlinks/keywords (Agency)
│       ├── github.ts            # PR auto-fixes (Agency)
│       └── cms.ts               # WP/Webflow/Sanity (Agency)
└── types/index.ts                # Shared TypeScript types
```

## License

MIT
