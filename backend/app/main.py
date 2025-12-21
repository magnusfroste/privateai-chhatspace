from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from sqlalchemy import select
from app.core.database import init_db, async_session
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from app.api import auth, workspaces, chats, documents, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    os.makedirs(settings.DOCUMENTS_DIR, exist_ok=True)
    os.makedirs(settings.ORIGINALS_DIR, exist_ok=True)
    os.makedirs(settings.MARKDOWN_DIR, exist_ok=True)
    
    await init_db()
    
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == settings.ADMIN_EMAIL))
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                password_hash=get_password_hash(settings.ADMIN_PASSWORD),
                name="Admin",
                role="admin"
            )
            db.add(admin_user)
            await db.commit()
            print(f"Created admin user: {settings.ADMIN_EMAIL}")
    
    yield


app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(chats.router)
app.include_router(documents.router)
app.include_router(admin.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/health/qdrant")
async def qdrant_health_check():
    from app.services.rag_service import rag_service
    try:
        collections = rag_service.client.get_collections()
        return {"status": "ok", "collections": len(collections.collections)}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=str(e))


# Try multiple static paths for different environments
static_paths = [
    "/app/static",  # Docker container
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "static")),  # Local dev
]
for static_dir in static_paths:
    if os.path.exists(static_dir) and os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
        break
