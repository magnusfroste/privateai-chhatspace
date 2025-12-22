# AutoVersio - Product Requirements Document

## Executive Summary

AutoVersio is an AI-driven chat application built for teams that need sophisticated document management and intelligent search. The system combines Retrieval-Augmented Generation (RAG), hybrid vector search, and external search agents to provide users with access to both private documents and real-time web information.

## Core Features

### 1. Authentication & User Management
- **Admin User Creation**: Automatic creation of admin user with configurable credentials
- **JWT Authentication**: Secure token-based authentication with configurable expiration
- **Role-based Access**: Admin vs regular user roles with appropriate permissions
- **Secure Password Hashing**: Bcrypt-based password storage

### 2. Workspace Management
- **Multiple Workspaces**: Users can create and manage isolated environments
- **Workspace Ownership**: Workspaces belong to users (admins can see all)
- **Workspace Settings**: Full workspace configuration page with tabs for:
  - General settings (name, description, system prompt, chat mode)
  - Document management
  - Advanced RAG settings (top_n, similarity threshold, hybrid search, web search)
- **Chat Modes**: "Chat" mode for conversational AI, "Query" mode that only responds when relevant context exists
- **Cascade Delete**: Deleting a workspace removes all associated chats, messages, and documents
- **System Prompts**: Customizable AI behavior per workspace

### 3. Chat Functionality
- **Real-time Streaming**: Server-Sent Events (SSE) for live chat responses
- **Chat History**: Persistent storage of conversations with full message history
- **Chat Organization**: Chats are organized under workspaces
- **Chat Titles**: Auto-generated or custom chat titles
- **Message Roles**: Proper user/assistant message differentiation

### 4. RAG (Retrieval-Augmented Generation) & CAG (Content-Augmented Generation)

#### RAG (Workspace-scoped)
- **Document Upload**: Support for PDF, DOCX, TXT, MD file formats per workspace
- **Automatic Conversion**: Documents converted to markdown for processing
- **Hybrid Vector Embeddings**: Qdrant-based vector storage supporting both dense and sparse search
- **Context Injection**: Relevant document chunks added to LLM prompts
- **Configurable Retrieval**: Adjustable top_n chunks, similarity threshold, and search type
- **Scope**: Available for all chats within the workspace

#### CAG (Chat-scoped File Attachments)
- **Direct File Attachment**: Upload files directly in individual chat messages
- **Per-Message Context**: Files attached to specific messages only affect that conversation
- **Real-time Parsing**: PDF, DOCX, TXT, MD files parsed and included in LLM prompt
- **Flexible Usage**: Perfect for one-off questions with specific documents
- **Combined with RAG**: Both RAG and CAG can be active simultaneously
- **File Limit**: Multiple files can be attached to a single message

### 5. Web Search Integration
- **External Search Agent**: Integration with n8n webhook for real-time web search
- **Contextual Search**: Searches combine with RAG context for comprehensive answers
- **Configurable**: Can be enabled/disabled per workspace
- **Fallback Support**: Works alongside or independently of document-based RAG

### 6. Document Management
- **File Browser**: Upload, view, and manage documents per workspace
- **Embedding Status**: Track which documents have been processed for RAG
- **Bulk Operations**: Embed all documents at once with progress tracking
- **File Deletion**: Remove documents and associated embeddings
- **Metadata Tracking**: File size, upload date, embedding status

### 7. LLM Integration
- **OpenAI-compatible API**: Generic LLM service supporting any OpenAI-compatible endpoint
- **API Key Support**: Configurable authentication for LLM services
- **Multiple Models**: Support for different model names per service
- **Streaming Responses**: Real-time token-by-token responses
- **Error Handling**: Graceful failure handling for LLM service issues

### 8. Embedding Service Integration
- **Separate Embedding Service**: Dedicated embedding model endpoint
- **Batch Processing**: Efficient processing of multiple text chunks
- **Dimension Configuration**: Configurable embedding vector dimensions
- **Hybrid Search Support**: Both dense and sparse vector generation

### 9. Vector Database Integration
- **Qdrant Support**: High-performance vector similarity search with hybrid capabilities
- **Collection Management**: Automatic collection creation per workspace
- **Similarity Search**: Configurable top-k retrieval with score thresholds
- **Hybrid Search**: Combination of semantic (dense) and keyword (sparse) search

### 10. Admin Panel
- **Statistics Dashboard**: User counts, chat logs, system metrics
- **User Management**: View and manage all users
- **Chat Logging**: Comprehensive logging of all conversations with performance metrics
- **System Monitoring**: Real-time service health checks (LLM, Embedder, Qdrant)
- **Workspace Oversight**: Admin can access all workspaces and pin important ones

## Technical Architecture

### Backend (FastAPI)
- **Framework**: FastAPI with async SQLAlchemy
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT tokens with configurable expiration
- **File Storage**: Local filesystem with configurable paths
- **API Design**: RESTful endpoints with OpenAPI documentation
- **Async Processing**: Full async/await support for concurrent operations

### Frontend (React)
- **Framework**: React + Vite + TypeScript
- **State Management**: Zustand for global state
- **UI Framework**: Tailwind CSS with dark theme
- **Real-time Updates**: Server-Sent Events for streaming responses
- **Responsive Design**: Mobile-friendly interface
- **File Upload**: Drag-and-drop file handling with progress indicators

### Containerization
- **Docker Support**: Single container deployment with persistent volumes
- **Multi-stage Build**: Optimized build process separating frontend/backend
- **Environment Configuration**: Comprehensive .env support
- **Easypanel Ready**: Compatible with Easypanel deployment platform

## Configuration Options

### Environment Variables

All settings can be configured via environment variables in Easypanel or `.env` file.

#### Core Settings
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: Initial admin credentials
- `SECRET_KEY`: JWT signing key (required for production)
- `DEBUG`: Enable debug mode (default: false)

#### LLM & Embedding Services
- `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`: LLM service configuration
- `EMBEDDER_BASE_URL` / `EMBEDDER_API_KEY` / `EMBEDDER_MODEL`: Embedding service config

#### Vector Database & Search
- `QDRANT_URL`: Vector database endpoint
- `SEARCH_AGENT_URL`: n8n webhook URL for web search (optional)
- `OCR_SERVICE_URL`: Marker API URL for PDF OCR (optional, enables scanned PDF support)

#### Default RAG Settings (applied to new workspaces)
- `DEFAULT_TOP_N`: Number of context chunks (default: 5)
- `DEFAULT_SIMILARITY_THRESHOLD`: Minimum relevance score (default: 0.25)
- `DEFAULT_USE_HYBRID_SEARCH`: Enable hybrid search (default: true)
- `DEFAULT_USE_WEB_SEARCH`: Enable web search (default: false)
- `DEFAULT_CHAT_MODE`: Chat mode - "chat" or "query" (default: chat)
- `DEFAULT_SYSTEM_PROMPT`: Default AI instructions

#### Context Window Management
- `MAX_CONTEXT_TOKENS`: Maximum context size (default: 128000)
- `CONTEXT_HISTORY_RATIO`: Chat history allocation (default: 0.7)
- `CONTEXT_SYSTEM_RATIO`: System prompt + RAG allocation (default: 0.15)
- `CONTEXT_USER_RATIO`: User input + files allocation (default: 0.15)

#### Storage & Database
- `DATABASE_URL`: Database connection string
- `DATA_DIR` / `DOCUMENTS_DIR` / `ORIGINALS_DIR` / `MARKDOWN_DIR`: Storage paths

### Runtime Configuration
- System prompts per workspace (overrides default)
- RAG enabled/disabled per message
- Advanced settings per workspace (expandable in UI)
- Web search toggle per workspace

## Security Considerations

### Authentication
- JWT tokens with expiration
- Secure password hashing (bcrypt)
- Admin-only operations protected

### Data Protection
- Local data storage (no external data sharing)
- Configurable data directories
- File upload validation

### API Security
- Bearer token authentication
- CORS configuration
- Input validation and sanitization

## Deployment Options

### Local Development
- Python virtual environment setup
- Frontend development server with hot reload
- Backend development server with auto-reload
- Local service dependencies (Qdrant, LLM, Embedder)

### Docker Container
- Single container with all dependencies
- Persistent volume mounting for data
- Environment-based configuration
- Health checks for service monitoring

### Easypanel Deployment
- Git-based deployment
- Automatic builds and scaling
- Persistent storage integration
- Environment variable management

## User Experience

### Interface Design
- **Dark Theme**: Modern, eye-friendly dark color scheme
- **Clean Layout**: Sidebar navigation with main content area
- **Responsive**: Works on desktop and mobile devices
- **Intuitive Controls**: Clear buttons and visual feedback

### Workflow
1. **Login**: Secure authentication with JWT
2. **Workspace Creation**: Set up isolated environments with custom settings
3. **Document Upload**: Add knowledge base documents for RAG
4. **Settings Configuration**: Configure RAG parameters, search options, and AI behavior
5. **Chat Creation**: Start conversations within workspaces
6. **Context-Augmented Responses**: AI answers with document and web search context
7. **File Attachments**: Upload files directly in chat for immediate context
8. **Settings Management**: Fine-tune workspace and preferences

## Performance Requirements

- **Response Time**: <2 seconds for non-streaming responses
- **Streaming Latency**: <100ms per token
- **Concurrent Users**: Support for multiple simultaneous users
- **Document Processing**: Efficient batch embedding operations (up to 10MB files)
- **Database Queries**: Optimized for chat history and vector search
- **Web Search**: <5 second response time for external search integration

## Scalability Considerations

- **Horizontal Scaling**: Stateless design supports load balancing
- **Database Optimization**: Indexes for chat and document queries
- **File Storage**: Configurable storage backends (local/cloud)
- **Vector Database**: Qdrant clustering for high-volume deployments
- **Caching**: Potential for response caching and embedding memoization

## Future Enhancements

### Planned Features
- Multiple LLM provider support (Anthropic, Google, etc.)
- Chat export/import functionality
- Shared workspaces between users
- Advanced document processing (Docling integration)
- Paperless integration for document import
- Voice input/output
- Advanced analytics dashboard
- Plugin system for custom integrations
- Mobile app (React Native)

### Technical Improvements
- Redis caching layer
- Message queue for async processing
- Advanced RAG techniques (re-ranking, multi-query)
- Analytics and usage tracking
- Multi-language support
- Team collaboration features
- Enterprise features (SSO, audit logs, compliance)

## Conclusion

AutoVersio provides a complete, production-ready LLM chat application with advanced RAG capabilities, web search integration, and sophisticated document management. The modular architecture supports various LLM and embedding services while maintaining a clean, user-friendly interface focused on productivity and ease of use.

**Implementation Status**: All core features implemented and tested, successfully deployed with remote LLM, embedding, vector database, and web search services integration.

## Setup and Installation

### Prerequisites
- **Python 3.10+**: Backend runtime environment
- **Node.js 18+**: Frontend build tools
- **npm**: Package manager for frontend dependencies
- **External Services**: Access to LLM, embedding, and vector database services

### Local Development Setup

#### 1. Clone and Prepare
```bash
git clone https://github.com/magnusfroste/privateai-chatspace.git
cd privateai-chatspace
```

#### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your service URLs and credentials
```

#### 3. Frontend Setup
```bash
cd frontend
npm install
```

#### 4. Running Development Servers

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

Access the application at `http://localhost:5173`

### Docker Deployment

#### Single Container Setup
```bash
# Build and run
docker-compose up --build
```

Access at `http://localhost:8000`

#### Environment Configuration
Create a `.env` file with the following variables:
```env
ADMIN_EMAIL=admin@autoversio.local
ADMIN_PASSWORD=changeme
SECRET_KEY=your-secret-key-here
LLM_BASE_URL=http://llm-service:8000/v1
LLM_API_KEY=your-llm-api-key
LLM_MODEL=default
EMBEDDER_BASE_URL=http://embedder-service:8001/v1
EMBEDDER_API_KEY=your-embedder-api-key
EMBEDDER_MODEL=default
QDRANT_URL=http://qdrant:6333
SEARCH_AGENT_URL=https://your-n8n-webhook-url
DATABASE_URL=sqlite+aiosqlite:///data/autoversio.db
```

### Easypanel Deployment

#### Automated Deployment
1. **Create App**: New app in Easypanel
2. **Connect Repository**: Link to `https://github.com/magnusfroste/privateai-chatspace`
3. **Build Settings**: 
   - Build method: Git
   - Enable automatic builds
4. **Environment Variables**: Configure all required environment variables
5. **Persistent Storage**: Mount volume at `/data`
6. **Port Configuration**: Expose port 8000
7. **Deploy**: Trigger deployment and access generated URL

#### Post-Deployment Verification
- Access the application URL
- Login with admin credentials
- Verify service health endpoints:
  - `/api/health` - General health
  - `/api/health/qdrant` - Vector database status
- Test basic functionality: create workspace, upload document, start chat

### Service Dependencies

#### Required External Services
1. **LLM Service** (OpenAI-compatible)
   - Example: vLLM, OpenAI API, or local models
   - Must support chat completions with streaming

2. **Embedding Service** (OpenAI-compatible)
   - Must support embeddings endpoint
   - Configurable dimensions and models

3. **Vector Database** (Qdrant)
   - Version 1.16+ with hybrid search support
   - Accessible via HTTP/HTTPS

4. **Web Search Agent** (Optional - n8n webhook)
   - External search integration
   - Returns formatted search results

#### Service Health Monitoring
The application includes health check endpoints to verify service connectivity:
- LLM service availability
- Embedding service responsiveness
- Vector database connection
- Web search agent status (if configured)

### Operation and Maintenance

#### Daily Operations
- **Monitor Logs**: Check application logs for errors
- **Health Checks**: Verify service endpoints regularly
- **Backup Data**: Regular database and file backups
- **Update Dependencies**: Keep Python/Node.js packages updated

#### Troubleshooting
- **Service Connectivity**: Check environment variables and network access
- **Database Issues**: Verify SQLite/PostgreSQL connectivity
- **File Upload Problems**: Check disk space and permissions
- **Performance Issues**: Monitor resource usage and scale as needed

#### Scaling Considerations
- **Horizontal Scaling**: Deploy multiple instances behind load balancer
- **Database Scaling**: Migrate from SQLite to PostgreSQL for high load
- **File Storage**: Implement cloud storage for large document volumes
- **Caching**: Add Redis for session and response caching

## Conclusion

AutoVersio provides a complete, production-ready LLM chat application with advanced RAG capabilities, web search integration, and sophisticated document management. The modular architecture supports various LLM and embedding services while maintaining a clean, user-friendly interface focused on productivity and ease of use.

**Implementation Status**: All core features implemented and tested, successfully deployed with remote LLM, embedding, vector database, and web search services integration.
