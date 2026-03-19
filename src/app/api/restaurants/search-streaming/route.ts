/**
 * Streaming Restaurant Search API
 *
 * Vercel Intensive:
 * - Uses Vercel AI Gateway (model strings like 'anthropic/claude-haiku-4-5')
 * - Streams the AI summary progressively via Server-Sent Events (SSE)
 * - Distinguishes PROVIDER_TIMEOUT vs FUNCTION_TIMEOUT vs STREAM_ERROR
 *
 * Interview talking point:
 * "I route all AI calls through Vercel AI Gateway for unified billing,
 *  automatic retries, and observability — with a single AI_GATEWAY_API_KEY."
 */

import { streamText, generateText } from 'ai';
import { NextRequest } from 'next/server';

// Vercel AI Gateway model — all AI calls use Haiku for speed + cost efficiency
const AI_MODEL = 'anthropic/claude-haiku-4-5';

// ── Types ──────────────────────────────────────────────────────────────────

interface PlaceSearchRequest {
  textQuery: string;
  locationBias?: {
    circle: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
  };
  maxResultCount?: number;
  includedType?: string;
  languageCode?: string;
}

interface PlaceResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  priceLevel?: string;
  userRatingCount?: number;
  businessStatus?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
  reviews?: Array<{
    name: string;
    relativePublishTimeDescription: string;
    rating: number;
    text: { text: string };
    authorAttribution: { displayName: string; photoUri?: string };
  }>;
}

interface Restaurant {
  id: string;
  name: string;
  rating: number;
  address: string;
  phone?: string;
  website?: string;
  googleMapsUrl: string;
  isOpen: boolean;
  openingHours?: string[];
  priceLevel?: number;
  distance?: number;
  photoUrl?: string;
  geometry?: { lat: number; lng: number };
  aiRecommendation?: string;
}

// ── Places API helpers ─────────────────────────────────────────────────────

async function searchPlacesText(req: PlaceSearchRequest) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,' +
        'places.rating,places.googleMapsUri,places.websiteUri,places.nationalPhoneNumber,' +
        'places.priceLevel,places.userRatingCount,places.businessStatus,' +
        'places.currentOpeningHours,places.photos,places.reviews',
    },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Places API failed: ${res.status} ${res.statusText}`);
  return res.json() as Promise<{ places: PlaceResult[] }>;
}

async function getTimezone(lat: number, lng: number) {
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    key: process.env.GOOGLE_PLACES_API_KEY!,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/timezone/json?${params}`
  );
  if (!res.ok) throw new Error(`Timezone API failed: ${res.status}`);
  return res.json() as Promise<{
    status: string;
    dstOffset: number;
    rawOffset: number;
  }>;
}

async function reverseGeocode(lat: number, lng: number) {
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
    key: process.env.GOOGLE_PLACES_API_KEY!,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`
  );
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  return res.json() as Promise<{
    results: Array<{ formatted_address: string }>;
    status: string;
  }>;
}

async function getLocationTime(lat: number, lng: number): Promise<Date> {
  try {
    const tz = await getTimezone(lat, lng);
    if (tz.status === 'OK') {
      const offsetMs = (tz.dstOffset + tz.rawOffset) * 1000;
      return new Date(Date.now() + offsetMs);
    }
  } catch {
    // fall through to default
  }
  return new Date();
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Background analytics helpers ──────────────────────────────────────────

async function saveSearchHistory(
  location: string,
  preferences: string,
  resultsCount: number,
  userCoords?: { lat: number; lng: number }
) {
  if (
    !process.env.MONGODB_URI ||
    process.env.MONGODB_URI.includes('dummy') ||
    process.env.MONGODB_URI === 'mongodb://localhost:27017/where-to-eat'
  )
    return;

  try {
    const dbConnect = (await import('@/lib/mongodb')).default;
    const SearchHistory = (await import('@/models/SearchHistory')).default;
    await dbConnect();
    await SearchHistory.create({ location, preferences, resultsCount, coordinates: userCoords });
  } catch {
    // silent
  }
}

async function updateKeywords(preferences: string) {
  if (!preferences) return;
  if (
    !process.env.MONGODB_URI ||
    process.env.MONGODB_URI.includes('dummy') ||
    process.env.MONGODB_URI === 'mongodb://localhost:27017/where-to-eat'
  )
    return;

  try {
    const dbConnect = (await import('@/lib/mongodb')).default;
    const PopularKeyword = (await import('@/models/PopularKeyword')).default;
    await dbConnect();
    const words = preferences
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['restaurant', 'food', 'place'].includes(w));

    for (const word of words.slice(0, 3)) {
      const clean = word.replace(/[^\w]/g, '');
      if (clean.length > 3) {
        await PopularKeyword.findOneAndUpdate(
          { keyword: clean },
          { $inc: { count: 1 }, $set: { lastUsed: new Date(), category: 'general' } },
          { upsert: true }
        );
      }
    }
  } catch {
    // silent
  }
}

// ── Error classification ───────────────────────────────────────────────────

/**
 * Classify where a failure originated so callers can differentiate:
 *
 *  | Type              | Meaning                                             |
 *  |-------------------|-----------------------------------------------------|
 *  | FUNCTION_TIMEOUT  | Vercel Edge Function hit its 30 s wall-clock limit  |
 *  | PROVIDER_TIMEOUT  | Anthropic API took too long (upstream timeout)      |
 *  | RATE_LIMIT        | 429 from Anthropic or Google APIs                   |
 *  | AUTH_ERROR        | Bad/missing API key                                 |
 *  | STREAM_ERROR      | Generic mid-stream failure after streaming began    |
 *  | UNKNOWN_ERROR     | Anything else                                       |
 */
function classifyError(error: unknown, streamStartedAt: number | null): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes('timeout') || msg.includes('timed out')) {
    if (streamStartedAt && Date.now() - streamStartedAt > 25_000) return 'FUNCTION_TIMEOUT';
    return 'PROVIDER_TIMEOUT';
  }
  if (msg.includes('rate limit') || msg.includes('429')) return 'RATE_LIMIT';
  if (msg.includes('authentication') || msg.includes('401')) return 'AUTH_ERROR';
  if (streamStartedAt) return 'STREAM_ERROR';
  return 'UNKNOWN_ERROR';
}

// ── Main route handler ─────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'; // Never pre-render this streaming endpoint
export const maxDuration = 30; // Vercel Function max duration (seconds)

export async function POST(request: NextRequest) {
  // Track when streaming begins — used to distinguish FUNCTION_TIMEOUT vs PROVIDER_TIMEOUT
  let streamStartedAt: number | null = null;
  const FUNCTION_TIMEOUT_BUDGET = 25_000; // 25 s; 5 s buffer before Vercel's 30 s hard limit

  try {
    const { location, preferences = '', userLocation, radius = 10000 } =
      await request.json();

    if (!location) {
      return errorJson('Location is required', 400);
    }
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.CLAUDE_API_KEY) {
      return errorJson('AI Gateway API key not configured', 500);
    }
    if (!process.env.GOOGLE_PLACES_API_KEY) {
      return errorJson('Google Places API key not configured', 500);
    }

    // ── Step 1: Resolve location ───────────────────────────────────────────
    let searchLocation = location;
    let userCoords = userLocation as { lat: number; lng: number } | undefined;

    const coordsMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      try {
        const gc = await reverseGeocode(lat, lng);
        if (gc.results?.[0]) {
          searchLocation = gc.results[0].formatted_address;
          userCoords = { lat, lng };
        }
      } catch {
        // keep original location string
      }
    }

    // ── Step 2: Build Places API query ─────────────────────────────────────
    let searchQuery = `restaurants in ${searchLocation}`;
    let searchType = 'restaurant';

    if (preferences.trim()) {
      const clean = preferences.replace(/[^\w\s&'-]/g, '').replace(/\s+/g, ' ').trim();
      if (clean) {
        const lower = clean.toLowerCase();
        searchQuery = `${clean} restaurants in ${searchLocation}`;
        if (lower.includes('cafe') || lower.includes('coffee shop')) {
          searchType = 'cafe';
          searchQuery = `${clean} in ${searchLocation}`;
        } else if (lower.includes('bar') || lower.includes('pub') || lower.includes('drinks')) {
          searchType = 'bar';
          searchQuery = `${clean} in ${searchLocation}`;
        }
      }
    }

    const searchReq: PlaceSearchRequest = {
      textQuery: searchQuery,
      maxResultCount: 20,
      languageCode: 'en',
      ...(userCoords && {
        locationBias: {
          circle: {
            center: { latitude: userCoords.lat, longitude: userCoords.lng },
            radius,
          },
        },
      }),
      ...(searchType !== 'restaurant' && { includedType: searchType }),
    };

    // ── Step 3: Fetch and process places ──────────────────────────────────
    const placesData = await searchPlacesText(searchReq);

    if (!placesData.places?.length) {
      return new Response(
        JSON.stringify({ restaurants: [], message: 'No places found in the specified location' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const restaurantPromises = placesData.places.slice(0, 20).map(async (place) => {
      try {
        if (
          !place.currentOpeningHours?.weekdayDescriptions ||
          place.businessStatus === 'CLOSED_TEMPORARILY'
        )
          return null;

        // Local time for this restaurant
        let localTime = new Date();
        if (place.location) {
          localTime = await getLocationTime(place.location.latitude, place.location.longitude);
        }

        // Very conservative open-check: if Google says CLOSED_PERMANENTLY skip it
        if (place.businessStatus === 'CLOSED_PERMANENTLY') return null;

        // Photo URL
        let photoUrl: string | undefined;
        if (place.photos?.[0]) {
          const ref = place.photos[0].name.split('/photos/')[1];
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
        }

        // Per-restaurant AI summary via AI Gateway (generateText for non-streaming)
        let aiRecommendation = '';
        if (place.reviews?.length) {
          const reviewTexts = place.reviews
            .slice(0, 3)
            .map((r) => r.text?.text)
            .filter((t): t is string => !!t && t.length > 0);

          if (reviewTexts.length) {
            try {
              const { text } = await generateText({
                model: AI_MODEL,
                messages: [
                  {
                    role: 'user',
                    content: `You are a restaurant critic. Based on these reviews for "${place.displayName?.text}" (${place.rating}★, ${place.formattedAddress}):
${reviewTexts.map((t, i) => `${i + 1}. "${t.substring(0, 200)}"`).join('\n')}

Write 2-3 sentences summarizing what diners love, the standout dishes, and the atmosphere. Be specific and vivid. No quotes around your response.`,
                  },
                ],
                maxOutputTokens: 100,
              });
              aiRecommendation = text.trim().replace(/^["']|["']$/g, '');
            } catch {
              // fall through to rating-based fallback
            }
          }
        }

        if (!aiRecommendation) {
          const r = place.rating || 0;
          const label = r >= 4.5 ? 'highly rated' : r >= 4.0 ? 'well reviewed' : r >= 3.5 ? 'popular' : 'local';
          aiRecommendation = `A ${label} restaurant with ${r}/5 stars.`;
        }

        const restaurant: Restaurant = {
          id: place.id,
          name: place.displayName?.text || 'Unknown Restaurant',
          rating: place.rating || 0,
          address: place.formattedAddress || 'Address not available',
          phone: place.nationalPhoneNumber,
          website: place.websiteUri,
          googleMapsUrl:
            place.googleMapsUri ||
            (place.location
              ? `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}`
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName?.text || '')}`),
          isOpen: place.currentOpeningHours?.openNow ?? false,
          openingHours: place.currentOpeningHours?.weekdayDescriptions,
          priceLevel:
            place.priceLevel === 'PRICE_LEVEL_INEXPENSIVE'
              ? 1
              : place.priceLevel === 'PRICE_LEVEL_MODERATE'
              ? 2
              : place.priceLevel === 'PRICE_LEVEL_EXPENSIVE'
              ? 3
              : place.priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE'
              ? 4
              : undefined,
          photoUrl,
          geometry: place.location
            ? { lat: place.location.latitude, lng: place.location.longitude }
            : undefined,
          distance:
            userCoords && place.location
              ? calculateDistance(
                  userCoords.lat,
                  userCoords.lng,
                  place.location.latitude,
                  place.location.longitude
                )
              : undefined,
          aiRecommendation,
        };

        return restaurant;
        // suppress unused variable warning  
        void localTime;
      } catch {
        return null;
      }
    });

    const restaurants = (await Promise.all(restaurantPromises)).filter(
      (r): r is Restaurant => r !== null
    );

    // Sort: open first, then by distance, then by rating
    const rankedRestaurants = restaurants
      .filter((r) => r.isOpen)
      .sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          if (Math.abs(a.distance - b.distance) > 0.5) return a.distance - b.distance;
        }
        return b.rating - a.rating;
      })
      .slice(0, 10);

    // ── Step 4: Stream the AI summary using Vercel AI SDK ─────────────────
    streamStartedAt = Date.now();

    // Encode restaurant metadata as a JSON header so the client can render
    // cards before the AI summary arrives.
    const metaHeader = JSON.stringify({
      type: 'meta',
      restaurants: rankedRestaurants,
      location: searchLocation,
      preferences,
    });

    const summaryPrompt = `You are a friendly, knowledgeable local restaurant guide. The user searched for "${preferences || 'restaurants'}" in ${searchLocation}.

Here are the top ${rankedRestaurants.length} results:
${rankedRestaurants
  .map(
    (r, i) =>
      `${i + 1}. ${r.name} (${r.rating}★${r.distance ? `, ${r.distance.toFixed(1)} km away` : ''}${r.priceLevel ? `, ${'$'.repeat(r.priceLevel)}` : ''}) — ${r.aiRecommendation}`
  )
  .join('\n')}

Write a helpful overview (4–6 sentences) that includes:
1. The overall dining scene for this search — what cuisines and price ranges are available
2. Your #1 pick with a specific reason why (mention a standout dish or feature)
3. A good runner-up for a different vibe or cuisine
4. One practical tip (best time to visit, parking, reservations, etc.)

Be conversational and specific. Reference actual restaurant names.`;

    const result = streamText({
      model: AI_MODEL,
      messages: [{ role: 'user', content: summaryPrompt }],
      maxOutputTokens: 400,
    });

    // Build an SSE stream:
    //   data: {"type":"meta","restaurants":[...]}       ← restaurants JSON (once)
    //   data: {"type":"delta","text":"..."}             ← AI text chunks
    //   data: {"type":"done","duration":1234}           ← completion signal
    //   data: {"type":"error","errorType":"...","message":"..."}  ← on failure
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Always send restaurant data first so the UI can render cards immediately
        controller.enqueue(encoder.encode(`data: ${metaHeader}\n\n`));

        try {
          for await (const chunk of result.textStream) {
            // Abort if we're approaching the function timeout budget
            if (Date.now() - streamStartedAt! > FUNCTION_TIMEOUT_BUDGET) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'error',
                    errorType: 'FUNCTION_TIMEOUT',
                    message: 'Stream aborted: approaching Vercel Edge Function time limit',
                  })}\n\n`
                )
              );
              controller.close();
              return;
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`
              )
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                duration: Date.now() - streamStartedAt!,
              })}\n\n`
            )
          );
        } catch (streamErr) {
          const errorType = classifyError(streamErr, streamStartedAt);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                errorType,
                message: streamErr instanceof Error ? streamErr.message : 'Stream failed',
              })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    // Fire-and-forget background analytics
    Promise.all([
      saveSearchHistory(searchLocation, preferences, rankedRestaurants.length, userCoords),
      updateKeywords(preferences),
    ]).catch(() => {});

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Vercel-Cache': 'BYPASS',
        // Surface timing for RCA demos
        'X-Stream-Start': String(streamStartedAt),
      },
    });
  } catch (error) {
    const errorType = classifyError(error, streamStartedAt);
    console.error(`[${errorType}] Restaurant streaming error:`, error);

    // If streaming already started, send error over SSE
    if (streamStartedAt) {
      const enc = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(ctrl) {
            ctrl.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  errorType,
                  message: error instanceof Error ? error.message : 'Unknown error',
                  duration: Date.now() - streamStartedAt!,
                })}\n\n`
              )
            );
            ctrl.close();
          },
        }),
        { status: 500, headers: { 'Content-Type': 'text/event-stream' } }
      );
    }

    // Otherwise fall back to plain JSON error
    return errorJson(
      `[${errorType}] ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

function errorJson(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
