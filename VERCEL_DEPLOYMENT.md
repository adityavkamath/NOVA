# 🚀 Nova Frontend Deployment on Vercel - Complete Guide

## Prerequisites
- ✅ Backend successfully deployed on Render
- ✅ GitHub repository with your code
- ✅ Vercel account (free tier works)

## Step 1: Update Backend URL for Production

First, update your frontend to use the production backend URL from Render.

### Get Your Render Backend URL
1. Go to your Render dashboard
2. Click on your backend service
3. Copy the URL (should look like: `https://nova-backend-xxxx.onrender.com`)

### Update Environment Configuration
You'll need to set the production backend URL as an environment variable in Vercel.

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

2. **Import Project**
   - Click "New Project"
   - Select "Import Git Repository"
   - Choose your `NOVA` repository
   - Click "Import"

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: Leave empty (uses project root)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: Leave empty (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

4. **Add Environment Variables**
   Click "Environment Variables" and add these:

   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c21vb3RoLXN3aWZ0LTE1LmNsZXJrLmFjY291bnRzLmRldiQ
   CLERK_SECRET_KEY=sk_test_513LC2lM9UWCv5CfQRFbrM6ZIbQXIvMvIs37kn3saT
   NEXT_PUBLIC_BACKEND_API_URL=https://your-render-backend-url.onrender.com
   NEXT_PUBLIC_API_URL=https://your-render-backend-url.onrender.com
   ```

   **Important**: Replace `https://your-render-backend-url.onrender.com` with your actual Render backend URL.

5. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (usually 2-3 minutes)

### Option B: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy from Project Root**
   ```bash
   cd /home/aditya/Documents/Nova
   vercel
   ```

4. **Follow the prompts**:
   - Set up and deploy? `Y`
   - Which scope? (choose your account)
   - Link to existing project? `N`
   - Project name: `nova-rag-assistant` (or your preferred name)
   - Directory: `./` (current directory)

5. **Set Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   vercel env add CLERK_SECRET_KEY
   vercel env add NEXT_PUBLIC_BACKEND_API_URL
   vercel env add NEXT_PUBLIC_API_URL
   ```

## Step 3: Configure Backend CORS for Vercel

Once deployed, you'll get a Vercel URL (e.g., `https://nova-rag-assistant.vercel.app`). You need to update your backend to allow this domain.

### Update Backend CORS Settings

1. **Go to your Render backend dashboard**
2. **Add Environment Variable**:
   ```
   FRONTEND_URL=https://your-vercel-app.vercel.app
   ```

3. **Your backend `main.py` should already have CORS configured** (we set this up earlier):
   ```python
   origins = [
       "http://localhost:3000",
       "https://localhost:3000", 
       "https://*.vercel.app",
       os.getenv("FRONTEND_URL", "http://localhost:3000")
   ]
   ```

4. **Redeploy your backend** on Render to apply the changes.

## Step 4: Verify Deployment

### Check Frontend
1. Visit your Vercel URL
2. Verify the landing page loads
3. Test authentication (Clerk login/signup)
4. Try accessing dashboard features

### Check Backend Connection
1. Open browser developer tools (F12)
2. Go to Network tab
3. Try uploading a PDF or asking a question
4. Verify API calls are going to your Render backend URL
5. Check for any CORS errors

## Step 5: Custom Domain (Optional)

### Add Custom Domain to Vercel
1. Go to your project in Vercel dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### Update Backend CORS for Custom Domain
1. Add your custom domain to Render environment variables
2. Update CORS origins in your backend

## Troubleshooting Common Issues

### 1. Build Errors
**Error**: `Module not found` or build failures
**Solution**: Check that all dependencies are in `package.json` and run:
```bash
npm install
npm run build
```

### 2. Environment Variables Not Working
**Error**: API calls failing or authentication issues
**Solution**: 
- Ensure all environment variables start with `NEXT_PUBLIC_` for client-side access
- Redeploy after adding environment variables

### 3. CORS Errors
**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`
**Solution**:
- Add your Vercel URL to backend CORS origins
- Redeploy backend on Render

### 4. Authentication Issues
**Error**: Clerk authentication not working
**Solution**:
- Verify Clerk keys are correct
- Check that Clerk domain settings include your Vercel URL

## Final Checklist

- [ ] Backend deployed and running on Render
- [ ] Frontend deployed and running on Vercel
- [ ] Environment variables configured correctly
- [ ] CORS configured for Vercel domain
- [ ] Authentication working (Clerk)
- [ ] API calls successful between frontend and backend
- [ ] All features working (PDF upload, chat, agents, etc.)

## Production URLs Structure

After successful deployment, you'll have:

- **Frontend**: `https://your-project.vercel.app`
- **Backend**: `https://your-backend.onrender.com`
- **Backend API Docs**: `https://your-backend.onrender.com/docs`

## Performance Tips

1. **Enable Vercel Analytics** in project settings
2. **Use Vercel Edge Functions** for better performance (already configured with Next.js)
3. **Monitor Render backend** for response times
4. **Consider upgrading Render plan** for better backend performance

Your Nova RAG Assistant will now be fully deployed and accessible to users worldwide! 🎉
