from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.document import Document
from app.services.document_service import document_service
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/documents", tags=["documents"])


class DocumentResponse(BaseModel):
    id: int
    workspace_id: int
    original_filename: str
    is_embedded: bool
    embedded_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/workspace/{workspace_id}", response_model=List[DocumentResponse])
async def list_documents(
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
    
    result = await db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.post("/workspace/{workspace_id}/upload", response_model=DocumentResponse)
async def upload_document(
    workspace_id: int,
    file: UploadFile = File(...),
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
    
    content = await file.read()
    
    original_path = await document_service.save_original(
        workspace_id=workspace_id,
        filename=file.filename,
        content=content
    )
    
    document = Document(
        workspace_id=workspace_id,
        original_filename=file.filename,
        original_path=original_path,
        file_size=len(content)
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    
    markdown_path = await document_service.convert_to_markdown(
        original_path=original_path,
        workspace_id=workspace_id,
        document_id=document.id
    )
    
    document.markdown_path = markdown_path
    await db.commit()
    await db.refresh(document)
    
    return document


@router.post("/{document_id}/embed", response_model=DocumentResponse)
async def embed_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    result = await db.execute(
        select(Workspace).where(Workspace.id == document.workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not document.markdown_path:
        raise HTTPException(status_code=400, detail="Document not converted to markdown")
    
    if document.is_embedded:
        await rag_service.delete_document(document.workspace_id, document.id)
    
    markdown_content = await document_service.read_markdown(document.markdown_path)
    chunks = document_service.chunk_text(markdown_content)
    
    await rag_service.add_document(
        workspace_id=document.workspace_id,
        document_id=document.id,
        chunks=chunks,
        metadata={"filename": document.original_filename}
    )
    
    document.is_embedded = True
    document.embedded_at = datetime.utcnow()
    await db.commit()
    await db.refresh(document)
    
    return document


@router.post("/workspace/{workspace_id}/embed-all")
async def embed_all_documents(
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
    
    result = await db.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .where(Document.markdown_path.isnot(None))
    )
    documents = result.scalars().all()
    
    embedded_count = 0
    for document in documents:
        try:
            if document.is_embedded:
                await rag_service.delete_document(workspace_id, document.id)
            
            markdown_content = await document_service.read_markdown(document.markdown_path)
            chunks = document_service.chunk_text(markdown_content)
            
            await rag_service.add_document(
                workspace_id=workspace_id,
                document_id=document.id,
                chunks=chunks,
                metadata={"filename": document.original_filename}
            )
            
            document.is_embedded = True
            document.embedded_at = datetime.utcnow()
            embedded_count += 1
        except Exception:
            continue
    
    await db.commit()
    
    return {"embedded": embedded_count, "total": len(documents)}


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    result = await db.execute(
        select(Workspace).where(Workspace.id == document.workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not document.markdown_path:
        raise HTTPException(status_code=400, detail="Document not converted")
    
    content = await document_service.read_markdown(document.markdown_path)
    
    return {"content": content}


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    result = await db.execute(
        select(Workspace).where(Workspace.id == document.workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if document.is_embedded:
        await rag_service.delete_document(document.workspace_id, document.id)
    
    await document_service.delete_files(document.original_path, document.markdown_path)
    
    await db.delete(document)
    await db.commit()
    
    return {"status": "deleted"}
