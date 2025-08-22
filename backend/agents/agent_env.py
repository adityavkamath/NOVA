import os
from pathlib import Path

AGENT_CONFIG = {
    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY"),
    "OPENAI_MODEL_PRIMARY": os.getenv("OPENAI_MODEL_PRIMARY", "gpt-4"),
    "OPENAI_MODEL_SECONDARY": os.getenv("OPENAI_MODEL_SECONDARY", "gpt-3.5-turbo"),
    "OPENAI_TEMPERATURE": float(os.getenv("OPENAI_TEMPERATURE", "0.3")),
    "OPENAI_MAX_TOKENS": int(os.getenv("OPENAI_MAX_TOKENS", "4000")),
    
    "MAX_CONSECUTIVE_AUTO_REPLY": int(os.getenv("MAX_CONSECUTIVE_AUTO_REPLY", "3")),
    "AGENT_TIMEOUT": int(os.getenv("AGENT_TIMEOUT", "120")),
    "ENABLE_STREAMING": os.getenv("ENABLE_STREAMING", "true").lower() == "true",
    "ENABLE_FUNCTION_CALLING": os.getenv("ENABLE_FUNCTION_CALLING", "true").lower() == "true",
    
    "VECTOR_SEARCH_TOP_K": int(os.getenv("VECTOR_SEARCH_TOP_K", "5")),
    "EMBEDDING_MODEL": os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002"),
    
    "LOG_LEVEL": os.getenv("LOG_LEVEL", "INFO"),
    "LOG_AGENT_CONVERSATIONS": os.getenv("LOG_AGENT_CONVERSATIONS", "false").lower() == "true",
    
    "CACHE_ENABLED": os.getenv("CACHE_ENABLED", "true").lower() == "true",
    "CACHE_TTL": int(os.getenv("CACHE_TTL", "3600")),  # 1 hour
    "MAX_CONCURRENT_AGENTS": int(os.getenv("MAX_CONCURRENT_AGENTS", "5")),
}

def validate_agent_config():
    """Validate agent configuration"""
    required_vars = ["OPENAI_API_KEY"]
    missing_vars = []
    
    for var in required_vars:
        if not AGENT_CONFIG.get(var):
            missing_vars.append(var)
    
    if missing_vars:
        raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
    
    return True

__all__ = ["AGENT_CONFIG", "validate_agent_config"]
