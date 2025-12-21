import httpx
from typing import List, Dict
from app.core.config import settings


class EmbeddingService:
    def __init__(self):
        self.base_url = settings.EMBEDDER_BASE_URL.rstrip('/')
        self.api_key = settings.EMBEDDER_API_KEY
        self.model = settings.EMBEDDER_MODEL
        self.dimension = settings.EMBEDDING_DIMENSION
    
    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    async def embed_text(self, text: str) -> List[float]:
        """Embed a single text"""
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers=self._get_headers(),
                json={
                    "input": text,
                    "model": self.model
                }
            )
            response.raise_for_status()
            data = response.json()
            if "data" not in data:
                raise ValueError(f"Embedder returned unexpected response: {data}")
            return data["data"][0]["embedding"]
    
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts"""
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers=self._get_headers(),
                json={
                    "input": texts,
                    "model": self.model
                }
            )
            response.raise_for_status()
            data = response.json()
            if "data" not in data:
                raise ValueError(f"Embedder returned unexpected response: {data}")
            return [item["embedding"] for item in data["data"]]


embedding_service = EmbeddingService()
