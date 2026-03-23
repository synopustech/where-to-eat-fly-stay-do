# Vercel Senior Support Engineer - Interview Scenarios

## Scenario 1: AI Gateway Troubleshooting

### The Problem
A customer reports that their AI requests are failing with a 500 error. They're using the AI Gateway with the following code:

```typescript
import { generateText } from 'ai';

export async function GET() {
  const { text } = await generateText({
    model: 'anthropic/claude-3-5-sonnet',
    prompt: 'Explain quantum computing',
  });
  return Response.json({ result: text });
}
```

### Your Investigation Steps
1. Check the customer's environment variables
2. Verify AI Gateway API key is set
3. Check Vercel dashboard for error logs
4. Review the AI Gateway dashboard for usage metrics

### Expected Solution
- Verify `AI_GATEWAY_API_KEY` environment variable is set
- Check if the API key has sufficient credits
- Review AI Gateway dashboard for specific error messages
- Check if the model name is correct (should be `anthropic/claude-3-5-sonnet-v2:0`)

### Key Points to Mention
- AI Gateway requires `AI_GATEWAY_API_KEY` environment variable
- Check the AI Gateway dashboard for detailed error messages
- Models have specific naming conventions (provider/model-name)
- AI Gateway provides automatic retries and failover

---

## Scenario 2: CDN Cache Invalidation

### The Problem
A customer deployed a new version of their Next.js app, but users are still seeing old content. The cache isn't being invalidated properly.

### Your Investigation Steps
1. Check if the deployment was successful
2. Verify cache headers in the response
3. Check if ISR is configured correctly
4. Review the cache key configuration

### Expected Solution
- For static pages: ISR automatically invalidates on deploy
- For dynamic content: Use `Cache-Control` headers with `s-maxage`
- For immediate invalidation: Use Vercel's cache purge API
- For user-specific content: Use `Vary` header with appropriate request headers

### Key Points to Mention
- Vercel's CDN automatically invalidates on deploy for ISR
- `s-maxage` controls CDN cache time
- `stale-while-revalidate` allows serving stale content while revalidating
- `Vary` header creates separate cache entries for different request headers
- Cache purge API can manually invalidate cache when needed

---

## Scenario 3: Fluid Compute Performance Issue

### The Problem
A customer reports that their AI-powered API is slow, taking 5+ seconds to respond. They're using Fluid compute.

### Your Investigation Steps
1. Check the function duration in Vercel dashboard
2. Review the AI SDK usage patterns
3. Check for network latency to AI provider
4. Verify if streaming is being used

### Expected Solution
- Use streaming for long-running AI responses
- Implement caching for repeated requests
- Use background tasks for non-urgent processing
- Consider using AI Gateway for better routing

### Key Points to Mention
- Fluid compute eliminates cold starts
- Concurrent invocations share the same instance
- Background tasks can run after response
- Streaming provides better UX for long-running AI tasks
- AI Gateway provides automatic retries and better routing

---

## Scenario 4: Customer Escalation - Enterprise Request

### The Problem
An enterprise customer needs custom routing rules for their AI Gateway requests. They want to route requests based on user location and have different models for different regions.

### Your Investigation Steps
1. Understand the customer's routing requirements
2. Review AI Gateway provider options
3. Check if custom headers can be used for routing
4. Propose a solution using AI Gateway features

### Expected Solution
- Use AI Gateway's provider options for fallback
- Implement custom routing in the application layer
- Use Vercel's edge config for region-based routing
- Consider using Vercel's regional deployments

### Key Points to Mention
- AI Gateway provides automatic failover between providers
- Provider options allow custom routing and fallback
- Vercel's edge config can store region-specific configurations
- Custom headers can be used for intelligent routing
- Enterprise customers can get custom support and SLAs

---

## Scenario 5: Debugging AI Gateway Integration

### The Problem
A customer is trying to use AI Gateway with the OpenAI SDK but getting authentication errors.

### Your Investigation Steps
1. Check the customer's code for correct API key usage
2. Verify the base URL is set correctly
3. Check if the API key has the correct permissions
4. Review AI Gateway authentication documentation

### Expected Solution
```typescript
// Correct way to use AI Gateway with OpenAI SDK
import { OpenAI } from 'openai';

const client = new OpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});
```

### Key Points to Mention
- AI Gateway uses `AI_GATEWAY_API_KEY` environment variable
- Base URL should be `https://ai-gateway.vercel.sh/v1`
- AI Gateway is compatible with OpenAI SDK
- Authentication is handled through Vercel's OIDC tokens
- Bring Your Own Key (BYOK) is supported for enterprise customers

---

## Scenario 6: Performance Optimization for AI Workloads

### The Problem
A customer's AI-powered application is experiencing high latency and costs. They want to optimize performance and reduce costs.

### Your Investigation Steps
1. Analyze the current AI usage patterns
2. Review caching strategies
3. Check for unnecessary AI calls
4. Propose optimization strategies

### Expected Solution
- Implement caching for repeated requests
- Use streaming for long-running AI tasks
- Implement background tasks for non-urgent processing
- Use AI Gateway's spend monitoring to track costs
- Consider using cheaper models for non-critical tasks

### Key Points to Mention
- Fluid compute reduces costs by sharing instances
- Caching reduces unnecessary AI calls
- Streaming provides better UX for long-running tasks
- AI Gateway provides spend monitoring and cost optimization
- Background tasks can run after response without blocking

---

## Scenario 7: Security and Rate Limiting

### The Problem
A customer is experiencing rate limiting issues with their AI Gateway integration. They want to understand how to manage rate limits effectively.

### Your Investigation Steps
1. Check the AI Gateway usage dashboard
2. Review the customer's request patterns
3. Check if rate limiting is configured
4. Propose solutions for rate limit management

### Expected Solution
- Use AI Gateway's built-in rate limiting
- Implement request queuing for high-volume applications
- Use AI Gateway's budget management
- Consider using multiple providers for load balancing

### Key Points to Mention
- AI Gateway provides automatic rate limit management
- Budget management can prevent unexpected costs
- Multiple providers can be configured for load balancing
- Request queuing can handle high-volume scenarios
- AI Gateway's observability features help track usage

---

## Scenario 8: Migration from Direct API to AI Gateway

### The Problem
A customer is currently using direct API calls to AI providers and wants to migrate to AI Gateway. They're concerned about the migration process.

### Your Investigation Steps
1. Review the customer's current implementation
2. Plan the migration strategy
3. Test the AI Gateway integration
4. Monitor the migration for issues

### Expected Solution
- Use AI Gateway's compatibility mode
- Gradually migrate endpoints
- Monitor for any issues during migration
- Update environment variables to use AI Gateway

### Key Points to Mention
- AI Gateway provides compatibility modes for existing integrations
- Migration can be done gradually without downtime
- AI Gateway's observability helps track migration progress
- Environment variables can be updated without code changes
- AI Gateway provides automatic failover during migration

---

## Scenario 9: Debugging Cache Issues

### The Problem
A customer's API responses are not being cached as expected. They're seeing inconsistent cache behavior.

### Your Investigation Steps
1. Check the `Cache-Control` headers in the response
2. Verify the response meets cache criteria
3. Check if the request method is GET or HEAD
4. Review the cache key configuration

### Expected Solution
- Ensure `Cache-Control` headers are set correctly
- Verify response doesn't contain `no-store` or `private`
- Check if the request method is GET or HEAD
- Use `Vary` header for user-specific content

### Key Points to Mention
- Vercel's CDN caches GET and HEAD requests only
- Response must not contain `no-store` or `private`
- `s-maxage` controls CDN cache time
- `Vary` header creates separate cache entries
- Cache invalidation happens automatically on deploy

---

## Scenario 10: Customer Support Workflow

### The Problem
A customer is experiencing issues with their Vercel deployment and needs immediate assistance. The issue is complex and requires coordination with multiple teams.

### Your Investigation Steps
1. Triage the issue and understand the impact
2. Gather all relevant information (logs, error messages)
3. Escalate to the appropriate team if needed
4. Communicate with the customer throughout the process

### Expected Solution
- Use Vercel's support tools to investigate
- Coordinate with engineering teams for complex issues
- Provide regular updates to the customer
- Document the issue and solution for future reference

### Key Points to Mention
- Vercel provides support tools for debugging
- Complex issues may require coordination with engineering
- Regular communication with customers is essential
- Documentation helps prevent future issues
- Enterprise customers get priority support

---

## Scenario 11: Streaming AI Responses

### The Problem
A customer wants to implement streaming AI responses for better user experience. They're currently using `generateText` which returns the full response at once.

### Your Investigation Steps
1. Review the customer's current implementation
2. Plan the migration to streaming
3. Test the streaming implementation
4. Monitor for any issues

### Expected Solution
```typescript
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: 'anthropic/claude-3-5-sonnet',
    messages,
  });
  
  return result.toDataStreamResponse();
}
```

### Key Points to Mention
- `streamText` provides better UX for long-running AI tasks
- Streaming allows partial responses to be sent immediately
- AI Gateway supports streaming for all providers
- Streaming reduces perceived latency
- Error handling is important for streaming implementations

---

## Scenario 12: Background Tasks with Fluid Compute

### The Problem
A customer wants to perform background processing after responding to a user request. They're concerned about the impact on response time.

### Your Investigation Steps
1. Review the customer's current implementation
2. Plan the background task implementation
3. Test the background task execution
4. Monitor for any issues

### Expected Solution
```typescript
export async function POST(req: Request) {
  // Process the request
  const data = await req.json();
  
  // Return response immediately
  const response = Response.json({ status: 'ok' });
  
  // Perform background tasks
  Promise.all([
    saveToDatabase(data),
    sendNotification(data),
    updateAnalytics(data),
  ]).catch(() => {
    // Silent fail for background tasks
  });
  
  return response;
}
```

### Key Points to Mention
- Fluid compute allows background tasks after response
- Background tasks don't block the response
- Silent fail for background tasks prevents errors
- Background tasks can run for extended periods
- Fluid compute's concurrency model is ideal for background tasks

---

## Scenario 13: AI Gateway Observability

### The Problem
A customer wants to monitor their AI Gateway usage and identify performance bottlenecks.

### Your Investigation Steps
1. Review the AI Gateway dashboard
2. Analyze usage patterns
3. Identify performance bottlenecks
4. Propose optimization strategies

### Expected Solution
- Use AI Gateway's observability features
- Monitor latency and error rates
- Identify slow providers and fallback
- Optimize based on usage patterns

### Key Points to Mention
- AI Gateway provides detailed observability
- Monitor latency and error rates
- Identify slow providers and fallback
- Use spend monitoring to track costs
- Observability helps identify optimization opportunities

---

## Scenario 14: Custom Caching Strategy

### The Problem
A customer needs a custom caching strategy for their API. They want to cache responses based on user location and device type.

### Your Investigation Steps
1. Understand the customer's caching requirements
2. Plan the caching strategy
3. Implement the caching headers
4. Test the caching behavior

### Expected Solution
```typescript
export async function GET(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  const device = request.headers.get('user-agent');
  
  const response = Response.json({ data: 'content' }, {
    headers: {
      'Cache-Control': 's-maxage=3600',
      'Vary': 'X-Vercel-IP-Country, User-Agent',
    },
  });
  
  return response;
}
```

### Key Points to Mention
- `Vary` header creates separate cache entries
- `X-Vercel-IP-Country` for location-based caching
- `User-Agent` for device-based caching
- Multiple `Vary` headers can be combined
- Caching improves performance and reduces costs

---

## Scenario 15: Enterprise AI Gateway Configuration

### The Problem
An enterprise customer needs custom AI Gateway configuration for their multi-tenant application. They want to route requests based on tenant ID.

### Your Investigation Steps
1. Understand the customer's multi-tenant requirements
2. Plan the AI Gateway configuration
3. Implement tenant-specific routing
4. Test the configuration

### Expected Solution
- Use AI Gateway's provider options
- Implement tenant-specific routing in the application
- Use Vercel's edge config for tenant configuration
- Monitor usage per tenant

### Key Points to Mention
- AI Gateway supports custom provider options
- Tenant-specific routing can be implemented in the application
- Vercel's edge config stores tenant configurations
- AI Gateway's observability tracks usage per tenant
- Enterprise customers get custom support and SLAs
