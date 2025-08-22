from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from auth.clerk_auth import get_current_user
from supabase_client import supabase
from typing import Optional
import uuid
import json
from utils.chat_processing import get_or_create_memory, generate_response_stream

router = APIRouter()

class CreateChatSessionRequest(BaseModel):
    title: str
    feature_type: str 
    source_id: str    

class ChatSessionResponse(BaseModel):
    id: str
    user_id: str
    title: str
    feature_type: str
    source_id: Optional[str]
    created_at: str

@router.post("/create-session")
async def create_chat_session(
    request: CreateChatSessionRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        if request.source_id:
            if request.feature_type == "pdf":
                pdf_response = supabase.table("pdf_files").select("id").eq("id", request.source_id).eq("user_id", current_user["id"]).execute()
                if not pdf_response.data:
                    raise HTTPException(status_code=404, detail="PDF not found or you don't have permission to access it")
            elif request.feature_type == "csv":
                csv_response = supabase.table("csv_datasets").select("id").eq("id", request.source_id).eq("user_id", current_user["id"]).execute()
                if not csv_response.data:
                    raise HTTPException(status_code=404, detail="CSV not found or you don't have permission to access it")

        session_id = str(uuid.uuid4())
        session_data = {
            "id": session_id,
            "user_id": current_user["id"],
            "title": request.title,
            "feature_type": request.feature_type,
            "source_id": request.source_id if request.source_id else None,
        }

        insert_result = supabase.table("chat_sessions").insert(session_data).execute()
        
        if not insert_result.data:
            raise HTTPException(status_code=500, detail="Failed to create chat session")

        return {
            "success": True,
            "message": "Chat session created successfully",
            "data": {
                "id": insert_result.data[0]["id"],
                "user_id": insert_result.data[0]["user_id"],
                "title": insert_result.data[0]["title"],
                "feature_type": insert_result.data[0]["feature_type"],
                "source_id": insert_result.data[0]["source_id"],
                "created_at": insert_result.data[0]["created_at"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred while creating chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create chat session: {str(e)}")

@router.get("/{session_id}")
async def get_chat_session(
    session_id: str, 
    current_user: dict = Depends(get_current_user)
):
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")

        response = supabase.table("chat_sessions").select("*").eq("id", session_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Chat session not found or you don't have permission to access it")
        
        session_data = response.data[0]
        return {
            "success": True,
            "data": session_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred while fetching chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
async def get_user_chat_sessions(
    current_user: dict = Depends(get_current_user),
    feature_type: Optional[str] = None,
    source_id: Optional[str] = None,
    limit: Optional[int] = 50
):
    """Get all chat sessions for the current user"""
    try:
        query = supabase.table("chat_sessions").select("*").eq("user_id", current_user["id"])

        if feature_type:
            query = query.eq("feature_type", feature_type)

        if source_id:
            query = query.eq("source_id", source_id)

        query = query.limit(limit).order("created_at", desc=True)
        
        response = query.execute()
        
        return {
            "success": True,
            "data": response.data,
            "count": len(response.data)
        }
        
    except Exception as e:
        print(f"Debug: Exception occurred while fetching user chat sessions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a chat session and all its messages"""
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")

        session_response = supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).execute()
        
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Chat session not found or you don't have permission to delete it")

        supabase.table("chat_messages").delete().eq("session_id", session_id).execute()

        delete_result = supabase.table("chat_sessions").delete().eq("id", session_id).eq("user_id", current_user["id"]).execute()
        
        return {
            "success": True,
            "message": "Chat session and all messages deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred while deleting chat session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/messages")
async def get_chat_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    limit: Optional[int] = 100
):
    """Get all messages for a specific chat session"""
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")

        session_response = supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).execute()
        
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Chat session not found or you don't have permission to access it")

        messages_response = supabase.table("chat_messages").select("*").eq("session_id", session_id).limit(limit).order("timestamp", desc=False).execute()
        
        return {
            "success": True,
            "data": messages_response.data,
            "count": len(messages_response.data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred while fetching chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

class SendMessageRequest(BaseModel):
    session_id: str
    message: str
    pdf_id: Optional[str] = None
    csv_id: Optional[str] = None
    web_id: Optional[str] = None

@router.post("/send-message")
async def send_message(
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    try:
        print(f"DEBUG: send_message received - session_id: {request.session_id}, pdf_id: {request.pdf_id}, csv_id: {request.csv_id}, web_id: {request.web_id}")

        session_response = supabase.table("chat_sessions").select("id").eq("id", request.session_id).eq("user_id", current_user["id"]).execute()
        
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Chat session not found")

        user_message_data = {
            "id": str(uuid.uuid4()),
            "session_id": request.session_id,
            "role": "user",
            "message": request.message,
            "tokens_used": len(request.message.split()),  
        }
        
        supabase.table("chat_messages").insert(user_message_data).execute()

        async def generate_and_save_response():
            assistant_message_id = str(uuid.uuid4())
            assistant_response = ""
            
            async for chunk in generate_response_stream(
                request.message, 
                request.session_id, 
                request.pdf_id, 
                current_user,
                csv_id=request.csv_id,
                web_id=request.web_id
            ):
                if chunk.startswith("data: ") and not chunk.endswith("[DONE]\n\n"):
                    try:
                        data = json.loads(chunk[6:])
                        if "content" in data:
                            assistant_response += data["content"]
                    except:
                        pass
                
                yield chunk

            assistant_message_data = {
                "id": assistant_message_id,
                "session_id": request.session_id,
                "role": "ai_agent",
                "message": assistant_response.strip(),
                "tokens_used": len(assistant_response.split()),
            }
            
            supabase.table("chat_messages").insert(assistant_message_data).execute()
        
        return StreamingResponse(
            generate_and_save_response(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception in send_message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{session_id}/messages")
async def get_chat_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user),
    limit: Optional[int] = 100
):
    """Get all messages for a specific chat session"""
    try:
        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID is required")

        session_response = supabase.table("chat_sessions").select("id").eq("id", session_id).eq("user_id", current_user["id"]).execute()
        
        if not session_response.data:
            raise HTTPException(status_code=404, detail="Chat session not found or you don't have permission to access it")

        messages_response = supabase.table("chat_messages").select("*").eq("session_id", session_id).limit(limit).order("timestamp", desc=False).execute()

        memory = get_or_create_memory(session_id)
        memory.clear() 
        
        for msg in messages_response.data:
            if msg["role"] == "user":
                memory.chat_memory.add_user_message(msg["message"])
            else:
                memory.chat_memory.add_ai_message(msg["message"])
        
        return {
            "success": True,
            "data": messages_response.data,
            "count": len(messages_response.data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred while fetching chat messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))