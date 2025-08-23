import asyncio
import json
import logging
import os
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .specialized_agents import (
    CoordinatorAgent,
    DocumentExpertAgent,
    AgentOrchestrator,
)
from .agent_config import WORKFLOW_PATTERNS, get_openai_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
@dataclass
class AgentContext:
    """Context information for agent operations"""

    user_id: str
    session_id: str
    query: str
    data_sources: Dict[str, Any]
    conversation_history: List[Dict[str, str]]


class AgentOrchestrator:

    def __init__(self):
        self.coordinator: Optional[CoordinatorAgent] = None
        self.specialists: Dict[str, Any] = {}
        self.active_sessions: Dict[str, AgentContext] = {}
        self.is_initialized = False

    async def initialize(self) -> bool:
        """Initialize the agent system"""
        try:
            self.coordinator = CoordinatorAgent()
            self.specialists = {
                "document_expert": DocumentExpertAgent(),
            }
            
            for agent_type, agent in self.specialists.items():
                self.coordinator.register_specialist(agent_type, agent)
            
            self.is_initialized = True
            logger.info("Agent system initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize agent system: {str(e)}")
            return False

    async def process_query(
        self, context: AgentContext, stream: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        Process a query using the agent system
        """
        if not self.is_initialized:
            await self.initialize()

        try:
            self.active_sessions[context.session_id] = context
            workflow_type = self._determine_workflow(context)

            if stream:
                async for chunk in self._execute_workflow_stream(
                    context, workflow_type
                ):
                    yield chunk
            else:
                response = await self._execute_workflow(context, workflow_type)
                yield response

        except Exception as e:
            error_msg = f"Error in agent processing: {str(e)}"
            logger.error(error_msg)
            yield json.dumps({"error": error_msg})

    def _determine_workflow(self, context: AgentContext) -> str:
        """
        Determine the appropriate workflow based on data sources
        """
        data_sources = context.data_sources

        has_documents = bool(
            data_sources.get("pdf_id") or 
            data_sources.get("csv_id") or 
            data_sources.get("web_id")
        )

        if has_documents:
            return "document_query"
        else:
            return "general_query"

    async def _execute_workflow_stream(
        self, context: AgentContext, workflow_type: str
    ) -> AsyncGenerator[str, None]:
        """
        Execute workflow with streaming response
        """
        if context.data_sources:
            yield json.dumps(
                {"sources": await self._get_sources_info(context.data_sources)}
            )

        yield json.dumps(
            {"thinking": f"Analyzing query using {workflow_type} workflow..."}
        )

        if workflow_type == "document_query":
            async for chunk in self._handle_document_query_stream(context):
                yield chunk
        else:
            async for chunk in self._handle_general_query_stream(context):
                yield chunk

    async def _execute_workflow(self, context: AgentContext, workflow_type: str) -> str:
        """Execute workflow and return complete response"""
        response_parts = []
        async for chunk in self._execute_workflow_stream(context, workflow_type):
            response_parts.append(chunk)
        return "".join(response_parts)


    async def _handle_document_query_stream(
        self, context: AgentContext
    ) -> AsyncGenerator[str, None]:
        yield json.dumps({"content": "📄 Initializing document analysis agent...\n\n"})
        await asyncio.sleep(0.3)
        
        analysis_steps = [
            "🔍 Scanning document for relevant content...",
            "📖 Reading and understanding the document...", 
            "🧠 Analyzing content with AI specialist...",
            "✨ Preparing comprehensive response...",
        ]
        for i, step in enumerate(analysis_steps):
            yield json.dumps({"content": f"{step}\n"})
            await asyncio.sleep(0.4)

        try:
            if self.coordinator:
                response = await self.coordinator.coordinate_response(
                    query=context.query,
                    data_sources=context.data_sources,
                    user_id=context.user_id
                )
                yield json.dumps({"content": f"\n---\n\n{response}"})
            else:
                pdf_id = context.data_sources.get("pdf_id")
                doc_context = []
                if pdf_id:
                    doc_context = await self._get_document_context(
                        pdf_id, context.user_id, context.query
                    )
                
                result = await self._analyze_document_with_agent(context.query, doc_context)
                yield json.dumps({"content": f"\n---\n\n{result}"})
                
        except Exception as e:
            logger.error(f"Document analysis failed: {e}")
            error_response = f"""I apologize, but I encountered an error while analyzing the document: {str(e)}

**Possible solutions:**
• Make sure your PDF document was uploaded successfully
• Try rephrasing your question
• Check if the document contains the information you're looking for
• Try again in a few moments

If the problem persists, please contact support."""
            yield json.dumps({"content": error_response})

    async def _handle_general_query_stream(
        self, context: AgentContext
    ) -> AsyncGenerator[str, None]:
        yield json.dumps({"content": "💭 Processing your query...\n\n"})
        await asyncio.sleep(0.1)
        
        content = f"""I understand you're asking: **"{context.query}"**

To provide you with the most accurate and detailed analysis, I need you to upload a PDF document first. 

🚀 **Here's what I can do once you upload a document:**

📋 **Comprehensive Document Analysis:**
• Summarize the main content and key findings
• Extract specific information based on your questions  
• Analyze document structure and organization
• Identify key themes and important concepts

🔍 **Interactive Q&A:**
• Answer detailed questions about the document content
• Explain complex terms or technical concepts  
• Compare information across different sections
• Provide insights and interpretations

💡 **Smart Insights:**
• Highlight the most important points
• Connect related concepts within the document
• Suggest areas for further exploration
• Provide context and explanations

**To get started:** Click the "Upload PDF" button above and then ask me anything about your document!
"""
        yield json.dumps({"content": content})

    async def _get_document_context(
        self, pdf_id: str, user_id: str, query: str
    ) -> List[str]:
        from utils.semantic_search import semantic_search

        try:
            search_results = await semantic_search(
                query=query,
                user_id=user_id,
                feature_type="pdf",
                source_id=pdf_id,
                top_k=5,
            )
            if search_results:
                return [result["chunk_text"] for result in search_results]
            return []
        except Exception as e:
            print(f"Error retrieving PDF context: {e}")
            return []

    async def _get_web_context(self, web_id: str, user_id: str) -> str:
        from utils.semantic_search import semantic_search

        try:
            search_results = await semantic_search(
                query="content overview",
                user_id=user_id,
                feature_type="web",
                source_id=web_id,
                top_k=10,
            )
            if search_results:
                return "\n".join([result["chunk_text"] for result in search_results])
            return "Web content context not available"
        except Exception:
            return "Error retrieving web context"

    async def _get_sources_info(self, data_sources: Dict[str, Any]) -> list:
        sources = []
        if data_sources.get("pdf_id"):
            sources.append({"type": "pdf", "id": data_sources["pdf_id"]})
        return sources

    async def _analyze_document_with_agent(
        self, query: str, doc_context: List[str]
    ) -> str:
        from openai import AsyncOpenAI
        import os

        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            return "OpenAI API key not set."
        if not doc_context:
            return "No relevant content found in the PDF."

        context_text = "\n\n".join(doc_context)
        prompt = (
            f"You are an expert document analyst. Given the following extracted content from a PDF, answer the user's question as accurately as possible.\n"
            f"\n---\nPDF Content:\n{context_text}\n---\n"
            f"\nUser Question: {query}\n\nAnswer:"
        )

        client = AsyncOpenAI(api_key=openai_api_key)
        try:
            response = await client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant for document Q&A.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=512,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI error: {e}")
            return "Error generating answer from PDF."

orchestrator = AgentOrchestrator()
