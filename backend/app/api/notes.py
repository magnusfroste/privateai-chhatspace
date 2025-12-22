from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.note import Note
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/notes", tags=["notes"])


class NoteCreate(BaseModel):
    workspace_id: int
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class NoteResponse(BaseModel):
    id: int
    workspace_id: int
    user_id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("/workspace/{workspace_id}", response_model=List[NoteResponse])
async def get_workspace_notes(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all notes for a workspace"""
    result = await db.execute(
        select(Note).where(
            Note.workspace_id == workspace_id,
            Note.user_id == current_user.id
        ).order_by(Note.updated_at.desc())
    )
    notes = result.scalars().all()
    return notes


@router.post("", response_model=NoteResponse)
async def create_note(
    data: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new note"""
    note = Note(
        workspace_id=data.workspace_id,
        user_id=current_user.id,
        title=data.title,
        content=data.content
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    data: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a note"""
    result = await db.execute(
        select(Note).where(
            Note.id == note_id,
            Note.user_id == current_user.id
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
    
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}")
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a note"""
    result = await db.execute(
        select(Note).where(
            Note.id == note_id,
            Note.user_id == current_user.id
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await db.delete(note)
    await db.commit()
    return {"message": "Note deleted"}


@router.post("/{note_id}/transform")
async def transform_note(
    note_id: int,
    action: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Transform note content with AI (expand, improve, summarize, continue, translate)"""
    from app.services.llm_service import llm_service
    
    result = await db.execute(
        select(Note).where(
            Note.id == note_id,
            Note.user_id == current_user.id
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Define transformation prompts
    prompts = {
        "expand": f"Expand and elaborate on the following text with more details and examples:\n\n{note.content}",
        "improve": f"Improve the following text by making it clearer, more professional, and better structured:\n\n{note.content}",
        "summarize": f"Summarize the following text concisely:\n\n{note.content}",
        "continue": f"Continue writing from where this text ends:\n\n{note.content}",
        "translate": f"Translate the following text to English (if not English) or Swedish (if English):\n\n{note.content}"
    }
    
    if action not in prompts:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {', '.join(prompts.keys())}")
    
    # Call LLM
    try:
        transformed = await llm_service.generate(prompts[action])
        return {"transformed": transformed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transformation failed: {str(e)}")
