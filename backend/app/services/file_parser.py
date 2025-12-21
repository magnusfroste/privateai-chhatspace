import io
from typing import List
import PyPDF2
from docx import Document


async def parse_pdf(file_content: bytes) -> str:
    """Parse PDF file to text"""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to parse PDF: {e}")


async def parse_docx(file_content: bytes) -> str:
    """Parse DOCX file to text"""
    try:
        doc = Document(io.BytesIO(file_content))
        text = ""
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Failed to parse DOCX: {e}")
