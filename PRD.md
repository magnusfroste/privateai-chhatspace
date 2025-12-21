# AutoVersio - Product Requirements Document

## Executive Summary

AutoVersio is a modern, self-hosted LLM chat application with RAG (Retrieval-Augmented Generation) support, designed to be a ChatGPT-like interface for local LLM inference. The application provides a clean, dark-themed chat experience with workspace organization, document upload capabilities, and seamless integration with external LLM and embedding services.

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
  - General settings (name, description, system prompt)
  - Document management
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
- **Vector Embeddings**: Qdrant-based vector storage for semantic search
- **Context Injection**: Relevant document chunks added to LLM prompts
- **Configurable Chunking**: Adjustable context retrieval parameters
- **Scope**: Available for all chats within the workspace

#### CAG (Chat-scoped File Attachments)
- **Direct File Attachment**: Upload files directly in individual chat messages
- **Per-Message Context**: Files attached to specific messages only affect that conversation
- **Real-time Parsing**: PDF, DOCX, TXT, MD files parsed and included in LLM prompt
- **Flexible Usage**: Perfect for one-off questions with specific documents
- **Combined with RAG**: Both RAG and CAG can be active simultaneously
- **File Limit**: Multiple files can be attached to a single message

### 5. Document Management
- **File Browser**: Upload, view, and manage documents per workspace
- **Embedding Status**: Track which documents have been processed for RAG
- **Bulk Operations**: Embed all documents at once
- **File Deletion**: Remove documents and associated embeddings

### 6. LLM Integration
- **OpenAI-compatible API**: Generic LLM service supporting any OpenAI-compatible endpoint
- **API Key Support**: Configurable authentication for LLM services
- **Multiple Models**: Support for different model names per service
- **Streaming Responses**: Real-time token-by-token responses
- **Error Handling**: Graceful failure handling for LLM service issues

### 7. Embedding Service Integration
- **Separate Embedding Service**: Dedicated embedding model endpoint
- **Batch Processing**: Efficient processing of multiple text chunks
- **Dimension Configuration**: Configurable embedding vector dimensions

### 8. Vector Database Integration
- **Qdrant Support**: High-performance vector similarity search
- **Collection Management**: Automatic collection creation per workspace
- **Similarity Search**: Configurable top-k retrieval

### 9. Admin Panel
- **Statistics Dashboard**: User counts, chat logs, system metrics
- **User Management**: View and manage all users
- **Chat Logging**: Comprehensive logging of all conversations
- **System Monitoring**: Performance and usage tracking

## Technical Architecture

### Backend (FastAPI)
- **Framework**: FastAPI with async SQLAlchemy
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: JWT tokens with configurable expiration
- **File Storage**: Local filesystem with configurable paths
- **API Design**: RESTful endpoints with OpenAPI documentation

### Frontend (React)
- **Framework**: React + Vite + TypeScript
- **State Management**: Zustand for global state
- **UI Framework**: Tailwind CSS with dark theme
- **Real-time Updates**: Server-Sent Events for streaming responses
- **Responsive Design**: Mobile-friendly interface

### Containerization
- **Docker Support**: Single container deployment with persistent volumes
- **Multi-stage Build**: Optimized build process separating frontend/backend
- **Environment Configuration**: Comprehensive .env support
- **Easypanel Ready**: Compatible with Easypanel deployment platform

## Configuration Options

### Environment Variables
- `ADMIN_EMAIL/ADMIN_PASSWORD`: Initial admin credentials
- `SECRET_KEY`: JWT signing key
- `LLM_BASE_URL/LLM_API_KEY/LLM_MODEL`: LLM service configuration
- `EMBEDDER_BASE_URL/EMBEDDER_API_KEY/EMBEDDER_MODEL`: Embedding service config
- `QDRANT_URL`: Vector database endpoint
- `DATABASE_URL`: Database connection string

### Runtime Configuration
- System prompts per workspace
- RAG enabled/disabled per message
- Document embedding settings
- Chat retention policies

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
- Frontend development server
- Hot reload for both backend and frontend

### Docker Container
- Single container with all dependencies
- Persistent volume mounting
- Environment-based configuration

### Easypanel Deployment
- Git-based deployment
- Automatic builds
- Persistent storage integration

## User Experience

### Interface Design
- **Dark Theme**: Modern, eye-friendly dark color scheme
- **Clean Layout**: Sidebar navigation with main content area
- **Responsive**: Works on desktop and mobile devices
- **Intuitive Controls**: Clear buttons and visual feedback

### Workflow
1. **Login**: Secure authentication with JWT
2. **Workspace Creation**: Set up isolated environments
3. **Document Upload**: Add knowledge base documents
4. **Chat Creation**: Start conversations within workspaces
5. **RAG-enhanced Responses**: AI answers with document context
6. **Settings Management**: Configure workspaces and preferences

## Performance Requirements

- **Response Time**: <2 seconds for non-streaming responses
- **Streaming Latency**: <100ms per token
- **Concurrent Users**: Support for multiple simultaneous users
- **Document Processing**: Efficient batch embedding operations
- **Database Queries**: Optimized for chat history and search

## Scalability Considerations

- **Horizontal Scaling**: Stateless design supports load balancing
- **Database Optimization**: Indexes for chat and document queries
- **File Storage**: Configurable storage backends (local/cloud)
- **Caching**: Potential for response caching and embedding memoization

## Future Enhancements

### Planned Features
- Multiple LLM provider support
- Chat export/import functionality
- Shared workspaces between users
- Advanced document processing (Docling integration)
- Paperless integration for document import

### Technical Improvements
- Redis caching layer
- Message queue for async processing
- Advanced RAG techniques (re-ranking, multi-query)
- Analytics and usage tracking

## Conclusion

AutoVersio provides a complete, production-ready LLM chat application with RAG capabilities, designed for easy deployment and customization. The modular architecture supports various LLM and embedding services while maintaining a clean, user-friendly interface focused on productivity and ease of use.
