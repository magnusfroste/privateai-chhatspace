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
    
    def _extract_chunk_metadata(self, chunk: str, chunk_index: int) -> dict:
        """Extract rich metadata from a chunk for better filtering and retrieval"""
        import re
        
        metadata = {
            "chunk_index": chunk_index,
            "char_count": len(chunk),
            "word_count": len(chunk.split()),
        }
        
        # Detect content type
        has_table = bool(re.search(r'\|[^\n]+\|', chunk))
        has_code = bool(re.search(r'```[\s\S]*?```', chunk))
        has_list = bool(re.search(r'^\s*[-*•]\s', chunk, re.MULTILINE))
        has_header = bool(re.search(r'^#{1,6}\s', chunk, re.MULTILINE))
        
        metadata["has_table"] = has_table
        metadata["has_code"] = has_code
        metadata["has_list"] = has_list
        metadata["has_header"] = has_header
        
        # Determine primary content type
        if has_table:
            metadata["content_type"] = "table"
        elif has_code:
            metadata["content_type"] = "code"
        elif has_list:
            metadata["content_type"] = "list"
        else:
            metadata["content_type"] = "text"
        
        # Extract section title if chunk starts with header
        header_match = re.match(r'^(#{1,6})\s+(.+?)(?:\n|$)', chunk)
        if header_match:
            metadata["section_level"] = len(header_match.group(1))
            metadata["section_title"] = header_match.group(2).strip()
        
        return metadata
    
    async def add_document(
        self,
        workspace_id: int,
        document_id: int,
        chunks: List[str],
        metadata: Optional[dict] = None
    ):
        """Add document chunks with both dense and sparse vectors and rich metadata"""
        await self.ensure_collection(workspace_id)
        collection_name = self._collection_name(workspace_id)
        
        embeddings = await embedding_service.embed_texts(chunks)
        
        points = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            point_id = str(uuid.uuid4())
            sparse_vec = self._text_to_sparse(chunk)
            
            # Extract rich metadata from chunk content
            chunk_metadata = self._extract_chunk_metadata(chunk, i)
            
            # Merge with document-level metadata
            full_metadata = {
                "document_id": document_id,
                "content": chunk,
                "total_chunks": len(chunks),
                **chunk_metadata,
                **(metadata or {})
            }
            
            points.append(PointStruct(
                id=point_id,
                vector={
                    "dense": embedding,
                    "sparse": sparse_vec
                },
                payload=full_metadata
            ))
        
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )
        
        print(f"Added {len(points)} chunks to Qdrant for document {document_id}")
    
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
                        "content_type": item["hit"].payload.get("content_type", "text"),
                        "section_title": item["hit"].payload.get("section_title", ""),
                        "has_table": item["hit"].payload.get("has_table", False),
                        "has_code": item["hit"].payload.get("has_code", False),
                        "word_count": item["hit"].payload.get("word_count", 0),
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
                    "content_type": hit.payload.get("content_type", "text"),
                    "section_title": hit.payload.get("section_title", ""),
                    "has_table": hit.payload.get("has_table", False),
                    "has_code": hit.payload.get("has_code", False),
                    "word_count": hit.payload.get("word_count", 0),
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
            # First check if collection exists
            collections = self.client.get_collections().collections
            if not any(c.name == collection_name for c in collections):
                print(f"Collection {collection_name} does not exist, skipping delete")
                return
            
            # Delete points with matching document_id
            result = self.client.delete(
                collection_name=collection_name,
                points_selector={
                    "filter": {
                        "must": [
                            {"key": "document_id", "match": {"value": document_id}}
                        ]
                    }
                }
            )
            print(f"Deleted document {document_id} from {collection_name}: {result}")
        except Exception as e:
            print(f"Error deleting document {document_id} from Qdrant: {e}")
    
    async def delete_collection(self, workspace_id: int):
        """Delete entire workspace collection"""
        collection_name = self._collection_name(workspace_id)
        try:
            self.client.delete_collection(collection_name)
        except Exception:
            pass
    
    async def get_document_stats(self, workspace_id: int, document_id: int) -> dict:
        """Get aggregated statistics for a document from Qdrant."""
        collection_name = self._collection_name(workspace_id)
        
        try:
            # Scroll through all points for this document
            results, _ = self.client.scroll(
                collection_name=collection_name,
                scroll_filter={
                    "must": [
                        {"key": "document_id", "match": {"value": document_id}}
                    ]
                },
                limit=1000,
                with_payload=True
            )
            
            if not results:
                return {}
            
            total_chunks = len(results)
            total_words = 0
            total_chars = 0
            tables = 0
            code_blocks = 0
            lists = 0
            
            for point in results:
                payload = point.payload or {}
                total_words += payload.get("word_count", 0)
                total_chars += payload.get("char_count", 0)
                
                content_type = payload.get("content_type", "text")
                if content_type == "table" or payload.get("has_table"):
                    tables += 1
                if content_type == "code" or payload.get("has_code"):
                    code_blocks += 1
                if content_type == "list" or payload.get("has_list"):
                    lists += 1
            
            # Estimate tokens (roughly 4 chars per token)
            estimated_tokens = total_chars // 4 if total_chars else total_words
            
            return {
                "total_chunks": total_chunks,
                "total_words": total_words,
                "total_tokens": estimated_tokens,
                "tables": tables,
                "code_blocks": code_blocks,
                "lists": lists,
            }
        except Exception as e:
            print(f"Error getting document stats: {e}")
            return {}


rag_service = RAGService()
