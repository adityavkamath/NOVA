#!/bin/bash

# AutoGen Installation Script for NOVA RAG Project
echo "🚀 Installing AutoGen dependencies for NOVA RAG project..."

# Check if we're in the correct directory
if [ ! -f "backend/requirements.txt" ]; then
    echo "❌ Error: Please run this script from the project root directory (where backend/ folder exists)"
    exit 1
fi

# Navigate to backend directory
cd backend

echo "📦 Installing AutoGen and related dependencies..."

# Install AutoGen dependencies
pip install pyautogen==0.2.30
pip install autogen-agentchat==0.2.30
pip install autogen-core==0.2.30
pip install termcolor==2.4.0

# Install the full requirements.txt to ensure all dependencies are up to date
echo "📦 Installing all backend dependencies..."
pip install -r requirements.txt

echo "✅ AutoGen dependencies installed successfully!"

echo ""
echo "🔧 Configuration:"
echo "1. Make sure your .env file contains your OpenAI API key:"
echo "   OPENAI_API_KEY=your_openai_api_key_here"
echo ""
echo "2. Optional environment variables for agent configuration:"
echo "   OPENAI_MODEL_PRIMARY=gpt-4"
echo "   OPENAI_MODEL_SECONDARY=gpt-3.5-turbo"
echo "   OPENAI_TEMPERATURE=0.3"
echo "   MAX_CONSECUTIVE_AUTO_REPLY=3"
echo "   ENABLE_STREAMING=true"
echo ""
echo "3. Start the backend server:"
echo "   cd backend && python run_server.py"
echo ""
echo "4. In another terminal, start the frontend:"
echo "   npm run dev"
echo ""
echo "🎉 Your AutoGen RAG system is ready!"
echo "   Navigate to http://localhost:3000/dashboard/agents to try it out"

# Return to original directory
cd ..
