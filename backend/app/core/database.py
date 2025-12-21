from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import os


# Extract database path and create directory if needed
db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
if db_path.startswith("./"):
    # Relative path - resolve from current working directory
    db_dir = os.path.dirname(os.path.abspath(db_path))
else:
    # Absolute path
    db_dir = os.path.dirname(db_path)

if db_dir:
    os.makedirs(db_dir, exist_ok=True)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Run migrations for existing databases
    await run_migrations()


async def run_migrations():
    """Run database migrations for existing databases"""
    from sqlalchemy import text
    
    async with engine.begin() as conn:
        # Check if admin_pinned column exists in workspaces table
        try:
            result = await conn.execute(text("SELECT admin_pinned FROM workspaces LIMIT 1"))
        except Exception:
            # Column doesn't exist, add it
            print("Adding admin_pinned column to workspaces table...")
            await conn.execute(text("ALTER TABLE workspaces ADD COLUMN admin_pinned BOOLEAN DEFAULT 0"))
            print("Migration complete: admin_pinned column added")
