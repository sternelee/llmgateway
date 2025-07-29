# LLMGateway Cloudflare Workers Migration Guide

This guide will help you migrate your LLMGateway project from PostgreSQL + Redis to Cloudflare Workers with D1 database.

## Overview

The migration includes:

- **Database**: PostgreSQL → Cloudflare D1 (SQLite)
- **Cache/Queue**: Redis → Cloudflare KV + Durable Objects
- **Runtime**: Node.js → Cloudflare Workers
- **Deployment**: Self-hosted → Cloudflare edge network

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler
   ```
3. **Authentication**: Login to Cloudflare
   ```bash
   wrangler login
   ```

## Migration Steps

### 1. Database Schema Migration

The PostgreSQL schema has been converted to SQLite-compatible format:

- **Timestamps**: `timestamp` → `integer({ mode: "timestamp" })`
- **Booleans**: `boolean` → `integer({ mode: "boolean" })`
- **Decimals**: `decimal` → `text` (manually parse as needed)
- **JSON**: `json` → `text` (stringify/parse manually)
- **Unique constraints**: Converted to `uniqueIndex`

### 2. Application Changes

#### Gateway (`apps/gateway/`)

- **Entry point**: `src/worker.d1.ts` (new Workers-compatible version)
- **Database**: Uses D1 with `createD1Database(env.DB)`
- **Cache**: Redis → KV namespace via `KVCache` class
- **Health check**: Updated to test D1 + KV connections

#### API (`apps/api/`)

- **Entry point**: `src/worker.d1.ts` (new Workers-compatible version)
- **Database**: Uses D1 with `createD1Database(env.DB)`
- **Authentication**: Compatible with Workers environment
- **Stripe webhooks**: Adapted for Workers runtime

#### Database Package (`packages/db/`)

- **Schema**: New D1-compatible schema in `src/schema.d1.ts`
- **Connection**: New D1 connection handler in `src/db.d1.ts`
- **Config**: Drizzle config for D1 in `drizzle.config.d1.ts`

### 3. Configuration Files

#### Wrangler Configuration

Each app has a `wrangler.toml` file with:

- D1 database bindings
- KV namespace bindings
- Environment variables
- Route configuration

#### Build Scripts

Updated `package.json` files include:

- `build:worker`: Build for Workers deployment
- `dev:worker`: Local development with Wrangler
- `deploy`: Deploy to production
- `deploy:staging`: Deploy to staging

## Deployment

### Automated Deployment

Use the provided deployment script:

```bash
# Deploy to staging
./deploy-workers.sh staging

# Deploy to production
./deploy-workers.sh production
```

### Manual Deployment

1. **Create D1 Database**:

   ```bash
   wrangler d1 create llmgateway-prod
   ```

2. **Create KV Namespace**:

   ```bash
   wrangler kv:namespace create "CACHE"
   ```

3. **Update Configuration**:
   Edit `wrangler.toml` files with actual IDs

4. **Deploy Schema**:

   ```bash
   cd packages/db
   pnpm generate-d1
   wrangler d1 execute llmgateway-prod --file=./migrations/*.sql
   ```

5. **Deploy Workers**:
   ```bash
   cd apps/gateway && wrangler deploy
   cd apps/api && wrangler deploy
   ```

### Environment Secrets

Set required secrets using Wrangler:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GOOGLE_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put POSTHOG_API_KEY
```

## Key Differences

### Database Operations

```typescript
// Before (PostgreSQL)
await db.query.user.findFirst({
  where: { id: { eq: userId } },
});

// After (D1)
await db.query.user.findFirst({
  where: (user, { eq }) => eq(user.id, userId),
});
```

### Caching

```typescript
// Before (Redis)
await redisClient.set(key, value, "EX", 60);

// After (KV)
await kvCache.set(key, value, { expirationTtl: 60 });
```

### Background Tasks

- **Before**: Background workers with Redis queues
- **After**: Use Durable Objects or scheduled Workers for background tasks

## Limitations

### D1 Limitations

- **Database size**: 10GB limit per database
- **Concurrent writes**: Limited (good for read-heavy workloads)
- **Complex queries**: Some PostgreSQL features not available

### KV Limitations

- **Write frequency**: 1 write per second per key
- **Value size**: 25MB limit
- **Eventually consistent**: Not immediately consistent globally

### Workers Limitations

- **CPU time**: 10ms-50ms limit per request (varies by plan)
- **Memory**: 128MB limit
- **Subrequests**: 50-1000 limit per request

## Testing

1. **Local Development**:

   ```bash
   cd apps/gateway && pnpm dev:worker
   cd apps/api && pnpm dev:worker
   ```

2. **Health Checks**:

   - Gateway: `https://gateway.yourdomain.com/`
   - API: `https://api.yourdomain.com/`

3. **API Documentation**:
   - Gateway: `https://gateway.yourdomain.com/docs`
   - API: `https://api.yourdomain.com/docs`

## Monitoring

Use Cloudflare dashboard to monitor:

- **Workers Analytics**: Request volume, errors, performance
- **D1 Analytics**: Query performance, storage usage
- **KV Analytics**: Read/write operations
- **Real-time logs**: Debug issues in production

## Rollback Plan

If issues arise, you can:

1. **DNS**: Switch back to original deployment
2. **Data**: Export D1 data back to PostgreSQL if needed
3. **Workers**: Keep both versions deployed during transition

## Support

- **Cloudflare Docs**: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers/)
- **D1 Documentation**: [developers.cloudflare.com/d1](https://developers.cloudflare.com/d1/)
- **Discord**: Cloudflare Developers Discord
- **Community**: Cloudflare Community Forums
