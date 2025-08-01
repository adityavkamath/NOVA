import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_PROJECT_URL = os.getenv("SUPABASE_PROJECT_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET_NAME=os.getenv("SUPABASE_STORAGE_BUCKET_NAME")

DEFAULT_MODEL = "gpt-3.5-turbo"
DEFAULT_TEMPERATURE = 0.3
DEFAULT_MAX_TOKENS = 500


CHROMA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../vectorstore/chroma")
)

REDDIT_COLLECTION_NAME = "reddit_python"
STACKOVERFLOW_COLLECTION_NAME = "stackoverflow_python"
GITHUB_COLLECTION_NAME = "github_discussions"
DEVTO_COLLECTION_NAME = "devto"
HACKERNEWS_COLLECTION_NAME = "hackernews"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REDDIT_CLIENT_ID = os.getenv("REDDIT_CLIENT_ID")
REDDIT_CLIENT_SECRET = os.getenv("REDDIT_CLIENT_SECRET")
REDDIT_USER_AGENT = os.getenv("REDDIT_USER_AGENT")
STACK_APP_KEY = os.getenv("STACK_APP_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")