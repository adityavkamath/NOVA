"""
AutoGen Agent Routes for RAG System
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, logger
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import json
import uuid
import os

from backend.auth.clerk_auth import get_current_user
from backend.supabase_client import supabase
from backend.agents.agent_orchestrator import orchestrator, AgentContext

router = APIRouter()

UPLOAD_DIR = os.environ.get("PDF_UPLOAD_DIR", "uploads/pdf/")

import re

def is_valid_uuid(val):
    if not val or val in ["null", "undefined", "", None]:
        return False
    uuid_regex = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')
    return bool(uuid_regex.match(val))

class AgentChatRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    csv_id: Optional[str] = None
    pdf_id: Optional[str] = None
    web_id: Optional[str] = None
    stream: bool = True

class CreateAgentSessionRequest(BaseModel):
    title: str
    description: Optional[str] = None
    agent_type: str = "multi_agent"  # single_agent, multi_agent, coordinator
    data_sources: Dict[str, Any] = {}

class AgentSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str]
    agent_type: str
    data_sources: Dict[str, Any]
    created_at: str

@router.post("/create-agent-session")
async def create_agent_session(
    request: CreateAgentSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new agent-powered chat session"""
    try:
        # Optional: Validate data sources if provided
        if request.data_sources:
            await _validate_data_sources(request.data_sources, current_user["id"])
        
        session_id = str(uuid.uuid4())

        # 👇 DO NOT pass source_id — it's UUID and not required here
        session_data = {
            "id": session_id,
            "user_id": current_user["id"],
            "title": request.title,
            "feature_type": "agent",   # NEW feature_type for agents
            "agent_type": request.agent_type  # ✅ Added new column
        }

        # DEBUG: log what we’re inserting
        print("📤 Inserting into chat_sessions:", session_data)

        result = supabase.table("chat_sessions").insert(session_data).execute()
        
        print("✅ Insert result:", result)

        if result.data:
            return AgentSessionResponse(
                id=result.data[0]["id"],
                user_id=result.data[0]["user_id"],
                title=result.data[0]["title"],
                description=request.description,  # Not in DB
                agent_type=request.agent_type,    # Coming from request
                data_sources=request.data_sources,
                created_at=result.data[0]["created_at"]
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to create agent session")
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating agent session: {str(e)}")


@router.post("/chat")
async def agent_chat(
    request: AgentChatRequest,
    current_user: dict = Depends(get_current_user)
):
    """Chat with AutoGen agents (streaming, persistent history)"""
    try:
        # Validate pdf_id if present
        if request.pdf_id and not is_valid_uuid(request.pdf_id):
            raise HTTPException(status_code=400, detail="Invalid PDF ID")
        # Get or create session
        if request.session_id:
            session = await _get_session(request.session_id, current_user["id"])
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            data_sources = {}
            if request.csv_id:
                data_sources["csv_id"] = request.csv_id
            if request.pdf_id:
                data_sources["pdf_id"] = request.pdf_id
            if request.web_id:
                data_sources["web_id"] = request.web_id
        else:
            session_id = str(uuid.uuid4())
            data_sources = {}
            if request.csv_id:
                data_sources["csv_id"] = request.csv_id
            if request.pdf_id:
                data_sources["pdf_id"] = request.pdf_id
            if request.web_id:
                data_sources["web_id"] = request.web_id
            session = {
                "id": session_id,
                "user_id": current_user["id"],
                "title": "Agent Chat",
                "agent_type": "multi_agent",
                "data_sources": json.dumps(data_sources)
            }
        await _validate_data_sources(data_sources, current_user["id"])
        conversation_history = await _get_conversation_history(session["id"])
        context = AgentContext(
            user_id=current_user["id"],
            session_id=session["id"],
            query=request.query,
            data_sources=data_sources,
            conversation_history=conversation_history
        )
        # Save user message before streaming
        supabase.table("chat_messages").insert({
            "id": str(uuid.uuid4()),
            "session_id": session["id"],
            "role": "user",
            "message": request.query,
            "timestamp": datetime.utcnow().isoformat(),
            "sources": None
        }).execute()
        async def stream():
            agent_response = ""
            sources = None
            async for chunk in orchestrator.process_query(context, stream=True):
                yield f"data: {chunk}\n\n"
                try:
                    parsed = json.loads(chunk)
                    if "content" in parsed:
                        agent_response += parsed["content"]
                    if "sources" in parsed:
                        sources = parsed["sources"]
                except Exception:
                    pass
            # Save agent message after streaming
            supabase.table("chat_messages").insert({
                "id": str(uuid.uuid4()),
                "session_id": session["id"],
                "role": "ai_agent",
                "message": agent_response,
                "timestamp": datetime.utcnow().isoformat(),
                "sources": json.dumps(sources) if sources else None
            }).execute()
        return StreamingResponse(stream(), media_type="text/event-stream")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error during agent chat: {str(e)}")


@router.get("/sessions/{session_id}/messages")
async def get_agent_session_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    """
    Fetch all messages for an agent chat session, ordered by timestamp ASC.
    Returns a plain list for frontend rendering.
    """
    # Verify session exists and belongs to this user
    session_resp = supabase.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", current_user["id"]).execute()
    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Session not found")
    # Fetch messages ordered by timestamp ascending
    response = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("timestamp").execute()
    if not response.data:
        return []
    # Parse sources JSON text to Python object safely
    messages_data = []
    for msg in response.data:
        sources = None
        try:
            sources = json.loads(msg["sources"]) if msg.get("sources") else None
        except Exception:
            sources = None
        messages_data.append({
            "id": msg["id"],
            "role": msg["role"],
            "message": msg["message"],
            "tokens_used": msg.get("tokens_used"),
            "timestamp": msg.get("timestamp"),
            "sources": sources
        })
    return messages_data


@router.delete("/sessions/{session_id}")
async def delete_agent_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an agent chat session"""
    try:
        # Verify session ownership
        session = await _get_session(session_id, current_user["id"])
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Delete messages first
        supabase.table("chat_messages").delete().eq("session_id", session_id).execute()
        
        # Delete session
        supabase.table("chat_sessions").delete().eq("id", session_id).eq("user_id", current_user["id"]).execute()
        
        return {"message": "Session deleted successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting session: {str(e)}")

@router.get("/agent-status")
async def get_agent_status():
    """Get the status of the agent system"""
    try:
        # Initialize orchestrator if needed
        if not orchestrator.is_initialized:
            await orchestrator.initialize()
        
        return {
            "status": "active" if orchestrator.is_initialized else "inactive",
            "available_agents": list(orchestrator.specialists.keys()) if orchestrator.is_initialized else [],
            "active_sessions": len(orchestrator.active_sessions),
            "capabilities": {
                "csv_analysis": True,
                "document_analysis": True, 
                "web_research": True,
                "multi_source_synthesis": True,
                "streaming_responses": True
            }
        }
    
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "available_agents": [],
            "active_sessions": 0
        }

# Helper functions
async def _validate_data_sources(data_sources: Dict[str, Any], user_id: str):
    """Validate that user has access to specified data sources"""
    if data_sources.get("csv_id"):
        csv_response = supabase.table("csv_datasets").select("id").eq("id", data_sources["csv_id"]).eq("user_id", user_id).execute()
        if not csv_response.data:
            raise HTTPException(status_code=404, detail="CSV not found or access denied")
    
    if data_sources.get("pdf_id"):
        pdf_response = supabase.table("pdf_files").select("id").eq("id", data_sources["pdf_id"]).eq("user_id", user_id).execute()
        if not pdf_response.data:
            raise HTTPException(status_code=404, detail="PDF not found or access denied")
    
    if data_sources.get("web_id"):
        web_response = supabase.table("web_pages").select("id").eq("id", data_sources["web_id"]).eq("user_id", user_id).execute()
        if not web_response.data:
            raise HTTPException(status_code=404, detail="Web content not found or access denied")

async def _get_session(session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get session by ID and user ID"""
    try:
        response = supabase.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", user_id).execute()
        return response.data[0] if response.data else None
    except:
        return None

async def _get_conversation_history(session_id: str) -> List[Dict[str, str]]:
    """Get conversation history for a session"""
    try:
        response = supabase.table("chat_messages").select("role, message").eq("session_id", session_id).order("created_at").execute()
        
        history = []
        for msg in response.data:
            history.append({
                "role": msg["role"],
                "content": msg["message"]
            })
        
        return history
    except:
        return []

async def _save_agent_messages(session_id: str, user_query: str, agent_response: str):
    """Save user query and agent response to database"""
    try:
        import uuid
        # Save user message
        supabase.table("chat_messages").insert({
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "role": "user",
            "message": user_query,
            "sources": None
        }).execute()

        # Save agent response
        supabase.table("chat_messages").insert({
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "role": "ai_agent",
            "message": agent_response,
            "sources": json.dumps([{"type": "agent_analysis", "title": "AutoGen Agent Response"}])
        }).execute()
    except Exception as e:
        print(f"Error saving agent messages: {e}")

async def _stream_agent_response(context: AgentContext):
    """Stream agent response"""
    try:
        full_response = ""
        async for chunk in orchestrator.process_query(context, stream=True):
            chunk_data = json.loads(chunk)
            if "content" in chunk_data:
                full_response += chunk_data["content"]
            yield f"data: {chunk}\n\n"
        
        yield "data: [DONE]\n\n"
        
        # Save messages after streaming is complete
        await _save_agent_messages(context.session_id, context.query, full_response)
    
    except Exception as e:
        error_chunk = json.dumps({"error": f"Streaming error: {str(e)}"})
        yield f"data: {error_chunk}\n\n"
        yield "data: [DONE]\n\n"
