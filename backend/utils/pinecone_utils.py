import os
import hashlib
import re
from pinecone import Pinecone
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX_NAME", "nova-rag-index")

# Initialize Pinecone client (lazy initialization for index)
pc = None
index = None
embeddings_model = None

def get_pinecone_client():
    global pc, index, embeddings_model
    if pc is None:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(PINECONE_INDEX)
        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
    return pc, index, embeddings_model

def sanitize_id(id_string):
    """Convert any string to ASCII-safe ID for Pinecone"""
    # Remove non-ASCII characters and replace with underscore
    ascii_id = re.sub(r'[^\x00-\x7F]+', '_', id_string)
    # Replace special characters with underscore
    ascii_id = re.sub(r'[^\w\-]', '_', ascii_id)
    # Remove multiple underscores
    ascii_id = re.sub(r'_+', '_', ascii_id)
    # If still too long or problematic, use hash
    if len(ascii_id) > 512 or not ascii_id:
        ascii_id = hashlib.md5(id_string.encode('utf-8')).hexdigest()
    return ascii_id

def upsert_to_pinecone(texts, metadatas, ids, batch_size=50):
    _, index, embeddings_model = get_pinecone_client()
    vectors = embeddings_model.embed_documents(texts)
    to_upsert = []
    for i, vector in enumerate(vectors):
        # Ensure text is included in metadata for search results
        meta = dict(metadatas[i])
        meta["text"] = texts[i]
        # Sanitize ID to be ASCII-safe
        safe_id = sanitize_id(ids[i])
        to_upsert.append((safe_id, vector, meta))
    
    # Batch upserts to avoid exceeding 2MB request limit
    for i in range(0, len(to_upsert), batch_size):
        batch = to_upsert[i:i+batch_size]
        index.upsert(vectors=batch)
        print(f"✅ Upserted batch {i//batch_size + 1}/{(len(to_upsert) + batch_size - 1)//batch_size} ({len(batch)} vectors)")

def query_pinecone(query, top_k=5):
    _, index, embeddings_model = get_pinecone_client()
    query_vector = embeddings_model.embed_query(query)
    res = index.query(vector=query_vector, top_k=top_k, include_metadata=True)
    return res
