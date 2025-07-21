from sqlalchemy import (
    Column, String, Integer, ForeignKey, Text, Enum,
    DateTime, Float, func, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
import enum
import uuid
# from pgvector.sqlalchemy import Vector

Base = declarative_base()

# =============================================================================
# ENUMS
# =============================================================================

class RoleEnum(str, enum.Enum):
    user = "user"
    ai_agent = "ai-agent"

class FeatureTypeEnum(str, enum.Enum):
    pdf = "pdf"
    csv = "csv"
    api = "api"
    web = "web"
    multi_source = "multi_source"  # New type for multi-source chats

class StatusEnum(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"

# =============================================================================
# MODELS
# =============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    email = Column(String, unique=True, nullable=False)
    clerk_user_id = Column(String, unique=True, nullable=True, index=True)
    llm_model = Column(String, default="gpt-4")
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=1000)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete")
    pdf_files = relationship("PdfFile", back_populates="user", cascade="all, delete")
    csv_datasets = relationship("CsvDataset", back_populates="user", cascade="all, delete")
    web_scraped_pages = relationship("WebScrapedPage", back_populates="user", cascade="all, delete")

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email})>"

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String)
    feature_type = Column(Enum(FeatureTypeEnum), nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete")

    __table_args__ = (
        Index("idx_doc_user", "user_id"),
        Index("idx_doc_source", "source_id"),
        Index("idx_doc_feature_type", "feature_type"),
    )

    def __repr__(self):
        return f"<ChatSession(id={self.id}, title={self.title})>"

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    message = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON string of sources used
    tokens_used = Column(Integer, default=0)
    timestamp = Column(DateTime, server_default=func.now())

    # Relationships
    session = relationship("ChatSession", back_populates="messages")

    __table_args__ = (Index("idx_session_messages", "session_id"),)

    def __repr__(self):
        return f"<ChatMessage(id={self.id}, role={self.role})>"
    

# class DocumentChunk(Base):
#     __tablename__ = "document_chunks"

#     id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
#     user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
#     source_id = Column(UUID(as_uuid=True), nullable=False)  # PDF ID, CSV ID, etc.
#     feature_type = Column(Enum(FeatureTypeEnum), nullable=False)  # 'pdf', 'csv', 'web', etc.
    
#     chunk_text = Column(Text, nullable=False)
#     embedding = Column(Vector(1536), nullable=True)  # 1536 for OpenAI (adjust as needed)
#     created_at = Column(DateTime, server_default=func.now())

#     __table_args__ = (
#         Index("idx_doc_user", "user_id"),
#         Index("idx_doc_source", "source_id"),
#     )

#     def __repr__(self):
#         return f"<DocumentChunk(id={self.id}, source={self.source_id}, type={self.feature_type})>"


class PdfFile(Base):
    __tablename__ = "pdf_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    supabase_path = Column(String, nullable=False)
    public_url = Column(Text, nullable=True)  
    embedding_status = Column(Enum(StatusEnum), default=StatusEnum.pending)
    uploaded_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="pdf_files")

    __table_args__ = (Index("idx_pdf_user", "user_id"),)

    def __repr__(self):
        return f"<PdfFile(id={self.id}, filename={self.filename})>"

class CsvDataset(Base):
    __tablename__ = "csv_datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    supabase_path = Column(String, nullable=False)
    embedding_status = Column(Enum(StatusEnum), default=StatusEnum.pending)
    uploaded_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="csv_datasets")

    __table_args__ = (Index("idx_csv_user", "user_id"),)

    def __repr__(self):
        return f"<CsvDataset(id={self.id}, filename={self.filename})>"

class WebScrapedPage(Base):
    __tablename__ = "web_scraped_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    page_title = Column(String)
    embedding_status = Column(Enum(StatusEnum), default=StatusEnum.pending)
    scraped_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="web_scraped_pages")

    __table_args__ = (Index("idx_web_user", "user_id"),)

    def __repr__(self):
        return f"<WebScrapedPage(id={self.id}, url={self.url})>"