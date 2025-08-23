# 🔧 Environment Variables Setup for Render

## Required Environment Variables for Backend

Add these environment variables in your Render service dashboard:

### 1. Clerk Authentication
```
CLERK_SECRET_KEY=your_clerk_secret_key_here
CLERK_JWKS_URL=https://your-app-name.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-app-name.clerk.accounts.dev
```

### 2. Pinecone Vector Database
```
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=nova-rag-index
```

### 3. Supabase Database
```
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 4. OpenAI
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 5. Optional Frontend URL
```
FRONTEND_URL=https://nova-5ja4nyndz-adityas-projects-73ecbb73.vercel.app
```

## How to Find Your Clerk URLs

1. Go to your Clerk Dashboard: https://dashboard.clerk.dev/
2. Select your application
3. Go to "API Keys" section
4. Your JWKS URL format: `https://[your-frontend-url].clerk.accounts.dev/.well-known/jwks.json`
5. Your Issuer URL format: `https://[your-frontend-url].clerk.accounts.dev`

## How to Create Pinecone Index

1. Go to Pinecone Console: https://app.pinecone.io/
2. Create a new index named: `nova-rag-index`
3. Set dimensions: `1536` (for OpenAI text-embedding-3-small)
4. Set metric: `cosine`
5. Copy your API key from the API Keys section

## Issues Fixed in This Update

- ✅ CORS configuration updated to allow Vercel domain
- ✅ Fixed undefined `collections` variable in semantic_search.py
- ✅ Added proper error handling for Pinecone index
- ✅ Simplified source management for multi-source chat

## Next Steps

1. Add all environment variables in Render dashboard
2. Create the Pinecone index if it doesn't exist
3. Test the application after deployment
