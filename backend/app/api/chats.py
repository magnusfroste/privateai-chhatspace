from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import time
import json
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.workspace import Workspace
from app.models.chat import Chat, Message
from app.models.chat_log import ChatLog
from app.services.llm_service import llm_service
from app.services.rag_service import rag_service
from app.services.search_agent_service import search_agent_service
from app.services.file_parser import parse_pdf, parse_docx

router = APIRouter(prefix="/api/chats", tags=["chats"])


class ChatCreate(BaseModel):
    workspace_id: int
    title: Optional[str] = "New Chat"


class ChatUpdate(BaseModel):
    title: Optional[str] = None


class ChatResponse(BaseModel):
    id: int
    title: str
    workspace_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str
    use_rag: bool = True
    files: Optional[List[str]] = None  # File contents as text/markdown


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/workspace/{workspace_id}", response_model=List[ChatResponse])
async def list_chats(
    workspace_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat)
        .where(Chat.workspace_id == workspace_id)
        .where(Chat.user_id == current_user.id)
        .order_by(Chat.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ChatResponse)
async def create_chat(
    data: ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Workspace).where(Workspace.id == data.workspace_id)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    if current_user.role != "admin" and workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    chat = Chat(
        title=data.title,
        workspace_id=data.workspace_id,
        user_id=current_user.id
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    
    return chat


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return chat


@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: int,
    data: ChatUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if data.title is not None:
        chat.title = data.title
    
    await db.commit()
    await db.refresh(chat)
    
    return chat


@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


@router.post("/{chat_id}/messages")
async def send_message(
    chat_id: int,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send message without file attachments (JSON body)"""
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.workspace))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user_message = Message(
        chat_id=chat_id,
        role="user",
        content=data.content
    )
    db.add(user_message)
    await db.commit()
    
    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    
    history = [{"role": m.role, "content": m.content} for m in messages]
    
    rag_context = None
    if data.use_rag:
        top_n = chat.workspace.top_n if chat.workspace and chat.workspace.top_n else 4
        threshold = chat.workspace.similarity_threshold if chat.workspace and chat.workspace.similarity_threshold else 0.0
        use_hybrid = chat.workspace.use_hybrid_search if chat.workspace and chat.workspace.use_hybrid_search is not None else True
        rag_results = await rag_service.search(chat.workspace_id, data.content, limit=top_n, score_threshold=threshold, hybrid=use_hybrid)
        if rag_results:
            rag_context = "\n\n---\n\n".join([r["content"] for r in rag_results])
    
    # Web search via external agent (n8n)
    web_search_context = None
    use_web_search = chat.workspace.use_web_search if chat.workspace and chat.workspace.use_web_search else False
    if use_web_search and search_agent_service.is_available():
        web_result = await search_agent_service.search(
            query=data.content,
            session_id=str(chat.id),
            system_prompt=chat.workspace.system_prompt if chat.workspace else None
        )
        if web_result:
            web_search_context = f"Web Search Results:\n{web_result}"
    
    # Combine contexts
    combined_context = None
    if rag_context and web_search_context:
        combined_context = f"{rag_context}\n\n---\n\n{web_search_context}"
    elif rag_context:
        combined_context = rag_context
    elif web_search_context:
        combined_context = web_search_context
    
    system_prompt = chat.workspace.system_prompt if chat.workspace else None
    chat_mode = chat.workspace.chat_mode if chat.workspace else "chat"
    
    # In query mode, refuse to answer if no RAG context found
    if chat_mode == "query" and not rag_context:
        no_context_response = "There is no relevant information in this workspace to answer your query."
        
        async def refuse():
            yield f"data: {json.dumps({'content': no_context_response})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            
            async with db.begin():
                assistant_message = Message(
                    chat_id=chat_id,
                    role="assistant",
                    content=no_context_response
                )
                db.add(assistant_message)
                await db.commit()
        
        return StreamingResponse(
            refuse(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    
    async def generate():
        start_time = time.time()
        full_response = ""
        
        try:
            async for chunk in llm_service.chat_completion_stream(
                messages=history,
                system_prompt=system_prompt,
                rag_context=combined_context
            ):
                full_response += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"
            
            async with db.begin():
                assistant_message = Message(
                    chat_id=chat_id,
                    role="assistant",
                    content=full_response
                )
                db.add(assistant_message)
                
                chat_log = ChatLog(
                    user_id=current_user.id,
                    workspace_id=chat.workspace_id,
                    chat_id=chat_id,
                    prompt=data.content,
                    response=full_response,
                    latency_ms=(time.time() - start_time) * 1000,
                    rag_context=rag_context
                )
                db.add(chat_log)
                await db.commit()
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/{chat_id}/messages/upload")
async def send_message_with_files(
    chat_id: int,
    content: str = Form(...),
    use_rag: bool = Form(True),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat)
        .options(selectinload(Chat.workspace))
        .where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Parse attached files to text/markdown
    file_contents = []
    if files:
        for file in files:
            if file.filename:
                try:
                    # Read file content
                    file_content = await file.read()
                    
                    # Parse based on file type
                    if file.filename.lower().endswith('.pdf'):
                        text_content = await parse_pdf(file_content)
                    elif file.filename.lower().endswith('.docx'):
                        text_content = await parse_docx(file_content)
                    elif file.filename.lower().endswith('.txt') or file.filename.lower().endswith('.md'):
                        text_content = file_content.decode('utf-8')
                    else:
                        continue  # Skip unsupported files
                    
                    file_contents.append(f"[CONTEXT FILE: {file.filename}]:\n{text_content}\n[END CONTEXT FILE: {file.filename}]")
                except Exception as e:
                    print(f"Error parsing file {file.filename}: {e}")
                    continue
    
    # Store the original user message (without file content) for chat history
    user_message = Message(
        chat_id=chat_id,
        role="user",
        content=content  # Only the user message, not including file content
    )
    db.add(user_message)
    await db.commit()
    
    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    
    history = [{"role": m.role, "content": m.content} for m in messages]
    
    rag_context = None
    if use_rag:
        top_n = chat.workspace.top_n if chat.workspace and chat.workspace.top_n else 4
        threshold = chat.workspace.similarity_threshold if chat.workspace and chat.workspace.similarity_threshold else 0.0
        use_hybrid = chat.workspace.use_hybrid_search if chat.workspace and chat.workspace.use_hybrid_search is not None else True
        rag_results = await rag_service.search(chat.workspace_id, content, limit=top_n, score_threshold=threshold, hybrid=use_hybrid)
        if rag_results:
            rag_context = "\n\n---\n\n".join([r["content"] for r in rag_results])
    
    # Web search via external agent (n8n)
    web_search_context = None
    use_web_search = chat.workspace.use_web_search if chat.workspace and chat.workspace.use_web_search else False
    if use_web_search and search_agent_service.is_available():
        web_result = await search_agent_service.search(
            query=content,
            session_id=str(chat.id),
            system_prompt=chat.workspace.system_prompt if chat.workspace else None
        )
        if web_result:
            web_search_context = f"Web Search Results:\n{web_result}"
    
    system_prompt = chat.workspace.system_prompt if chat.workspace else None
    chat_mode = chat.workspace.chat_mode if chat.workspace else "chat"
    
    # Combine file contents for LLM context (AnythingLLM-style formatting)
    file_context = "\n\n".join(file_contents) if file_contents else None
    
    # In query mode, refuse to answer if no RAG context and no file context
    if chat_mode == "query" and not rag_context and not file_context:
        no_context_response = "There is no relevant information in this workspace to answer your query."
        
        async def refuse():
            yield f"data: {json.dumps({'content': no_context_response})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            
            async with db.begin():
                assistant_message = Message(
                    chat_id=chat_id,
                    role="assistant",
                    content=no_context_response
                )
                db.add(assistant_message)
                await db.commit()
        
        return StreamingResponse(
            refuse(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    
    # Combine RAG and web search contexts
    combined_context = None
    if rag_context and web_search_context:
        combined_context = f"{rag_context}\n\n---\n\n{web_search_context}"
    elif rag_context:
        combined_context = rag_context
    elif web_search_context:
        combined_context = web_search_context
    
    async def generate():
        start_time = time.time()
        full_response = ""
        
        try:
            async for chunk in llm_service.chat_completion_stream(
                messages=history,
                system_prompt=system_prompt,
                rag_context=combined_context,
                file_content=file_context
            ):
                full_response += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            
            yield f"data: {json.dumps({'done': True})}\n\n"
            
            async with db.begin():
                assistant_message = Message(
                    chat_id=chat_id,
                    role="assistant",
                    content=full_response
                )
                db.add(assistant_message)
                
                # Store the full prompt including files for logging
                full_prompt = content
                if file_context:
                    full_prompt += "\n\n" + file_context
                
                chat_log = ChatLog(
                    user_id=current_user.id,
                    workspace_id=chat.workspace_id,
                    chat_id=chat_id,
                    prompt=full_prompt,  # Store the full prompt including files
                    response=full_response,
                    latency_ms=(time.time() - start_time) * 1000,
                    rag_context=rag_context
                )
                db.add(chat_log)
                await db.commit()
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.delete(chat)
    await db.commit()
    
    return {"status": "deleted"}


@router.put("/{chat_id}/title")
async def update_chat_title(
    chat_id: int,
    title: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id)
    )
    chat = result.scalar_one_or_none()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    if current_user.role != "admin" and chat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    chat.title = title
    await db.commit()
    
    return {"status": "updated"}
