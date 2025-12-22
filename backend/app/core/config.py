from pydantic_settings import BaseSettings
from typing import Optional
import os

# Get the backend directory (where .env should be)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AutoVersio"
    DEBUG: bool = False
    
    # Auth
    SECRET_KEY: str = "change-this-in-production-use-env-variable"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Admin (set via env in Easypanel)
    ADMIN_EMAIL: str = "admin@autoversio.local"
    ADMIN_PASSWORD: str = "changeme"
    
    # Default System Prompt for new workspaces (can be customized per workspace)
    DEFAULT_SYSTEM_PROMPT: str = """You are a helpful AI assistant. Answer questions accurately and provide detailed, useful responses.

Format your responses using Markdown for better readability:
- Use code blocks with language tags (```python, ```yaml, ```bash, etc.) for code
- Use **bold** for emphasis and key terms
- Use headings (## or ###) to structure longer responses
- Use bullet points or numbered lists for multiple items
- Use `inline code` for file names, commands, or technical terms

When given context or documents, use them to inform your answers."""
    
    # Context Window Limits (adjusted for Qwen3-80B)
    MAX_CONTEXT_TOKENS: int = 128000  # Qwen3-80B has 128K context window
    CONTEXT_HISTORY_RATIO: float = 0.7  # 70% for chat history (more for large models)
    CONTEXT_SYSTEM_RATIO: float = 0.15  # 15% for system prompt + RAG
    CONTEXT_USER_RATIO: float = 0.15    # 15% for user input + files
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:////data/autoversio.db"
    
    # LLM (OpenAI-compatible API)
    LLM_BASE_URL: str = "http://172.17.0.1:8000/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "default"
    
    # Embedder (OpenAI-compatible API)
    EMBEDDER_BASE_URL: str = "http://172.17.0.1:8001/v1"
    EMBEDDER_API_KEY: str = ""
    EMBEDDER_MODEL: str = "default"
    
    # Qdrant
    QDRANT_URL: str = "http://172.17.0.1:6333"
    
    # Search Agent (n8n webhook for web search)
    SEARCH_AGENT_URL: str = ""  # e.g. https://agent.froste.eu/webhook/xxx/chat
    
    # OCR Service (Marker API for PDF to Markdown)
    OCR_SERVICE_URL: str = ""  # e.g. http://marker-api:8001
    
    # Default RAG Settings (used when creating new workspaces)
    DEFAULT_TOP_N: int = 5  # Number of document chunks to retrieve
    DEFAULT_SIMILARITY_THRESHOLD: float = 0.25  # Minimum similarity score
    DEFAULT_USE_HYBRID_SEARCH: bool = True  # Use hybrid (dense + sparse) search
    DEFAULT_USE_WEB_SEARCH: bool = False  # Use external search agent
    DEFAULT_CHAT_MODE: str = "chat"  # "chat" or "query"
    
    # Storage paths
    DATA_DIR: str = "/data"
    DOCUMENTS_DIR: str = "/data/documents"
    ORIGINALS_DIR: str = "/data/documents/originals"
    MARKDOWN_DIR: str = "/data/documents/markdown"
    
    class Config:
        env_file = os.path.join(BACKEND_DIR, ".env")
        case_sensitive = True


settings = Settings()
