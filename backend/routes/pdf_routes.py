from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from auth.clerk_auth import get_current_user
from supabase_client import supabase
from config import SUPABASE_STORAGE_BUCKET_NAME
import uuid

from utils.embedding_processor import process_pdf_embeddings

router = APIRouter()
BUCKET = SUPABASE_STORAGE_BUCKET_NAME

@router.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    contents = await file.read()
    if len(contents) > 200 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 200MB")

    try:
        filename = f"{uuid.uuid4()}.pdf"
        supabase_path = f"pdfs/{current_user['id']}/{filename}"

        supabase.storage.from_(BUCKET).upload(
            supabase_path,
            contents,
            {
                "content-type": "application/pdf",
                "x-upsert": "false",
            }
        )

        signed_url_response = supabase.storage.from_(BUCKET).create_signed_url(
            supabase_path, 604800  # 7 days
        )
        signed_url = signed_url_response.get("signedURL")
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to generate signed URL")

        pdf_id = str(uuid.uuid4())
        insert_result = supabase.table("pdf_files").insert({
            "id": pdf_id,
            "user_id": current_user["id"],
            "filename": file.filename,
            "supabase_path": supabase_path,
            "embedding_status": "pending",
            "public_url": signed_url,
        }).execute()

        # Convert the pdf into embeddings and store it in supabase
        await process_pdf_embeddings(
            pdf_id=pdf_id,
            user_id=current_user["id"],
            signed_url=signed_url,
            filename=file.filename
        )

        return {
            "success": True,
            "message": "PDF uploaded and embeddings processed successfully.",
            "data": {
                "id": insert_result.data[0]["id"],
                "filename": file.filename,
                "path": supabase_path,
                "url": signed_url,
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# To get individual pdf details by its id
@router.get("/{pdf_id}")
async def get_pdf(pdf_id: str, user_id: str = Header(None, alias="user-id")):
    try:
        if not pdf_id:
            raise HTTPException(status_code=400, detail="PDF ID is required")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID header is required")
        
        current_user = await get_current_user(user_id)
        
        # Fetch PDF details of the current user only
        response = supabase.table("pdf_files").select("*").eq("id", pdf_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="PDF not found or you don't have permission to access it")
        
        pdf_data = response.data[0]
        return pdf_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Debug: Exception occurred: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))