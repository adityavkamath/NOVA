from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from backend.auth.clerk_auth import get_current_user
from backend.utils.semantic_search import search_similar_docs, get_available_sources, check_collections_status
from backend.utils.llm_answer import generate_answer, is_python_question
from backend.supabase_client import supabase
from typing import List, Optional
import uuid

router = APIRouter()

class MultiSearchRequest(BaseModel):
    query: str
    source: str = "all"

class MultiSearchResponse(BaseModel):
    answer: str
    docs: List[dict]
    source: str
    sources_used: List[str]

class CreateSessionRequest(BaseModel):
    title: Optional[str] = "Multi-Source Chat"

class SendMessageRequest(BaseModel):
    session_id: str
    message: str
    source: str = "all"

class ChatSessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    feature_type: str

class ChatMessageResponse(BaseModel):
    id: str
    role: str
    message: str
    timestamp: str

@router.get("/search")
async def semantic_search(
    query: str = Query(..., description="The search query"),
    source: str = Query("all", description="The source to search in"),
    current_user: dict = Depends(get_current_user)
):
    """Perform semantic search across the chroma database"""
    print(f"🔍 Multi-chat Query: {query}, Source: {source}")

    if not is_python_question(query):
        return {
            "answer": "❌ Sorry, I only assist with Python-related queries.",
            "docs": [],
            "source": source,
            "sources_used": []
        }

    docs = search_similar_docs(query, source=source, top_k=5)
    if not docs:
        return {
            "answer": "No relevant information found.",
            "docs": [],
            "source": source,
            "sources_used": []
        }

    context = "\n\n".join([f"Source: {doc['source']}\nTitle: {doc.get('title', 'No title')}\nContent: {doc['text']}" for doc in docs])
    top_doc = docs[0]

    answer = generate_answer(query, context, source=top_doc["source"])
    print(f"✅ Multi-chat Answer: {answer[:100]}...")

    sources_used = list(set([doc["source"] for doc in docs]))

    return {
        "answer": answer,
        "docs": docs,
        "source": source,
        "sources_used": sources_used
    }

@router.get("/sources")
async def get_sources(current_user: dict = Depends(get_current_user)):
    """Get available sources for search"""
    try:
        sources = get_available_sources()
        return {
            "success": True,
            "sources": sources,
            "sources_with_labels": [
                {"value": "all", "label": "All Sources"},
                {"value": "reddit", "label": "Reddit"},
                {"value": "stackoverflow", "label": "StackOverflow"},
                {"value": "github", "label": "GitHub"},
                {"value": "devto", "label": "Dev.to"},
                {"value": "hackernews", "label": "HackerNews"}
            ]
        }
    except Exception as e:
        print(f"Error getting sources: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search")
async def semantic_search_post(
    request: MultiSearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """Alternative POST endpoint for semantic search"""
    return await semantic_search(
        query=request.query,
        source=request.source,
        current_user=current_user
    )

@router.get("/status")
async def get_collections_status(current_user: dict = Depends(get_current_user)):
    """Get status of all collections"""
    try:
        status = check_collections_status()
        return {
            "success": True,
            "collections": status,
            "total_available": len([k for k, v in status.items() if v["status"] == "available"])
        }
    except Exception as e:
        print(f"Error getting collection status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sessions")
async def create_chat_session(
    request: CreateSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new multi-source chat session"""
    try:
        session_id = str(uuid.uuid4())
        session_data = {
            "id": session_id,
            "user_id": current_user["id"],
            "title": request.title,
            "feature_type": "multi_source",
            "source_id": None,  
        }

        insert_result = supabase.table("chat_sessions").insert(session_data).execute()
        
        if not insert_result.data:
            raise HTTPException(status_code=500, detail="Failed to create chat session")
        
        return {
            "id": insert_result.data[0]["id"],
            "title": insert_result.data[0]["title"],
            "created_at": insert_result.data[0]["created_at"],
            "feature_type": insert_result.data[0]["feature_type"]
        }
        
    except Exception as e:
        print(f"Error creating chat session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_user)
):
    """Get all multi-source chat sessions for the current user"""
    try:
        response = supabase.table("chat_sessions").select("*").eq("user_id", current_user["id"]).eq("feature_type", "multi_source").order("created_at", desc=True).execute()
        
        return {
            "sessions": [
                {
                    "id": session["id"],
                    "title": session["title"],
                    "created_at": session["created_at"],
                    "feature_type": session["feature_type"]
                }
                for session in response.data
            ]
        }
        
    except Exception as e:
        print(f"Error getting chat sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}/messages")
async def get_chat_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all messages for a specific chat session"""
    try:
        session_response = supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).execute()
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Session not found")

        messages_response = supabase.table("chat_messages").select("*").eq("session_id", session_id).order("timestamp", desc=False).execute()
        
        return {
            "messages": [
                {
                    "id": message["id"],
                    "role": message["role"],
                    "message": message["message"],
                    "sources": message.get("sources"),
                    "timestamp": message["timestamp"]
                }
                for message in messages_response.data
            ]
        }
        
    except Exception as e:
        print(f"Error getting chat messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-message")
async def send_message(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a message and get AI response with database storage"""
    try:
        session_response = supabase.table("chat_sessions").select("id").eq("id", request.session_id).eq("user_id", current_user["id"]).execute()
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Session not found")

        user_message_data = {
            "id": str(uuid.uuid4()),
            "session_id": request.session_id,
            "role": "user",
            "message": request.message,
        }
        
        user_result = supabase.table("chat_messages").insert(user_message_data).execute()

        if not is_python_question(request.message):
            ai_response = "❌ Sorry, I only assist with Python-related queries."
            docs = []
            sources_used = []
            detailed_sources = []
        else:
            docs = search_similar_docs(request.message, source=request.source, top_k=5)
            if not docs:
                ai_response = "No relevant information found."
                sources_used = []
                detailed_sources = []
            else:
                context = "\n\n".join([f"Source: {doc['source']}\nTitle: {doc.get('title', 'No title')}\nContent: {doc['text']}" for doc in docs])
                top_doc = docs[0]

                ai_response = generate_answer(request.message, context, source=top_doc["source"])
                sources_used = list(set([doc["source"] for doc in docs]))

                detailed_sources = []
                for doc in docs[:5]: 
                    source_info = {
                        "title": doc.get("title", f"{doc['source'].title()} Content"),
                        "url": doc.get("url"),
                        "content_preview": doc["text"][:200] + "..." if len(doc["text"]) > 200 else doc["text"],
                        "source_platform": doc["source"],
                        "relevance_score": round(1 - doc["score"], 3) 
                    }
                    detailed_sources.append(source_info)

        ai_message_data = {
            "id": str(uuid.uuid4()),
            "session_id": request.session_id,
            "role": "ai_agent",
            "message": ai_response,
        }

        if detailed_sources:
            import json
            try:
                ai_message_data["sources"] = json.dumps(detailed_sources)
            except Exception as e:
                print(f"Error serializing detailed sources: {e}")
                ai_message_data["sources"] = json.dumps(sources_used) if sources_used else None
        
        try:
            ai_result = supabase.table("chat_messages").insert(ai_message_data).execute()
        except Exception as e:
            print(f"Error inserting AI message: {e}")
            ai_message_data.pop("sources", None)
            ai_result = supabase.table("chat_messages").insert(ai_message_data).execute()
        
        return {
            "user_message": {
                "id": user_result.data[0]["id"],
                "role": user_result.data[0]["role"],
                "message": user_result.data[0]["message"],
                "timestamp": user_result.data[0]["timestamp"]
            },
            "ai_message": {
                "id": ai_result.data[0]["id"],
                "role": ai_result.data[0]["role"],
                "message": ai_result.data[0]["message"],
                "timestamp": ai_result.data[0]["timestamp"]
            },
            "docs": docs,
            "sources_used": sources_used,
            "detailed_sources": detailed_sources
        }
        
    except Exception as e:
        print(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail=str(e))
