from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, SparseVectorParams, SparseVector, Modifier, NamedVector, NamedSparseVector, Fusion, FusionQuery, Query
from typing import List, Optional
import uuid
from app.core.config import settings
from app.services.embedding_service import embedding_service


class RAGService:
    def __init__(self):
        # Parse URL to handle HTTPS properly
        url = settings.QDRANT_URL
        if url.startswith("https://"):
            host = url.replace("https://", "")
            self.client = QdrantClient(host=host, port=443, https=True, timeout=60)
        elif url.startswith("http://"):
            self.client = QdrantClient(url=url, timeout=60)
        else:
            self.client = QdrantClient(url=url, timeout=60)
        self._dimension = None  # Will be detected from embedder
    
    def _collection_name(self, workspace_id: int) -> str:
        return f"workspace_{workspace_id}"
    
    async def _get_dimension(self) -> int:
        """Get embedding dimension from embedder (cached)"""
        if self._dimension is None:
            # Get dimension from a test embedding
            test_embedding = await embedding_service.embed_texts(["test"])
            self._dimension = len(test_embedding[0])
        return self._dimension
    
    def _text_to_sparse(self, text: str) -> SparseVector:
        """Convert text to sparse BM25-style vector using simple tokenization"""
        # Simple word tokenization and frequency counting
        words = text.lower().split()
        word_counts = {}
        for word in words:
            # Clean word
            word = ''.join(c for c in word if c.isalnum())
            if word and len(word) > 1:
                word_counts[word] = word_counts.get(word, 0) + 1
        
        # Convert to sparse vector (indices = word hashes, values = counts)
        # Use dict to handle hash collisions by summing values
        index_map = {}
        for word, count in word_counts.items():
            # Use hash as index (mod large number to keep indices reasonable)
            idx = hash(word) % 1000000
            # If collision, sum the counts
            index_map[idx] = index_map.get(idx, 0.0) + float(count)
        
        # Convert to sorted lists (Qdrant requires sorted indices)
        indices = sorted(index_map.keys())
        values = [index_map[idx] for idx in indices]
        
        return SparseVector(indices=indices, values=values)
    
    async def ensure_collection(self, workspace_id: int):
        """Create collection with hybrid search support (dense + sparse vectors)"""
        collection_name = self._collection_name(workspace_id)
        collections = self.client.get_collections().collections
        exists = any(c.name == collection_name for c in collections)
        
        if not exists:
            dimension = await self._get_dimension()
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config={
                    "dense": VectorParams(
                        size=dimension,
                        distance=Distance.COSINE
                    )
                },
                sparse_vectors_config={
                    "sparse": SparseVectorParams(
                        modifier=Modifier.IDF  # BM25-style IDF weighting
                    )
                }
            )
    
    async def add_document(
        self,
        workspace_id: int,
        document_id: int,
        chunks: List[str],
        metadata: Optional[dict] = None
    ):
        """Add document chunks with both dense and sparse vectors"""
        await self.ensure_collection(workspace_id)
        collection_name = self._collection_name(workspace_id)
        
        embeddings = await embedding_service.embed_texts(chunks)
        
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = str(uuid.uuid4())
            sparse_vec = self._text_to_sparse(chunk)
            
            points.append(PointStruct(
                id=point_id,
                vector={
                    "dense": embedding,
                    "sparse": sparse_vec
                },
                payload={
                    "document_id": document_id,
                    "chunk_index": i,
                    "content": chunk,
                    **(metadata or {})
                }
            ))
        
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )
    
    async def search(
        self,
        workspace_id: int,
        query: str,
        limit: int = 5,
        score_threshold: float = 0.0,
        hybrid: bool = True
    ) -> List[dict]:
        """Hybrid search using both dense vectors and sparse BM25"""
        collection_name = self._collection_name(workspace_id)
        
        try:
            query_embedding = await embedding_service.embed_text(query)
            
            # Check if collection has named vectors (hybrid support)
            collection_info = self.client.get_collection(collection_name)
            vectors_config = collection_info.config.params.vectors
            has_named_vectors = isinstance(vectors_config, dict) and "dense" in vectors_config
            
            if hybrid and has_named_vectors:
                # Hybrid search: run dense and sparse separately, then fuse with RRF
                sparse_query = self._text_to_sparse(query)
                
                # Dense semantic search
                dense_results = self.client.query_points(
                    collection_name=collection_name,
                    query=query_embedding,
                    using="dense",
                    limit=limit * 2
                )
                
                # Sparse keyword search
                sparse_results = self.client.query_points(
                    collection_name=collection_name,
                    query=sparse_query,
                    using="sparse",
                    limit=limit * 2
                )
                
                # Manual RRF fusion
                rrf_scores = {}
                k = 60  # RRF constant
                
                for rank, hit in enumerate(dense_results.points):
                    point_id = hit.id
                    if point_id not in rrf_scores:
                        rrf_scores[point_id] = {"hit": hit, "score": 0}
                    rrf_scores[point_id]["score"] += 1.0 / (k + rank + 1)
                
                for rank, hit in enumerate(sparse_results.points):
                    point_id = hit.id
                    if point_id not in rrf_scores:
                        rrf_scores[point_id] = {"hit": hit, "score": 0}
                    rrf_scores[point_id]["score"] += 1.0 / (k + rank + 1)
                
                # Sort by RRF score and take top results
                sorted_results = sorted(rrf_scores.values(), key=lambda x: x["score"], reverse=True)[:limit]
                
                return [
                    {
                        "content": item["hit"].payload.get("content", ""),
                        "document_id": item["hit"].payload.get("document_id"),
                        "filename": item["hit"].payload.get("filename", ""),
                        "chunk_index": item["hit"].payload.get("chunk_index", 0),
                        "score": item["score"]
                    }
                    for item in sorted_results
                ]
            elif has_named_vectors:
                # Dense-only search for collections with named vectors
                results = self.client.query_points(
                    collection_name=collection_name,
                    query=query_embedding,
                    using="dense",
                    limit=limit,
                    score_threshold=score_threshold if score_threshold > 0 else None
                )
            else:
                # Fallback for old collections with default vector
                results = self.client.query_points(
                    collection_name=collection_name,
                    query=query_embedding,
                    limit=limit,
                    score_threshold=score_threshold if score_threshold > 0 else None
                )
            
            return [
                {
                    "content": hit.payload.get("content", ""),
                    "document_id": hit.payload.get("document_id"),
                    "filename": hit.payload.get("filename", ""),
                    "chunk_index": hit.payload.get("chunk_index", 0),
                    "score": hit.score
                }
                for hit in results.points
            ]
        except Exception as e:
            print(f"RAG search error: {e}")
            return []
    
    async def delete_document(self, workspace_id: int, document_id: int):
        """Delete all chunks for a document"""
        collection_name = self._collection_name(workspace_id)
        
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector={
                    "filter": {
                        "must": [
                            {"key": "document_id", "match": {"value": document_id}}
                        ]
                    }
                }
            )
        except Exception:
            pass
    
    async def delete_collection(self, workspace_id: int):
        """Delete entire workspace collection"""
        collection_name = self._collection_name(workspace_id)
        try:
            self.client.delete_collection(collection_name)
        except Exception:
            pass


rag_service = RAGService()
