# Microservices Architecture for PDF Processing

This document explains the microservices architecture for PDF-to-markdown conversion in your Easypanel deployment.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Easypanel Host                          │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │  Chat Backend    │      │  Docling-Serve   │           │
│  │  (FastAPI)       │─────▶│  (GPU-accelerated)│          │
│  │  Port: 8000      │      │  Port: 5001      │           │
│  └──────────────────┘      └──────────────────┘           │
│           │                                                 │
│           │                 ┌──────────────────┐           │
│           └────────────────▶│  Marker-API      │           │
│                             │  (OCR Service)   │           │
│                             │  Port: 8001      │           │
│                             └──────────────────┘           │
│                                                             │
│  GPU Resources: 2x RTX 5090 (shared by docling-serve)     │
└─────────────────────────────────────────────────────────────┘
```

## Your Current Setup

### 1. **Docling-Serve Container** (GPU-Accelerated)
- **Image**: `quay.io/docling-project/docling-serve-cu128:latest`
- **Port**: 5001
- **GPU**: 2x RTX 5090
- **Features**:
  - Advanced PDF understanding (tables, formulas, layout)
  - GPU-accelerated processing
  - OCR support for scanned PDFs
  - Web UI at `/ui` endpoint
  - REST API at `/v1alpha/convert/file`

### 2. **Chat Backend Container** (Your App)
- **Framework**: FastAPI
- **Port**: 8000
- **Role**: Main application that orchestrates PDF processing
- **Connects to**: Docling-serve, Marker-API, Qdrant, LLM, etc.

### 3. **Marker-API Container** (Optional)
- **Port**: 8001
- **Alternative**: OCR-focused PDF processing

## Provider Options

You now have **4 PDF processing options**:

| Provider | Deployment | GPU | Best For |
|----------|-----------|-----|----------|
| **docling-api** | External (your container) | ✅ Yes (2x RTX 5090) | **Production** - Best quality, GPU-accelerated |
| **marker-api** | External (separate container) | Optional | OCR-heavy documents |
| **docling** | In-process (CPU) | ❌ No | Development, no external deps |
| **pypdf2** | In-process (CPU) | ❌ No | Fallback, text-only PDFs |

## Recommended Configuration for Your Setup

Since you already have docling-serve running with GPU acceleration, use it!

### Configuration in `.env`

```bash
# Use your GPU-accelerated docling-serve container
PDF_PROVIDER=docling-api

# Connect to your docling-serve container
# Option 1: If chat backend is in same Docker network
DOCLING_SERVICE_URL=http://docling-serve:5001

# Option 2: If using host network or different networks
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```

## Network Configuration

### Option A: Same Docker Network (Recommended for Easypanel)

If both containers are in the same Docker network:

```yaml
# Chat backend .env
DOCLING_SERVICE_URL=http://docling-serve:5001
```

**Advantages**:
- Direct container-to-container communication
- No port exposure needed
- Better security
- Faster (no host network overhead)

### Option B: Host Network Access

If containers are in different networks:

```yaml
# Chat backend .env
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```

**Note**: Ensure docling-serve port 5001 is accessible from the chat backend container.

## Testing Your Setup

### 1. Test Docling-Serve Health

```bash
# From your host
curl http://172.17.0.1:5001/health

# Expected response
{"status": "ok"}
```

### 2. Test from Chat Backend

```bash
# Use the admin API endpoint
curl http://your-chat-backend:8000/api/admin/test/pdf-provider \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected response
{
  "status": "connected",
  "provider": "docling-api",
  "url": "http://172.17.0.1:5001",
  "message": "Docling-serve API is available (GPU-accelerated)"
}
```

### 3. Test PDF Conversion

Upload a PDF through your chat app and check the logs:

```bash
# Chat backend logs should show
INFO: Converting PDF with docling-api provider
INFO: Successfully converted PDF to markdown
```

## Performance Optimization

### GPU Utilization

Your docling-serve is configured with:
- **2x RTX 5090 GPUs**: Excellent for parallel processing
- **4 workers**: `DOCLING_SERVE_ENG_LOC_NUM_WORKERS=4`
- **128GB shared memory**: `shm_size: '128gb'`

This setup can handle multiple concurrent PDF conversions efficiently.

### Timeout Configuration

Current timeouts:
- **Sync wait**: 1200s (20 minutes)
- **Document timeout**: 1200s (20 minutes)
- **Chat backend HTTP timeout**: 300s (5 minutes)

For large PDFs, the chat backend might timeout before docling-serve finishes. Consider:

```python
# In document_service.py, increase timeout if needed
async with httpx.AsyncClient(timeout=600.0) as client:  # 10 minutes
```

## Easypanel Deployment

### Chat Backend Environment Variables

Add to your Easypanel chat backend service:

```bash
PDF_PROVIDER=docling-api
DOCLING_SERVICE_URL=http://docling-serve:5001
```

### Network Configuration

Ensure both services are in the same Docker network or configure host access:

1. **Same network** (preferred):
   - Both containers in same Easypanel project
   - Use service name: `http://docling-serve:5001`

2. **Different networks**:
   - Use host IP: `http://172.17.0.1:5001`
   - Ensure port 5001 is accessible

## Monitoring and Debugging

### Check Docling-Serve Logs

```bash
docker logs docling-serve -f
```

Look for:
- GPU initialization
- Worker startup
- Conversion requests
- Error messages

### Check Chat Backend Logs

```bash
docker logs your-chat-backend -f
```

Look for:
- "Converting PDF with docling-api provider"
- "Successfully converted PDF to markdown"
- Connection errors to docling-serve

### Common Issues

#### 1. Connection Refused

**Error**: `Connection refused to http://docling-serve:5001`

**Solutions**:
- Check if docling-serve is running: `docker ps | grep docling-serve`
- Verify network connectivity: `docker exec chat-backend ping docling-serve`
- Try host IP instead: `http://172.17.0.1:5001`

#### 2. Timeout Errors

**Error**: `Timeout waiting for docling-serve response`

**Solutions**:
- Increase timeout in `document_service.py`
- Check GPU utilization: `nvidia-smi`
- Reduce concurrent requests
- Check docling-serve logs for processing issues

#### 3. GPU Not Available

**Error**: Docling-serve not using GPU

**Solutions**:
- Verify GPU access: `docker exec docling-serve nvidia-smi`
- Check CUDA environment variables in compose file
- Ensure NVIDIA Docker runtime is installed

## Scaling Considerations

### Horizontal Scaling

To handle more load:

1. **Multiple docling-serve instances**:
   ```yaml
   # Run multiple containers
   docling-serve-1:
     ports: ["5001:5001"]
   docling-serve-2:
     ports: ["5002:5001"]
   ```

2. **Load balancer**:
   - Add nginx/traefik in front
   - Round-robin requests across instances

### Vertical Scaling

Your current setup with 2x RTX 5090 is already powerful. To optimize:

1. **Increase workers**: `DOCLING_SERVE_ENG_LOC_NUM_WORKERS=8`
2. **Tune batch size**: Adjust based on GPU memory
3. **Monitor GPU utilization**: `nvidia-smi dmon`

## Cost and Resource Comparison

| Provider | GPU Required | Memory | Processing Speed | Cost |
|----------|-------------|--------|------------------|------|
| **docling-api** | Yes (2x RTX 5090) | High (128GB SHM) | **Fastest** | GPU electricity |
| **marker-api** | Optional | Medium | Fast | API/GPU costs |
| **docling** | No | Low-Medium | Slow (CPU) | CPU only |
| **pypdf2** | No | Low | Very Fast (limited) | CPU only |

## Recommendations

### For Production (Your Setup)

```bash
PDF_PROVIDER=docling-api
DOCLING_SERVICE_URL=http://docling-serve:5001
```

**Why?**
- You already have the GPU infrastructure
- Best quality markdown output
- Handles complex PDFs (tables, formulas, images)
- GPU-accelerated = fast processing
- Scales with your existing hardware

### For Development/Testing

```bash
PDF_PROVIDER=pypdf2
```

**Why?**
- No external dependencies
- Fast for simple text PDFs
- Easy to debug

### Fallback Strategy

The system automatically falls back:
```
docling-api → (fails) → pypdf2
```

This ensures PDFs are always processed, even if docling-serve is down.

## Security Considerations

1. **Network isolation**: Keep docling-serve in private network
2. **No public exposure**: Don't expose port 5001 publicly
3. **Authentication**: Consider adding API keys if needed
4. **Resource limits**: Set memory/CPU limits to prevent DoS

## Next Steps

1. **Update your chat backend `.env`**:
   ```bash
   PDF_PROVIDER=docling-api
   DOCLING_SERVICE_URL=http://172.17.0.1:5001
   ```

2. **Restart chat backend**:
   ```bash
   docker restart your-chat-backend
   ```

3. **Test the integration**:
   - Upload a PDF through your chat app
   - Check logs for successful conversion
   - Verify markdown quality

4. **Monitor performance**:
   - Watch GPU utilization: `nvidia-smi dmon`
   - Check conversion times in logs
   - Monitor memory usage

## Troubleshooting Commands

```bash
# Test docling-serve health
curl http://172.17.0.1:5001/health

# Test PDF conversion manually
curl -X POST "http://172.17.0.1:5001/v1alpha/convert/file" \
  -F "files=@test.pdf;type=application/pdf" \
  -F 'parameters={"options": {"from_formats": ["pdf"], "to_formats": ["md"]}}'

# Check GPU usage
nvidia-smi

# View docling-serve logs
docker logs docling-serve --tail 100 -f

# View chat backend logs
docker logs your-chat-backend --tail 100 -f

# Test network connectivity
docker exec your-chat-backend curl http://docling-serve:5001/health
```

## Summary

You now have a production-ready microservices architecture:

- **Chat Backend**: Orchestrates all services
- **Docling-Serve**: GPU-accelerated PDF processing (2x RTX 5090)
- **Marker-API**: Alternative OCR service (optional)
- **Automatic fallback**: Ensures reliability

This setup leverages your existing GPU infrastructure for the best quality PDF-to-markdown conversion, which is crucial for your LLM to understand document content accurately.
