# Docling API Parameters for Rich Markdown (RAG/CAG)

When calling your docling-serve API, you can pass parameters to get richer markdown output. Here's how to optimize for RAG/CAG.

## Current Implementation

Your chat backend currently sends basic parameters:

```python
# In document_service.py
data = {
    "parameters": '{"options": {"from_formats": ["pdf"], "to_formats": ["md"]}}'
}
```

## Optimized Parameters for RAG/CAG

Update `document_service.py` to send these enhanced parameters:

```python
async def _convert_pdf_with_docling_api(self, path: Path) -> str:
    """Convert PDF to markdown using docling-serve API with optimized settings"""
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with aiofiles.open(path, "rb") as f:
                pdf_content = await f.read()
            
            # OPTIMIZED PARAMETERS FOR RICH MARKDOWN
            parameters = {
                "options": {
                    "from_formats": ["pdf"],
                    "to_formats": ["md"],
                    
                    # OCR Settings (for scanned PDFs)
                    "do_ocr": True,              # Enable OCR
                    "force_ocr": False,          # Don't replace existing text
                    "ocr_engine": "easyocr",     # Best OCR engine
                    
                    # PDF Backend (v4 is most advanced)
                    "pdf_backend": "dlparse_v4",
                    
                    # Table Extraction (CRITICAL for RAG)
                    "table_mode": "accurate",    # Use accurate mode (not fast)
                    "do_table_structure": True,  # Extract table structure
                    "table_cell_matching": True, # Match cells back to PDF
                    
                    # Formula Extraction (for scientific/technical docs)
                    "do_formula_enrichment": True,  # Extract LaTeX formulas
                    
                    # Code Extraction (for technical docs)
                    "do_code_enrichment": True,     # Extract code blocks
                    
                    # Image Handling
                    "include_images": True,              # Include images
                    "images_scale": 2.0,                 # High quality images
                    "image_export_mode": "embedded",     # Embed images in markdown
                    
                    # Picture Classification & Description (POWERFUL for RAG)
                    "do_picture_classification": True,   # Classify images (chart, diagram, photo)
                    "do_picture_description": True,      # Describe images with VLM
                    "picture_description_area_threshold": 0.01,  # Process small images too
                    
                    # Markdown Formatting
                    "md_page_break_placeholder": "\n\n---\n\n",  # Clear page breaks
                    
                    # Error Handling
                    "abort_on_error": False,  # Continue even if errors
                }
            }
            
            files = {"files": (path.name, pdf_content, "application/pdf")}
            data = {"parameters": json.dumps(parameters)}
            
            response = await client.post(
                f"{self.docling_service_url}/v1alpha/convert/file",
                files=files,
                data=data
            )
            response.raise_for_status()
            
            result = response.json()
            if result.get("status") == "success" and result.get("document"):
                markdown = result["document"].get("md_content", "")
                if markdown:
                    return markdown
                return f"Error: No markdown content in response"
            else:
                errors = result.get("errors", [])
                return f"Error converting PDF with Docling API: {errors}"
    except Exception as e:
        return f"Error converting PDF with Docling API: {e}"
```

## Key Parameters Explained

### For Better RAG Quality

| Parameter | Value | Why It Matters for RAG |
|-----------|-------|------------------------|
| **`table_mode`** | `"accurate"` | Preserves table structure so LLM can answer "What's in row 2?" |
| **`do_formula_enrichment`** | `True` | Extracts LaTeX formulas so LLM understands math |
| **`do_picture_description`** | `True` | **HUGE**: VLM describes charts/diagrams, LLM can answer about visuals |
| **`do_picture_classification`** | `True` | Identifies if image is chart/diagram/photo for better context |
| **`do_code_enrichment`** | `True` | Extracts code blocks properly formatted |
| **`pdf_backend`** | `"dlparse_v4"` | Most advanced parser, best layout understanding |

### Picture Description (Game Changer for RAG)

When enabled, docling uses a Vision-Language Model (VLM) to describe images:

**Without picture description:**
```markdown
![Image](image1.png)
```

**With picture description:**
```markdown
![A bar chart showing quarterly revenue growth from Q1 to Q4 2024, with values increasing from $1.2M to $2.1M](image1.png)
```

**Impact on RAG:** Your LLM can now answer questions about charts and diagrams!

## Example Output Comparison

### Basic Parameters (Current)
```markdown
# Document Title

Some text.

| A | B |
|---|---|
| 1 | 2 |

More text.
```

### Optimized Parameters (Proposed)
```markdown
# Document Title

Some text with proper reading order preserved.

## Table 1: Financial Results

| Quarter | Revenue | Growth Rate |
|---------|---------|-------------|
| Q1 2024 | $1.2M   | +15%        |
| Q2 2024 | $1.4M   | +16%        |

**Formula:** The growth rate is calculated as: $\frac{R_{new} - R_{old}}{R_{old}} \times 100$

![A line chart showing the upward trend in revenue across quarters, with a steady increase from Q1 to Q4](chart1.png)

```python
def calculate_growth(old, new):
    return ((new - old) / old) * 100
```

---

More text on next page.
```

## Performance Impact

| Setting | Processing Time | Quality | Recommendation |
|---------|----------------|---------|----------------|
| **Basic** | Fast | Good | Development |
| **Optimized (no VLM)** | Medium | Excellent | Production |
| **Optimized (with VLM)** | Slower | **Best** | High-value docs |

## Conditional Settings

You can make picture description conditional based on document type:

```python
# For scientific papers, financial reports - use VLM
if document_type in ["scientific", "financial", "technical"]:
    parameters["options"]["do_picture_description"] = True
else:
    parameters["options"]["do_picture_description"] = False
```

## VLM Configuration (Optional)

If you want to use your own VLM for picture descriptions:

```python
"picture_description_api": {
    "url": "http://your-vllm-server:8000/v1/chat/completions",
    "params": {
        "model": "ibm-granite/granite-vision-3.2-2b",
        "max_completion_tokens": 200
    },
    "prompt": "Describe this chart/diagram in detail for a technical audience: "
}
```

**Note:** Requires `DOCLING_SERVE_ENABLE_REMOTE_SERVICES=true` in your compose file.

## Testing Different Configurations

Create test profiles:

### Profile 1: Fast (Development)
```python
{
    "table_mode": "fast",
    "do_formula_enrichment": False,
    "do_picture_description": False
}
```

### Profile 2: Balanced (Production)
```python
{
    "table_mode": "accurate",
    "do_formula_enrichment": True,
    "do_picture_description": False,
    "do_code_enrichment": True
}
```

### Profile 3: Maximum Quality (High-Value Docs)
```python
{
    "table_mode": "accurate",
    "do_formula_enrichment": True,
    "do_picture_description": True,
    "do_picture_classification": True,
    "do_code_enrichment": True
}
```

## Implementation Steps

1. **Update `document_service.py`** with optimized parameters
2. **Add `import json`** at the top
3. **Test with a complex PDF** (tables, formulas, charts)
4. **Compare markdown quality** before/after
5. **Adjust parameters** based on your needs

## Expected Improvements for RAG

- **Better table understanding**: LLM can answer "What's in column 2?"
- **Formula awareness**: LLM understands mathematical relationships
- **Visual context**: LLM can discuss charts and diagrams
- **Code preservation**: Code blocks properly formatted
- **Page structure**: Clear page breaks help with context

## Monitoring

Watch processing times:
```python
import time
start = time.time()
markdown = await self._convert_pdf_with_docling_api(path)
duration = time.time() - start
print(f"Docling processing took {duration:.2f}s")
```

Adjust parameters if too slow for your use case.
