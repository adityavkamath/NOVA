import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import requests
from dotenv import load_dotenv
import chromadb
from chromadb.utils import embedding_functions
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.schema import Document
import re
from config import CHROMA_DIR

load_dotenv()

def clean_text(text):
    """Clean and normalize text for embedding"""
    if not text:
        return ""
    
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters but keep basic punctuation
    text = re.sub(r'[^\w\s\-.,!?;:]', '', text)
    return text.strip()

TAGS = [
    "python", "django", "flask", "fastapi", "pydantic", "sqlalchemy",
    "tkinter", "pyqt", "kivy", "numpy", "pandas", "matplotlib",
    "scikit-learn", "tensorflow", "torch", "asyncio", "multiprocessing",
    "pytest", "unittest", "pip", "virtualenv", "poetry", "jupyter",
    "notebook", "openai", "langchain", "llm", "selenium", "scrapy",
    "typing", "dataclasses", "decorators", "httpx", "requests",
    "beautifulsoup", "opencv", "pillow", "image-processing", "regex",
    "parsing", "yaml", "json"
]

embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
client = chromadb.PersistentClient(path=CHROMA_DIR)
embedding_func = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY")
)
collection = client.get_or_create_collection("devto", embedding_function=embedding_func)


def fetch_dev_articles(tag, limit=10):
    """Fetch DEV.to articles for a specific tag"""
    url = "https://dev.to/api/articles"
    
    try:
        res = requests.get(url, params={"tag": tag, "per_page": limit, "top": 7}, timeout=30)
        if res.status_code != 200:
            print(f"⚠️ DEV API error for {tag}: {res.status_code}")
            return []
        
        articles = res.json()
        if not isinstance(articles, list):
            print(f"⚠️ Unexpected response format for tag {tag}")
            return []
        
        return articles
    except Exception as e:
        print(f"⚠️ Error fetching DEV articles for {tag}: {e}")
        return []


def main():
    """Main DEV.to ingestion function"""
    print("🚀 Starting DEV.to ingestion with LangChain...")
    
    total_articles = 0
    
    for tag in TAGS:
        print(f"🔍 Fetching DEV.to articles for tag: {tag}")
        articles = fetch_dev_articles(tag)
        
        if not articles:
            continue
        
        for article in articles:
            try:
                content = f"{article.get('title', '')}\n{article.get('description', '')}".strip()
                
                if not content or len(content) < 50:
                    continue
                
                cleaned = clean_text(content)

                metadata = {
                    "title": article.get("title") or "No title",  # Add title field
                    "url": article.get("url") or "",
                    "source": "devto",
                    "tags": tag,  
                    "published_at": article.get("published_at") or "",
                    "public_reactions_count": article.get("public_reactions_count") or 0,
                    "comments_count": article.get("comments_count") or 0,
                    "reading_time_minutes": article.get("reading_time_minutes") or 0,
                    "author": (article.get("user") or {}).get("name") or "",
                    "cover_image": article.get("cover_image") or ""
                }

                collection.add(
                    documents=[cleaned],
                    metadatas=[metadata],
                    ids=[article.get("url", f"devto_{article.get('id', '')}_{tag}")],
                )
                
                total_articles += 1
                print(f"✅ Ingested: {article.get('title', 'No title')}")
                
            except Exception as e:
                print(f"❌ Failed to ingest: {article.get('title', 'No title')} -> {e}")
                continue
        
        print(f"✅ Completed tag '{tag}' - Total articles so far: {total_articles}")

    print(f"✅ DEV.to Ingestion Complete! Total articles: {total_articles}")


if __name__ == "__main__":
    main()
