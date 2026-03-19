import Link from 'next/link';

/**
 * Suggested Restaurants — ISR Demo Page
 *
 * Day 9–10 of the Vercel Intensive:
 * - Uses Incremental Static Regeneration (revalidate = 60)
 * - Pre-renders top cuisine pages at build time via generateStaticParams()
 * - Tracks x-vercel-cache: MISS → HIT → STALE lifecycle
 *
 * Interview talking point:
 * "ISR lets me serve a pre-built page instantly (HIT) while Vercel quietly
 *  regenerates it in the background every 60 seconds (Stale-While-Revalidate).
 *  Here's the x-vercel-cache header sequence I traced in DevTools."
 */

import { Metadata } from 'next';

// ── ISR Configuration ──────────────────────────────────────────────────────
// revalidate = 60 means: serve cached HTML for 60 s, then regenerate in background
// The first request after expiry gets STALE (instant), next gets the fresh page
export const revalidate = 60;

// ── Pre-render these cuisines at build time (generateStaticParams) ─────────
// These become static pages on Vercel's Edge CDN — zero origin round-trips
const TOP_CUISINES = [
  'italian',
  'thai',
  'japanese',
  'chinese',
  'mexican',
  'indian',
  'french',
  'mediterranean',
  'korean',
  'american',
];

export async function generateStaticParams() {
  return TOP_CUISINES.map((cuisine) => ({ cuisine }));
}

export async function generateMetadata({
  params,
}: {
  params: { cuisine: string };
}): Promise<Metadata> {
  const name = params.cuisine.charAt(0).toUpperCase() + params.cuisine.slice(1);
  return {
    title: `Best ${name} Restaurants Near You`,
    description: `ISR-powered page: Top ${name} restaurant suggestions, refreshed every 60 seconds without a full rebuild.`,
  };
}

// ── Data fetching (runs at build + re-runs on ISR background refresh) ──────
async function getSuggestedRestaurants(cuisine: string) {
  // In production this would call your own /api/suggestions endpoint.
  // Using a simple static list here so the build works without credentials.
  const seed: Record<string, string[]> = {
    italian: ['Pasta Palace', 'La Trattoria', 'Mama Roma'],
    thai: ['Thai Orchid', 'Spice Garden', 'Bangkok Kitchen'],
    japanese: ['Sakura Sushi', 'Ramen House', 'Izakaya Yuzu'],
    chinese: ['Golden Dragon', 'Dim Sum House', 'Silk Road Kitchen'],
    mexican: ['Casa Taco', 'El Rancho', 'La Cantina'],
    indian: ['Spice Route', 'Masala House', 'Tandoor Palace'],
    french: ['Café de Paris', 'Le Bistro', 'Brasserie Lumière'],
    mediterranean: ['Olive & Vine', 'Sea & Shore', 'Mezze Bar'],
    korean: ['Seoul Kitchen', 'K-BBQ House', 'Bibimbap Bowl'],
    american: ['The Burger Joint', 'Smokehouse BBQ', 'Main Street Diner'],
  };

  return {
    cuisine,
    suggestions: seed[cuisine] ?? ['No suggestions available'],
    // Timestamp proves the page was re-generated — watch this change after 60 s
    generatedAt: new Date().toISOString(),
  };
}

// ── Page component ─────────────────────────────────────────────────────────

export default async function SuggestedRestaurantsPage({
  params,
}: {
  params: { cuisine: string };
}) {
  const { cuisine, suggestions, generatedAt } = await getSuggestedRestaurants(
    params.cuisine
  );

  const displayName = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);

  return (
    <div className="min-vh-100 bg-light-cream">
      <nav className="navbar navbar-expand-lg navbar-theme">
        <div className="container">
          <Link className="navbar-brand fw-bold" href="/">
            <i className="bi bi-compass me-2"></i>
            Where to Eat, Fly, Stay, &amp; Do
          </Link>
        </div>
      </nav>

      <div className="container py-5">
        {/* ISR debug banner — visible in development, useful for DevTools demo */}
        <div
          className="alert alert-info mb-4 rounded-4 border-0 shadow-sm"
          role="note"
          aria-label="ISR debug info"
        >
          <div className="d-flex align-items-start gap-3">
            <i className="bi bi-lightning-charge-fill text-primary fs-4 mt-1" />
            <div>
              <strong>ISR Demo</strong> — revalidate every 60 s
              <br />
              <small className="text-muted">
                Page generated at: <code>{generatedAt}</code>
                <br />
                Check the{' '}
                <code>x-vercel-cache</code> response header in DevTools:
                <br />
                First visit → <strong>MISS</strong> | Cached visit → <strong>HIT</strong> | After
                60 s → <strong>STALE</strong> (revalidation triggered in background)
              </small>
            </div>
          </div>
        </div>

        <h1 className="display-5 fw-bold text-jet-black mb-2">
          Top {displayName} Restaurants
        </h1>
        <p className="lead text-muted mb-5">
          Suggestions updated every 60 seconds via Incremental Static Regeneration
        </p>

        <div className="row g-4 mb-5">
          {suggestions.map((name, i) => (
            <div key={i} className="col-sm-6 col-lg-4">
              <div className="card h-100 shadow-sm rounded-4 border-0">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{
                        width: 48,
                        height: 48,
                        background: '#f5a623',
                        fontSize: '1.4rem',
                      }}
                    >
                      🍽️
                    </div>
                    <h5 className="card-title fw-bold mb-0">{name}</h5>
                  </div>
                  <p className="card-text text-muted small mb-0">
                    {displayName} cuisine · Highly rated
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stale-While-Revalidate explanation — interview anchor */}
        <div className="card card-appetizing">
          <div className="card-body p-4 p-md-5">
            <h2 className="h4 fw-bold mb-3">
              <i className="bi bi-diagram-3 me-2 text-primary"></i>
              How Stale-While-Revalidate Works Here
            </h2>
            <ol className="mb-0 text-muted">
              <li className="mb-2">
                <strong>Build time</strong> — Next.js pre-renders this page for{' '}
                {TOP_CUISINES.join(', ')} and stores HTML on Vercel&apos;s Edge CDN.
              </li>
              <li className="mb-2">
                <strong>Cache HIT</strong> — Subsequent visitors receive the cached HTML in
                single-digit milliseconds from the nearest edge node.
              </li>
              <li className="mb-2">
                <strong>60 s TTL expires</strong> — The <em>next</em> request is served instantly
                from stale cache, but Vercel simultaneously triggers a background regeneration.
                The visitor never waits.
              </li>
              <li>
                <strong>Fresh page</strong> — Once regeneration completes, the next request
                returns updated HTML. Watch <code>generatedAt</code> above change.
              </li>
            </ol>
          </div>
        </div>

        {/* Quick links to other cuisines */}
        <div className="mt-5">
          <h3 className="h5 fw-semibold mb-3">Explore other cuisines</h3>
          <div className="d-flex flex-wrap gap-2">
            {TOP_CUISINES.filter((c) => c !== cuisine).map((c) => (
              <a
                key={c}
                href={`/suggested-restaurants/${c}`}
                className="btn btn-outline-secondary btn-sm rounded-pill"
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
