"""
Specialized AutoGen Agents for RAG System
"""
import asyncio
import json
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
        
        # Register functions specific to this agent type
        if agent_type in AGENT_FUNCTIONS:
            for func_config in AGENT_FUNCTIONS[agent_type]:
                self.register_function(
                    function_map={func_config["name"]: self._create_function_handler(func_config)}
                )
    
    def _create_function_handler(self, func_config: Dict) -> Callable:
        """Create a function handler based on configuration"""
        def handler(**kwargs):
            return self._execute_function(func_config["name"], **kwargs)
        return handler
    
    def _execute_function(self, function_name: str, **kwargs) -> str:
        """Execute agent-specific functions"""
        if self.agent_type == "document_expert":
            return self._execute_document_function(function_name, **kwargs)
        else:
            return f"Function {function_name} not implemented for {self.agent_type}"
    
    def _execute_document_function(self, function_name: str, **kwargs) -> str:
        """Execute document analysis functions"""
        if function_name == "analyze_document_structure":
            return self._analyze_document_structure(**kwargs)
        elif function_name == "extract_key_information":
            return self._extract_key_information(**kwargs)
        return f"Unknown document function: {function_name}"
    
    def _analyze_document_structure(self, document_content: str, focus_areas: Optional[List[str]] = None) -> str:
        """Analyze document structure"""
        structure_analysis = {
            "document_type": "Identified from content",
            "main_sections": ["Introduction", "Main Content", "Conclusion"],
            "page_count": "Estimated from content length",
            "key_topics": focus_areas or ["Identified key topics"],
            "document_quality": "Good readability and structure"
        }
        
        return json.dumps(structure_analysis, indent=2)
    
    def _extract_key_information(self, document_content: str, query: str, information_type: str = "facts") -> str:
        """Extract key information based on query"""
        extraction_result = {
            "query": query,
            "information_type": information_type,
            "extracted_info": f"Key information relevant to: {query}",
            "confidence": "High",
            "page_references": ["Page 1", "Page 3"],
            "related_topics": ["Related topic 1", "Related topic 2"]
        }
        
        return json.dumps(extraction_result, indent=2)


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
        has_pdf = bool(data_sources.get("pdf_id")) 
        
        if has_pdf:
            return "document_query"
        else:
            return "general_query"
    
    async def coordinate_response(self, query: str, data_sources: Dict[str, Any]) -> str:
        """Coordinate response generation using appropriate agents"""
        workflow = self.determine_workflow(query, data_sources)
        
        if workflow == "document_query" and "document_expert" in self.available_agents:
            return await self._single_agent_workflow(query, "document_expert", data_sources)
        else:
            return self._direct_response(query)
    
    async def _single_agent_workflow(self, query: str, agent_type: str, data_sources: Dict[str, Any]) -> str:
        """Handle single agent workflow"""
        agent = self.available_agents[agent_type]
        
        # Create a context-specific message
        context_message = f"""
        Query: {query}
        Data Sources: {json.dumps(data_sources, indent=2)}
        
        Please analyze this query using your specialized capabilities and provide a comprehensive response.
        """
        
        # This would initiate a conversation with the specialist agent
        response = await self._simulate_agent_conversation(agent, context_message)
        return response
    
    def _direct_response(self, query: str) -> str:
        """Provide direct response when no specialists are needed"""
        return f"I understand your query: '{query}'. However, I don't have access to specific PDF documents to provide a detailed analysis. Please provide relevant PDF documents for a more comprehensive response."


class DocumentExpertAgent(BaseRAGAgent):
    """Specialized agent for PDF document analysis"""
    
    def __init__(self, document_content: Optional[str] = None, **kwargs):
        super().__init__("document_expert", document_content, **kwargs)
