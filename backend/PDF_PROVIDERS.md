# PDF to Markdown Providers

This document explains the different PDF-to-markdown conversion providers available in the application and how to configure them.

## Overview

The application supports four PDF-to-markdown conversion providers:

1. **Docling API** (Recommended for Production) - External GPU-accelerated microservice
2. **Marker API** - External API service with OCR support
3. **Docling** - Local in-process processing with advanced PDF understanding
4. **PyPDF2** - Basic text extraction fallback

## Provider Comparison

| Feature | Docling API | Docling | Marker API | PyPDF2 |
|---------|-------------|---------|------------|--------|
| **Deployment** | External API | Local (in-process) | External API | Local (in-process) |
| **GPU Acceleration** | ✅ Yes | ❌ No | Optional | ❌ No |
| **OCR Support** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Table Extraction** | ✅ Advanced | ✅ Advanced | ✅ Yes | ❌ Limited |
| **Layout Understanding** | ✅ Advanced | ✅ Advanced | ✅ Yes | ❌ No |
| **Formula Support** | ✅ Yes | ✅ Yes | ✅ Limited | ❌ No |
| **Image Classification** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Setup Complexity** | Low (if container exists) | Medium | Low | Low |
| **Processing Speed** | **Fastest (GPU)** | Slow (CPU) | Fast | Very Fast |
| **Cost** | GPU electricity | Free (local) | API costs | Free (local) |
| **Best For** | **Production (GPU)** | Dev/no GPU | Distributed systems | Text-only PDFs |

## Configuration

### 1. Docling API (Recommended for Production)

**Setup:**
1. Deploy docling-serve container (GPU-accelerated)
2. Configure the API URL

**Configuration in `.env`:**
```bash
PDF_PROVIDER=docling-api
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```

**Docker Compose Example:**
```yaml
services:
  docling-serve:
    image: quay.io/docling-project/docling-serve-cu128:latest
    container_name: docling-serve
    restart: unless-stopped
    ports:
      - "5001:5001"
    environment:
      - DOCLING_SERVE_ENABLE_UI=true
      - DOCLING_SERVE_ACCELERATOR_DEVICE=cuda
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 2
              capabilities: [gpu]
```

**Features:**
- **GPU-accelerated** (2x RTX 5090 in your setup)
- Advanced PDF understanding (layout, tables, formulas)
- OCR support for scanned PDFs
- Microservices architecture
- Scales independently
- Web UI at `/ui` endpoint

**When to use:**
- **Production environments with GPU**
- Complex PDFs requiring best quality
- High-volume processing
- When you need fastest processing
- Microservices architecture

**API Endpoint:**
- Health: `GET /health`
- Convert: `POST /v1alpha/convert/file`

### 2. Docling (Local Processing)

**Installation:**
```bash
pip install docling
```

**Configuration in `.env`:**
```bash
PDF_PROVIDER=docling
```

**Features:**
- Advanced PDF understanding (layout, reading order, tables, formulas)
- Local execution (no external dependencies)
- OCR support for scanned PDFs
- Image classification
- VLM support (GraniteDocling)
- Exports to Markdown, HTML, JSON

**When to use:**
- Production environments
- Sensitive documents (local processing)
- Complex PDFs with tables, formulas, images
- When you need the best quality markdown output

### 3. Marker API

**Setup:**
1. Deploy marker-api service (see https://github.com/marker-api)
2. Configure the API URL

**Configuration in `.env`:**
```bash
PDF_PROVIDER=marker-api
OCR_SERVICE_URL=http://marker-api:8001
```

**Features:**
- External API service
- OCR support
- Good for distributed systems
- Scales independently

**When to use:**
- Microservices architecture
- When you want to separate PDF processing from main app
- When you already have marker-api deployed
- Load balancing across multiple instances

### 4. PyPDF2 (Fallback)

**Installation:**
```bash
pip install pypdf2
```

**Configuration in `.env`:**
```bash
PDF_PROVIDER=pypdf2
```

**Features:**
- Simple text extraction
- No OCR (text-based PDFs only)
- Very fast
- Minimal dependencies

**When to use:**
- Simple text-only PDFs
- Testing/development
- Fallback when other providers fail
- Minimal resource environments

## Automatic Fallback

The system automatically falls back to PyPDF2 if the configured provider fails:

```
Docling API → (fails) → PyPDF2
Docling → (fails) → PyPDF2
Marker API → (fails) → PyPDF2
```

## Testing Your Configuration

Use the admin API endpoint to test your PDF provider:

```bash
GET /api/admin/test/pdf-provider
```

**Example responses:**

**Docling API (success):**
```json
{
  "status": "connected",
  "provider": "docling-api",
  "url": "http://172.17.0.1:5001",
  "message": "Docling-serve API is available (GPU-accelerated)"
}
```

**Docling (success):**
```json
{
  "status": "available",
  "provider": "docling",
  "message": "Docling is installed and ready for advanced PDF processing"
}
```

**Marker API (success):**
```json
{
  "status": "connected",
  "provider": "marker-api",
  "url": "http://marker-api:8001",
  "message": "Marker API is available for PDF OCR"
}
```

**Error example:**
```json
{
  "status": "error",
  "provider": "docling-api",
  "url": "http://172.17.0.1:5001",
  "error": "Connection refused"
}
```

## MCP Server Integration (Docling)

Docling also provides an **MCP (Model Context Protocol) server** for agent-based workflows. This is separate from the direct API integration.

### What is MCP?

MCP is a standard protocol for connecting AI agents to external tools. Docling's MCP server allows AI agents (like Claude Desktop, LM Studio) to process documents on-demand.

### MCP vs Direct Integration

| Approach | Use Case |
|----------|----------|
| **Direct Integration** (current) | Batch processing when users upload PDFs to your chat app |
| **MCP Server** | Agent-driven, on-demand document processing |

### Setting up Docling MCP Server

1. **Install docling-mcp:**
```bash
pip install docling-mcp
```

2. **Configure your MCP client** (e.g., Claude Desktop):

Edit `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "docling": {
      "command": "uvx",
      "args": ["--from=docling-mcp", "docling-mcp-server"]
    }
  }
}
```

3. **Use in agents:**
The MCP server provides tools for AI agents to convert documents, extract content, and more.

### When to use MCP Server?

- Building AI agents that need document processing capabilities
- Integration with frameworks like LlamaIndex, Llama Stack, Pydantic AI
- On-demand document conversion in agent workflows
- When you want agents to handle document processing autonomously

**Note:** The MCP server is optional and separate from the direct PDF-to-markdown integration in this application.

## Recommendations

### For Production with GPU
```bash
PDF_PROVIDER=docling-api
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```
- **Best quality output**
- **Fastest processing** (GPU-accelerated)
- Advanced features
- Scales independently

### For Production without GPU
```bash
PDF_PROVIDER=docling
```
- Best quality output
- Local processing (privacy)
- Advanced features
- CPU-only (slower)

### For Microservices
```bash
PDF_PROVIDER=marker-api
OCR_SERVICE_URL=http://marker-api:8001
```
- Scalable architecture
- Independent scaling

### For Development
```bash
PDF_PROVIDER=pypdf2
```
- Quick setup
- Minimal dependencies

## Troubleshooting

### Docling API connection issues
```bash
# Test API health
curl http://172.17.0.1:5001/health

# Check if container is running
docker ps | grep docling-serve

# View logs
docker logs docling-serve -f

# Test conversion
curl -X POST "http://172.17.0.1:5001/v1alpha/convert/file" \
  -F "files=@test.pdf;type=application/pdf" \
  -F 'parameters={"options": {"from_formats": ["pdf"], "to_formats": ["md"]}}'
```

### Docling not working
```bash
# Reinstall docling
pip uninstall docling
pip install docling

# Check installation
python -c "from docling.document_converter import DocumentConverter; print('OK')"
```

### Marker API connection issues
```bash
# Test API health
curl http://marker-api:8001/health

# Check network connectivity
ping marker-api
```

### Poor quality output
- Try switching to `docling` for better quality
- Ensure OCR is enabled for scanned PDFs
- Check if PDF is text-based or image-based

## Performance Considerations

- **Docling API**: GPU-accelerated, fastest for complex PDFs, network latency minimal
- **Docling**: CPU-intensive, slower but no external dependencies
- **Marker API**: Network latency, API response time
- **PyPDF2**: Fastest but limited features

## Security

- **Docling API**: Data sent to microservice (can be in same private network)
- **Docling**: All processing local, no data leaves server
- **Marker API**: Data sent to external service
- **PyPDF2**: All processing local

For sensitive documents:
- **Best**: Use **Docling** (local processing)
- **Good**: Use **Docling API** in private network (no internet exposure)
- **Avoid**: External APIs for sensitive data
