import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import praw
import chromadb
from chromadb.utils import embedding_functions
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.schema import Document
from config import (
    CHROMA_DIR,
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT,
    REDDIT_COLLECTION_NAME,
)
import re
from dotenv import load_dotenv

load_dotenv()

def clean_text(text):
    """Clean and normalize text for embedding"""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s\-.,!?;:]', '', text)
    return text.strip()

reddit = praw.Reddit(
    client_id=REDDIT_CLIENT_ID,
    client_secret=REDDIT_CLIENT_SECRET,
    user_agent=REDDIT_USER_AGENT,
)

embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
client = chromadb.PersistentClient(path=CHROMA_DIR)

try:
    embedding_func = embedding_functions.OpenAIEmbeddingFunction(
        api_key=os.getenv("OPENAI_API_KEY")
    )
    collection = client.get_or_create_collection(
        REDDIT_COLLECTION_NAME, embedding_function=embedding_func
    )
except Exception as e:
    print("Failed to create Reddit collection:", e)
    sys.exit(1)

TAGS = [
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


def fetch_posts(tags=TAGS, limit_per_tag=10):
    """Fetch Reddit posts with LangChain integration"""
    posts = []
    seen_urls = set()

    for tag in tags:
        print(f"🔍 Fetching Reddit posts for tag: {tag}")
        try:
            for submission in reddit.subreddit("all").search(
                tag, sort="top", limit=limit_per_tag, time_filter="month"
            ):
                if submission.url in seen_urls:
                    continue
                seen_urls.add(submission.url)

                submission.comments.replace_more(limit=0)
                comments = submission.comments[:3]
                comments_text = "\n".join([c.body for c in comments if hasattr(c, "body")])

                combined = f"{submission.title}\n{submission.selftext}\n{comments_text}".strip()
                cleaned = clean_text(combined)

                if len(cleaned) < 50:  
                    continue

                doc = Document(
                    page_content=cleaned,
                    metadata={
                        "title": submission.title,  
                        "url": submission.url,
                        "score": submission.score,
                        "source": "reddit",
                        "tags": tag, 
                        "subreddit": submission.subreddit.display_name,
                        "created_utc": submission.created_utc,
                        "num_comments": submission.num_comments
                    }
                )

                posts.append({
                    "id": submission.url,
                    "document": doc,
                    "tag": tag
                })

        except Exception as e:
            print(f"⚠️ Error fetching posts for tag {tag}: {e}")
            continue

    return posts


def ingest():
    """Ingest Reddit posts into ChromaDB with LangChain"""
    print("🚀 Ingesting Reddit posts into ChromaDB with LangChain...")
    posts = fetch_posts()
    
    if not posts:
        print("❌ No posts to ingest")
        return

    print(f"📦 Processing {len(posts)} posts...")
    
    for i, post in enumerate(posts):
        try:
            doc = post["document"]

            collection.add(
                documents=[doc.page_content],
                metadatas=[doc.metadata],
                ids=[post["id"]],
            )
            
            if (i + 1) % 10 == 0:
                print(f"✅ Ingested {i+1}/{len(posts)} Reddit posts")
                
        except Exception as e:
            print(f"⚠️ Failed to ingest post {post['id']}: {e}")
            continue

    print(f"✅ Reddit ingestion complete! Processed {len(posts)} posts")


if __name__ == "__main__":
    ingest()
