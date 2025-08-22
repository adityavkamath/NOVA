from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, HttpUrl
from auth.clerk_auth import get_current_user
from supabase_client import supabase
import uuid
import requests
import re
from urllib.parse import urljoin, urlparse
from utils.embedding_processor import process_web_embeddings

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

router = APIRouter()

class WebScrapeRequest(BaseModel):
    url: HttpUrl

class WebPageResponse(BaseModel):
    id: str
    url: str
    title: str
    content_preview: str
    word_count: int
    embedding_status: str

def clean_text(text: str) -> str:
    """Clean and normalize text content"""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s.,!?;:()-]', '', text)
    return text.strip()

def extract_main_content(soup) -> str:
    """Extract main content from HTML, avoiding navigation, ads, etc."""

    for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
        script.decompose()

    main_content = ""

    content_selectors = [
        'main', 'article', '[role="main"]', '.content', '.post-content', 
        '.entry-content', '.article-body', '.story-body', '#content'
    ]
    
    for selector in content_selectors:
        content_elem = soup.select_one(selector)
        if content_elem:
            main_content = content_elem.get_text()
            break

    if not main_content:
        paragraphs = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        main_content = ' '.join([p.get_text() for p in paragraphs])

    main_content = clean_text(main_content)
    
    return main_content

@router.post("/scrape-url")
async def scrape_web_url(
    request: WebScrapeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Scrape a web URL and store its content"""
    
    try:
        url = str(request.url)
        user_id = current_user["id"]
        
        print(f"Scraping URL: {url} for user: {user_id}")

        existing_response = supabase.table("web_pages").select("*").eq("user_id", user_id).eq("url", url).execute()
        
        if existing_response.data:
            existing_page = existing_response.data[0]
            return {
                "success": True,
                "message": "URL already scraped",
                "data": {
                    "id": existing_page["id"],
                    "url": existing_page["url"],
                    "title": existing_page["title"],
                    "content_preview": existing_page["content"][:500] + "..." if len(existing_page["content"]) > 500 else existing_page["content"],
                    "word_count": existing_page["word_count"],
                    "embedding_status": existing_page["embedding_status"]
                }
            }

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }

        if BeautifulSoup is None:
            raise HTTPException(status_code=500, detail="BeautifulSoup4 is not installed")

        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        title = soup.find('title')
        title = title.get_text().strip() if title else urlparse(url).netloc

        meta_desc = soup.find('meta', attrs={'name': 'description'})
        meta_description = meta_desc.get('content', '') if meta_desc else ''

        content = extract_main_content(soup)
        
        if len(content) < 100:
            raise HTTPException(status_code=400, detail="Could not extract meaningful content from the URL")
        
        word_count = len(content.split())
        web_id = str(uuid.uuid4())

        web_data = {
            "id": web_id,
            "user_id": user_id,
            "url": url,
            "title": title,
            "content": content,
            "meta_description": meta_description,
            "word_count": word_count,
            "embedding_status": "pending"
        }
        
        insert_result = supabase.table("web_pages").insert(web_data).execute()
        
        if not insert_result.data:
            raise HTTPException(status_code=500, detail="Failed to store web page data")

        print(f"Starting web content embedding processing for {web_id}")
        await process_web_embeddings(web_id, user_id, url, title, content)
        
        return {
            "success": True,
            "message": "Web page scraped and processed successfully",
            "data": {
                "id": web_id,
                "url": url,
                "title": title,
                "content_preview": content[:500] + "..." if len(content) > 500 else content,
                "word_count": word_count,
                "embedding_status": "pending"
            }
        }
        
    except requests.RequestException as e:
        print(f"Request error for URL {url}: {e}")
        raise HTTPException(status_code=400, detail=f"Could not fetch the URL: {str(e)}")
    except Exception as e:
        print(f"Error scraping URL {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scrape URL: {str(e)}")

@router.get("/{web_id}")
async def get_web_page(
    web_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get web page details by ID"""
    
    try:
        response = supabase.table("web_pages").select("*").eq("id", web_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Web page not found")
        
        web_page = response.data[0]
        
        return {
            "success": True,
            "data": {
                "id": web_page["id"],
                "url": web_page["url"],
                "title": web_page["title"],
                "content": web_page["content"],
                "meta_description": web_page["meta_description"],
                "word_count": web_page["word_count"],
                "embedding_status": web_page["embedding_status"],
                "created_at": web_page["created_at"]
            }
        }
        
    except Exception as e:
        print(f"Error fetching web page {web_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch web page")

@router.delete("/{web_id}")
async def delete_web_page(
    web_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a web page and its associated data"""
    
    try:
        response = supabase.table("web_pages").select("id").eq("id", web_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Web page not found")

        supabase.table("document_chunks").delete().eq("source_id", web_id).eq("feature_type", "web").execute()

        sessions_response = supabase.table("chat_sessions").select("id").eq("source_id", web_id).eq("feature_type", "web").execute()
        
        for session in sessions_response.data:
            session_id = session["id"]
            supabase.table("chat_messages").delete().eq("session_id", session_id).execute()
            supabase.table("chat_sessions").delete().eq("id", session_id).execute()
        

        supabase.table("web_pages").delete().eq("id", web_id).execute()
        
        return {
            "success": True,
            "message": "Web page deleted successfully"
        }
        
    except Exception as e:
        print(f"Error deleting web page {web_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete web page")
