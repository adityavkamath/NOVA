import os
import uuid
import tempfile
import requests
from datetime import datetime
from supabase_client import supabase

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings

embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")

# Clean text to avoid UnicodeEncodeError from bad surrogate pairs
def clean_text(text: str) -> str:
    # Remove null bytes and other problematic characters
    cleaned = text.replace("\x00", "")  # Remove null characters
    cleaned = cleaned.encode("utf-8", "ignore").decode("utf-8", "ignore")  # Handle surrogate pairs
    return cleaned


async def process_pdf_embeddings(pdf_id: str, user_id: str, signed_url: str, filename: str):
    try:
        response = requests.get(signed_url)
        response.raise_for_status()
        pdf_content = response.content

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(pdf_content)
            temp_path = temp_file.name

        try:
            loader = PyPDFLoader(temp_path)
            documents = loader.load()

            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_documents(documents)

            # Clean texts before embedding
            texts = [clean_text(chunk.page_content) for chunk in chunks]
            embeddings = embeddings_model.embed_documents(texts)

            insert_data = []
            for cleaned_text, chunk, emb in zip(texts, chunks, embeddings):
                insert_data.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "source_id": pdf_id,
                    "feature_type": "pdf",
                    "chunk_text": cleaned_text,  # Store cleaned text
                    "embedding": emb,
                    "created_at": datetime.utcnow().isoformat()
                })

            batch_size = 50
            for i in range(0, len(insert_data), batch_size):
                supabase.table("document_chunks").insert(insert_data[i:i+batch_size]).execute()

            supabase.table("pdf_files").update({
                "embedding_status": "completed",
            }).eq("id", pdf_id).execute()

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        supabase.table("pdf_files").update({
            "embedding_status": "failed",
        }).eq("id", pdf_id).execute()
        print(f"❌ Embedding failed for PDF {pdf_id}: {e}")
