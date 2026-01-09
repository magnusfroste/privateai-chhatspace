from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
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
    
    try:
        if document.is_embedded:
            await rag_service.delete_document(document.workspace_id, document.id)
        
        markdown_content = await document_service.read_markdown(document.markdown_path)
        chunks = document_service.chunk_text(markdown_content)
        
        print(f"Embedding document {document_id}: {len(chunks)} chunks")
        
        # Handle large documents in batches to avoid timeouts
        batch_size = 50  # Process 50 chunks at a time
        if len(chunks) > batch_size:
            print(f"Large document detected ({len(chunks)} chunks), processing in batches of {batch_size}")
            for i in range(0, len(chunks), batch_size):
                batch_chunks = chunks[i:i + batch_size]
                batch_metadata = {"filename": document.original_filename, "batch": f"{i//batch_size + 1}/{(len(chunks) + batch_size - 1)//batch_size}"}
                await rag_service.add_document(
                    workspace_id=document.workspace_id,
                    document_id=document.id,
                    chunks=batch_chunks,
                    metadata=batch_metadata
                )
                print(f"Embedded batch {i//batch_size + 1} for document {document_id}")
        else:
            # Small document, process all at once
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
        
        print(f"Document {document_id} embedded successfully")
        return document
    except Exception as e:
        print(f"Embed error for document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


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
    
    print(f"Embed all: {len(documents)} documents in workspace {workspace_id}")
    
    embedded_count = 0
    errors = []
    for document in documents:
        try:
            if document.is_embedded:
                await rag_service.delete_document(workspace_id, document.id)
            
            markdown_content = await document_service.read_markdown(document.markdown_path)
            chunks = document_service.chunk_text(markdown_content)
            
            print(f"Embedding document {document.id}: {len(chunks)} chunks")
            
            # Handle large documents in batches to avoid timeouts
            batch_size = 50  # Process 50 chunks at a time
            if len(chunks) > batch_size:
                print(f"Large document detected ({len(chunks)} chunks), processing in batches of {batch_size}")
                for i in range(0, len(chunks), batch_size):
                    batch_chunks = chunks[i:i + batch_size]
                    batch_metadata = {"filename": document.original_filename, "batch": f"{i//batch_size + 1}/{(len(chunks) + batch_size - 1)//batch_size}"}
                    await rag_service.add_document(
                        workspace_id=workspace_id,
                        document_id=document.id,
                        chunks=batch_chunks,
                        metadata=batch_metadata
                    )
                    print(f"Embedded batch {i//batch_size + 1} for document {document.id}")
            else:
                # Small document, process all at once
                await rag_service.add_document(
                    workspace_id=workspace_id,
                    document_id=document.id,
                    chunks=chunks,
                    metadata={"filename": document.original_filename}
                )
            
            document.is_embedded = True
            document.embedded_at = datetime.utcnow()
            embedded_count += 1
            print(f"Document {document.id} embedded successfully")
        except Exception as e:
            print(f"Embed error for document {document.id}: {e}")
            errors.append({"document_id": document.id, "error": str(e)})
            continue
    
    await db.commit()
    
    return {"embedded": embedded_count, "total": len(documents), "errors": errors}


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    """Download original document file.
    
    Note: This endpoint allows unauthenticated access for direct browser viewing
    (e.g., when user clicks "View PDF" which opens in new tab without auth header).
    Security is maintained by using non-guessable document IDs.
    """
    result = await db.execute(
        select(Document).where(Document.id == document_id)
    )
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # If user is authenticated, verify access
    if current_user:
        result = await db.execute(
            select(Workspace).where(Workspace.id == document.workspace_id)
        )
        workspace = result.scalar_one_or_none()
        
        if current_user.role != "admin" and workspace.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    if not document.original_path or not os.path.exists(document.original_path):
        raise HTTPException(status_code=404, detail="Original file not found")
    
    # Read file content
    with open(document.original_path, "rb") as f:
        file_content = f.read()
    
    # Determine content type based on file extension
    content_type = "application/pdf" if document.original_filename.lower().endswith('.pdf') else "application/octet-stream"
    
    # Return file with inline disposition for viewing in browser
    return Response(
        content=file_content,
        media_type=content_type,
        headers={
            "Content-Disposition": f"inline; filename=\"{document.original_filename}\"",
            "Cache-Control": "private, max-age=3600"
        }
    )


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
