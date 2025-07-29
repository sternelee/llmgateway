#!/bin/bash

# LLMGateway Cloudflare Workers Deployment Script

set -e

echo "🚀 Starting LLMGateway Cloudflare Workers deployment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "❌ You are not logged in to Cloudflare. Please run:"
    echo "wrangler login"
    exit 1
fi

# Environment setup
ENVIRONMENT=${1:-staging}
echo "📦 Deploying to environment: $ENVIRONMENT"

# Build the applications for Workers
echo "🔧 Building gateway worker..."
cd apps/gateway
pnpm build:worker
echo "✅ Gateway worker built successfully"

echo "🔧 Building API worker..."
cd ../api
pnpm build:worker
echo "✅ API worker built successfully"

# Go back to root
cd ../..

# Create D1 databases if they don't exist
echo "🗄️ Setting up D1 databases..."

if [ "$ENVIRONMENT" = "production" ]; then
    echo "Creating production D1 database..."
    GATEWAY_DB_ID=$(wrangler d1 create llmgateway-prod --output json | jq -r '.result.uuid')
    API_DB_ID=$GATEWAY_DB_ID
else
    echo "Creating staging D1 database..."
    GATEWAY_DB_ID=$(wrangler d1 create llmgateway-staging --output json | jq -r '.result.uuid')
    API_DB_ID=$GATEWAY_DB_ID
fi

echo "✅ D1 database created with ID: $GATEWAY_DB_ID"

# Create KV namespaces
echo "🗄️ Setting up KV namespaces..."

if [ "$ENVIRONMENT" = "production" ]; then
    KV_ID=$(wrangler kv:namespace create "CACHE" --output json | jq -r '.result.id')
else
    KV_ID=$(wrangler kv:namespace create "CACHE" --preview --output json | jq -r '.result.id')
fi

echo "✅ KV namespace created with ID: $KV_ID"

# Update wrangler.toml files with the actual IDs
echo "📝 Updating wrangler.toml configuration files..."

# Update gateway wrangler.toml
sed -i.bak "s/your-${ENVIRONMENT}-d1-database-id/$GATEWAY_DB_ID/g" apps/gateway/wrangler.toml
sed -i.bak "s/your-${ENVIRONMENT}-kv-namespace-id/$KV_ID/g" apps/gateway/wrangler.toml

# Update API wrangler.toml
sed -i.bak "s/your-${ENVIRONMENT}-d1-database-id/$API_DB_ID/g" apps/api/wrangler.toml

echo "✅ Configuration files updated"

# Push database schema to D1
echo "🗄️ Pushing database schema to D1..."
cd packages/db
pnpm generate-d1
wrangler d1 execute llmgateway-${ENVIRONMENT} --file=./migrations/*.sql
cd ../..

echo "✅ Database schema deployed to D1"

# Deploy workers
echo "🚀 Deploying gateway worker..."
cd apps/gateway
wrangler deploy --env $ENVIRONMENT
cd ..

echo "🚀 Deploying API worker..."
cd api
wrangler deploy --env $ENVIRONMENT
cd ../..

echo "✅ Deployment completed successfully!"
echo ""
echo "🎉 Your LLMGateway is now deployed on Cloudflare Workers!"
echo ""
echo "📋 Next steps:"
echo "1. Set up your secrets using 'wrangler secret put <SECRET_NAME>'"
echo "2. Configure your custom domain in Cloudflare Dashboard"
echo "3. Update the domain URLs in the wrangler.toml files"
echo "4. Test your deployment"
echo ""
echo "🔐 Required secrets to set:"
echo "- OPENAI_API_KEY"
echo "- ANTHROPIC_API_KEY"
echo "- GOOGLE_API_KEY"
echo "- STRIPE_SECRET_KEY"
echo "- STRIPE_WEBHOOK_SECRET"
echo "- BETTER_AUTH_SECRET"
echo "- POSTHOG_API_KEY"