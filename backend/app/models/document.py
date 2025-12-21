from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False)
    original_filename = Column(String(500), nullable=False)
    original_path = Column(String(1000), nullable=True)
    markdown_path = Column(String(1000), nullable=True)
    file_size = Column(Integer, nullable=True)
    is_embedded = Column(Boolean, default=False)
    embedded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="documents")
