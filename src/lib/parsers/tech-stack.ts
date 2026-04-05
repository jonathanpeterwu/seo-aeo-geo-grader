import { CheerioDoc } from "./parse-html"

/**
 * BuiltWith-style client-side technology detection.
 *
 * Detects frameworks, auth providers, analytics, CDNs, CSS frameworks,
 * CMS platforms, chat widgets, payment processors, and more by inspecting
 * HTML source patterns: script src, meta tags, link hrefs, inline scripts,
 * DOM attributes, and global JS variable markers.
 *
 * Approach mirrors Wappalyzer / BuiltWith: pure static pattern matching
 * against the rendered HTML — no JS execution required.
 */

// ── Types ────────────────────────────────────────────────────

export interface DetectedTech {
  name: string
  category: TechCategory
  confidence: "high" | "medium" | "low"
  evidence: string // what matched
  website?: string
  seoImpact?: SEOImpact
}

export interface SEOImpact {
  effect: "positive" | "neutral" | "negative" | "warning"
  summary: string
}

export type TechCategory =
  | "framework"
  | "auth"
  | "analytics"
  | "cdn-hosting"
  | "css-framework"
  | "cms"
  | "chat-support"
  | "payment"
  | "font"
  | "tag-manager"
  | "monitoring"
  | "search"
  | "video"
  | "social"
  | "security"
  | "server"
  | "misc"

export interface TechStackResult {
  technologies: DetectedTech[]
  categoryBreakdown: { category: TechCategory; count: number; items: string[] }[]
  totalDetected: number
  seoWarnings: string[]
  seoPositives: string[]
}

// ── Fingerprint Rules ────────────────────────────────────────

interface FingerprintRule {
  name: string
  category: TechCategory
  website?: string
  // Each matcher returns evidence string or null
  matchers: ((ctx: MatchContext) => string | null)[]
}

interface MatchContext {
  html: string           // raw HTML (lowercased)
  scriptSrcs: string[]   // all <script src="..."> values
  linkHrefs: string[]    // all <link href="..."> values
  metaTags: Map<string, string> // name/property → content
  headers: Record<string, string> // HTTP response headers (lowercased keys)
  $: CheerioDoc
}

// Helper: check response header
function headerMatch(headers: Record<string, string>, key: string, pattern: RegExp): string | null {
  const val = headers[key]
  if (val && pattern.test(val.toLowerCase())) return `header ${key}: ${val.slice(0, 80)}`
  return null
}

function headerContains(headers: Record<string, string>, key: string, needle: string): string | null {
  const val = headers[key]
  if (val && val.toLowerCase().includes(needle.toLowerCase())) return `header ${key}: ${val.slice(0, 80)}`
  return null
}

// Helper: check if any script src matches a pattern
function scriptMatch(srcs: string[], pattern: RegExp): string | null {
  for (const src of srcs) {
    if (pattern.test(src)) return `script src: ${src.slice(0, 120)}`
  }
  return null
}

// Helper: check if HTML contains a string (html is pre-lowercased, needles must be lowercase)
function htmlContains(html: string, needle: string): string | null {
  return html.includes(needle) ? `HTML contains "${needle}"` : null
}

// Helper: check link hrefs
function linkMatch(hrefs: string[], pattern: RegExp): string | null {
  for (const href of hrefs) {
    if (pattern.test(href)) return `link href: ${href.slice(0, 120)}`
  }
  return null
}

// Helper: check meta generator tag for a CMS/framework name
function metaGenerator(needle: string): (ctx: MatchContext) => string | null {
  return (ctx) => {
    const gen = ctx.metaTags.get("generator")
    return gen?.toLowerCase().includes(needle) ? `meta generator: ${gen}` : null
  }
}

// ── Technology Fingerprint Database ──────────────────────────

const FINGERPRINTS: FingerprintRule[] = [
  // ─── Frameworks ──────────────────────────────────
  {
    name: "Next.js",
    category: "framework",
    website: "https://nextjs.org",
    matchers: [
      (ctx) => htmlContains(ctx.html, "__next_data__"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /\/_next\//),
      (ctx) => htmlContains(ctx.html, 'id="__next"'),
      (ctx) => headerContains(ctx.headers, "x-powered-by", "next.js"),
    ],
  },
  {
    name: "React",
    category: "framework",
    website: "https://react.dev",
    matchers: [
      (ctx) => htmlContains(ctx.html, "data-reactroot"),
      (ctx) => htmlContains(ctx.html, "_reactrootcontainer"),
      (ctx) => htmlContains(ctx.html, "react-root"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /react(?:\.production|\.development|\.min)?\.js/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /react-dom/),
      (ctx) => htmlContains(ctx.html, "__react"),
    ],
  },
  {
    name: "Vue.js",
    category: "framework",
    website: "https://vuejs.org",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /vue(?:\.min|\.global|\.runtime)?\.js/),
      (ctx) => htmlContains(ctx.html, "data-v-"),
      (ctx) => htmlContains(ctx.html, 'id="app"') && htmlContains(ctx.html, "v-cloak") ? 'Vue v-cloak + #app' : null,
      (ctx) => htmlContains(ctx.html, "__vue__"),
    ],
  },
  {
    name: "Nuxt.js",
    category: "framework",
    website: "https://nuxt.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "__nuxt"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /\/_nuxt\//),
      (ctx) => htmlContains(ctx.html, "window.__nuxt__"),
    ],
  },
  {
    name: "Angular",
    category: "framework",
    website: "https://angular.dev",
    matchers: [
      (ctx) => htmlContains(ctx.html, "ng-version"),
      (ctx) => htmlContains(ctx.html, "ng-app"),
      (ctx) => htmlContains(ctx.html, "ng-controller"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /angular(?:\.min)?\.js/),
      (ctx) => htmlContains(ctx.html, "_nghost"),
      (ctx) => htmlContains(ctx.html, "_ngcontent"),
    ],
  },
  {
    name: "Svelte",
    category: "framework",
    website: "https://svelte.dev",
    matchers: [
      (ctx) => htmlContains(ctx.html, "svelte-"),
      (ctx) => htmlContains(ctx.html, "__svelte"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /svelte/),
    ],
  },
  {
    name: "SvelteKit",
    category: "framework",
    website: "https://kit.svelte.dev",
    matchers: [
      (ctx) => htmlContains(ctx.html, "__sveltekit"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /_app\/immutable\//),
    ],
  },
  {
    name: "Gatsby",
    category: "framework",
    website: "https://www.gatsbyjs.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "___gatsby"),
      (ctx) => htmlContains(ctx.html, "gatsby-"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /gatsby/),
    ],
  },
  {
    name: "Remix",
    category: "framework",
    website: "https://remix.run",
    matchers: [
      (ctx) => htmlContains(ctx.html, "__remix"),
      (ctx) => htmlContains(ctx.html, "data-remix"),
    ],
  },
  {
    name: "Astro",
    category: "framework",
    website: "https://astro.build",
    matchers: [
      (ctx) => htmlContains(ctx.html, "astro-"),
      metaGenerator("astro"),
    ],
  },
  {
    name: "jQuery",
    category: "framework",
    website: "https://jquery.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /jquery(?:\.min)?\.js/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /jquery[\-.](\d)/),
    ],
  },
  {
    name: "Htmx",
    category: "framework",
    website: "https://htmx.org",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /htmx(?:\.min)?\.js/),
      (ctx) => htmlContains(ctx.html, "hx-get"),
      (ctx) => htmlContains(ctx.html, "hx-post"),
    ],
  },
  {
    name: "Alpine.js",
    category: "framework",
    website: "https://alpinejs.dev",
    matchers: [
      (ctx) => htmlContains(ctx.html, "x-data"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /alpine(?:\.min)?\.js/),
    ],
  },

  // ─── Authentication ──────────────────────────────
  {
    name: "Clerk",
    category: "auth",
    website: "https://clerk.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /clerk/),
      (ctx) => htmlContains(ctx.html, "clerk-js"),
      (ctx) => htmlContains(ctx.html, "data-clerk-publishable-key"),
      (ctx) => htmlContains(ctx.html, "clerk.accounts.dev"),
      (ctx) => htmlContains(ctx.html, "clerk.com"),
      (ctx) => htmlContains(ctx.html, "__clerk"),
    ],
  },
  {
    name: "Auth0",
    category: "auth",
    website: "https://auth0.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /auth0/),
      (ctx) => htmlContains(ctx.html, "auth0-lock"),
      (ctx) => htmlContains(ctx.html, "auth0.com"),
      (ctx) => htmlContains(ctx.html, "auth0-js"),
    ],
  },
  {
    name: "Firebase Auth",
    category: "auth",
    website: "https://firebase.google.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /firebase.*auth/),
      (ctx) => htmlContains(ctx.html, "firebaseauth"),
      (ctx) => htmlContains(ctx.html, "firebase.auth"),
    ],
  },
  {
    name: "Supabase",
    category: "auth",
    website: "https://supabase.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /supabase/),
      (ctx) => htmlContains(ctx.html, "supabase"),
    ],
  },
  {
    name: "NextAuth.js",
    category: "auth",
    website: "https://next-auth.js.org",
    matchers: [
      (ctx) => htmlContains(ctx.html, "next-auth"),
      (ctx) => htmlContains(ctx.html, "__nextauth"),
      (ctx) => htmlContains(ctx.html, "/api/auth/session"),
    ],
  },
  {
    name: "Okta",
    category: "auth",
    website: "https://okta.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /okta/),
      (ctx) => htmlContains(ctx.html, "okta-sign-in"),
    ],
  },
  {
    name: "Stytch",
    category: "auth",
    website: "https://stytch.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /stytch/),
      (ctx) => htmlContains(ctx.html, "stytch"),
    ],
  },

  // ─── Analytics ───────────────────────────────────
  {
    name: "Google Analytics",
    category: "analytics",
    website: "https://analytics.google.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /google-analytics\.com\/analytics/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /googletagmanager\.com\/gtag/),
      (ctx) => htmlContains(ctx.html, "ua-"),
      (ctx) => htmlContains(ctx.html, "g-") && htmlContains(ctx.html, "gtag") ? "gtag G- measurement ID" : null,
    ],
  },
  {
    name: "Google Tag Manager",
    category: "tag-manager",
    website: "https://tagmanager.google.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /googletagmanager\.com\/gtm/),
      (ctx) => htmlContains(ctx.html, "gtm-"),
      (ctx) => htmlContains(ctx.html, "google_tag_manager"),
    ],
  },
  {
    name: "Segment",
    category: "analytics",
    website: "https://segment.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /cdn\.segment\.com/),
      (ctx) => htmlContains(ctx.html, "analytics.js"),
      (ctx) => htmlContains(ctx.html, "segment.com"),
    ],
  },
  {
    name: "Mixpanel",
    category: "analytics",
    website: "https://mixpanel.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /cdn\.mxpnl\.com/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /mixpanel/),
      (ctx) => htmlContains(ctx.html, "mixpanel"),
    ],
  },
  {
    name: "Hotjar",
    category: "analytics",
    website: "https://www.hotjar.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /static\.hotjar\.com/),
      (ctx) => htmlContains(ctx.html, "hotjar"),
      (ctx) => htmlContains(ctx.html, "_hjsettings"),
    ],
  },
  {
    name: "Plausible",
    category: "analytics",
    website: "https://plausible.io",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /plausible\.io/),
      (ctx) => htmlContains(ctx.html, "plausible"),
    ],
  },
  {
    name: "PostHog",
    category: "analytics",
    website: "https://posthog.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /posthog/),
      (ctx) => htmlContains(ctx.html, "posthog"),
    ],
  },
  {
    name: "Amplitude",
    category: "analytics",
    website: "https://amplitude.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /cdn\.amplitude\.com/),
      (ctx) => htmlContains(ctx.html, "amplitude"),
    ],
  },
  {
    name: "Heap",
    category: "analytics",
    website: "https://www.heap.io",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /heap-analytics/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /cdn\.heapanalytics\.com/),
      (ctx) => htmlContains(ctx.html, "heap"),
    ],
  },
  {
    name: "Clarity",
    category: "analytics",
    website: "https://clarity.microsoft.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /clarity\.ms/),
      (ctx) => htmlContains(ctx.html, "clarity"),
    ],
  },
  {
    name: "Facebook Pixel",
    category: "analytics",
    website: "https://www.facebook.com/business",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /connect\.facebook\.net/),
      (ctx) => htmlContains(ctx.html, "fbevents"),
      (ctx) => htmlContains(ctx.html, "facebook pixel"),
    ],
  },
  {
    name: "HubSpot Analytics",
    category: "analytics",
    website: "https://www.hubspot.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /js\.hs-scripts\.com/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /js\.hs-analytics\.net/),
      (ctx) => htmlContains(ctx.html, "hubspot"),
    ],
  },

  // ─── CDN & Hosting ──────────────────────────────
  {
    name: "Vercel",
    category: "cdn-hosting",
    website: "https://vercel.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /vercel/),
      (ctx) => htmlContains(ctx.html, "/_vercel/"),
      (ctx) => headerMatch(ctx.headers, "x-vercel-id", /./),
      (ctx) => headerContains(ctx.headers, "server", "vercel"),
    ],
  },
  {
    name: "Netlify",
    category: "cdn-hosting",
    website: "https://www.netlify.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "netlify"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /netlify/),
    ],
  },
  {
    name: "Cloudflare",
    category: "cdn-hosting",
    website: "https://www.cloudflare.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /cloudflare/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /cdnjs\.cloudflare\.com/),
      (ctx) => headerMatch(ctx.headers, "cf-ray", /./),
      (ctx) => headerContains(ctx.headers, "server", "cloudflare"),
    ],
  },
  {
    name: "AWS CloudFront",
    category: "cdn-hosting",
    website: "https://aws.amazon.com/cloudfront",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /cloudfront\.net/),
      (ctx) => linkMatch(ctx.linkHrefs, /cloudfront\.net/),
    ],
  },
  {
    name: "Fastly",
    category: "cdn-hosting",
    website: "https://www.fastly.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "fastly"),
    ],
  },
  {
    name: "Akamai",
    category: "cdn-hosting",
    website: "https://www.akamai.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /akamai/),
      (ctx) => linkMatch(ctx.linkHrefs, /akamaized\.net/),
    ],
  },

  // ─── CSS Frameworks ─────────────────────────────
  {
    name: "Tailwind CSS",
    category: "css-framework",
    website: "https://tailwindcss.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "tailwind"),
      // Tailwind utility class patterns (high confidence heuristic)
      (ctx) => {
        const hasTwClasses = /class="[^"]*(?:flex |grid |mt-\d|px-\d|bg-|text-(?:sm|lg|xl|2xl)|rounded-|shadow-)[^"]*"/.test(ctx.html)
        return hasTwClasses ? "Tailwind utility classes detected" : null
      },
    ],
  },
  {
    name: "Bootstrap",
    category: "css-framework",
    website: "https://getbootstrap.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /bootstrap(?:\.min)?\.js/),
      (ctx) => linkMatch(ctx.linkHrefs, /bootstrap(?:\.min)?\.css/),
      (ctx) => htmlContains(ctx.html, "bootstrap"),
    ],
  },
  {
    name: "Material UI",
    category: "css-framework",
    website: "https://mui.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "muirtl") || htmlContains(ctx.html, "mui-"),
      (ctx) => htmlContains(ctx.html, "makeStyles") || htmlContains(ctx.html, "MuiButton"),
    ],
  },
  {
    name: "Chakra UI",
    category: "css-framework",
    website: "https://chakra-ui.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "chakra-"),
    ],
  },
  {
    name: "Bulma",
    category: "css-framework",
    website: "https://bulma.io",
    matchers: [
      (ctx) => linkMatch(ctx.linkHrefs, /bulma(?:\.min)?\.css/),
    ],
  },
  {
    name: "Ant Design",
    category: "css-framework",
    website: "https://ant.design",
    matchers: [
      (ctx) => htmlContains(ctx.html, "ant-"),
      (ctx) => linkMatch(ctx.linkHrefs, /antd/),
    ],
  },

  // ─── CMS ────────────────────────────────────────
  {
    name: "WordPress",
    category: "cms",
    website: "https://wordpress.org",
    matchers: [
      (ctx) => htmlContains(ctx.html, "wp-content"),
      (ctx) => htmlContains(ctx.html, "wp-includes"),
      metaGenerator("wordpress"),
    ],
  },
  {
    name: "Webflow",
    category: "cms",
    website: "https://webflow.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "webflow"),
      metaGenerator("webflow"),
    ],
  },
  {
    name: "Shopify",
    category: "cms",
    website: "https://www.shopify.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "shopify"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /cdn\.shopify\.com/),
      (ctx) => htmlContains(ctx.html, "myshopify"),
    ],
  },
  {
    name: "Squarespace",
    category: "cms",
    website: "https://www.squarespace.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "squarespace"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /squarespace/),
    ],
  },
  {
    name: "Wix",
    category: "cms",
    website: "https://www.wix.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "wix.com"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /static\.wixstatic\.com/),
      (ctx) => htmlContains(ctx.html, "wixsite"),
    ],
  },
  {
    name: "Ghost",
    category: "cms",
    website: "https://ghost.org",
    matchers: [
      metaGenerator("ghost"),
      (ctx) => htmlContains(ctx.html, "ghost-"),
    ],
  },
  {
    name: "Hugo",
    category: "cms",
    website: "https://gohugo.io",
    matchers: [
      metaGenerator("hugo"),
    ],
  },
  {
    name: "Drupal",
    category: "cms",
    website: "https://www.drupal.org",
    matchers: [
      (ctx) => htmlContains(ctx.html, "drupal"),
      metaGenerator("drupal"),
    ],
  },
  {
    name: "Sanity",
    category: "cms",
    website: "https://www.sanity.io",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /sanity/),
      (ctx) => htmlContains(ctx.html, "cdn.sanity.io"),
    ],
  },
  {
    name: "Contentful",
    category: "cms",
    website: "https://www.contentful.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "contentful"),
      (ctx) => htmlContains(ctx.html, "ctfassets"),
    ],
  },

  // ─── Chat & Support ─────────────────────────────
  {
    name: "Intercom",
    category: "chat-support",
    website: "https://www.intercom.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /intercom/),
      (ctx) => htmlContains(ctx.html, "intercom-"),
      (ctx) => htmlContains(ctx.html, "intercomSettings"),
    ],
  },
  {
    name: "Drift",
    category: "chat-support",
    website: "https://www.drift.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /drift/),
      (ctx) => htmlContains(ctx.html, "drift-widget"),
    ],
  },
  {
    name: "Crisp",
    category: "chat-support",
    website: "https://crisp.chat",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /crisp/),
      (ctx) => htmlContains(ctx.html, "crisp-client"),
      (ctx) => htmlContains(ctx.html, "$crisp"),
    ],
  },
  {
    name: "Zendesk",
    category: "chat-support",
    website: "https://www.zendesk.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /zendesk/),
      (ctx) => htmlContains(ctx.html, "zdassets"),
      (ctx) => htmlContains(ctx.html, "ze-snippet"),
    ],
  },
  {
    name: "Freshdesk",
    category: "chat-support",
    website: "https://freshdesk.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "freshdesk"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /freshdesk/),
    ],
  },
  {
    name: "LiveChat",
    category: "chat-support",
    website: "https://www.livechat.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /livechat/),
      (ctx) => htmlContains(ctx.html, "livechat"),
    ],
  },
  {
    name: "Tawk.to",
    category: "chat-support",
    website: "https://www.tawk.to",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /tawk\.to/),
      (ctx) => htmlContains(ctx.html, "tawk"),
    ],
  },

  // ─── Payment ────────────────────────────────────
  {
    name: "Stripe",
    category: "payment",
    website: "https://stripe.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /js\.stripe\.com/),
      (ctx) => htmlContains(ctx.html, "stripe"),
    ],
  },
  {
    name: "PayPal",
    category: "payment",
    website: "https://www.paypal.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /paypal/),
      (ctx) => htmlContains(ctx.html, "paypal"),
    ],
  },
  {
    name: "Square",
    category: "payment",
    website: "https://squareup.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /squareup\.com/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /square\.js/),
    ],
  },

  // ─── Fonts ──────────────────────────────────────
  {
    name: "Google Fonts",
    category: "font",
    website: "https://fonts.google.com",
    matchers: [
      (ctx) => linkMatch(ctx.linkHrefs, /fonts\.googleapis\.com/),
      (ctx) => linkMatch(ctx.linkHrefs, /fonts\.gstatic\.com/),
    ],
  },
  {
    name: "Adobe Fonts (Typekit)",
    category: "font",
    website: "https://fonts.adobe.com",
    matchers: [
      (ctx) => linkMatch(ctx.linkHrefs, /use\.typekit\.net/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /use\.typekit\.net/),
    ],
  },
  {
    name: "Font Awesome",
    category: "font",
    website: "https://fontawesome.com",
    matchers: [
      (ctx) => linkMatch(ctx.linkHrefs, /font-?awesome/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /fontawesome/),
      (ctx) => htmlContains(ctx.html, "fa-"),
    ],
  },

  // ─── Monitoring & Error Tracking ────────────────
  {
    name: "Sentry",
    category: "monitoring",
    website: "https://sentry.io",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /sentry/),
      (ctx) => htmlContains(ctx.html, "sentry"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /browser\.sentry-cdn\.com/),
    ],
  },
  {
    name: "Datadog RUM",
    category: "monitoring",
    website: "https://www.datadoghq.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /datadog/),
      (ctx) => htmlContains(ctx.html, "dd_rum"),
    ],
  },
  {
    name: "New Relic",
    category: "monitoring",
    website: "https://newrelic.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /newrelic/),
      (ctx) => htmlContains(ctx.html, "newrelic"),
      (ctx) => htmlContains(ctx.html, "nreum"),
    ],
  },
  {
    name: "LogRocket",
    category: "monitoring",
    website: "https://logrocket.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /logrocket/),
      (ctx) => htmlContains(ctx.html, "logrocket"),
    ],
  },
  {
    name: "Bugsnag",
    category: "monitoring",
    website: "https://www.bugsnag.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /bugsnag/),
      (ctx) => htmlContains(ctx.html, "bugsnag"),
    ],
  },

  // ─── Search ─────────────────────────────────────
  {
    name: "Algolia",
    category: "search",
    website: "https://www.algolia.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /algolia/),
      (ctx) => htmlContains(ctx.html, "algolia"),
    ],
  },
  {
    name: "Elasticsearch",
    category: "search",
    website: "https://www.elastic.co",
    matchers: [
      (ctx) => htmlContains(ctx.html, "elasticsearch"),
    ],
  },

  // ─── Video ──────────────────────────────────────
  {
    name: "YouTube Embed",
    category: "video",
    website: "https://www.youtube.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "youtube.com/embed"),
      (ctx) => htmlContains(ctx.html, "youtube-nocookie.com"),
    ],
  },
  {
    name: "Vimeo",
    category: "video",
    website: "https://vimeo.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "player.vimeo.com"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /vimeo/),
    ],
  },
  {
    name: "Wistia",
    category: "video",
    website: "https://wistia.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /wistia/),
      (ctx) => htmlContains(ctx.html, "wistia"),
    ],
  },

  // ─── Social ─────────────────────────────────────
  {
    name: "Twitter/X Widgets",
    category: "social",
    website: "https://x.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /platform\.twitter\.com/),
      (ctx) => htmlContains(ctx.html, "twitter-tweet"),
    ],
  },
  {
    name: "Facebook SDK",
    category: "social",
    website: "https://developers.facebook.com",
    matchers: [
      (ctx) => htmlContains(ctx.html, "fb-root"),
      (ctx) => scriptMatch(ctx.scriptSrcs, /connect\.facebook\.net.*sdk/),
    ],
  },

  // ─── Security ───────────────────────────────────
  {
    name: "reCAPTCHA",
    category: "security",
    website: "https://www.google.com/recaptcha",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /recaptcha/),
      (ctx) => htmlContains(ctx.html, "g-recaptcha"),
    ],
  },
  {
    name: "hCaptcha",
    category: "security",
    website: "https://www.hcaptcha.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /hcaptcha/),
      (ctx) => htmlContains(ctx.html, "h-captcha"),
    ],
  },
  {
    name: "Turnstile",
    category: "security",
    website: "https://www.cloudflare.com/products/turnstile",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /challenges\.cloudflare\.com/),
      (ctx) => htmlContains(ctx.html, "cf-turnstile"),
    ],
  },

  // ─── Misc ───────────────────────────────────────
  {
    name: "Lottie",
    category: "misc",
    website: "https://lottiefiles.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /lottie/),
      (ctx) => htmlContains(ctx.html, "lottie-player"),
    ],
  },
  {
    name: "GSAP",
    category: "misc",
    website: "https://greensock.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /gsap/),
      (ctx) => scriptMatch(ctx.scriptSrcs, /greensock/),
    ],
  },
  {
    name: "Three.js",
    category: "misc",
    website: "https://threejs.org",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /three(?:\.min)?\.js/),
    ],
  },
  {
    name: "Framer Motion",
    category: "misc",
    website: "https://www.framer.com/motion",
    matchers: [
      (ctx) => htmlContains(ctx.html, "framer-motion"),
    ],
  },
  {
    name: "LaunchDarkly",
    category: "misc",
    website: "https://launchdarkly.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /launchdarkly/),
      (ctx) => htmlContains(ctx.html, "launchdarkly"),
    ],
  },
  {
    name: "Optimizely",
    category: "misc",
    website: "https://www.optimizely.com",
    matchers: [
      (ctx) => scriptMatch(ctx.scriptSrcs, /optimizely/),
      (ctx) => htmlContains(ctx.html, "optimizely"),
    ],
  },

  // ─── Server / Infrastructure (header-based) ─────
  {
    name: "Nginx",
    category: "server",
    website: "https://nginx.org",
    matchers: [
      (ctx) => headerContains(ctx.headers, "server", "nginx"),
    ],
  },
  {
    name: "Apache",
    category: "server",
    website: "https://httpd.apache.org",
    matchers: [
      (ctx) => headerContains(ctx.headers, "server", "apache"),
    ],
  },
  {
    name: "Express",
    category: "server",
    website: "https://expressjs.com",
    matchers: [
      (ctx) => headerContains(ctx.headers, "x-powered-by", "express"),
    ],
  },
  {
    name: "Node.js",
    category: "server",
    website: "https://nodejs.org",
    matchers: [
      (ctx) => headerContains(ctx.headers, "x-powered-by", "node"),
    ],
  },
  {
    name: "PHP",
    category: "server",
    website: "https://www.php.net",
    matchers: [
      (ctx) => headerContains(ctx.headers, "x-powered-by", "php"),
    ],
  },
  {
    name: "ASP.NET",
    category: "server",
    website: "https://dotnet.microsoft.com/apps/aspnet",
    matchers: [
      (ctx) => headerContains(ctx.headers, "x-powered-by", "asp.net"),
      (ctx) => headerContains(ctx.headers, "x-aspnet-version", "."),
    ],
  },
  {
    name: "Envoy",
    category: "server",
    website: "https://www.envoyproxy.io",
    matchers: [
      (ctx) => headerContains(ctx.headers, "server", "envoy"),
    ],
  },
  {
    name: "Caddy",
    category: "server",
    website: "https://caddyserver.com",
    matchers: [
      (ctx) => headerContains(ctx.headers, "server", "caddy"),
    ],
  },
]

// ── Category Labels ──────────────────────────────────────────

export const CATEGORY_LABELS: Record<TechCategory, string> = {
  framework: "Frameworks & Libraries",
  auth: "Authentication",
  analytics: "Analytics",
  "cdn-hosting": "CDN & Hosting",
  "css-framework": "CSS Frameworks",
  cms: "CMS & Content",
  "chat-support": "Chat & Support",
  payment: "Payment",
  font: "Fonts",
  "tag-manager": "Tag Managers",
  monitoring: "Monitoring & Errors",
  search: "Search",
  video: "Video",
  social: "Social",
  security: "Security",
  server: "Server & Infrastructure",
  misc: "Other",
}

// ── Main Detection Function ──────────────────────────────────

// ── SEO Impact Rules ─────────────────────────────────────────
// Maps tech name → SEO impact annotation

const SEO_IMPACTS: Record<string, SEOImpact> = {
  // SSR frameworks — positive for crawlability
  "Next.js":     { effect: "positive", summary: "SSR/SSG framework — excellent crawlability and Core Web Vitals" },
  "Nuxt.js":     { effect: "positive", summary: "SSR/SSG framework — excellent crawlability for Vue apps" },
  "Gatsby":      { effect: "positive", summary: "Static site generator — fast TTFB and full crawlability" },
  "Remix":       { effect: "positive", summary: "SSR framework — good crawlability with streaming support" },
  "Astro":       { effect: "positive", summary: "Islands architecture — minimal JS shipped, fast load times" },
  "SvelteKit":   { effect: "positive", summary: "SSR/SSG framework — minimal runtime overhead" },

  // Client-only frameworks — warning
  "React":       { effect: "neutral", summary: "Client-side library — ensure SSR/SSG wrapper (Next.js, Remix) for crawlability" },
  "Vue.js":      { effect: "neutral", summary: "Client-side library — ensure SSR wrapper (Nuxt) for crawlability" },
  "Angular":     { effect: "warning", summary: "SPA framework — verify server-side rendering is enabled for crawlers" },
  "Svelte":      { effect: "neutral", summary: "Compiled framework — small bundle size benefits Core Web Vitals" },

  // CDN — positive
  "Cloudflare":  { effect: "positive", summary: "Global CDN — reduces TTFB, improves Core Web Vitals worldwide" },
  "Vercel":      { effect: "positive", summary: "Edge network — optimized for Next.js with automatic CDN" },
  "Netlify":     { effect: "positive", summary: "Edge CDN — fast static asset delivery" },
  "AWS CloudFront": { effect: "positive", summary: "Global CDN — reduces latency for static assets" },
  "Fastly":      { effect: "positive", summary: "Edge CDN — low-latency delivery" },

  // Analytics — warning if too many
  "Google Analytics": { effect: "neutral", summary: "Standard analytics — minimal performance impact" },
  "Google Tag Manager": { effect: "neutral", summary: "Tag container — monitor for tag bloat affecting CWV" },
  "Hotjar":      { effect: "warning", summary: "Session recording — can impact page load and Largest Contentful Paint" },
  "Facebook Pixel": { effect: "warning", summary: "Tracking pixel — adds render-blocking requests" },

  // CMS — varies
  "WordPress":   { effect: "neutral", summary: "Most SEO plugins available — ensure caching and image optimization" },
  "Webflow":     { effect: "positive", summary: "Built-in SEO controls, auto-sitemap, clean semantic HTML" },
  "Shopify":     { effect: "neutral", summary: "E-commerce SEO basics included — limited URL structure control" },
  "Wix":         { effect: "warning", summary: "Limited SEO control — heavy JavaScript, slow initial render" },
  "Squarespace": { effect: "neutral", summary: "Basic SEO built-in — limited structured data options" },

  // Monitoring — positive
  "Sentry":      { effect: "positive", summary: "Error tracking — helps catch SEO-impacting JavaScript errors" },

  // Heavy JS libraries — warning
  "jQuery":      { effect: "warning", summary: "Legacy library — 87KB adds to bundle size, impacts CWV" },
  "Three.js":    { effect: "warning", summary: "3D library — heavy payload, ensure lazy loading" },
  "GSAP":        { effect: "neutral", summary: "Animation library — lightweight, minimal CWV impact" },
  "Lottie":      { effect: "neutral", summary: "Animation library — ensure lazy loading for below-fold content" },
}

export function detectTechStack(
  $: CheerioDoc,
  responseHeaders: Record<string, string> = {}
): TechStackResult {
  // Build match context once
  const html = ($.html() || "").toLowerCase()

  const scriptSrcs: string[] = []
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src")
    if (src) scriptSrcs.push(src.toLowerCase())
  })

  const linkHrefs: string[] = []
  $("link[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (href) linkHrefs.push(href.toLowerCase())
  })

  const metaTags = new Map<string, string>()
  $("meta").each((_, el) => {
    const name = ($(el).attr("name") || $(el).attr("property") || $(el).attr("http-equiv") || "").toLowerCase()
    const content = $(el).attr("content") || ""
    if (name && content) metaTags.set(name, content)
  })

  // Normalize header keys to lowercase
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(responseHeaders)) {
    headers[k.toLowerCase()] = v
  }

  const ctx: MatchContext = { html, scriptSrcs, linkHrefs, metaTags, headers, $ }

  // Run all fingerprints
  const technologies: DetectedTech[] = []
  const seen = new Set<string>()

  for (const fp of FINGERPRINTS) {
    if (seen.has(fp.name)) continue

    let matchCount = 0
    let firstEvidence = ""

    for (const matcher of fp.matchers) {
      const evidence = matcher(ctx)
      if (evidence) {
        matchCount++
        if (!firstEvidence) firstEvidence = evidence
      }
    }

    if (matchCount > 0) {
      seen.add(fp.name)
      technologies.push({
        name: fp.name,
        category: fp.category,
        confidence: matchCount >= 3 ? "high" : matchCount >= 2 ? "medium" : "low",
        evidence: firstEvidence,
        website: fp.website,
        seoImpact: SEO_IMPACTS[fp.name],
      })
    }
  }

  // Implied technologies
  const IMPLIED: [string, string, TechCategory, string][] = [
    ["Next.js", "React", "framework", "https://react.dev"],
    ["Nuxt.js", "Vue.js", "framework", "https://vuejs.org"],
    ["Gatsby", "React", "framework", "https://react.dev"],
    ["SvelteKit", "Svelte", "framework", "https://svelte.dev"],
  ]
  for (const [parent, child, cat, website] of IMPLIED) {
    if (seen.has(parent) && !seen.has(child)) {
      seen.add(child)
      technologies.push({
        name: child,
        category: cat,
        confidence: "high",
        evidence: `Implied by ${parent}`,
        website,
        seoImpact: SEO_IMPACTS[child],
      })
    }
  }

  // ── SEO Warnings & Positives ───────────────────────────────
  const seoWarnings: string[] = []
  const seoPositives: string[] = []

  const SSR_FRAMEWORKS = ["Next.js", "Gatsby", "Remix", "Nuxt.js", "SvelteKit", "Astro"] as const
  const CDN_PROVIDERS = ["Cloudflare", "Vercel", "Netlify", "AWS CloudFront", "Fastly", "Akamai"] as const

  const hasSSR = SSR_FRAMEWORKS.some((f) => seen.has(f))
  const hasCDN = CDN_PROVIDERS.some((c) => seen.has(c))

  // Warn: React/Vue without SSR framework
  if (seen.has("React") && !hasSSR) {
    seoWarnings.push("React detected without SSR framework (Next.js/Gatsby/Remix) — content may not be crawlable by search engines")
  }
  if (seen.has("Vue.js") && !seen.has("Nuxt.js")) {
    seoWarnings.push("Vue.js detected without Nuxt.js — ensure server-side rendering is configured for crawlability")
  }

  if (!hasCDN) {
    seoWarnings.push("No CDN detected — consider adding one to reduce TTFB and improve Core Web Vitals")
  } else {
    seoPositives.push("CDN detected — good for global performance and Core Web Vitals")
  }

  // Warn: No analytics
  const hasAnalytics = technologies.some((t) => t.category === "analytics" || t.category === "tag-manager")
  if (!hasAnalytics) {
    seoWarnings.push("No analytics detected — unable to measure SEO performance without tracking")
  }

  // Warn: Script bloat (5+ analytics/tracking scripts)
  const trackingCount = technologies.filter((t) => t.category === "analytics" || t.category === "tag-manager" || t.category === "social").length
  if (trackingCount >= 5) {
    seoWarnings.push(`${trackingCount} tracking scripts detected — excessive third-party scripts degrade Core Web Vitals`)
  }

  // Warn: No error monitoring
  const hasMonitoring = technologies.some((t) => t.category === "monitoring")
  if (!hasMonitoring && technologies.length >= 5) {
    seoWarnings.push("No error monitoring detected — JavaScript errors can silently break SEO-critical rendering")
  }

  // Positive: SSR framework
  if (hasSSR) {
    seoPositives.push("SSR/SSG framework detected — content is crawlable by search engines and AI bots")
  }

  // Build category breakdown
  const catMap = new Map<TechCategory, string[]>()
  for (const tech of technologies) {
    const list = catMap.get(tech.category) || []
    list.push(tech.name)
    catMap.set(tech.category, list)
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, items]) => ({ category, count: items.length, items }))
    .sort((a, b) => b.count - a.count)

  return {
    technologies,
    categoryBreakdown,
    totalDetected: technologies.length,
    seoWarnings,
    seoPositives,
  }
}
