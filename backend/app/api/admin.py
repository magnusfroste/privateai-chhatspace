from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import httpx
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_admin, get_password_hash
from app.models.user import User
from app.models.workspace import Workspace
from app.models.document import Document
from app.models.chat import Chat, Message
from app.models.chat_log import ChatLog
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str = ""
    role: str = "user"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatLogResponse(BaseModel):
    id: int
    user_id: int
    workspace_id: Optional[int]
    chat_id: Optional[int]
    prompt: str
    response: str
    model: Optional[str]
    latency_ms: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_users: int
    total_workspaces: int
    total_chats: int
    total_messages: int
    total_logs: int


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    users = await db.execute(select(func.count(User.id)))
    workspaces = await db.execute(select(func.count(Workspace.id)))
    chats = await db.execute(select(func.count(Chat.id)))
    messages = await db.execute(select(func.count(Message.id)))
    logs = await db.execute(select(func.count(ChatLog.id)))
    
    return StatsResponse(
        total_users=users.scalar() or 0,
        total_workspaces=workspaces.scalar() or 0,
        total_chats=chats.scalar() or 0,
        total_messages=messages.scalar() or 0,
        total_logs=logs.scalar() or 0
    )


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        name=data.name,
        role=data.role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        user.role = data.role
    if data.password is not None:
        user.password_hash = get_password_hash(data.password)
    
    await db.commit()
    await db.refresh(user)
    
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    await db.delete(user)
    await db.commit()
    
    return {"status": "deleted"}


@router.get("/logs", response_model=List[ChatLogResponse])
async def list_chat_logs(
    limit: int = Query(100, le=1000),
    offset: int = 0,
    user_id: Optional[int] = None,
    workspace_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    query = select(ChatLog).order_by(ChatLog.created_at.desc())
    
    if user_id:
        query = query.where(ChatLog.user_id == user_id)
    if workspace_id:
        query = query.where(ChatLog.workspace_id == workspace_id)
    
    query = query.offset(offset).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/logs/{log_id}", response_model=ChatLogResponse)
async def get_chat_log(
    log_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    result = await db.execute(select(ChatLog).where(ChatLog.id == log_id))
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    return log


class ServiceStatus(BaseModel):
    name: str
    status: str  # "online", "offline", "error"
    url: str
    latency_ms: Optional[float] = None
    error: Optional[str] = None


class SystemHealthResponse(BaseModel):
    llm: ServiceStatus
    embedder: ServiceStatus
    qdrant: ServiceStatus


class WorkspaceInfo(BaseModel):
    id: int
    name: str
    owner_email: str
    document_count: int
    embedded_count: int
    has_rag_collection: bool
    rag_points: int
    admin_pinned: bool


class SystemOverviewResponse(BaseModel):
    workspaces: List[WorkspaceInfo]
    total_rag_collections: int


@router.get("/health/services", response_model=SystemHealthResponse)
async def check_services_health(
    admin: User = Depends(get_current_admin)
):
    """Check health of LLM, Embedder, and Qdrant services"""
    
    async def check_service(name: str, url: str, health_path: str = "", api_key: str = None) -> ServiceStatus:
        import time
        start = time.time()
        try:
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{url}{health_path}", headers=headers)
                latency = (time.time() - start) * 1000
                if response.status_code == 200:
                    return ServiceStatus(name=name, status="online", url=url, latency_ms=latency)
                else:
                    return ServiceStatus(name=name, status="error", url=url, latency_ms=latency, error=f"HTTP {response.status_code}")
        except Exception as e:
            return ServiceStatus(name=name, status="offline", url=url, error=str(e))
    
    llm_status = await check_service("LLM", settings.LLM_BASE_URL, "/models", settings.LLM_API_KEY)
    embedder_status = await check_service("Embedder", settings.EMBEDDER_BASE_URL, "/models", settings.EMBEDDER_API_KEY)
    qdrant_status = await check_service("Qdrant", settings.QDRANT_URL, "/collections")
    
    return SystemHealthResponse(
        llm=llm_status,
        embedder=embedder_status,
        qdrant=qdrant_status
    )


@router.get("/system/overview", response_model=SystemOverviewResponse)
async def get_system_overview(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Get overview of workspaces and RAG collections"""
    
    # Get all workspaces with owner info
    result = await db.execute(
        select(Workspace, User.email)
        .join(User, Workspace.owner_id == User.id)
        .order_by(Workspace.id)
    )
    workspace_data = result.all()
    
    workspaces_info = []
    total_collections = 0
    
    for workspace, owner_email in workspace_data:
        # Count documents
        doc_result = await db.execute(
            select(func.count(Document.id))
            .where(Document.workspace_id == workspace.id)
        )
        doc_count = doc_result.scalar() or 0
        
        # Count embedded documents
        embedded_result = await db.execute(
            select(func.count(Document.id))
            .where(Document.workspace_id == workspace.id)
            .where(Document.is_embedded == True)
        )
        embedded_count = embedded_result.scalar() or 0
        
        # Check if RAG collection exists and get point count
        has_collection = False
        rag_points = 0
        try:
            collection_name = f"workspace_{workspace.id}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{settings.QDRANT_URL}/collections/{collection_name}")
                if response.status_code == 200:
                    has_collection = True
                    data = response.json()
                    rag_points = data.get("result", {}).get("points_count", 0)
                    total_collections += 1
        except:
            pass
        
        workspaces_info.append(WorkspaceInfo(
            id=workspace.id,
            name=workspace.name,
            owner_email=owner_email,
            document_count=doc_count,
            embedded_count=embedded_count,
            has_rag_collection=has_collection,
            rag_points=rag_points,
            admin_pinned=workspace.admin_pinned or False
        ))
    
    return SystemOverviewResponse(
        workspaces=workspaces_info,
        total_rag_collections=total_collections
    )


@router.get("/test/llm")
async def test_llm_connection(
    admin: User = Depends(get_current_admin)
):
    """Test LLM connection and list available models"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.LLM_BASE_URL}/models",
                headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"} if settings.LLM_API_KEY else {}
            )
            if response.status_code == 200:
                data = response.json()
                models = [m.get("id", m) for m in data.get("data", [])]
                return {
                    "status": "connected",
                    "url": settings.LLM_BASE_URL,
                    "models": models,
                    "configured_model": settings.LLM_MODEL
                }
            else:
                return {"status": "error", "url": settings.LLM_BASE_URL, "error": f"HTTP {response.status_code}: {response.text}"}
    except Exception as e:
        return {"status": "error", "url": settings.LLM_BASE_URL, "error": str(e)}


@router.get("/test/embedder")
async def test_embedder_connection(
    admin: User = Depends(get_current_admin)
):
    """Test Embedder connection and list available models"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{settings.EMBEDDER_BASE_URL}/models",
                headers={"Authorization": f"Bearer {settings.EMBEDDER_API_KEY}"} if settings.EMBEDDER_API_KEY else {}
            )
            if response.status_code == 200:
                data = response.json()
                models = [m.get("id", m) for m in data.get("data", [])]
                return {
                    "status": "connected",
                    "url": settings.EMBEDDER_BASE_URL,
                    "models": models,
                    "configured_model": settings.EMBEDDER_MODEL
                }
            else:
                return {"status": "error", "url": settings.EMBEDDER_BASE_URL, "error": f"HTTP {response.status_code}: {response.text}"}
    except Exception as e:
        return {"status": "error", "url": settings.EMBEDDER_BASE_URL, "error": str(e)}


@router.get("/test/pdf-provider")
async def test_pdf_provider(
    admin: User = Depends(get_current_admin)
):
    """Test PDF to Markdown provider configuration"""
    provider = settings.PDF_PROVIDER.lower()
    
    if provider == "docling-api":
        if not settings.DOCLING_SERVICE_URL:
            return {
                "status": "not_configured",
                "provider": "docling-api",
                "message": "DOCLING_SERVICE_URL not set. Configure it to use docling-serve API."
            }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{settings.DOCLING_SERVICE_URL}/health")
                if response.status_code == 200:
                    return {
                        "status": "connected",
                        "provider": "docling-api",
                        "url": settings.DOCLING_SERVICE_URL,
                        "message": "Docling-serve API is available (GPU-accelerated)"
                    }
                else:
                    return {
                        "status": "error",
                        "provider": "docling-api",
                        "url": settings.DOCLING_SERVICE_URL,
                        "error": f"HTTP {response.status_code}"
                    }
        except Exception as e:
            return {
                "status": "error",
                "provider": "docling-api",
                "url": settings.DOCLING_SERVICE_URL,
                "error": str(e)
            }
    
    elif provider == "docling":
        try:
            from docling.document_converter import DocumentConverter
            return {
                "status": "available",
                "provider": "docling",
                "message": "Docling is installed and ready for advanced PDF processing"
            }
        except ImportError:
            return {
                "status": "error",
                "provider": "docling",
                "error": "Docling not installed. Run: pip install docling"
            }
    
    elif provider == "marker-api":
        if not settings.OCR_SERVICE_URL:
            return {
                "status": "not_configured",
                "provider": "marker-api",
                "message": "OCR_SERVICE_URL not set. Configure it to use Marker API."
            }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{settings.OCR_SERVICE_URL}/health")
                if response.status_code == 200:
                    return {
                        "status": "connected",
                        "provider": "marker-api",
                        "url": settings.OCR_SERVICE_URL,
                        "message": "Marker API is available for PDF OCR"
                    }
                else:
                    return {
                        "status": "error",
                        "provider": "marker-api",
                        "url": settings.OCR_SERVICE_URL,
                        "error": f"HTTP {response.status_code}"
                    }
        except Exception as e:
            return {
                "status": "error",
                "provider": "marker-api",
                "url": settings.OCR_SERVICE_URL,
                "error": str(e)
            }
    
    elif provider == "pypdf2":
        try:
            from PyPDF2 import PdfReader
            return {
                "status": "available",
                "provider": "pypdf2",
                "message": "PyPDF2 is available (basic text extraction, no OCR)"
            }
        except ImportError:
            return {
                "status": "error",
                "provider": "pypdf2",
                "error": "PyPDF2 not installed"
            }
    
    else:
        return {
            "status": "error",
            "provider": provider,
            "error": f"Unknown provider: {provider}. Use 'docling', 'marker-api', or 'pypdf2'"
        }


@router.get("/test/qdrant")
async def test_qdrant_connection(
    admin: User = Depends(get_current_admin)
):
    """Test Qdrant connection and list collections"""
    try:
        collections = rag_service.client.get_collections()
        collection_info = []
        for c in collections.collections:
            try:
                info = rag_service.client.get_collection(c.name)
                collection_info.append({
                    "name": c.name,
                    "points_count": info.points_count,
                    "vectors_count": info.vectors_count
                })
            except:
                collection_info.append({"name": c.name, "points_count": "?", "vectors_count": "?"})
        
        return {
            "status": "connected",
            "url": settings.QDRANT_URL,
            "collections": collection_info,
            "total_collections": len(collection_info)
        }
    except Exception as e:
        return {"status": "error", "url": settings.QDRANT_URL, "error": str(e)}


@router.put("/workspaces/{workspace_id}/pin")
async def toggle_workspace_pin(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Toggle admin_pinned status for a workspace"""
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    workspace.admin_pinned = not workspace.admin_pinned
    await db.commit()
    await db.refresh(workspace)
    
    return {"id": workspace.id, "admin_pinned": workspace.admin_pinned}
