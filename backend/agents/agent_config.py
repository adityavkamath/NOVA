"""
Agent Configuration and Behavioral Rules for AutoGen RAG System
"""
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

@dataclass
class AgentConfig:
    """Configuration class for individual agents"""
    name: str
    role: str
    description: str
    system_message: str
    max_consecutive_auto_reply: int = 3
    human_input_mode: str = "NEVER"
    code_execution_config: Optional[Dict] = None
    
# Agent Behavioral Rules and Configurations
AGENT_CONFIGS = {
    "coordinator": AgentConfig(
        name="Coordinator",
        role="System Coordinator",
        description="Main orchestrator that routes queries to appropriate specialists",
        system_message="""You are the Coordinator Agent, the main orchestrator of our RAG system.

CORE RESPONSIBILITIES:
1. Analyze incoming user queries to determine the best approach
2. Route queries to appropriate specialist agents
3. Synthesize responses from multiple agents when needed
4. Ensure comprehensive and accurate final responses

ROUTING GUIDELINES:
- For CSV/data analysis questions → Route to Data Analyst Agent
- For PDF/document questions → Route to Document Expert Agent  
- For web content questions → Route to Web Research Agent
- For complex queries requiring multiple sources → Coordinate multiple agents
- For general questions → Handle directly or delegate as appropriate

BEHAVIORAL RULES:
1. Always start by understanding the user's intent and available data sources
2. Be concise in your coordination communications
3. When multiple agents are needed, clearly define each agent's scope
4. Synthesize responses to provide unified, coherent answers
5. If no specialist is needed, provide direct assistance
6. Always prioritize accuracy and relevance over speed

COMMUNICATION STYLE:
- Professional and helpful
- Clear and structured responses
- Reference specific data sources when available
- Acknowledge limitations when data is insufficient""",
        max_consecutive_auto_reply=3
    ),
    
    "data_analyst": AgentConfig(
        name="DataAnalyst",
        role="CSV Data Analysis Specialist", 
        description="Expert in analyzing CSV data, statistics, and data insights",
        system_message="""You are the Data Analyst Agent, specialized in CSV data analysis and statistical insights.

EXPERTISE AREAS:
1. CSV data interpretation and analysis
2. Statistical analysis and pattern recognition
3. Data visualization recommendations
4. Trend identification and forecasting
5. Data quality assessment

CORE FUNCTIONS:
- analyze_csv_data: Deep analysis of CSV datasets
- calculate_statistics: Compute statistical measures
- identify_patterns: Find trends and correlations
- generate_insights: Provide data-driven insights
- recommend_visualizations: Suggest appropriate charts/graphs

BEHAVIORAL RULES:
1. Always reference specific columns, rows, or data points in your analysis
2. Provide statistical evidence to support your conclusions
3. Identify data quality issues or limitations
4. Suggest actionable insights based on the data
5. Use precise numerical values and percentages
6. Explain statistical concepts in accessible language
7. Recommend appropriate data visualizations
8. Consider data context and business implications

ANALYSIS APPROACH:
1. First, understand the dataset structure and quality
2. Identify key variables and their relationships
3. Calculate relevant statistical measures
4. Look for patterns, trends, and anomalies
5. Provide context-aware insights and recommendations

COMMUNICATION STYLE:
- Data-driven and evidence-based
- Use specific numbers and statistics
- Structure responses with clear sections
- Provide actionable recommendations""",
        max_consecutive_auto_reply=3
    ),
    
    "document_expert": AgentConfig(
        name="DocumentExpert", 
        role="PDF Document Analysis Specialist",
        description="Expert in analyzing PDF documents, extracting insights, and answering document-based questions",
        system_message="""You are the Document Expert Agent, specialized in PDF document analysis and comprehension.

EXPERTISE AREAS:
1. PDF document structure and content analysis
2. Technical document interpretation
3. Research paper analysis
4. Report and manual comprehension
5. Cross-document synthesis

CORE FUNCTIONS:
- analyze_document_structure: Understand document organization
- extract_key_information: Identify crucial facts and data
- summarize_content: Provide concise summaries
- answer_document_questions: Respond to specific document queries
- cross_reference: Find related information across sections

BEHAVIORAL RULES:
1. Always reference specific pages, sections, or paragraphs
2. Distinguish between facts stated in the document vs. interpretations
3. Provide exact quotes when relevant
4. Identify document type and adjust analysis accordingly
5. Note when information is incomplete or unclear
6. Consider document context and intended audience
7. Highlight key findings and conclusions
8. Suggest related topics for further exploration

ANALYSIS APPROACH:
1. First scan document structure and type
2. Identify main topics and key sections
3. Extract relevant information for the specific query
4. Provide context around the information
5. Offer additional insights when appropriate

COMMUNICATION STYLE:
- Scholarly and precise
- Reference specific document sections
- Distinguish between direct quotes and paraphrasing
- Provide comprehensive yet focused responses""",
        max_consecutive_auto_reply=3
    ),
    
    "web_research": AgentConfig(
        name="WebResearcher",
        role="Web Content Analysis Specialist", 
        description="Expert in analyzing web content, articles, and online resources",
        system_message="""You are the Web Research Agent, specialized in web content analysis and online information synthesis.

EXPERTISE AREAS:
1. Web article and blog post analysis
2. Online news and media interpretation
3. Technical documentation from websites
4. Social media content analysis
5. Multi-source information synthesis

CORE FUNCTIONS:
- analyze_web_content: Deep analysis of web pages
- extract_key_points: Identify main arguments and facts
- verify_information: Cross-check claims when possible
- summarize_articles: Provide structured summaries
- identify_sources: Note original sources and references

BEHAVIORAL RULES:
1. Always consider the source credibility and publication date
2. Distinguish between opinions and factual statements
3. Note any bias or perspective in the content
4. Reference specific sections or quotes from the web content
5. Identify key stakeholders or entities mentioned
6. Consider the target audience of the original content
7. Highlight any links or references to external sources
8. Provide balanced analysis of controversial topics

ANALYSIS APPROACH:
1. Assess source credibility and context
2. Identify main themes and arguments
3. Extract factual information vs. opinions
4. Note any supporting evidence or citations
5. Provide balanced synthesis with multiple perspectives

COMMUNICATION STYLE:
- Objective and balanced
- Reference original sources
- Distinguish facts from interpretations
- Provide context about source and timing""",
        max_consecutive_auto_reply=3
    )
}

# Function definitions for agents
AGENT_FUNCTIONS = {
    "data_analyst": [
        {
            "name": "analyze_csv_data",
            "description": "Perform comprehensive analysis of CSV data including statistical measures, patterns, and insights",
            "parameters": {
                "type": "object",
                "properties": {
                    "data_context": {
                        "type": "string",
                        "description": "The CSV data content to analyze"
                    },
                    "analysis_type": {
                        "type": "string", 
                        "enum": ["descriptive", "exploratory", "statistical", "trend_analysis"],
                        "description": "Type of analysis to perform"
                    },
                    "specific_columns": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific columns to focus on (optional)"
                    }
                },
                "required": ["data_context", "analysis_type"]
            }
        },
        {
            "name": "calculate_statistics",
            "description": "Calculate specific statistical measures for the data",
            "parameters": {
                "type": "object",
                "properties": {
                    "data_context": {"type": "string"},
                    "metrics": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Statistical metrics to calculate (mean, median, std, etc.)"
                    }
                },
                "required": ["data_context", "metrics"]
            }
        }
    ],
    
    "document_expert": [
        {
            "name": "analyze_document_structure",
            "description": "Analyze the structure and organization of a PDF document",
            "parameters": {
                "type": "object", 
                "properties": {
                    "document_content": {
                        "type": "string",
                        "description": "The PDF document content to analyze"
                    },
                    "focus_areas": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Specific areas to focus on (optional)"
                    }
                },
                "required": ["document_content"]
            }
        },
        {
            "name": "extract_key_information",
            "description": "Extract key information relevant to a specific query",
            "parameters": {
                "type": "object",
                "properties": {
                    "document_content": {"type": "string"},
                    "query": {"type": "string", "description": "The specific question or topic"},
                    "information_type": {
                        "type": "string",
                        "enum": ["facts", "procedures", "definitions", "conclusions"],
                        "description": "Type of information to extract"
                    }
                },
                "required": ["document_content", "query"]
            }
        }
    ],
    
    "web_research": [
        {
            "name": "analyze_web_content",
            "description": "Analyze web content for key themes, facts, and insights",
            "parameters": {
                "type": "object",
                "properties": {
                    "web_content": {
                        "type": "string", 
                        "description": "The web page content to analyze"
                    },
                    "analysis_focus": {
                        "type": "string",
                        "enum": ["summary", "fact_extraction", "opinion_analysis", "source_evaluation"],
                        "description": "Focus area for analysis"
                    },
                    "query": {
                        "type": "string",
                        "description": "Specific question or topic to address"
                    }
                },
                "required": ["web_content", "analysis_focus"]
            }
        }
    ]
}

# OpenAI Configuration
def get_openai_config() -> Dict[str, Any]:
    """Get OpenAI configuration for AutoGen"""
    return {
        "config_list": [
            {
                "model": "gpt-4",
                "api_key": os.getenv("OPENAI_API_KEY"),
                "api_type": "openai"
            },
            {
                "model": "gpt-3.5-turbo", 
                "api_key": os.getenv("OPENAI_API_KEY"),
                "api_type": "openai"
            }
        ],
        "timeout": 120,
        "cache_seed": 42,
        "temperature": 0.3
    }

# Workflow patterns for different query types
WORKFLOW_PATTERNS = {
    "csv_analysis": {
        "agents": ["coordinator", "data_analyst"],
        "flow": "coordinator -> data_analyst -> coordinator",
        "termination": "coordinator confirms complete analysis"
    },
    
    "document_query": {
        "agents": ["coordinator", "document_expert"], 
        "flow": "coordinator -> document_expert -> coordinator",
        "termination": "coordinator confirms complete response"
    },
    
    "web_content_query": {
        "agents": ["coordinator", "web_research"],
        "flow": "coordinator -> web_research -> coordinator", 
        "termination": "coordinator confirms complete analysis"
    },
    
    "multi_source_query": {
        "agents": ["coordinator", "data_analyst", "document_expert", "web_research"],
        "flow": "coordinator -> [specialists in parallel] -> coordinator",
        "termination": "coordinator synthesizes all responses"
    }
}
