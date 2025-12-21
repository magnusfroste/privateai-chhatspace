# AutoVersio - Product Requirements Document (PRD)

## Executive Summary

AutoVersio är en AI-driven chatapplikation byggd för team som behöver sofistikerad dokumenthantering och intelligent sökning. Systemet kombinerar Retrieval-Augmented Generation (RAG), hybrid vektorsökning och externa sökagenter för att ge användare tillgång till både privata dokument och realtidsinformation från webben.

## Product Overview

### Vision
Att skapa en intuitiv, kraftfull AI-assistent som fungerar som en naturlig förlängning av teamets kunskapsbas - där svaren alltid är relevanta, välformaterade och baserade på både interna dokument och aktuell information.

### Mission
Ge utvecklare och tekniska team möjlighet att chatta med sin dokumentation och kodbas på ett naturligt sätt, kompletterat med webbsökning när det behövs.

### Core Values
- **Kvalitet över kvantitet**: Fokusera på korrekta, användbara svar
- **Simpel design**: Mindre är mer - Apple-inspirerad användarupplevelse
- **Flexibilitet**: Kan användas för olika typer av dokumentation och kunskapsbaser

## Target Audience

### Primary Users
- **Utvecklare**: För att chatta med kodbaser, dokumentation och teknisk kunskap
- **Tekniska skribenter**: För att skapa och underhålla dokumentation
- **Produktteam**: För att snabbt hitta information om produkter och processer

### Secondary Users
- **Administratörer**: För att hantera systemet och användare
- **DevOps ingenjörer**: För att övervaka systemhälsa och prestanda

## Features & Capabilities

### Core Features

#### 1. Workspace Management
- **Skapa och hantera arbetsytor**: Varje workspace har egna dokument, inställningar och chatt-trådar
- **Multi-user support**: Användare ser endast sina egna workspaces (admins ser alla)
- **Workspace settings**: Anpassa AI-beteende per workspace

#### 2. Document Management
- **Stöd för flera format**: PDF, DOCX, TXT, MD
- **Automatisk embedding**: Dokument processas och lagras i vektordatabas
- **RAG integration**: Dokument används som kontext för AI-svar

#### 3. Advanced AI Chat
- **Retrieval-Augmented Generation**: AI svarar baserat på relevanta dokument-chunks
- **Hybrid search**: Kombinerar semantisk sökning med keyword-sökning
- **Web search integration**: n8n-agent för realtidsinformation från webben
- **Markdown-formattering**: AI svarar med korrekt formatering av kod och struktur

#### 4. User Experience
- **Grok-style interface**: Centrerad landing-sida, naturlig chat-flöde
- **Syntax highlighting**: Kodblock med språk-identifiering och copy-funktionalitet
- **Kollapsbar input**: Långa meddelanden kan kollapsas för bättre översikt
- **Inline editing**: Byt namn på workspaces och chats direkt i sidebar

#### 5. Administration
- **Service monitoring**: Realtids-status för LLM, Embedder och Qdrant
- **System overview**: Dashboard med workspace- och RAG-statistik
- **User management**: Skapa, ta bort och hantera användare
- **Chat logs**: Granska konversationer och prestanda

### Technical Capabilities

#### AI & Search
- **Qwen3-80B LLM**: Högkvalitativ, svensk textgenerering
- **Qdrant Vector Database**: Effektiv vektorsökning med hybrid capabilities
- **Hybrid Search**: RRF fusion av dense och sparse vektorer
- **External Search**: n8n webhook-integration för webbsökning

#### Security & Privacy
- **JWT Authentication**: Säkra API-anrop
- **Role-based access**: Admin vs User permissions
- **Workspace isolation**: Användare ser endast egna workspaces
- **Document security**: Filer krypteras och access-kontrolleras

#### Scalability
- **Asynchronous processing**: FastAPI med async/await
- **Streaming responses**: Realtids-svar från LLM
- **Database optimization**: SQLite med indexering
- **Containerized deployment**: Docker/Easypanel

## Technical Architecture

### Backend Stack
- **Framework**: FastAPI (Python async web framework)
- **Database**: SQLite med SQLAlchemy ORM
- **Authentication**: JWT tokens med bcrypt hashing
- **File processing**: PyMuPDF, python-docx, markdown
- **AI integration**: OpenAI-kompatibelt API för LLM och embeddings

### Frontend Stack
- **Framework**: React 18 med TypeScript
- **Styling**: Tailwind CSS med custom dark theme
- **State management**: Zustand stores
- **API client**: Fetch API med JWT auth
- **UI components**: Custom components med Lucide icons

### External Services
- **LLM**: Qwen3-80B via OpenAI-kompatibelt API
- **Embeddings**: OpenAI-kompatibel embedding service
- **Vector Database**: Qdrant 1.16+ med hybrid search
- **Web Search**: n8n webhook agent med Jina/Firecrawl

### Database Schema
```
Users (id, email, name, role, password_hash, created_at)
Workspaces (id, name, description, system_prompt, chat_mode, top_n, similarity_threshold, use_hybrid_search, use_web_search, owner_id, created_at)
Documents (id, workspace_id, original_filename, original_path, markdown_path, file_size, is_embedded, embedded_at)
Chats (id, title, workspace_id, user_id, created_at, updated_at)
Messages (id, chat_id, role, content, created_at)
ChatLogs (id, user_id, workspace_id, chat_id, prompt, response, model, latency_ms, created_at)
```

## User Stories

### Core User Journeys

#### As a Developer
```
I want to upload my project documentation
So that I can ask questions about the codebase and get accurate answers

I want to search for specific functions or APIs
So that I can quickly understand how to use different parts of the system

I want to get code examples in the correct format
So that I can copy-paste working code into my projects
```

#### As a Technical Writer
```
I want to create and maintain documentation
So that team members can easily find and understand information

I want to see how users interact with the documentation
So that I can improve content based on actual usage patterns

I want to ensure all documentation is up-to-date
So that users don't get outdated information
```

#### As an Administrator
```
I want to monitor system health
So that I can ensure reliable service for users

I want to see usage statistics
So that I can plan for scaling and improvements

I want to manage user access
So that I can control who has access to what information
```

## Non-functional Requirements

### Performance
- **Response time**: < 2 sekunder för enkla frågor, < 5 sekunder för komplexa
- **Concurrent users**: Minst 50 samtidiga användare
- **File processing**: Max 10MB filer, processade inom 30 sekunder

### Reliability
- **Uptime**: 99.5% tillgänglighet
- **Data durability**: 100% för användardata
- **Error handling**: Graceful degradation vid service failures

### Security
- **Data encryption**: Kryptering av känsliga data i vila och transit
- **Access control**: Rollbaserad åtkomstkontroll
- **Audit logging**: Alla viktiga åtgärder loggas

### Usability
- **Learning curve**: < 5 minuter för nya användare
- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile responsive**: Fungerar på alla skärmstorlekar

### Scalability
- **Horizontal scaling**: Kan skalas genom att lägga till fler instanser
- **Database growth**: Hanterar minst 1TB data
- **API limits**: Rate limiting för att förhindra missbruk

## Deployment & Operations

### Environment Setup
```bash
# Required environment variables
DATABASE_URL=sqlite+aiosqlite:///data/autoversio.db
SECRET_KEY=your-secret-key-here
LLM_BASE_URL=http://llm-service:8000/v1
EMBEDDER_BASE_URL=http://embedder-service:8001/v1
QDRANT_URL=http://qdrant:6333
SEARCH_AGENT_URL=https://your-n8n-webhook-url

# Optional admin setup
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
```

### Docker Deployment
```yaml
version: '3.8'
services:
  autoversio-backend:
    image: autoversio/backend:latest
    environment:
      - DATABASE_URL=sqlite+aiosqlite:///data/autoversio.db
      # ... other env vars
    volumes:
      - ./data:/data
    ports:
      - "8000:8000"

  autoversio-frontend:
    image: autoversio/frontend:latest
    ports:
      - "3000:3000"
```

### Monitoring & Maintenance
- **Health endpoints**: `/api/health/*` för service monitoring
- **Logs**: Structured logging till stdout/stderr
- **Metrics**: Prometheus-kompatibla metrics
- **Backups**: Automatiska databas-backuper

## Future Roadmap

### Phase 2 (Q1 2025)
- [ ] Multi-language support (Swedish, English, etc.)
- [ ] Advanced RAG: Parent-child chunking, metadata filtering
- [ ] Team collaboration: Shared workspaces, permissions
- [ ] API access: REST API för integrationer

### Phase 3 (Q2 2025)
- [ ] Voice input/output
- [ ] Advanced analytics dashboard
- [ ] Plugin system för custom integrations
- [ ] Mobile app (React Native)

### Phase 4 (Q3 2025)
- [ ] Multi-modal support (images, diagrams)
- [ ] Advanced AI agents (custom workflows)
- [ ] Enterprise features (SSO, audit logs, compliance)

## Success Metrics

### User Engagement
- **Daily Active Users**: > 100
- **Average session time**: > 15 minuter
- **Chat completion rate**: > 90%

### Technical Performance
- **Query accuracy**: > 95% relevant svar
- **Response time**: < 3 sekunder medel
- **System uptime**: > 99.9%

### Business Impact
- **Time savings**: > 50% snabbare informationssökning
- **User satisfaction**: > 4.5/5 NPS score
- **Adoption rate**: > 80% av target users

---

**Document Version**: 1.0  
**Last Updated**: December 21, 2025  
**Author**: Cascade AI Assistant  
**Status**: Final
