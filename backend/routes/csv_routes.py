from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from auth.clerk_auth import get_current_user
from supabase_client import supabase
from config import SUPABASE_STORAGE_BUCKET_NAME
import uuid

from utils.embedding_processor import process_csv_embeddings

router = APIRouter()
BUCKET = SUPABASE_STORAGE_BUCKET_NAME

@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    print(f"CSV upload attempt - User: {current_user.get('id')}, File: {file.filename}, Content-Type: {file.content_type}")

    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    allowed_types = [
        "text/csv", 
        "application/csv", 
        "application/vnd.ms-excel",
        "text/plain", 
        "application/octet-stream"
    ]
    
    if file.content_type not in allowed_types:
        print(f"Received content type: {file.content_type}")  
        if not file.filename.lower().endswith('.csv'):
            raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Only CSV files are allowed")

    contents = await file.read()
    if len(contents) > 50 * 1024 * 1024: 
        raise HTTPException(status_code=400, detail="File size must be under 100MB")

    try:
        filename = f"{uuid.uuid4()}.csv"
        supabase_path = f"csvs/{current_user['id']}/{filename}"

        print(f"Uploading to Supabase path: {supabase_path}")

        upload_response = supabase.storage.from_(BUCKET).upload(
            supabase_path,
            contents,
            {
                "content-type": "text/csv",
                "x-upsert": "false",
            }
        )
        
        print(f"Upload response: {upload_response}")

        signed_url_response = supabase.storage.from_(BUCKET).create_signed_url(
            supabase_path, 604800  
        )
        signed_url = signed_url_response.get("signedURL")
        if not signed_url:
            print(f"Failed to get signed URL. Response: {signed_url_response}")
            raise HTTPException(status_code=500, detail="Failed to generate signed URL")

        csv_id = str(uuid.uuid4())
        print(f"Inserting CSV record with ID: {csv_id}")
        
        insert_result = supabase.table("csv_datasets").insert({
            "id": csv_id,
            "user_id": current_user["id"],
            "filename": file.filename,
            "supabase_path": supabase_path,
            "embedding_status": "pending",
        }).execute()
        
        print(f"Insert result: {insert_result}")

        print(f"Starting CSV embedding processing for {csv_id}")
        await process_csv_embeddings(
            csv_id=csv_id,
            user_id=current_user["id"],
            signed_url=signed_url,
            filename=file.filename
        )

        return {
            "success": True,
            "message": "CSV uploaded and embeddings processed successfully.",
            "data": {
                "id": insert_result.data[0]["id"],
                "filename": file.filename,
                "path": supabase_path,
                "url": signed_url,
            }
        }

    except Exception as e:
        print(f"CSV upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/{csv_id}")
async def get_csv(csv_id: str, user_id: str = Header(None, alias="user-id")):
    try:
        if not csv_id:
            raise HTTPException(status_code=400, detail="CSV ID is required")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID header is required")
        
        current_user = await get_current_user(user_id)

        response = supabase.table("csv_datasets").select("*").eq("id", csv_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="CSV not found or you don't have permission to access it")
        
        csv_data = response.data[0]

        signed_url_response = supabase.storage.from_(BUCKET).create_signed_url(
            csv_data["supabase_path"], 604800 
        )
        signed_url = signed_url_response.get("signedURL")
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to generate signed URL")

        csv_data["public_url"] = signed_url
        
        return csv_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
