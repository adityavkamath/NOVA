import asyncio
import json
import os
from typing import Dict, List, Any, Optional, Callable
from openai import OpenAI, AsyncOpenAI
from .agent_config import AGENT_CONFIGS, AGENT_FUNCTIONS, get_openai_config

class BaseRAGAgent:
    """Base class for RAG-specific agents with enhanced capabilities"""
    
    def __init__(self, agent_type: str, context_data: Optional[str] = None, **kwargs):
        config = AGENT_CONFIGS[agent_type]
        self.name = config.name
        self.system_message = config.system_message
        self.max_consecutive_auto_reply = config.max_consecutive_auto_reply
        self.human_input_mode = config.human_input_mode
        
        # Initialize OpenAI client
        openai_config = get_openai_config()
        self.client = OpenAI(api_key=openai_config["config_list"][0]["api_key"])
        self.async_client = AsyncOpenAI(api_key=openai_config["config_list"][0]["api_key"])
        self.model = openai_config["config_list"][0]["model"]
        
        self.agent_type = agent_type
        self.context_data = context_data
        self.conversation_history = []
    
    async def generate_reply(self, message: str, context: str = "") -> str:
        """Generate a reply using OpenAI"""
        try:
            messages = [
                {"role": "system", "content": self.system_message},
            ]
            
            if context:
                messages.append({"role": "system", "content": f"Context: {context}"})
            
            # Add conversation history
            for msg in self.conversation_history[-10:]:  # Last 10 messages
                messages.append(msg)
            
            messages.append({"role": "user", "content": message})
            
            response = await self.async_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            reply = response.choices[0].message.content
            
            # Update conversation history
            self.conversation_history.append({"role": "user", "content": message})
            self.conversation_history.append({"role": "assistant", "content": reply})
            
            return reply
            
        except Exception as e:
            return f"Error generating response: {str(e)}"


class CoordinatorAgent(BaseRAGAgent):
    """Main coordinator agent that orchestrates other agents"""
    
    def __init__(self, **kwargs):
        super().__init__("coordinator", **kwargs)
        self.available_agents = {}
        self.current_workflow = None
        self.current_user_id = None
    
    def register_specialist(self, agent_type: str, agent: BaseRAGAgent):
        """Register a specialist agent"""
        self.available_agents[agent_type] = agent
    
    async def coordinate_response(self, user_message: str, context: str = "") -> str:
        """Coordinate response using specialist agents"""
        try:
            # Determine which specialist agent to use
            specialist_type = self._determine_specialist(user_message)
            
            if specialist_type in self.available_agents:
                specialist = self.available_agents[specialist_type]
                response = await specialist.generate_reply(user_message, context)
                return f"[{specialist.name}]: {response}"
            else:
                # Use coordinator's own response
                return await self.generate_reply(user_message, context)
                
        except Exception as e:
            return f"Coordination error: {str(e)}"
    
    def _determine_specialist(self, message: str) -> str:
        """Determine which specialist agent should handle the message"""
        message_lower = message.lower()
        
        if any(keyword in message_lower for keyword in ['code', 'programming', 'debug', 'function']):
            return 'technical_specialist'
        elif any(keyword in message_lower for keyword in ['research', 'analyze', 'study', 'find']):
            return 'research_specialist'
        elif any(keyword in message_lower for keyword in ['write', 'content', 'article', 'blog']):
            return 'content_specialist'
        else:
            return 'general_specialist'
    
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
    
    async def coordinate_response_with_sources(self, query: str, data_sources: Dict[str, Any], user_id: str = None) -> str:
        """Coordinate response generation using appropriate agents with document sources"""
        if user_id:
            self.current_user_id = user_id
            
        workflow = self.determine_workflow(query, data_sources)
        
        if workflow == "document_query":
            return await self._document_workflow(query, data_sources)
        else:
            return await self.generate_reply(query)
    
    async def _document_workflow(self, query: str, data_sources: Dict[str, Any]) -> str:
        """Handle document analysis workflow"""
        document_content = await self._get_document_content(data_sources, query)
        
        if not document_content:
            return "I couldn't find any relevant document content to analyze. Please make sure you have uploaded documents and they have been processed successfully."

        try:
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

            response = await self.async_client.chat.completions.create(
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
            return f"I encountered an error while analyzing the document: {str(e)}. Please try again."
    
    async def _get_document_content(self, data_sources: Dict[str, Any], query: str) -> str:
        """Get document content using semantic search"""
        try:
            from utils.semantic_search import semantic_search
            
            content_chunks = []

            if data_sources.get("pdf_id"):
                pdf_results = await semantic_search(
                    query=query,
                    user_id=self.current_user_id,
                    feature_type="pdf",
                    source_id=data_sources["pdf_id"],
                    top_k=15  
                )
                if pdf_results:
                    content_chunks.extend([result["chunk_text"] for result in pdf_results])

            if data_sources.get("csv_id"):
                csv_results = await semantic_search(
                    query=query,
                    user_id=self.current_user_id,
                    feature_type="csv",
                    source_id=data_sources["csv_id"],
                    top_k=15
                )
                if csv_results:
                    content_chunks.extend([result["chunk_text"] for result in csv_results])

            if data_sources.get("web_id"):
                web_results = await semantic_search(
                    query=query,
                    user_id=self.current_user_id,
                    feature_type="web",
                    source_id=data_sources["web_id"],
                    top_k=15
                )
                if web_results:
                    content_chunks.extend([result["chunk_text"] for result in web_results])

            if content_chunks:
                return "\n\n".join(content_chunks[:20])  # Limit to prevent token overflow
            
            return ""
            
        except Exception as e:
            print(f"Error retrieving document content: {e}")
            return ""


class TechnicalSpecialistAgent(BaseRAGAgent):
    """Agent specialized in technical and coding queries"""
    
    def __init__(self, **kwargs):
        super().__init__("technical_specialist", **kwargs)


class ResearchSpecialistAgent(BaseRAGAgent):
    """Agent specialized in research and analysis"""
    
    def __init__(self, **kwargs):
        super().__init__("research_specialist", **kwargs)


class ContentSpecialistAgent(BaseRAGAgent):
    """Agent specialized in content creation and writing"""
    
    def __init__(self, **kwargs):
        super().__init__("content_specialist", **kwargs)


class GeneralSpecialistAgent(BaseRAGAgent):
    """General purpose agent for various queries"""
    
    def __init__(self, **kwargs):
        super().__init__("general_specialist", **kwargs)


# Agent orchestrator class
class AgentOrchestrator:
    """Orchestrates multiple agents for complex workflows"""
    
    def __init__(self):
        self.coordinator = CoordinatorAgent()
        self._initialize_specialists()
    
    def _initialize_specialists(self):
        """Initialize and register all specialist agents"""
        specialists = {
            'technical_specialist': TechnicalSpecialistAgent(),
            'research_specialist': ResearchSpecialistAgent(),
            'content_specialist': ContentSpecialistAgent(),
            'general_specialist': GeneralSpecialistAgent()
        }
        
        for agent_type, agent in specialists.items():
            self.coordinator.register_specialist(agent_type, agent)
    
    async def process_query(self, query: str, data_sources: Dict[str, Any] = None, user_id: str = None) -> str:
        """Process a query using the appropriate agent workflow"""
        if data_sources:
            return await self.coordinator.coordinate_response_with_sources(query, data_sources, user_id)
        else:
            return await self.coordinator.coordinate_response(query)


# Global orchestrator instance
orchestrator = AgentOrchestrator()
