import os
import sys
import re

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

import requests
from dotenv import load_dotenv
import chromadb
from chromadb.utils import embedding_functions
from langchain_community.embeddings import OpenAIEmbeddings
from langchain.schema import Document
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

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

REPOS = [
    ("django", "django"),
    ("pallets", "flask"),
    ("tiangolo", "fastapi"),
    ("samuelcolvin", "pydantic"),
    ("sqlalchemy", "sqlalchemy"),
    ("psf", "requests"),
    ("pandas-dev", "pandas"),
    ("numpy", "numpy"),
    ("matplotlib", "matplotlib"),
    ("scikit-learn", "scikit-learn"),
    ("tensorflow", "tensorflow"),
    ("pytorch", "pytorch"),
    ("openai", "openai-python"),
    ("streamlit", "streamlit"),
    ("jupyter", "notebook"),
    ("pytest-dev", "pytest"),
    ("encode", "httpx"),
    ("scrapy", "scrapy"),
    ("python-pillow", "Pillow"),
    ("tqdm", "tqdm"),
]

embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
client = chromadb.PersistentClient(path=CHROMA_DIR)
embedding_func = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY")
)
collection = client.get_or_create_collection(
    "github_discussions", embedding_function=embedding_func
)


def fetch_discussions(owner, repo, limit=10):
    """Fetch GitHub discussions for a repository"""
    url = "https://api.github.com/graphql"
    query = """
    query ($owner: String!, $repo: String!, $limit: Int!) {
      repository(owner: $owner, name: $repo) {
        discussions(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            title
            url
            bodyText
            createdAt
            updatedAt
            comments(first: 5) {
              nodes {
                bodyText
              }
            }
          }
        }
      }
    }
    """
    variables = {"owner": owner, "repo": repo, "limit": limit}
    
    try:
        res = requests.post(
            url,
            headers={"Authorization": f"Bearer {GITHUB_TOKEN}"},
            json={"query": query, "variables": variables},
            timeout=30
        )

        if res.status_code != 200:
            print(f"❌ GraphQL error fetching {owner}/{repo}: {res.status_code}")
            return []

        data = res.json()
        if "errors" in data:
            print(f"⚠️ GraphQL errors for {owner}/{repo}: {data['errors']}")
            return []
        
        repository = data.get("data", {}).get("repository")
        if not repository:
            print(f"⚠️ No repository data for {owner}/{repo}")
            return []
            
        return repository.get("discussions", {}).get("nodes", [])
        
    except Exception as e:
        print(f"⚠️ Error parsing discussions for {owner}/{repo}: {e}")
        return []


def fallback_clean_text(text: str) -> str:
    """Fallback text cleaning if main clean_text fails"""
    if not text:
        return ""
    text = text.strip().replace("\n", " ").replace("\r", "")
    text = re.sub(r'\s+', ' ', text)
    return text


def main():
    """Main GitHub ingestion function"""
    print("🚀 Ingesting GitHub Discussions with LangChain...")
    
    total_posts = 0
    
    for owner, repo in REPOS:
        print(f"🔍 Fetching discussions from {owner}/{repo}")
        discussions = fetch_discussions(owner, repo)
        
        if not discussions:
            print(f"⚠️ No discussions found for {owner}/{repo}")
            continue
        
        for post in discussions:
            try:
                comments_text = ""
                if post.get("comments", {}).get("nodes"):
                    comments = [c.get("bodyText", "") for c in post["comments"]["nodes"]]
                    comments_text = "\n".join(comments)
                
                content = f"{post.get('title', '')}\n{post.get('bodyText', '')}\n{comments_text}".strip()

                try:
                    cleaned = clean_text(content)
                except:
                    cleaned = fallback_clean_text(content)

                if not cleaned or len(cleaned) < 50:
                    print(f"⛔ Skipped (empty/short): {post.get('title', 'No title')}")
                    continue
                    
                if len(cleaned) > 20000:
                    print(f"⚠️ Truncating long content: {post.get('title', 'No title')} ({len(cleaned)} chars)")
                    cleaned = cleaned[:20000] + "..."

                metadata = {
                    "url": post.get("url", ""),
                    "source": "github",
                    "tags": repo,  
                    "repository": f"{owner}/{repo}",
                    "created_at": post.get("createdAt", ""),
                    "updated_at": post.get("updatedAt", ""),
                    "title": post.get("title", "")
                }

                collection.add(
                    documents=[cleaned],
                    metadatas=[metadata],
                    ids=[post.get("url", f"github_{owner}_{repo}_{total_posts}")],
                )
                
                total_posts += 1
                print(f"✅ Added: {post.get('title', 'No title')}")
                
            except Exception as e:
                print(f"❌ Failed to add: {post.get('title', 'No title')} -> {e}")
                continue
        
        print(f"✅ Completed {owner}/{repo} - Total posts so far: {total_posts}")

    print(f"✅ GitHub Discussions Ingestion Complete! Total posts: {total_posts}")


if __name__ == "__main__":
    main()
