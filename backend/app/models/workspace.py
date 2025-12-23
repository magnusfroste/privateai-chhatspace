from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    chat_mode = Column(String(20), default="chat")  # "chat" or "query"
    top_n = Column(Integer, default=4)  # Number of document chunks to retrieve
    similarity_threshold = Column(Float, default=0.25)  # Minimum similarity score
    use_hybrid_search = Column(Boolean, default=True)  # Use hybrid (dense + sparse) search
    use_web_search = Column(Boolean, default=False)  # Use external search agent for web search
    sound_enabled = Column(Boolean, default=True)  # Enable sound for TTS
    admin_pinned = Column(Boolean, default=False)  # Show in admin's sidebar
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="workspaces")
    chats = relationship("Chat", back_populates="workspace", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="workspace", cascade="all, delete-orphan")
