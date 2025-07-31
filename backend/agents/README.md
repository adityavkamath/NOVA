# AutoGen RAG Agent System

## Overview

This project has been enhanced with Microsoft AutoGen to create an agentic RAG (Retrieval-Augmented Generation) system. The system now features multiple specialized AI agents that collaborate to provide comprehensive and intelligent responses to user queries.

## Agent Architecture

### 🎯 Coordinator Agent
- **Role**: System orchestrator and query router
- **Responsibilities**:
  - Analyzes incoming queries to determine the best approach
  - Routes queries to appropriate specialist agents
  - Synthesizes responses from multiple agents
  - Ensures comprehensive and accurate final responses

### 📊 Data Analyst Agent
- **Role**: CSV data analysis specialist
- **Capabilities**:
  - Statistical analysis and pattern recognition
  - Data visualization recommendations
  - Trend identification and forecasting
  - Data quality assessment

### 📄 Document Expert Agent
- **Role**: PDF document analysis specialist
- **Capabilities**:
  - Document structure analysis
  - Technical document interpretation
  - Research paper analysis
  - Cross-document synthesis

### 🌐 Web Research Agent
- **Role**: Web content analysis specialist
- **Capabilities**:
  - Web article and blog post analysis
  - Source credibility assessment
  - Multi-source information synthesis
  - Current trends identification

## Features

### ✨ Multi-Agent Collaboration
- Agents work together to provide comprehensive responses
- Automatic workflow determination based on query type and available data
- Intelligent task distribution and result synthesis

### 🔄 Streaming Responses
- Real-time response generation with progress updates
- Users can see agents "thinking" and working through problems
- Enhanced user experience with immediate feedback

### 🎛️ Behavioral Rules
- Each agent has specific behavioral guidelines and expertise areas
- Consistent response quality and formatting
- Specialized function calling for domain-specific tasks

### 🔗 Seamless Integration
- Works with existing PDF, CSV, and web scraping features
- Compatible with existing user authentication and data access
- Maintains all current functionality while adding agent capabilities

## API Endpoints

### Create Agent Session
```http
POST /api/agents/create-agent-session
```
Create a new agent-powered chat session with specified data sources.

### Agent Chat
```http
POST /api/agents/chat
```
Chat with AutoGen agents using streaming or non-streaming responses.

### Get Sessions
```http
GET /api/agents/sessions
```
Retrieve all agent chat sessions for the authenticated user.

### Get Session Messages
```http
GET /api/agents/sessions/{session_id}/messages
```
Get conversation history for a specific agent session.

### Agent Status
```http
GET /api/agents/agent-status
```
Check the status and capabilities of the agent system.

## Environment Variables

Add these to your `.env` file:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional - Agent Configuration
OPENAI_MODEL_PRIMARY=gpt-4
OPENAI_MODEL_SECONDARY=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=4000

# Agent System Settings
MAX_CONSECUTIVE_AUTO_REPLY=3
AGENT_TIMEOUT=120
ENABLE_STREAMING=true
ENABLE_FUNCTION_CALLING=true

# Performance Settings
VECTOR_SEARCH_TOP_K=5
CACHE_ENABLED=true
CACHE_TTL=3600
MAX_CONCURRENT_AGENTS=5

# Logging
LOG_LEVEL=INFO
LOG_AGENT_CONVERSATIONS=false
```

## Usage Examples

### 1. CSV Data Analysis
```python
# Create session with CSV data
session = await create_agent_session({
    "title": "Sales Data Analysis",
    "agent_type": "multi_agent",
    "data_sources": {"csv_id": "your-csv-id"}
})

# Query the data
response = await agent_chat({
    "query": "What are the sales trends over the last quarter?",
    "session_id": session.id,
    "stream": True
})
```

### 2. Document Research
```python
# Create session with PDF document
session = await create_agent_session({
    "title": "Research Paper Analysis", 
    "agent_type": "document_expert",
    "data_sources": {"pdf_id": "your-pdf-id"}
})

# Ask about the document
response = await agent_chat({
    "query": "What are the main conclusions of this research?",
    "session_id": session.id
})
```

### 3. Multi-Source Analysis
```python
# Create session with multiple data sources
session = await create_agent_session({
    "title": "Comprehensive Market Analysis",
    "agent_type": "multi_agent", 
    "data_sources": {
        "csv_id": "market-data-csv",
        "pdf_id": "research-report-pdf",
        "web_id": "news-articles-web"
    }
})

# Get comprehensive analysis
response = await agent_chat({
    "query": "Provide a comprehensive market analysis based on all available data",
    "session_id": session.id
})
```

## Workflow Patterns

### Single Source Workflows
- **CSV Analysis**: `coordinator → data_analyst → coordinator`
- **Document Query**: `coordinator → document_expert → coordinator`
- **Web Research**: `coordinator → web_research → coordinator`

### Multi-Source Workflows
- **Comprehensive Analysis**: `coordinator → [all specialists in parallel] → coordinator → synthesis`

## Installation

1. **Install AutoGen dependencies**:
   ```bash
   cd backend
   pip install pyautogen==0.2.30
   ```

2. **Set up environment variables** (see above)

3. **Initialize the agent system**:
   The agents will initialize automatically when first accessed.

## Benefits

### 🚀 Enhanced Intelligence
- Multiple specialized agents provide domain expertise
- Better accuracy through collaborative analysis
- Comprehensive responses covering multiple perspectives

### 🎯 Improved User Experience
- Streaming responses with real-time progress
- Clear indication of which agents are working
- Structured, professional responses

### 🔧 Maintainable Architecture
- Modular agent design for easy extension
- Clear separation of concerns
- Configurable behavior and capabilities

### 📈 Scalable System
- Easy to add new agent types
- Configurable performance parameters
- Caching and optimization built-in

## Future Enhancements

- **Custom Agent Training**: Train agents on domain-specific data
- **Agent Memory**: Persistent memory across sessions
- **Advanced Workflows**: More complex multi-agent collaboration patterns
- **Real-time Learning**: Agents that learn from user feedback
- **Integration APIs**: External tool and service integration

## Troubleshooting

### Common Issues

1. **Agent initialization fails**:
   - Check OpenAI API key is set correctly
   - Verify network connectivity
   - Check rate limits

2. **Slow responses**:
   - Adjust `AGENT_TIMEOUT` setting
   - Check OpenAI API status
   - Consider using gpt-3.5-turbo for faster responses

3. **Memory issues**:
   - Adjust `MAX_CONCURRENT_AGENTS`
   - Enable caching if disabled
   - Monitor system resources

For more detailed troubleshooting, check the application logs and agent status endpoint.
