# Interview Review: Days 1–4 — The AI SDK Transition

## What the Interviewer Is Testing

Vercel cares that you can explain **why** you use their AI SDK instead of calling Anthropic's API directly, and that you understand the operational implications of streaming at scale. Expect questions like:

- "Walk me through how you implemented streaming in this app."
- "How do you handle a stream that fails halfway through?"
- "What's the difference between a function timeout and a provider error?"
- "Why would you use AI Gateway instead of calling Anthropic directly?"

---

## What We Built

### 1. `streamText` for the AI Recommendation Summary

**File:** `src/app/api/restaurants/search-streaming/route.ts`

We use the Vercel AI SDK's `streamText` to generate the overall recommendation summary **while** the restaurant cards are already visible on screen.

```ts
import { streamText, generateText, gateway } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

function getModel() {
  if (process.env.AI_GATEWAY_API_KEY) {
    return gateway('anthropic/claude-haiku-4-5');   // Vercel AI Gateway path
  }
  const anthropic = createAnthropic({ apiKey: process.env.CLAUDE_API_KEY });
  return anthropic('claude-haiku-4-5-20251001');    // Direct Anthropic fallback
}

const result = streamText({
  model: getModel(),
  messages: [{ role: 'user', content: summaryPrompt }],
  maxOutputTokens: 400,
});
```

**Interview angle:** `streamText` returns a **synchronous** object with a `.textStream` async iterable — it does not return a Promise. This is a common gotcha. You `for await` over it rather than `await`ing the call itself.

---

### 2. `generateText` for Per-Restaurant Snippets

Each restaurant card gets a 2–3 sentence AI review generated from real Google Reviews. These are **non-streaming** (`generateText`) because they need to complete before the `meta` SSE event is sent.

```ts
const { text } = await generateText({
  model: getModel(),
  messages: [{ role: 'user', content: reviewPrompt }],
  maxOutputTokens: 100,
});
```

**Interview angle:** We deliberately chose `generateText` here (not `streamText`) because these calls run in parallel via `Promise.all`. Having partial streaming for 10 cards simultaneously would add complexity with no UX benefit — the card can't show partial text meaningfully.

---

### 3. SSE Stream Architecture — Two-Phase Response

We send two phases over a single HTTP response:

```
data: {"type":"meta","restaurants":[...]}      ← Phase 1: cards render immediately
data: {"type":"delta","text":"..."}            ← Phase 2: AI summary arrives progressively
data: {"type":"delta","text":"..."}
...
data: {"type":"done","duration":1842}
```

**Why not use the AI SDK's built-in streaming response?**  
The SDK *does* support structured outputs via `Output.object()`, `Output.array()`, etc.—but that solves a different problem (making AI generate JSON). Our challenge is **architectural**: we need a two-phase response pattern where restaurant data from our database arrives *first* (the `meta` frame), then the AI summary streams in (the `delta` frames). The SDK's `streamText` and `toDataStreamResponse()` are designed for single-source (AI-only) responses. Our custom `ReadableStream` orchestrates the blend: push the restaurant array immediately so cards render, then stream summary deltas behind it.

---

### 4. Stream Interruption Handling — The Senior Angle

**File:** `src/app/api/restaurants/search-streaming/route.ts` — `classifyError()`

This is the key differentiator a senior engineer explains:

```ts
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
```

| Error Type | What It Means | Response to User |
|---|---|---|
| `FUNCTION_TIMEOUT` | Vercel's 30s wall-clock limit hit | "Summary truncated — hit Edge Function limit" |
| `PROVIDER_TIMEOUT` | Anthropic upstream took too long | "AI summary unavailable — provider timed out" |
| `RATE_LIMIT` | 429 from Anthropic or Google | Show rate limit messaging |
| `AUTH_ERROR` | Bad/missing API key (deployment issue) | Operational alert |
| `STREAM_ERROR` | Mid-stream failure after data started flowing | "Please try again" |

We also proactively abort streaming **5 seconds before** the Vercel hard limit:

```ts
const FUNCTION_TIMEOUT_BUDGET = 25_000; // 25s — 5s before Vercel kills the function

if (Date.now() - streamStartedAt > FUNCTION_TIMEOUT_BUDGET) {
  // send FUNCTION_TIMEOUT SSE error event and close cleanly
}
```

**Why this matters in an interview:** A reactive timeout (waiting for the function to die) gives users a TCP reset error. The proactive approach sends a clean SSE error event, so the client displays a graceful message rather than a network failure.

---

### 5. AI Gateway — The "Senior" Angle

**What it is:** Vercel AI Gateway is a proxy layer that sits between your app and AI providers (Anthropic, OpenAI, etc.). You call `gateway('anthropic/claude-haiku-4-5')` — the Gateway handles routing, key management, retries, and observability.

**How we integrated it:**

```ts
// No @ai-sdk/anthropic needed — gateway() from 'ai' is enough
import { gateway } from 'ai';

const model = gateway('anthropic/claude-haiku-4-5');
```

The only required env var is `AI_GATEWAY_API_KEY` (set in Vercel dashboard). Your `CLAUDE_API_KEY` stays in Vercel — it's never exposed to the gateway call itself.

**What the Gateway gives you (key interview talking points):**

| Feature | Without Gateway | With Gateway |
|---|---|---|
| **Unified billing** | Separate invoices per provider | One Vercel bill |
| **Observability** | Custom logging only | Request traces, latency, token usage in Vercel dashboard |
| **Automatic retries** | You implement retry logic | Gateway retries transient failures |
| **Caching** | Not available on Anthropic directly | Gateway can cache identical prompts |
| **Rate limiting** | Provider limits only | Gateway adds project-level rate control |
| **Multi-provider** | One SDK per provider | Same `gateway()` call for OpenAI, Anthropic, Gemini |

**The "high-traffic restaurant search" talking point:**

> "During a Friday dinner rush, our app could get 200 concurrent searches. Without Gateway, each request hits Anthropic directly and we'd quickly 429. With Gateway, I can set a project-level rate limit and it queues excess requests rather than failing them. The cache also means if 50 people search for 'burgers in Sydney' within the same minute, only one Anthropic API call is made — the rest are served from cache."

---

### 6. Client-Side Stream Consumption

**File:** `src/app/page.tsx`

The client reads the SSE stream manually (not using the AI SDK's `useChat` hook, because we're mixing structured JSON + text in one stream):

```ts
// AbortController cancels in-flight streams when a new search starts
abortControllerRef.current?.abort();
const abortController = new AbortController();

const response = await fetch('/api/restaurants/search-streaming', {
  signal: abortController.signal,
  ...
});

const reader = response.body.getReader();
for await (const { done, value } of reader) {
  // parse SSE frames, dispatch meta/delta/done/error
}
```

**State machine the stream drives:**

```
loading=true
  → meta arrives  → loading=false, aiStreaming=true, cards render
  → delta arrives → aiSummary grows (progressive text)
  → done arrives  → aiStreaming=false, summary complete
  → error arrives → aiStreaming=false, show error message
```

---

## Expected Interview Questions & Answers

**Q: Why did you use `streamText` instead of just `generateText` for the summary?**

> The summary can take 3–5 seconds to generate. With `streamText`, the first words appear in ~500ms while the rest streams in. `generateText` would leave the user staring at a loading spinner for the full duration. The perceived performance difference is significant.

**Q: Couldn't you use the AI SDK's structured output feature (`Output.object()`) instead of custom SSE?**

> The SDK's structured outputs are for making the AI model generate JSON matching a schema — the AI itself produces the JSON. Our `meta` frame contains *our* restaurant data from the database, not from the AI. We need to send our data first so the cards appear instantly, then stream the AI text afterward. That's a two-phase orchestration pattern the SDK doesn't natively support, so we use custom SSE.

**Q: How do you know if a stream failure is a Vercel timeout vs an Anthropic error?**

> I track `streamStartedAt` — the timestamp when I first call `streamText`. If an error arrives more than 25 seconds after that, it's almost certainly Vercel's function timeout killing the process. If the error arrives quickly with an Anthropic error message, it's a provider error. I surface different messages to the user for each case.

**Q: What happens if the user starts a second search before the first stream finishes?**

> I store an `AbortController` ref. When a new search starts, I call `.abort()` on the previous controller before fetching. The `fetch` call gets aborted, the reader loop detects `abortController.signal.aborted` and breaks, and the `AbortError` is caught and silently ignored. This prevents the previous stream's `done`/`error` handlers from clobbering the new search's state.

**Q: Why use AI Gateway with `gateway()` instead of `@ai-sdk/anthropic` directly?**

> Using `@ai-sdk/anthropic` directly means my Anthropic API key leaves my Vercel environment on every request. With AI Gateway, Vercel holds the provider key — I only need `AI_GATEWAY_API_KEY` in my app. I also get free request tracing, token usage metrics, and the ability to switch providers (e.g., OpenAI → Anthropic) by changing one string without touching any other code.

---

## File Map

| File | AI SDK Usage |
|---|---|
| `src/app/api/restaurants/search-streaming/route.ts` | `streamText` (summary), `generateText` (per-restaurant), `gateway()` |
| `src/app/api/restaurants/search/route.ts` | `generateText` (non-streaming fallback endpoint) |
| `src/app/page.tsx` | Manual SSE consumer, `AbortController` for stream lifecycle |
