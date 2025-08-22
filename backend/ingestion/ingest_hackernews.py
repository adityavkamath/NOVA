import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import requests
from dotenv import load_dotenv

from langchain_community.embeddings import OpenAIEmbeddings
from langchain.schema import Document
import re
from vectorstore.pinecone_utils import upsert_to_pinecone

load_dotenv()


def clean_text(text):
    """Clean and normalize text for embedding"""
    if not text:
        return ""

    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s\-.,!?;:]", "", text)
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




def fetch_hn_posts(query, limit=200):
    """Fetch Hacker News posts for a specific query"""
    url = "https://hn.algolia.com/api/v1/search"
    params = {"query": query, "tags": "story", "hitsPerPage": limit}

    try:
        res = requests.get(url, params=params, timeout=30)
        if res.status_code != 200:
            print(f"⚠️ Hacker News error for {query}: {res.status_code}")
            return []

        data = res.json()
        return data.get("hits", [])
    except Exception as e:
        print(f"⚠️ Error fetching Hacker News posts for {query}: {e}")
        return []


def main():
    """Main Hacker News ingestion function"""
    print("🚀 Starting Hacker News ingestion with LangChain...")

    total_posts = 0


    for query in QUERIES:
        print(f"🔍 Fetching Hacker News posts for query: {query}")
        posts = fetch_hn_posts(query)
        if not posts:
            continue
        texts, metadatas, ids = [], [], []
        for post in posts:
            try:
                content = f"{post.get('title', '')}\n{post.get('story_text', '') or ''}".strip()
                if not content or len(content) < 50:
                    continue
                cleaned = clean_text(content)
                url = (
                    post.get("url")
                    or f"https://news.ycombinator.com/item?id={post.get('objectID', '')}"
                )
                metadata = {
                    "url": url,
                    "source": "hackernews",
                    "title": post.get("title", ""),
                    "tags": query,
                    "points": post.get("points", 0),
                    "num_comments": post.get("num_comments", 0),
                    "created_at": post.get("created_at", ""),
                    "author": post.get("author", ""),
                    "objectID": post.get("objectID", ""),
                }
                texts.append(cleaned)
                metadatas.append(metadata)
                ids.append(f"hn_{post.get('objectID', '')}_{query}")
                total_posts += 1
            except Exception as e:
                print(f"❌ Failed to ingest: {post.get('title', 'No title')} -> {e}")
                continue
        if texts:
            upsert_to_pinecone(texts, metadatas, ids)
            print(f"✅ Ingested {len(texts)} posts for query '{query}'")
        print(f"✅ Completed query '{query}' - Total posts so far: {total_posts}")

    print(f"✅ Hacker News Ingestion Complete! Total posts: {total_posts}")


if __name__ == "__main__":
    main()
