import os
import aiofiles
from typing import Optional, List
from pathlib import Path
from app.core.config import settings


class DocumentService:
    def __init__(self):
        self.originals_dir = Path(settings.ORIGINALS_DIR)
        self.markdown_dir = Path(settings.MARKDOWN_DIR)
        self._ensure_dirs()
    
    def _ensure_dirs(self):
        self.originals_dir.mkdir(parents=True, exist_ok=True)
        self.markdown_dir.mkdir(parents=True, exist_ok=True)
    
    async def save_original(
        self,
        workspace_id: int,
        filename: str,
        content: bytes
    ) -> str:
        """Save original file and return path"""
        workspace_dir = self.originals_dir / str(workspace_id)
        workspace_dir.mkdir(exist_ok=True)
        
        file_path = workspace_dir / filename
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        
        return str(file_path)
    
    async def convert_to_markdown(
        self,
        original_path: str,
        workspace_id: int,
        document_id: int
    ) -> str:
        """Convert document to markdown"""
        original = Path(original_path)
        suffix = original.suffix.lower()
        
        content = ""
        
        if suffix == ".txt" or suffix == ".md":
            async with aiofiles.open(original, "r", encoding="utf-8", errors="ignore") as f:
                content = await f.read()
        
        elif suffix == ".pdf":
            content = await self._convert_pdf(original)
        
        elif suffix == ".docx":
            content = await self._convert_docx(original)
        
        else:
            async with aiofiles.open(original, "r", encoding="utf-8", errors="ignore") as f:
                content = await f.read()
        
        workspace_md_dir = self.markdown_dir / str(workspace_id)
        workspace_md_dir.mkdir(exist_ok=True)
        
        md_filename = f"{document_id}_{original.stem}.md"
        md_path = workspace_md_dir / md_filename
        
        async with aiofiles.open(md_path, "w", encoding="utf-8") as f:
            await f.write(content)
        
        return str(md_path)
    
    async def _convert_pdf(self, path: Path) -> str:
        """Convert PDF to markdown"""
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(str(path))
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            return "\n\n".join(text_parts)
        except Exception as e:
            return f"Error converting PDF: {e}"
    
    async def _convert_docx(self, path: Path) -> str:
        """Convert DOCX to markdown"""
        try:
            from docx import Document
            doc = Document(str(path))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs)
        except Exception as e:
            return f"Error converting DOCX: {e}"
    
    async def read_markdown(self, markdown_path: str) -> str:
        """Read markdown content"""
        async with aiofiles.open(markdown_path, "r", encoding="utf-8") as f:
            return await f.read()
    
    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            
            if end < len(text):
                last_period = chunk.rfind(".")
                last_newline = chunk.rfind("\n")
                break_point = max(last_period, last_newline)
                if break_point > chunk_size // 2:
                    chunk = text[start:start + break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - overlap
        
        return [c for c in chunks if c]
    
    async def delete_files(self, original_path: Optional[str], markdown_path: Optional[str]):
        """Delete document files"""
        for path in [original_path, markdown_path]:
            if path and os.path.exists(path):
                os.remove(path)


document_service = DocumentService()
