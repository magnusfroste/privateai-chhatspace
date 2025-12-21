from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.chat import Chat, Message
from app.models.document import Document
from app.services.rag_service import rag_service
from app.services.document_service import document_service

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    chat_mode: Optional[str] = "chat"  # "chat" or "query"
    top_n: Optional[int] = 4  # Number of document chunks to retrieve
    similarity_threshold: Optional[float] = 0.25  # Minimum similarity score
    use_hybrid_search: Optional[bool] = True  # Use hybrid (dense + sparse) search
    use_web_search: Optional[bool] = False  # Use external search agent


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    chat_mode: Optional[str] = None  # "chat" or "query"
    top_n: Optional[int] = None
    similarity_threshold: Optional[float] = None
    use_hybrid_search: Optional[bool] = None
    use_web_search: Optional[bool] = None


class WorkspaceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    system_prompt: Optional[str]
    chat_mode: Optional[str]
    top_n: Optional[int]
    similarity_threshold: Optional[float]
    use_hybrid_search: Optional[bool]
    use_web_search: Optional[bool]
    owner_id: int

    class Config:
        from_attributes = True


@router.get("", response_model=List[WorkspaceResponse])
async def list_workspaces(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "admin":
        result = await db.execute(select(Workspace))
    else:
        result = await db.execute(
            select(Workspace).where(Workspace.owner_id == current_user.id)
        )
    return result.scalars().all()


@router.post("", response_model=WorkspaceResponse)
async def create_workspace(
    data: WorkspaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workspace = Workspace(
        name=data.name,
        description=data.description,
        system_prompt=data.system_prompt or settings.DEFAULT_SYSTEM_PROMPT,  # Use default if none provided
        owner_id=current_user.id
    )
    db.add(workspace)
    await db.commit()
    await db.refresh(workspace)
    
    await rag_service.ensure_collection(workspace.id)
    
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return workspace


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
async def update_workspace(
    workspace_id: int,
    data: WorkspaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if data.name is not None:
        workspace.name = data.name
    if data.description is not None:
        workspace.description = data.description
    if data.system_prompt is not None:
        workspace.system_prompt = data.system_prompt
    if data.chat_mode is not None:
        workspace.chat_mode = data.chat_mode
    if data.top_n is not None:
        workspace.top_n = data.top_n
    if data.similarity_threshold is not None:
        workspace.similarity_threshold = data.similarity_threshold
    if data.use_hybrid_search is not None:
        workspace.use_hybrid_search = data.use_hybrid_search
    if data.use_web_search is not None:
        workspace.use_web_search = data.use_web_search
    
    await db.commit()
    await db.refresh(workspace)
    
    return workspace


@router.delete("/{workspace_id}")
async def delete_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete all messages in chats belonging to this workspace
    chat_ids_result = await db.execute(
        select(Chat.id).where(Chat.workspace_id == workspace_id)
    )
    chat_ids = [row[0] for row in chat_ids_result.fetchall()]
    
    if chat_ids:
        await db.execute(delete(Message).where(Message.chat_id.in_(chat_ids)))
    
    # Delete all chats in this workspace
    await db.execute(delete(Chat).where(Chat.workspace_id == workspace_id))
    
    # Delete all documents and their files
    docs_result = await db.execute(
        select(Document).where(Document.workspace_id == workspace_id)
    )
    documents = docs_result.scalars().all()
    for doc in documents:
        await document_service.delete_files(doc.original_path, doc.markdown_path)
    await db.execute(delete(Document).where(Document.workspace_id == workspace_id))
    
    # Delete RAG collection
    await rag_service.delete_collection(workspace_id)
    
    # Delete workspace
    await db.delete(workspace)
    await db.commit()
    
    return {"status": "deleted"}
