# Easypanel Setup Guide - Docling Integration

Quick guide to integrate your existing docling-serve container with the chat backend in Easypanel.

## Current Architecture

```
┌─────────────────────────────────────────────┐
│           Easypanel Host                    │
│                                             │
│  ┌─────────────┐      ┌─────────────┐     │
│  │ Chat Backend│─────▶│ Docling     │     │
│  │ (Port 8000) │      │ (Port 5001) │     │
│  └─────────────┘      └─────────────┘     │
│                                             │
│  GPU: 2x RTX 5090 (used by docling-serve)  │
└─────────────────────────────────────────────┘
```

## Step 1: Update Chat Backend Environment

In Easypanel, add these environment variables to your chat backend service:

```bash
PDF_PROVIDER=docling-api
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```

**Network Options:**

### Option A: Same Docker Network (Recommended)
If both containers are in the same Easypanel project/network:
```bash
DOCLING_SERVICE_URL=http://docling-serve:5001
```

### Option B: Host Network
If containers are in different networks:
```bash
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```

## Step 2: Verify Docling-Serve is Running

```bash
# Check container status
docker ps | grep docling-serve

# Test health endpoint
curl http://172.17.0.1:5001/health

# Expected response: {"status": "ok"}
```

## Step 3: Restart Chat Backend

In Easypanel:
1. Go to your chat backend service
2. Click "Restart"
3. Wait for service to come back online

## Step 4: Test Integration

### Method 1: Admin API Test

```bash
curl http://your-chat-backend:8000/api/admin/test/pdf-provider \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "status": "connected",
  "provider": "docling-api",
  "url": "http://172.17.0.1:5001",
  "message": "Docling-serve API is available (GPU-accelerated)"
}
```

### Method 2: Upload a PDF

1. Login to your chat app
2. Create or open a workspace
3. Upload a PDF document
4. Check logs for successful conversion

**Expected Log Output:**
```
INFO: Converting PDF with docling-api provider
INFO: Successfully converted PDF to markdown (X.XX seconds)
```

## Troubleshooting

### Issue: Connection Refused

**Symptoms:**
```json
{
  "status": "error",
  "provider": "docling-api",
  "error": "Connection refused"
}
```

**Solutions:**

1. **Check if docling-serve is running:**
   ```bash
   docker ps | grep docling-serve
   ```

2. **Test direct connection:**
   ```bash
   curl http://172.17.0.1:5001/health
   ```

3. **Check network connectivity from chat backend:**
   ```bash
   docker exec your-chat-backend curl http://172.17.0.1:5001/health
   ```

4. **Try container name instead:**
   ```bash
   DOCLING_SERVICE_URL=http://docling-serve:5001
   ```

### Issue: Timeout Errors

**Symptoms:**
- PDF conversion takes too long
- Timeout errors in logs

**Solutions:**

1. **Check GPU utilization:**
   ```bash
   nvidia-smi
   ```

2. **View docling-serve logs:**
   ```bash
   docker logs docling-serve -f
   ```

3. **Increase timeout** (if needed):
   - Edit `document_service.py`
   - Change `timeout=300.0` to `timeout=600.0`

### Issue: Poor Quality Output

**Solutions:**
- Verify you're using `docling-api` provider
- Check docling-serve logs for errors
- Ensure GPU is being used (check `nvidia-smi`)

## Monitoring

### Check GPU Usage
```bash
# Real-time monitoring
nvidia-smi dmon

# Current status
nvidia-smi
```

### View Logs
```bash
# Docling-serve logs
docker logs docling-serve --tail 100 -f

# Chat backend logs
docker logs your-chat-backend --tail 100 -f
```

### Performance Metrics

Monitor these in your logs:
- PDF conversion time
- GPU utilization
- Memory usage
- Request queue length

## Network Configuration Details

### Same Network Setup

If both containers are in the same Docker network:

**Advantages:**
- Direct container-to-container communication
- No port exposure needed
- Better security
- Lower latency

**Configuration:**
```bash
DOCLING_SERVICE_URL=http://docling-serve:5001
```

### Host Network Setup

If containers are in different networks:

**Advantages:**
- Works across different Easypanel projects
- Simpler troubleshooting

**Configuration:**
```bash
DOCLING_SERVICE_URL=http://172.17.0.1:5001
```

**Note:** Ensure port 5001 is accessible from chat backend.

## Performance Optimization

Your docling-serve is already well-configured:
- ✅ 2x RTX 5090 GPUs
- ✅ 4 workers
- ✅ 128GB shared memory
- ✅ CUDA enabled

For even better performance:
1. Increase workers: `DOCLING_SERVE_ENG_LOC_NUM_WORKERS=8`
2. Monitor GPU utilization and adjust
3. Consider load balancing if needed

## Security Checklist

- ✅ Docling-serve not exposed to internet (port 5001 internal only)
- ✅ Communication within private Docker network
- ✅ No sensitive data leaves your infrastructure
- ✅ GPU resources isolated to docling-serve

## Quick Commands Reference

```bash
# Test docling-serve health
curl http://172.17.0.1:5001/health

# Test PDF conversion
curl -X POST "http://172.17.0.1:5001/v1alpha/convert/file" \
  -F "files=@test.pdf;type=application/pdf" \
  -F 'parameters={"options": {"from_formats": ["pdf"], "to_formats": ["md"]}}'

# Check GPU usage
nvidia-smi

# View docling-serve logs
docker logs docling-serve -f

# View chat backend logs
docker logs your-chat-backend -f

# Restart chat backend (Easypanel)
# Use Easypanel UI: Services → Chat Backend → Restart

# Check network connectivity
docker exec your-chat-backend ping docling-serve
docker exec your-chat-backend curl http://docling-serve:5001/health
```

## Expected Results

After successful integration:

1. **PDF uploads work seamlessly**
2. **High-quality markdown output** with:
   - Preserved table structures
   - Formula extraction
   - Layout understanding
   - Image descriptions
3. **Fast processing** (GPU-accelerated)
4. **Better LLM understanding** of document content

## Fallback Behavior

If docling-serve is unavailable, the system automatically falls back to PyPDF2:

```
docling-api (fails) → pypdf2 (basic text extraction)
```

This ensures PDFs are always processed, even if docling-serve is down.

## Next Steps

1. ✅ Update `.env` with `PDF_PROVIDER=docling-api`
2. ✅ Set `DOCLING_SERVICE_URL=http://172.17.0.1:5001`
3. ✅ Restart chat backend in Easypanel
4. ✅ Test with admin API endpoint
5. ✅ Upload a test PDF
6. ✅ Monitor logs and GPU usage

## Support

If you encounter issues:
1. Check logs (both containers)
2. Verify network connectivity
3. Test health endpoint
4. Review GPU utilization
5. Check the troubleshooting section above

For more details, see:
- `MICROSERVICES_ARCHITECTURE.md` - Detailed architecture guide
- `PDF_PROVIDERS.md` - Provider comparison and configuration
