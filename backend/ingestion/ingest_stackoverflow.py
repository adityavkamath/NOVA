import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import requests
from dotenv import load_dotenv 
import chromadb
from chromadb.utils import embedding_functions 
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.schema import Document
from config import CHROMA_DIR, STACKOVERFLOW_COLLECTION_NAME, STACK_APP_KEY
import re

load_dotenv()

def clean_text(text):
    """Clean and normalize text for embedding"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s\-.,!?;:]', '', text)
    return text.strip()

QUERIES = [
    "python",
    "django",
    "flask",
    "fastapi",
    "pydantic",
    "sqlalchemy",
    "tkinter",
    "pyqt",
    "kivy",
    "numpy",
    "pandas",
    "matplotlib",
    "scikit-learn",
    "tensorflow",
    "torch",
    "asyncio",
    "multiprocessing",
    "pytest",
    "unittest",
    "pip",
    "virtualenv",
    "poetry",
    "jupyter",
    "notebook",
    "openai",
    "langchain",
    "llm",
    "selenium",
    "scrapy",
    "typing",
    "dataclasses",
    "decorators",
    "httpx",
    "requests",
    "beautifulsoup",
    "opencv",
    "pillow",
    "image-processing",
    "regex",
    "parsing",
    "yaml",
    "json",
]

embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
client = chromadb.PersistentClient(path=CHROMA_DIR)
embedding_func = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY")
)
collection = client.get_or_create_collection(
    STACKOVERFLOW_COLLECTION_NAME, embedding_function=embedding_func
)


def fetch_so_posts(tag, limit=100):
    """Fetch StackOverflow posts for a specific tag"""
    url = "https://api.stackexchange.com/2.3/questions"
    params = {
        "order": "desc",
        "sort": "votes",
        "tagged": tag,
        "site": "stackoverflow",
        "filter": "withbody",
        "pagesize": limit,
        "key": STACK_APP_KEY,
    }

    try:
        r = requests.get(url, params=params, timeout=30)
        if r.status_code != 200:
            print(f"⚠️ StackOverflow API error for '{tag}': {r.status_code}")
            return []
        
        data = r.json()
        if "items" not in data:
            print(f"⚠️ No items found for tag '{tag}'")
            return []
        
        return data["items"]
    except Exception as e:
        print(f"⚠️ Error fetching StackOverflow posts for '{tag}': {e}")
        return []


def ingest_stackoverflow():
    """Ingest StackOverflow posts with LangChain integration"""
    print("🚀 Starting StackOverflow ingestion with LangChain...")
    
    total_posts = 0
    
    for tag in QUERIES:
        print(f"🔍 Ingesting StackOverflow posts for tag: {tag}")
        posts = fetch_so_posts(tag)
        
        if not posts:
            continue
            
        for post in posts:
            try:
                content = f"{post.get('title', '')}\n{post.get('body', '')}".strip()
                cleaned = clean_text(content)
                
                if len(cleaned) < 50:  
                    continue

                metadata = {
                    "url": post.get("link", ""),
                    "score": post.get("score", 0),
                    "tags": tag,  
                    "source": "stackoverflow",
                    "question_id": post.get("question_id", ""),
                    "view_count": post.get("view_count", 0),
                    "answer_count": post.get("answer_count", 0),
                    "creation_date": post.get("creation_date", 0),
                    "is_answered": post.get("is_answered", False)
                }

                collection.add(
                    documents=[cleaned],
                    metadatas=[metadata],
                    ids=[post.get("link", f"so_{post.get('question_id', '')}_{tag}")],
                )
                
                total_posts += 1
                
            except Exception as e:
                print(f"⚠️ Failed to ingest post {post.get('link', 'unknown')}: {e}")
                continue
        
        print(f"✅ Completed tag '{tag}' - Total posts so far: {total_posts}")

    print(f"✅ StackOverflow Ingestion Complete! Total posts: {total_posts}")


if __name__ == "__main__":
    ingest_stackoverflow()
