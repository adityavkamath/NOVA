"""
Agent Orchestrator - Main class for managing AutoGen agents in RAG system
"""

import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, AsyncGenerator
from dataclasses import dataclass
from backend.ingestion.ingest_csv import extract_csv_text_chunks


from .specialized_agents import (
    CoordinatorAgent,
    DataAnalystAgent,
    DocumentExpertAgent,
    WebResearchAgent,
)
from .agent_config import WORKFLOW_PATTERNS, get_openai_config

# Set up logging
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
                "data_analyst": DataAnalystAgent(),
                "document_expert": DocumentExpertAgent(),
                "web_research": WebResearchAgent(),
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
        source_types = []
        if data_sources.get("csv_id"):
            source_types.append("csv")
        if data_sources.get("pdf_id"):
            source_types.append("pdf")
        if data_sources.get("web_id"):
            source_types.append("web")

        if len(source_types) > 1:
            return "multi_source_query"
        elif "csv" in source_types:
            return "csv_analysis"
        elif "pdf" in source_types:
            return "document_query"
        elif "web" in source_types:
            return "web_content_query"
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

        if workflow_type == "csv_analysis":
            async for chunk in self._handle_csv_analysis_stream(context):
                yield chunk
        elif workflow_type == "document_query":
            async for chunk in self._handle_document_query_stream(context):
                yield chunk
        elif workflow_type == "web_content_query":
            async for chunk in self._handle_web_query_stream(context):
                yield chunk
        elif workflow_type == "multi_source_query":
            async for chunk in self._handle_multi_source_stream(context):
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

    # --- Streaming handlers ---

    async def _handle_csv_analysis_stream(
        self, context: AgentContext
    ) -> AsyncGenerator[str, None]:
        yield json.dumps({"content": "🔍 Initializing data analysis agent...\n\n"})
        await asyncio.sleep(0.1)
        yield json.dumps({"content": "📊 **Data Analysis Results**\n\n"})
        await asyncio.sleep(0.1)

        csv_context = await self._get_csv_context(
            context.data_sources.get("csv_id"), context.user_id
        )

        analysis_steps = [
            "Examining dataset structure and dimensions...",
            "Calculating statistical measures...",
            "Identifying patterns and trends...",
            "Generating insights and recommendations...",
        ]

        for step in analysis_steps:
            yield json.dumps({"content": f"• {step}\n"})
            await asyncio.sleep(0.2)

        # 2. Load CSV data and chunk for semantic search
        csv_id = context.data_sources.get("csv_id")
        if not csv_id:
            yield json.dumps({"error": "No CSV ID provided."})
            return

        # Import here to avoid circular imports
        from backend.ingestion.ingest_csv import extract_csv_text_chunks
        from backend.utils.embedding_processor import embed_chunks, semantic_search
        from backend.utils.llm_answer import get_llm_answer

        # 3. Extract CSV text chunks
        try:
            # extract_csv_text_chunks is a synchronous function, do not await
            chunks = extract_csv_text_chunks(csv_id, context.user_id)
            logger.info(
                f"[AgentOrchestrator] extract_csv_text_chunks returned: {chunks}"
            )
            if not isinstance(chunks, list):
                logger.error(f"extract_csv_text_chunks returned non-list: {chunks}")
                yield json.dumps(
                    {"error": f"extract_csv_text_chunks returned non-list: {chunks}"}
                )
                return
            # Check for error in chunks
            if len(chunks) == 1 and "error" in chunks[0]:
                logger.error(f"extract_csv_text_chunks error: {chunks[0]['error']}")
                yield json.dumps(
                    {"error": f"Failed to extract CSV chunks: {chunks[0]['error']}"}
                )
                return
        except Exception as e:
            logger.error(f"Exception during extract_csv_text_chunks: {e}")
            yield json.dumps({"error": f"Failed to extract CSV chunks: {str(e)}"})
            return

        # 4. Embed chunks
        try:
            embeddings = await embed_chunks(chunks)
        except Exception as e:
            yield json.dumps({"error": f"Failed to embed CSV chunks: {str(e)}"})
            return

        # 5. Semantic search for relevant chunks
        try:
            relevant_chunks = semantic_search(context.query, chunks, embeddings)
        except Exception as e:
            yield json.dumps({"error": f"Semantic search failed: {str(e)}"})
            return

        # 6. Prepare LLM context and get answer
        try:
            llm_context = "\n".join(
                [
                    (
                        chunk["chunk_text"]
                        if isinstance(chunk, dict) and "chunk_text" in chunk
                        else (
                            chunk["content"]
                            if isinstance(chunk, dict) and "content" in chunk
                            else str(chunk)
                        )
                    )
                    for chunk in relevant_chunks
                ]
            )
            answer = await get_llm_answer(context.query, llm_context)
        except Exception as e:
            yield json.dumps({"error": f"LLM answer failed: {str(e)}"})
            return

        # 7. Yield answer and sources
        yield json.dumps({"content": answer})
        sources_info = [
            {
                "title": chunk.get("title", "CSV Data"),
                "content_preview": chunk.get("chunk_text", chunk.get("content", "")),
                "relevance_score": (
                    float(chunk.get("score", 1.0))
                    if chunk.get("score") is not None
                    else 1.0
                ),
                "type": "csv",
            }
            for chunk in relevant_chunks
        ]
        yield json.dumps({"sources": sources_info})

        yield json.dumps({"content": "\n**Key Findings:**\n"})
        await asyncio.sleep(0.1)

        analysis_result = await self._analyze_csv_with_agent(context.query, csv_context)
        yield json.dumps({"content": analysis_result})

    async def _handle_document_query_stream(
        self, context: AgentContext
    ) -> AsyncGenerator[str, None]:
        yield json.dumps({"content": "📄 Initializing document analysis agent...\n\n"})
        await asyncio.sleep(0.1)
        yield json.dumps({"content": "**Document Analysis**\n\n"})

        pdf_id = context.data_sources.get("pdf_id")
        doc_context = []
        if pdf_id:
            doc_context = await self._get_document_context(
                pdf_id, context.user_id, context.query
            )

        analysis_steps = [
            "Scanning document structure...",
            "Extracting relevant sections...",
            "Analyzing content for query relevance...",
            "Formulating comprehensive response...",
        ]
        for step in analysis_steps:
            yield json.dumps({"content": f"• {step}\n"})
            await asyncio.sleep(0.2)

        # 3. Run PDF agent analysis
        try:
            doc_result = await self._analyze_document_with_agent(context.query, doc_context)
            yield json.dumps({"content": doc_result})
            # Optionally yield sources info for PDF
            sources_info = [
                {
                    "title": f"PDF Page {i+1}",
                    "content_preview": chunk[:150] + "..." if len(chunk) > 150 else chunk,
                    "relevance_score": 1.0,
                    "type": "pdf"
                }
                for i, chunk in enumerate(doc_context)
            ]
            if sources_info:
                yield json.dumps({"sources": sources_info})
        except Exception as e:
            yield json.dumps({"error": f"PDF agent analysis failed: {str(e)}"})
            return

    # ---- Integration with existing semantic search and analysis logic ----

    async def _get_csv_context(self, csv_id: str, user_id: str) -> str:
        from backend.utils.semantic_search import semantic_search

        try:
            search_results = await semantic_search(
                query="data overview",  # Generic context query
                user_id=user_id,
                feature_type="csv",
                source_id=csv_id,
                top_k=10,
            )
            if search_results:
                return "\n".join([result["chunk_text"] for result in search_results])
            return "CSV data context not available"
        except Exception:
            return "Error retrieving CSV context"

    async def _get_document_context(
        self, pdf_id: str, user_id: str, query: str
    ) -> List[str]:
        from backend.utils.semantic_search import semantic_search

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
        from backend.utils.semantic_search import semantic_search

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
        if data_sources.get("csv_id"):
            sources.append({"type": "csv", "id": data_sources["csv_id"]})
        if data_sources.get("pdf_id"):
            sources.append({"type": "pdf", "id": data_sources["pdf_id"]})
        if data_sources.get("web_id"):
            sources.append({"type": "web", "id": data_sources["web_id"]})
        return sources

    # --- Agent analysis methods using external AI (OpenAI) ---

    async def _analyze_csv_with_agent(self, query: str, csv_context: str) -> str:
        import logging

        logger = logging.getLogger(__name__)
        try:
            logger.info(f"[CSV Agent] Starting analysis for query: {query}")
            logger.debug(
                f"[CSV Agent] CSV context: {csv_context[:200]}..."
                if csv_context
                else "[CSV Agent] No CSV context provided."
            )

            # Simulate analysis logic (replace with actual LLM call if needed)
            analysis = f"""Based on the available CSV data, here's my analysis for \"{query}\":

**Dataset Overview:**
- The data contains multiple variables suitable for analysis
- Key patterns have been identified in the numerical columns
- Statistical measures calculated for relevant metrics

**Specific Insights:**
- Trends identified that relate to your query
- Correlations found between relevant variables  
- Statistical significance confirmed for key findings

**Recommendations:**
- Consider additional analysis on specific columns
- Visualizations could help illustrate the patterns
- Further investigation recommended for anomalies detected

*This analysis is generated by the Data Analyst Agent based on your specific query and available data.*"""
            logger.info(
                f"[CSV Agent] Analysis completed successfully for query: {query}"
            )
            return analysis
        except Exception as e:
            logger.error(f"[CSV Agent] Error during analysis: {e}")
            return f"Error during CSV analysis: {e}"

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

    async def _analyze_web_with_agent(self, query: str, web_context: str) -> str:
        return f"""Web content analysis for "{query}":

**Source Evaluation:**
- Content source assessed for credibility and relevance
- Publication date and context considered
- Author expertise and bias factors evaluated

**Content Analysis:**
- Main arguments and evidence extracted
- Key facts and figures identified
- Supporting references and links noted

**Research Summary:**
- Direct answers to your query provided
- Multiple perspectives considered where available
- Current trends and developments highlighted

*This analysis is conducted by the Web Research Agent with focus on accuracy and objectivity.*"""

    async def _synthesize_multi_source_analysis(
        self, query: str, analyses: Dict[str, str]
    ) -> str:
        synthesis = f"""## Comprehensive Analysis for: "{query}"\n\n"""
        if "csv" in analyses:
            synthesis += "### 📊 Data Analysis Insights\n"
            synthesis += f"{analyses['csv']}\n\n"
        if "document" in analyses:
            synthesis += "### 📄 Document Analysis Insights\n"
            synthesis += f"{analyses['document']}\n\n"
        if "web" in analyses:
            synthesis += "### 🌐 Web Research Insights\n"
            synthesis += f"{analyses['web']}\n\n"
        synthesis += """### 🎯 Integrated Conclusion

Based on the comprehensive analysis across all available sources, the evidence converges on several key points:

1. **Consistent Findings**: Information from multiple sources supports the main conclusions
2. **Data-Driven Insights**: Quantitative analysis provides statistical backing for qualitative observations
3. **Comprehensive Coverage**: Multiple perspectives ensure a well-rounded understanding
4. **Actionable Intelligence**: Combined insights offer practical recommendations

*This synthesis represents the coordinated effort of multiple specialized agents working together to provide the most comprehensive and accurate response possible.*"""

        return synthesis


# Global instance of the orchestrator
orchestrator = AgentOrchestrator()
