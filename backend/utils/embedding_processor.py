async def embed_chunks(chunks):
    """Embed a list of chunk dicts asynchronously and return embeddings."""
    texts = [chunk.get("chunk_text", chunk.get("content", "")) for chunk in chunks]
    return embeddings_model.embed_documents(texts)

async def semantic_search(query, chunks, embeddings):
    """Perform semantic search over embedded chunks and return relevant ones."""
    # Simple cosine similarity search (replace with your own logic if needed)
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    query_embedding = embeddings_model.embed_query(query)
    similarities = cosine_similarity([query_embedding], embeddings)[0]
    # Attach scores to chunks
    for i, chunk in enumerate(chunks):
        chunk["score"] = float(similarities[i])
    # Sort by score descending
    sorted_chunks = sorted(chunks, key=lambda c: c["score"], reverse=True)
    return sorted_chunks[:5]
import os
import uuid
import tempfile
import requests
import pandas as pd
from datetime import datetime
from backend.supabase_client import supabase

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain.schema import Document

embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")

def clean_text(text: str) -> str:
    cleaned = text.replace("\x00", "")  
    cleaned = cleaned.encode("utf-8", "ignore").decode("utf-8", "ignore")
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

            texts = [clean_text(chunk.page_content) for chunk in chunks]
            embeddings = embeddings_model.embed_documents(texts)

            insert_data = []
            for cleaned_text, chunk, emb in zip(texts, chunks, embeddings):
                insert_data.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "source_id": pdf_id,
                    "feature_type": "pdf",
                    "chunk_text": cleaned_text,
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


async def process_csv_embeddings(csv_id: str, user_id: str, signed_url: str, filename: str):
    try:
        response = requests.get(signed_url)
        response.raise_for_status()
        csv_content = response.content

        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode='wb') as temp_file:
            temp_file.write(csv_content)
            temp_path = temp_file.name

        try:
            import pandas as pd
            df = pd.read_csv(temp_path)
            
            documents = []

            column_info = f"CSV Dataset: {filename}\n"
            column_info += f"Columns: {', '.join(df.columns.tolist())}\n"
            column_info += f"Total rows: {len(df)}\n"
            column_info += f"Data types: {df.dtypes.to_string()}\n\n"

            numeric_cols = df.select_dtypes(include=['number']).columns
            if len(numeric_cols) > 0:
                column_info += "Basic Statistics:\n"
                column_info += df[numeric_cols].describe().to_string()
            
            documents.append(Document(page_content=column_info, metadata={"type": "summary", "source": filename}))

            for idx, row in df.iterrows():
                row_text = f"Row {idx + 1}:\n"
                for col in df.columns:
                    value = row[col]
                    if pd.notna(value):  
                        row_text += f"{col}: {value}\n"
                
                documents.append(Document(
                    page_content=row_text, 
                    metadata={"type": "row", "row_index": idx, "source": filename}
                ))

            for col in df.columns:
                col_values = df[col].dropna().astype(str).tolist()
                if col_values:
                    col_text = f"Column '{col}' from {filename}:\n"
                    col_text += f"Sample values: {', '.join(col_values[:20])}"  
                    if len(col_values) > 20:
                        col_text += f"... and {len(col_values) - 20} more values"
                    
                    documents.append(Document(
                        page_content=col_text,
                        metadata={"type": "column", "column_name": col, "source": filename}
                    ))

            splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            chunks = splitter.split_documents(documents)

            texts = [clean_text(chunk.page_content) for chunk in chunks]
            embeddings = embeddings_model.embed_documents(texts)

            insert_data = []
            for cleaned_text, chunk, emb in zip(texts, chunks, embeddings):
                insert_data.append({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "source_id": csv_id,
                    "feature_type": "csv",
                    "chunk_text": cleaned_text,
                    "embedding": emb,
                    "created_at": datetime.utcnow().isoformat()
                })

            batch_size = 50
            for i in range(0, len(insert_data), batch_size):
                supabase.table("document_chunks").insert(insert_data[i:i+batch_size]).execute()

            supabase.table("csv_datasets").update({
                "embedding_status": "completed",
            }).eq("id", csv_id).execute()

        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        supabase.table("csv_datasets").update({
            "embedding_status": "failed",
        }).eq("id", csv_id).execute()
        print(f"❌ Embedding failed for CSV {csv_id}: {e}")


async def process_web_embeddings(web_id: str, user_id: str, url: str, title: str, content: str):
    """Process web page content into embeddings and store them"""
    try:
        print(f"Processing web embeddings for {web_id}: {title}")

        documents = []

        summary_info = f"Web Page: {title}\n"
        summary_info += f"URL: {url}\n"
        summary_info += f"Content Length: {len(content)} characters\n"
        summary_info += f"Word Count: {len(content.split())} words\n\n"
        summary_info += f"Content Preview: {content[:500]}..."
        
        documents.append(Document(
            page_content=summary_info, 
            metadata={"type": "summary", "source": title, "url": url}
        ))
        
        main_content_doc = Document(
            page_content=content, 
            metadata={"type": "content", "source": title, "url": url}
        )
        documents.append(main_content_doc)

        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_documents(documents)

        texts = [clean_text(chunk.page_content) for chunk in chunks]
        embeddings = embeddings_model.embed_documents(texts)
        
        insert_data = []
        for cleaned_text, chunk, emb in zip(texts, chunks, embeddings):
            insert_data.append({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "source_id": web_id,
                "feature_type": "web",
                "chunk_text": cleaned_text,
                "embedding": emb,
                "created_at": datetime.utcnow().isoformat()
            })

        batch_size = 50
        for i in range(0, len(insert_data), batch_size):
            supabase.table("document_chunks").insert(insert_data[i:i+batch_size]).execute()

        supabase.table("web_pages").update({
            "embedding_status": "completed",
        }).eq("id", web_id).execute()
        
        print(f"✅ Web embeddings completed for {web_id}")
        
    except Exception as e:
        supabase.table("web_pages").update({
            "embedding_status": "failed",
        }).eq("id", web_id).execute()
        print(f"❌ Embedding failed for web page {web_id}: {e}")