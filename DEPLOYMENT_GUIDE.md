# Nova RAG Assistant - Deployment Guide

## Project Overview
This is a production-ready Multi-Source RAG (Retrieval-Augmented Generation) Assistant with:
- **Backend**: FastAPI with Python 3.13
- **Vector Database**: Pinecone
- **Database**: Supabase
- **Authentication**: Clerk
- **AI Provider**: OpenAI
- **Agent System**: AutoGen-based multi-agent orchestration

## Prerequisites

### Required Environment Variables
Create a `.env` file in the backend directory with:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_STORAGE_BUCKET_NAME=your_bucket_name

# Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
PINECONE_ENVIRONMENT=your_environment

# API Configuration
FRONTEND_URL=https://your-frontend-domain.vercel.app
BACKEND_URL=https://your-backend-domain.onrender.com
```

## Render Deployment (Backend)

### 1. Connect Repository
- Go to [Render Dashboard](https://dashboard.render.com)
- Click "New" → "Web Service"
- Connect your GitHub repository
- Select the repository and branch

### 2. Build Configuration
```
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### 3. Environment Settings
- **Runtime**: Python 3.13
- **Root Directory**: `/backend`
- **Instance Type**: Starter (or higher for production)

### 4. Environment Variables
Add all the environment variables from your `.env` file in Render's Environment section.

### 5. Advanced Settings
- **Auto-Deploy**: Enable for automatic deployments on git push
- **Health Check Path**: `/docs` (FastAPI docs endpoint)

## Vercel Deployment (Frontend)

### 1. Connect Repository
- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Click "Add New" → "Project"
- Import your repository

### 2. Build Configuration
- **Framework Preset**: Next.js
- **Root Directory**: Leave empty (project root)
- **Build Command**: `npm run build`
- **Output Directory**: Leave empty

### 3. Environment Variables
Add these to Vercel's Environment Variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.onrender.com
```

## Features Included

### ✅ Core RAG Functionality
- PDF document upload and processing
- CSV data ingestion and analysis
- Web scraping and content extraction
- Multi-document semantic search
- Context-aware Q&A generation

### ✅ Agent System
- **Coordinator Agent**: Orchestrates multi-agent workflows
- **Document Expert Agent**: Specialized in document analysis
- **Web Research Agent**: Handles web-based queries
- **Data Analysis Agent**: Processes structured data
- **Code Assistant Agent**: Programming and technical support

### ✅ Authentication & Security
- Clerk integration for user management
- Protected API endpoints
- User-specific data isolation
- Secure file uploads to Supabase Storage

### ✅ Multi-Chat System
- Session-based conversations
- Chat history persistence
- Real-time streaming responses
- Context-aware follow-up questions

## API Endpoints

### Authentication
- All endpoints require Clerk authentication
- User context automatically injected via middleware

### Document Processing
- `POST /pdf/upload-pdf` - Upload and process PDF documents
- `POST /csv/upload-csv` - Upload and process CSV files
- `POST /web/scrape-urls` - Scrape and process web content

### Chat & Query
- `POST /chat/sessions` - Create new chat session
- `POST /chat/message` - Send message to chat
- `POST /multi-chat/query` - Multi-source RAG query
- `GET /multi-chat/sources` - Get available data sources

### Agent System
- `POST /agents/chat` - Chat with AI agents
- `GET /agents/status` - Check agent system status
- `POST /agents/upload` - Upload files to agent context

## Database Schema

### Supabase Tables
1. **chat_sessions** - User chat session management
2. **chat_messages** - Individual chat messages
3. **documents** - Document metadata and references
4. **user_files** - File upload tracking

### Pinecone Index
- **Dimension**: 1536 (OpenAI embedding size)
- **Metric**: Cosine similarity
- **Metadata**: source, user_id, document_type, chunk_index

## Troubleshooting

### Common Issues

1. **Module Import Errors**
   - All import paths have been fixed with sys.path modifications
   - Ensure all `__init__.py` files are present

2. **Pinecone Connection Issues**
   - Verify PINECONE_API_KEY and PINECONE_INDEX_NAME
   - Check index exists and has correct dimensions

3. **Supabase Authentication**
   - Verify SUPABASE_URL and SUPABASE_KEY
   - Check RLS policies for user access

4. **CORS Errors**
   - Update FRONTEND_URL in environment variables
   - Verify origins in main.py CORS middleware

### Performance Optimization
- Use Render's Standard plan or higher for production
- Consider Redis for caching frequently accessed embeddings
- Implement rate limiting for API endpoints
- Use CDN for static assets

## Monitoring & Logs
- Render provides built-in logging and metrics
- Monitor Pinecone usage in their dashboard
- Track Supabase usage and storage
- Monitor OpenAI API usage and costs

## Security Checklist
- [ ] All API keys stored as environment variables
- [ ] CORS properly configured for production domains
- [ ] Clerk authentication properly implemented
- [ ] Supabase RLS policies configured
- [ ] File upload size limits configured
- [ ] Rate limiting implemented (recommended)

## Support
For issues or questions:
1. Check Render deployment logs
2. Verify all environment variables are set
3. Test API endpoints using `/docs` interface
4. Check Pinecone and Supabase dashboards for service status
