# MCP (Model Context Protocol) Integration for AutoVersio

## Overview

Model Context Protocol (MCP) is a standard that allows LLMs to interact with external tools and data sources through a unified interface. AnythingLLM successfully uses MCP with tool-calling capable models like Qwen3-80B to intelligently decide when to invoke external services.

## How AnythingLLM Handles MCP Tool Calling

### Intelligent Tool Selection
AnythingLLM relies on the LLM's native **tool calling** (function calling) capabilities to decide when to use MCP tools:

1. **Tool Registration**: MCP servers expose available tools/functions to the LLM
2. **LLM Decision**: The model analyzes the user query and decides if a tool is needed
3. **Tool Invocation**: If needed, the LLM calls the appropriate MCP tool with parameters
4. **Result Integration**: Tool results are fed back to the LLM for final response generation

### Key Difference from Current AutoVersio Web Search
- **Current AutoVersio**: Boolean flag → Search on EVERY message (45 sec delay)
- **MCP Approach**: LLM decides → Only search when relevant (intelligent triggering)

### Example Flow
```
User: "What's the weather today?"
→ LLM: Recognizes need for real-time data
→ Calls: weather_tool()
→ Returns: Current weather
→ LLM: Formats response with weather data

User: "Explain quantum physics"
→ LLM: Uses internal knowledge
→ No tool call needed
→ Direct response
```

## MCP Servers Used in AnythingLLM

### 1. Firecrawl MCP (Web Search & Scraping)
```json
{
  "firecrawl-mcp": {
    "command": "npx",
    "args": ["-y", "firecrawl-mcp"],
    "env": {
      "FIRECRAWL_API_KEY": "api-key"
    }
  }
}
```

**Capabilities:**
- Web page scraping and crawling
- Content extraction from URLs
- Search across websites
- Much faster than Jina Search (typically 2-5 seconds)

**Tools Exposed:**
- `scrape_url`: Extract content from a specific URL
- `crawl_website`: Crawl multiple pages from a domain
- `search_web`: Search the web for information

### 2. Klavis Firecrawl (Streamable MCP)
```json
{
  "klavis-firecrawl": {
    "type": "streamable",
    "url": "https://firecrawl-websearch-mcp-server.klavis.ai/mcp/?instance_id=abc"
  }
}
```

**Capabilities:**
- Hosted MCP server (no local installation)
- Streamable responses for better UX
- Web search optimized for LLM consumption

### 3. Odoo MCP (Database Access)
```json
{
  "Odoo mcp": {
    "command": "uvx",
    "args": [
      "--from", "mcp-alchemy",
      "--with", "psycopg2-binary",
      "mcp-alchemy"
    ],
    "env": {
      "DB_URL": "postgresql://odoo:e05ea935da0184073eaa@data_odoo-db:5432/autoversio"
    }
  }
}
```

**Capabilities:**
- Direct SQL queries to Odoo database
- Data retrieval for business logic
- Integration with ERP data

## Implementing MCP in AutoVersio

### Requirements

1. **Tool-Calling LLM**: Model must support function/tool calling
   - ✅ Qwen3-80B (proven in AnythingLLM)
   - ✅ GPT-4, GPT-3.5-turbo
   - ✅ Claude 3 (Opus, Sonnet, Haiku)
   - ✅ Gemini Pro
   - ❌ Most open-source models without fine-tuning

2. **MCP Server Integration**: Backend support for MCP protocol
   - Python MCP SDK: `mcp` package
   - Node.js MCP SDK: `@modelcontextprotocol/sdk`

3. **Tool Registration**: Expose MCP tools to LLM in chat context

### Proposed Architecture

```
User Query
    ↓
LLM Service (with tool calling)
    ↓
Tool Decision
    ├─→ No tool needed → Direct response
    └─→ Tool needed → MCP Server
                         ↓
                    Execute tool
                         ↓
                    Return result
                         ↓
                    LLM formats response
```

### Implementation Steps

1. **Add MCP Support to Backend**
   ```python
   # app/services/mcp_service.py
   from mcp import Server, Tool
   
   class MCPService:
       def __init__(self):
           self.servers = {}
       
       async def register_server(self, name: str, config: dict):
           # Initialize MCP server connection
           pass
       
       async def call_tool(self, tool_name: str, params: dict):
           # Execute MCP tool and return result
           pass
   ```

2. **Update LLM Service for Tool Calling**
   ```python
   # app/services/llm_service.py
   async def chat_with_tools(self, messages, tools):
       response = await self.client.chat.completions.create(
           model=self.model_name,
           messages=messages,
           tools=tools,  # MCP tools exposed here
           tool_choice="auto"  # Let LLM decide
       )
       
       if response.tool_calls:
           # Execute tool via MCP
           tool_results = await self.execute_tools(response.tool_calls)
           # Feed results back to LLM
           final_response = await self.generate_final_response(tool_results)
       
       return response
   ```

3. **Configure MCP Servers**
   ```json
   // config/mcp_servers.json
   {
     "mcpServers": {
       "firecrawl": {
         "command": "npx",
         "args": ["-y", "firecrawl-mcp"],
         "env": {
           "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
         }
       }
     }
   }
   ```

## Benefits for AutoVersio

### 1. Intelligent Web Search
- **Current**: 45 sec delay on EVERY message when enabled
- **With MCP**: Only search when LLM determines it's needed
- **Result**: Much better UX, faster responses

### 2. Multiple Data Sources
- Web search (Firecrawl)
- Database queries (Odoo MCP)
- Custom tools (future expansion)

### 3. Better Performance
- Firecrawl: 2-5 seconds (vs 45 sec Jina)
- Only called when relevant
- Parallel tool execution possible

### 4. Extensibility
- Easy to add new MCP servers
- Standard protocol (no custom integrations)
- Community-built tools available

## Migration Path

### Phase 1: Add MCP Infrastructure
- Install MCP SDK
- Create MCP service layer
- Add tool registration system

### Phase 2: Integrate Firecrawl
- Replace n8n/Jina with Firecrawl MCP
- Configure API key
- Test web search performance

### Phase 3: Enable Tool Calling
- Update LLM service to support tools
- Expose MCP tools to LLM
- Implement tool execution loop

### Phase 4: Remove Boolean Flag
- Deprecate `use_web_search` boolean
- Let LLM decide when to search
- Keep toggle for "enable/disable tools" globally

## Recommended MCP Servers for AutoVersio

1. **Firecrawl MCP** (Web Search)
   - Fast, reliable web scraping
   - Better than current Jina integration
   - API key: Already available

2. **Brave Search MCP** (Alternative Web Search)
   - Free tier available
   - Privacy-focused
   - Good for general queries

3. **Filesystem MCP** (Document Access)
   - Read/write local files
   - Could replace current document upload flow
   - Better integration with RAG

4. **PostgreSQL MCP** (Database Access)
   - Direct DB queries for analytics
   - Could expose workspace/chat stats
   - Useful for admin features

## Comparison: Current vs MCP Approach

| Feature | Current (n8n/Jina) | MCP Approach |
|---------|-------------------|--------------|
| **Triggering** | Boolean flag (always on/off) | LLM decides intelligently |
| **Performance** | 45 seconds per query | 2-5 seconds when needed |
| **User Control** | Manual toggle required | Automatic, transparent |
| **Extensibility** | Custom integration per service | Standard protocol |
| **Cost** | Fixed cost per query | Pay only when used |
| **UX** | Slow, frustrating | Fast, seamless |

## Next Steps

1. Research Python MCP SDK compatibility with FastAPI
2. Test Firecrawl MCP performance with Qwen3-80B
3. Design tool registration system for AutoVersio
4. Implement proof-of-concept with single MCP server
5. Migrate from n8n webhook to MCP-based search

## Resources

- MCP Specification: https://modelcontextprotocol.io
- Firecrawl MCP: https://github.com/firecrawl/firecrawl-mcp
- Python MCP SDK: https://github.com/modelcontextprotocol/python-sdk
- AnythingLLM MCP Docs: https://docs.anythingllm.com/features/mcp
