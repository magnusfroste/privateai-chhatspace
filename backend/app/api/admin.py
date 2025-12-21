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


class SystemOverviewResponse(BaseModel):
    workspaces: List[WorkspaceInfo]
    total_rag_collections: int


@router.get("/health/services", response_model=SystemHealthResponse)
async def check_services_health(
    admin: User = Depends(get_current_admin)
):
    """Check health of LLM, Embedder, and Qdrant services"""
    
    async def check_service(name: str, url: str, health_path: str = "") -> ServiceStatus:
        import time
        start = time.time()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{url}{health_path}")
                latency = (time.time() - start) * 1000
                if response.status_code == 200:
                    return ServiceStatus(name=name, status="online", url=url, latency_ms=latency)
                else:
                    return ServiceStatus(name=name, status="error", url=url, latency_ms=latency, error=f"HTTP {response.status_code}")
        except Exception as e:
            return ServiceStatus(name=name, status="offline", url=url, error=str(e))
    
    llm_status = await check_service("LLM", settings.LLM_BASE_URL, "/models")
    embedder_status = await check_service("Embedder", settings.EMBEDDER_BASE_URL, "/models")
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
            rag_points=rag_points
        ))
    
    return SystemOverviewResponse(
        workspaces=workspaces_info,
        total_rag_collections=total_collections
    )
