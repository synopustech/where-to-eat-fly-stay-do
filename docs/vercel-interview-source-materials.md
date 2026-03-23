# Vercel Interview Source Materials

## Quick Reference Guide

### AI Gateway

**What it is:**
- Unified API to access hundreds of AI models through a single endpoint
- Available on all plans
- No markup on tokens (same price as provider directly)

**Key Features:**
- One key, hundreds of models
- Unified API - switch providers with minimal code changes
- High reliability - automatic retries if one provider fails
- Embeddings support
- Spend monitoring
- Bring Your Own Key (BYOK) support

**Code Example:**
```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'anthropic/claude-sonnet-4.6',
  prompt: 'What is the capital of France?',
});
```

**Your App Uses:**
- [`src/app/api/restaurants/search/route.ts`](../src/app/api/restaurants/search/route.ts:11) - Uses `gateway('anthropic/claude-haiku-4-5')`
- [`src/app/api/restaurants/search-streaming/route.ts`](../src/app/api/restaurants/search-streaming/route.ts) - Uses streaming with AI Gateway

---

### Vercel CDN Cache

**What it is:**
- Global network of data centers caching content closer to users
- Reduces latency, load on origin, makes site faster

**When to Use:**
- Static pages (same for all users)
- API responses that don't change frequently
- Static assets (images, fonts, JS bundles)
- Server-rendered pages with predictable cache lifetimes

**Cache Control Headers:**
```typescript
// In Vercel Function
export async function GET() {
  return new Response('Cache Control example', {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=1',
      'CDN-Cache-Control': 'public, s-maxage=60',
      'Vercel-CDN-Cache-Control': 'public, s-maxage=3600',
    },
  });
}
```

**Header Directives:**
- `s-maxage=N` - CDN cache time (Vercel only)
- `max-age=N` - Browser cache time
- `stale-while-revalidate=Z` - Serve stale while revalidating
- `Vary` - Cache by specific request headers (e.g., location)

**Your App Uses:**
- [`src/app/api/suggestions/route.ts`](../src/app/api/suggestions/route.ts:141-144) - Uses `s-maxage=30, stale-while-revalidate=86400`

---

### Fluid Compute

**What it is:**
- Next-generation compute model combining serverless scalability with server concurrency
- Optimized for AI workloads

**Benefits:**
- No cold starts (instances stay warm)
- Concurrent invocations (multiple requests share instance)
- Background tasks (run after response)
- Longer duration (AI workloads)
- Cost efficiency (pay for actual compute)

**Your App Uses:**
- `generateText()` from Vercel AI SDK
- `gateway()` for AI Gateway routing
- Background tasks with `Promise.all()`

---

## Interview Talking Points

### "How do you use Vercel AI Gateway?"

**Answer:**
"I use AI Gateway in my restaurant recommendation app. It provides a unified API to access Claude models through the Vercel AI SDK. The key benefits are:
- Single API key for multiple providers
- Automatic failover if one provider fails
- Spend monitoring across providers
- No markup on token costs"

### "How do you use Vercel CDN caching?"

**Answer:**
"I use CDN caching in two ways:
1. **API responses** - Set `Cache-Control` headers with `s-maxage` for edge caching
2. **Static assets** - Automatically cached on Vercel's global network

For my suggestions API, I use `s-maxage=30, stale-while-revalidate=86400` which means:
- Edge caches serve fresh data for 30 seconds
- After 30s, serve stale data instantly while revalidating in background
- Users never wait; data is "fresh enough"

### "How do you use Fluid compute?"

**Answer:**
"My app uses Fluid compute through the Vercel AI SDK:
- `generateText()` runs on Fluid automatically
- `gateway()` routes through AI Gateway on Fluid
- Background tasks run after response (no cold starts)
- Multiple requests share the same instance (concurrent invocations)

This means faster AI responses, lower costs, and no cold starts."

---

## Key Documentation Links

### AI Gateway
- https://vercel.com/docs/ai-gateway
- https://vercel.com/docs/ai-gateway/getting-started
- https://vercel.com/docs/ai-gateway/models-and-providers
- https://vercel.com/docs/ai-gateway/models-and-providers/provider-options

### CDN Cache
- https://vercel.com/docs/caching/cdn-cache
- https://vercel.com/docs/caching/cache-control-headers
- https://vercel.com/docs/incremental-static-regeneration

### Fluid Compute
- https://vercel.com/docs/fluid-compute
- https://vercel.com/blog/fluid-compute-evolving-serverless-for-ai-workloads

---

## Your Project's Vercel Integration

### API Routes Using Fluid/CDN

| Route | Fluid Feature | CDN Feature |
|-------|--------------|-------------|
| `/api/restaurants/search` | `generateText()` on Fluid | - |
| `/api/restaurants/search-streaming` | `streamText()` on Fluid | - |
| `/api/suggestions` | - | `s-maxage=30, stale-while-revalidate=86400` |
| `/api/flights/generate` | - | - |

### Cache Headers in Your App

```typescript
// src/app/api/suggestions/route.ts:141-144
response.headers.set(
  'Cache-Control',
  'public, s-maxage=30, stale-while-revalidate=86400'
);
```

This means:
- **s-maxage=30**: Edge cache serves fresh data for 30 seconds
- **stale-while-revalidate=86400**: Serve stale data for up to 24 hours while revalidating
- **Users never wait** - instant responses from edge cache

---

## Quick Summary for Phone

**AI Gateway:**
- One API key, hundreds of models
- Automatic failover
- Spend monitoring
- No markup on tokens

**CDN Caching:**
- Global edge network
- `s-maxage` for edge cache
- `stale-while-revalidate` for instant responses
- Your app uses: `s-maxage=30, stale-while-revalidate=86400`

**Fluid Compute:**
- No cold starts
- Concurrent invocations
- Background tasks
- Cost efficient (pay for actual compute)
