# Privateai-chatspace

A modern, self-hosted LLM chat application with RAG (Retrieval-Augmented Generation) support. Successfully deployed on Easypanel with remote LLM and embedding services integration. Inspired by AnythingLLM and OpenWebUI, but simpler and focused on quality functionality.

## Features

- **Grok-like Chat UI** - Clean, dark-themed interface with streaming responses
- **Workspaces** - Organize chats by topic/department with custom system prompts
- **RAG Support** - Upload documents, convert to markdown, embed to Qdrant
- **File Upload** - PDF, DOCX, TXT, MD support with automatic conversion
- **Admin Panel** - User management, chat logs for debugging/development
- **Remote LLM Integration** - Connects to external OpenAI-compatible LLM APIs
- **Remote Embeddings** - Uses external embedding services for vector generation
- **Easypanel Ready** - Single container deployment with persistent storage

## Quick Start

### Docker Compose (Local Development)

```bash
docker-compose up --build
```

Access at `http://localhost:8000`

Default credentials:
- Email: `admin@autoversio.local`
- Password: `changeme`

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

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_EMAIL` | `admin@autoversio.local` | Admin user email |
| `ADMIN_PASSWORD` | `changeme` | Admin user password |
| `SECRET_KEY` | (random) | JWT secret key |
| `LLM_BASE_URL` | `http://172.17.0.1:8000/v1` | OpenAI-compatible LLM API |
| `LLM_API_KEY` | (empty) | API key for LLM (if required) |
| `LLM_MODEL` | `default` | Model name to use |
| `EMBEDDER_BASE_URL` | `http://172.17.0.1:8001/v1` | OpenAI-compatible embedder API |
| `EMBEDDER_API_KEY` | (empty) | API key for embedder (if required) |
| `EMBEDDER_MODEL` | `default` | Embedder model name |
| `QDRANT_URL` | `http://172.17.0.1:6333` | Qdrant vector database |
| `DATABASE_URL` | `sqlite+aiosqlite:////data/autoversio.db` | Database connection |

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

## Future Enhancements

- [ ] Docling integration for better document conversion
- [ ] Paperless integration for document import
- [ ] Multiple LLM provider support
- [ ] Chat export/import
- [ ] Shared workspaces between users

## License

MIT
