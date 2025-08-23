import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import praw
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.schema import Document
from config import (
    REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET,
    REDDIT_USER_AGENT,
    REDDIT_COLLECTION_NAME,
)
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vectorstore.pinecone_utils import upsert_to_pinecone
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

    print("🚀 Ingesting Reddit posts into Pinecone with LangChain...")
    posts = fetch_posts()
    if not posts:
        print("❌ No posts to ingest")
        return
    print(f"📦 Processing {len(posts)} posts...")
    texts, metadatas, ids = [], [], []
    for i, post in enumerate(posts):
        try:
            doc = post["document"]
            texts.append(doc.page_content)
            metadatas.append(doc.metadata)
            ids.append(post["id"])
        except Exception as e:
            print(f"⚠️ Failed to process post {post['id']}: {e}")
            continue
    if texts:
        upsert_to_pinecone(texts, metadatas, ids)
        print(f"✅ Ingested {len(texts)} Reddit posts")
    print(f"✅ Reddit ingestion complete! Processed {len(posts)} posts")


if __name__ == "__main__":
    ingest()
