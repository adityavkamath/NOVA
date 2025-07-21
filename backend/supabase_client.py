from supabase import create_client, Client
from config import SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models.models import Base
from typing import Generator
import os

supabase: Client = create_client(SUPABASE_PROJECT_URL, SUPABASE_SERVICE_ROLE_KEY)

# Database connection for SQLAlchemy
DATABASE_URL = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
if not DATABASE_URL:
    # Construct from Supabase config if not provided
    DATABASE_URL = f"postgresql://postgres.{SUPABASE_PROJECT_URL.split('//')[1].split('.')[0]}:{os.getenv('SUPABASE_DB_PASSWORD')}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()