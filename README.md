# Chatspace - Private AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

A modern, self-hosted LLM chat application with RAG (Retrieval-Augmented Generation) support. Successfully deployed on Easypanel with remote LLM and embedding services integration. Inspired by AnythingLLM and OpenWebUI, but simpler and focused on quality functionality.

**Privacy-First**: All data stays on your infrastructure. No external data transmission except to your configured LLM/embedding services.

## Features

- **Grok-like Chat UI** - Clean, dark-themed interface with streaming responses
- **Private Workspaces** - Organize chats by topic/department with custom system prompts (private to owner + admins)
- **RAG Support** - Upload documents, convert to markdown, embed to vector database
- **Dual Vector Store** - Choose between Qdrant (hybrid search) or LanceDB (file-based)
- **Advanced PDF Processing** - Docling API integration with OCR, table extraction, and code detection
- **Intelligent Tool Calling** - LLM autonomously decides when to use web search
- **Hybrid Search** - Semantic + keyword (BM25) search with cross-encoder reranking
- **File Upload** - PDF, DOCX, TXT, MD support with automatic conversion
- **REST API v1** - Developer-friendly API with API key authentication
- **A/B Test Evaluator** - Compare RAG system performance
- **Admin Panel** - User management, chat logs, API keys for debugging/development
- **Remote LLM Integration** - Connects to external OpenAI-compatible LLM APIs
- **Remote Embeddings** - Uses external embedding services for vector generation
- **Easypanel Ready** - Single container deployment with persistent storage

## Quick Start

### Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/magnusfroste/privateai-chatspace.git
cd privateai-chatspace

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your LLM/Embedder URLs and API keys

# 3. Start the application
docker-compose up --build
```

Access at `http://localhost:8000`

**Default credentials:**
- Email: `admin@localhost`
- Password: `changeme`

⚠️ **Important**: Change these credentials in production!

### Easypanel Deployment

**Status**: Successfully deployed and operational.

1. Create a new App in Easypanel
2. Connect to GitHub repo: `https://github.com/magnusfroste/privateai-chatspace`
3. Build method: Git (automatic builds)
4. Set environment variables (copy from below)
5. Mount persistent volume at `/data`
6. Expose port 8000
7. Deploy and access the generated URL

## Environment Variables

### Core Settings
| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_EMAIL` | `admin@localhost` | Admin user email |
| `ADMIN_PASSWORD` | `changeme` | Admin user password |
| `SECRET_KEY` | (random) | JWT secret key |
| `DEBUG` | `false` | Enable debug mode |

### LLM Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `http://172.17.0.1:8000/v1` | OpenAI-compatible LLM API |
| `LLM_API_KEY` | (empty) | API key for LLM (if required) |
| `LLM_MODEL` | `default` | Model name to use |

### Embedding Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDER_BASE_URL` | `http://172.17.0.1:8001/v1` | OpenAI-compatible embedder API |
| `EMBEDDER_API_KEY` | (empty) | API key for embedder (if required) |
| `EMBEDDER_MODEL` | `default` | Embedder model name |

### Vector Database & Search
| Variable | Default | Description |
|----------|---------|-------------|
| `QDRANT_URL` | `http://172.17.0.1:6333` | Qdrant vector database (hybrid search support) |
| `LANCEDB_DIR` | `/data/lancedb` | LanceDB file-based vector database directory |
| `VECTOR_STORE_TYPE` | `qdrant` | Vector store type: "qdrant" or "lancedb" |
| `SEARCH_AGENT_URL` | (empty) | n8n webhook URL for web search |
| `DOCLING_API_URL` | (empty) | Docling API URL for advanced PDF processing |
| `OCR_SERVICE_URL` | (empty) | Marker API URL for PDF OCR (e.g., `http://marker-api:8001`) |

### Default RAG Settings (for new workspaces)
| Variable | Default | Description |
|----------|---------|-------------|
| `DEFAULT_TOP_N` | `5` | Number of document chunks to retrieve (1-20) |
| `DEFAULT_SIMILARITY_THRESHOLD` | `0.25` | Minimum similarity score (0.0-1.0) |
| `DEFAULT_USE_HYBRID_SEARCH` | `true` | Use hybrid (dense + sparse) search |
| `DEFAULT_USE_WEB_SEARCH` | `false` | Use external search agent |
| `DEFAULT_CHAT_MODE` | `chat` | Default chat mode: "chat" or "query" |
| `DEFAULT_SYSTEM_PROMPT` | (see config) | Default AI instructions |

### Context Window Management
| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CONTEXT_TOKENS` | `128000` | Maximum context window size |
| `CONTEXT_HISTORY_RATIO` | `0.7` | Ratio for chat history (70%) |
| `CONTEXT_SYSTEM_RATIO` | `0.15` | Ratio for system prompt + RAG (15%) |
| `CONTEXT_USER_RATIO` | `0.15` | Ratio for user input + files (15%) |

### Storage & Database
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:////data/chatspace.db` | Database connection |
| `DATA_DIR` | `/data` | Data directory |
| `DOCUMENTS_DIR` | `/data/documents` | Documents directory |
| `ORIGINALS_DIR` | `/data/documents/originals` | Original files directory |
| `MARKDOWN_DIR` | `/data/documents/markdown` | Converted markdown directory |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Privateai-chatspace Container               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ FastAPI (Uvicorn)                                       ││
│  │ - REST API (/api/*)                                     ││
│  │ - Static files (React build)                            ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │ SQLite/Postgres │  │ /data/documents │  │ External     ││
│  │ (users, chats)  │  │ (uploads, md)   │  │ Services     ││
│  └─────────────────┘  └─────────────────┘  │ - vLLM       ││
│                                             │ - Embedder   ││
│                                             │ - Qdrant     ││
│                                             └──────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Data Model

- **User** - Authentication with admin/user roles
- **Workspace** - Isolated environments with custom system prompts
- **Chat** - Conversation threads within workspaces
- **Message** - Individual messages (user/assistant)
- **Document** - Uploaded files with embedding status
- **ChatLog** - Admin logging for all interactions

## RAG Workflow

1. **Upload** - User uploads PDF/DOCX/TXT/MD file
2. **Convert** - File is converted to Markdown and stored
3. **Embed** - User triggers embedding (manual or "Embed All")
4. **Search** - On each chat message, relevant chunks are retrieved
5. **Augment** - Context is added to the LLM prompt

## API Endpoints

### Auth
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register (if enabled)
- `GET /api/auth/me` - Current user

### Workspaces
- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces` - Create workspace
- `PUT /api/workspaces/{id}` - Update workspace
- `DELETE /api/workspaces/{id}` - Delete workspace

### Chats
- `GET /api/chats/workspace/{id}` - List chats in workspace
- `POST /api/chats` - Create chat
- `GET /api/chats/{id}/messages` - Get messages
- `POST /api/chats/{id}/messages` - Send message (streaming)

### Documents
- `GET /api/documents/workspace/{id}` - List documents
- `POST /api/documents/workspace/{id}/upload` - Upload file
- `POST /api/documents/{id}/embed` - Embed document
- `POST /api/documents/workspace/{id}/embed-all` - Embed all

### Admin
- `GET /api/admin/stats` - Statistics
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `GET /api/admin/logs` - Chat logs

## Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### Backend

```bash
cd backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your LLM/Embedder URLs

# Run development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to the backend.

### Running Both (Development)

Terminal 1 (Backend):
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

## Key Technologies

- **Backend**: FastAPI, SQLAlchemy, Python 3.10+
- **Frontend**: React, TypeScript, TailwindCSS
- **Vector Stores**: Qdrant (hybrid search), LanceDB (file-based)
- **PDF Processing**: Docling API (OCR, tables, code), Marker API, PyPDF2
- **Search**: Hybrid semantic + BM25, cross-encoder reranking
- **LLM Integration**: OpenAI-compatible API (vLLM, Ollama, etc.)
- **Deployment**: Docker, Docker Compose, Easypanel

## Future Enhancements

- [ ] Paperless integration for document import
- [ ] Multiple LLM provider support
- [ ] Chat export/import
- [ ] Shared workspaces between users
- [ ] Advanced analytics dashboard

## License

MIT
