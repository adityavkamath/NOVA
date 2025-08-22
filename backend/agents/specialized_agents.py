import asyncio
import json
import os
from typing import Dict, List, Any, Optional, Callable
import autogen
from autogen import ConversableAgent, UserProxyAgent
from .agent_config import AGENT_CONFIGS, AGENT_FUNCTIONS, get_openai_config

class BaseRAGAgent(ConversableAgent):
    """Base class for RAG-specific agents with enhanced capabilities"""
    
    def __init__(self, agent_type: str, context_data: Optional[str] = None, **kwargs):
        config = AGENT_CONFIGS[agent_type]
        llm_config = get_openai_config()
        
        super().__init__(
            name=config.name,
            system_message=config.system_message,
            llm_config=llm_config,
            max_consecutive_auto_reply=config.max_consecutive_auto_reply,
            human_input_mode=config.human_input_mode,
            **kwargs
        )
        
        self.agent_type = agent_type
        self.context_data = context_data
        self.conversation_history = []

class CoordinatorAgent(BaseRAGAgent):
    """Main coordinator agent that orchestrates other agents"""
    
    def __init__(self, **kwargs):
        super().__init__("coordinator", **kwargs)
        self.available_agents = {}
        self.current_workflow = None
    
    def register_specialist(self, agent_type: str, agent: BaseRAGAgent):
        """Register a specialist agent"""
        self.available_agents[agent_type] = agent
    
    def determine_workflow(self, query: str, data_sources: Dict[str, Any]) -> str:
        """Determine the appropriate workflow based on query and available data"""
        has_documents = bool(
            data_sources.get("pdf_id") or 
            data_sources.get("csv_id") or 
            data_sources.get("web_id")
        )
        
        if has_documents:
            return "document_query"
        else:
            return "general_query"
    
    async def coordinate_response(self, query: str, data_sources: Dict[str, Any], user_id: str = None) -> str:
        """Coordinate response generation using appropriate agents"""
        if user_id:
            self.current_user_id = user_id
            
        workflow = self.determine_workflow(query, data_sources)
        
        if workflow == "document_query" and "document_expert" in self.available_agents:
            return await self._single_agent_workflow(query, "document_expert", data_sources)
        else:
            return self._direct_response(query)
    
    async def _single_agent_workflow(self, query: str, agent_type: str, data_sources: Dict[str, Any]) -> str:
        """Handle single agent workflow with real document analysis"""
        document_content = await self._get_document_content(data_sources, query)
        
        if not document_content:
            return "I couldn't find any relevant document content to analyze. Please make sure you have uploaded a PDF document and it has been processed successfully."

        try:
            from openai import AsyncOpenAI
            import os
            
            openai_api_key = os.getenv("OPENAI_API_KEY")
            if not openai_api_key:
                return "OpenAI API key is not configured. Please check your environment settings."
            
            client = AsyncOpenAI(api_key=openai_api_key)

            comprehensive_prompt = f"""You are an expert document analyst. Based on the following document content, provide a comprehensive and conversational response to the user's query.

Document Content:
{document_content}

User's Question: {query}

Please provide a detailed, human-readable response that:
1. Directly answers the user's question
2. Provides relevant context from the document
3. Highlights key insights and findings
4. Uses a conversational, professional tone
5. References specific information from the document when appropriate

Do NOT return JSON or structured data. Provide a natural, flowing response as if you're having a conversation with the user."""

            response = await client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a helpful document analysis expert who provides clear, conversational responses based on document content."},
                    {"role": "user", "content": comprehensive_prompt}
                ],
                temperature=0.3,
                max_tokens=2000
            )
            
            return response.choices[0].message.content.strip()
                
        except Exception as e:
            return f"I encountered an error while analyzing the document: {str(e)}. Please try again or contact support if the issue persists."
    
    async def _get_document_content(self, data_sources: Dict[str, Any], query: str) -> str:
        """Get document content using semantic search"""
        try:
            from utils.semantic_search import semantic_search
            
            content_chunks = []

            if data_sources.get("pdf_id"):
                pdf_results = await semantic_search(
                    query=query,
                    user_id=self.current_user_id if hasattr(self, 'current_user_id') else None,
                    feature_type="pdf",
                    source_id=data_sources["pdf_id"],
                    top_k=15  
                )
                if pdf_results:
                    content_chunks.extend([result["chunk_text"] for result in pdf_results])

            if data_sources.get("csv_id"):
                csv_results = await semantic_search(
                    query=query,
                    user_id=self.current_user_id if hasattr(self, 'current_user_id') else None,
                    feature_type="csv",
                    source_id=data_sources["csv_id"],
                    top_k=15
                )
                if csv_results:
                    content_chunks.extend([result["chunk_text"] for result in csv_results])

            if data_sources.get("web_id"):
                web_results = await semantic_search(
                    query=query,
                    user_id=self.current_user_id if hasattr(self, 'current_user_id') else None,
                    feature_type="web",
                    source_id=data_sources["web_id"],
                    top_k=15
                )
                if web_results:
                    content_chunks.extend([result["chunk_text"] for result in web_results])
            
            if content_chunks:
                unique_chunks = []
                seen_chunks = set()
                for chunk in content_chunks:
                    if chunk.strip() and chunk not in seen_chunks:
                        unique_chunks.append(chunk.strip())
                        seen_chunks.add(chunk)

                combined_content = "\n\n---\n\n".join(unique_chunks[:20])
                return combined_content[:32000]  
            else:
                return ""
                
        except Exception as e:
            print(f"Error retrieving document content: {e}")
            return ""
    
    def _direct_response(self, query: str) -> str:
        """Provide direct response when no specialists are needed"""
        return f"""I understand you're asking: "{query}"

To provide you with a comprehensive analysis, I need you to upload a PDF document first. Here's what I can help you with once you upload a document:

📄 **Document Analysis:**
- Summarize the main content and key points
- Extract specific information based on your questions
- Analyze document structure and organization
- Answer questions about the document's content

📊 **Content Insights:**
- Identify key themes and topics
- Highlight important findings or conclusions
- Explain complex concepts in simple terms
- Compare information across different sections

🔍 **Interactive Q&A:**
- Answer specific questions about the document
- Clarify technical terms or concepts
- Provide detailed explanations of specific sections

Please upload a PDF document using the upload button above, and then ask me any questions about it!"""


class DocumentExpertAgent(BaseRAGAgent):
    """Specialized agent for PDF document analysis"""
    
    def __init__(self, document_content: Optional[str] = None, **kwargs):
        super().__init__("document_expert", document_content, **kwargs)