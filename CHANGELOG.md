# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-12

### Added

- **Simple API v1** - Developer-friendly REST API for integrations
  - `POST /api/v1/workspace/{id}/query` - Non-streaming RAG queries
  - `POST /api/v1/workspace/{id}/upload` - Upload with auto-embed
  - `GET /api/v1/workspaces` - List workspaces
  - `GET /api/v1/health` - Health check

- **API Key Authentication** - Generate API keys for programmatic access
  - Keys start with `pk_` prefix
  - Manage in Admin → API Keys
  - No login required for API access

- **A/B Test Evaluator** - Compare AnythingLLM vs Private AI
  - GUI in Admin panel
  - Stores test runs in database
  - Calculates Recall@5, MRR, latency metrics

- **RAG Enhancements**
  - Dual vector store support (Qdrant + LanceDB)
    - Qdrant: Hybrid search (dense + sparse BM25)
    - LanceDB: File-based, serverless alternative
    - Admin-configurable switching
  - Cross-encoder reranking
  - Query expansion via LLM
  - Rich metadata (content_type, section_title, has_table, has_code)

- **PDF Processing**
  - Docling API integration (OCR, tables, code detection)
    - Advanced parameters: do_ocr, do_table_structure, do_code_enrichment
    - 600s timeout for complex PDFs
  - Marker API support (alternative OCR)
  - PyPDF2 fallback
  - Semantic chunking (respects headers, tables, paragraphs)

- **Documentation**
  - API documentation (`docs/API.md`)
  - Contributing guide (`CONTRIBUTING.md`)
  - Environment examples (`.env.example`)

### Changed

- Improved error responses with consistent format
- Better workspace settings (RAG mode, hybrid search toggles)

### Security

- API keys stored securely (only shown once on creation)
- JWT token authentication for web UI
- CORS configuration

## [0.9.0] - 2025-12-XX

### Added

- Initial release
- Chat UI with streaming responses
- Workspace management
- Document upload (PDF, DOCX, TXT, MD)
- RAG with Qdrant vector database
- Admin panel with user management
- Docker deployment support

---

## Versioning

This project uses [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x): Breaking API changes
- **MINOR** (x.1.x): New features, backwards compatible
- **PATCH** (x.x.1): Bug fixes, backwards compatible
