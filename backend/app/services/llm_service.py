import httpx
from typing import AsyncGenerator, Optional, List, Dict
from app.core.config import settings


class LLMService:
    def __init__(self):
        self.base_url = settings.LLM_BASE_URL.rstrip('/')
        self.api_key = settings.LLM_API_KEY
        self.model = settings.LLM_MODEL
        
        # Context window limits
        self.max_context_tokens = settings.MAX_CONTEXT_TOKENS
        self.history_ratio = settings.CONTEXT_HISTORY_RATIO
        self.system_ratio = settings.CONTEXT_SYSTEM_RATIO
        self.user_ratio = settings.CONTEXT_USER_RATIO
        
        # Calculate token limits
        self.history_limit = int(self.max_context_tokens * self.history_ratio)
        self.system_limit = int(self.max_context_tokens * self.system_ratio)
        self.user_limit = int(self.max_context_tokens * self.user_ratio)
    
    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars ≈ 1 token)"""
        return len(text) // 4
    
    def _truncate_messages(self, messages: List[Dict[str, str]], max_tokens: int) -> List[Dict[str, str]]:
        """Truncate chat history to fit within token limit"""
        if not messages:
            return messages
            
        # Keep system message if it exists
        system_messages = [msg for msg in messages if msg.get("role") == "system"]
        chat_messages = [msg for msg in messages if msg.get("role") != "system"]
        
        # If no chat messages, return as is
        if not chat_messages:
            return messages
            
        total_tokens = 0
        truncated_messages = []
        
        # Add messages from most recent backwards until we hit the limit
        for msg in reversed(chat_messages):
            msg_tokens = self._estimate_tokens(msg.get("content", ""))
            if total_tokens + msg_tokens <= max_tokens:
                truncated_messages.insert(0, msg)
                total_tokens += msg_tokens
            else:
                break
        
        # If we truncated and have more than 2 messages, add a truncation indicator
        if len(truncated_messages) < len(chat_messages) and len(truncated_messages) > 1:
            truncated_messages.insert(0, {
                "role": "assistant", 
                "content": "[Previous conversation truncated to fit context window]"
            })
        
        return system_messages + truncated_messages
    
    def _build_system_prompt(
        self, 
        workspace_prompt: Optional[str] = None, 
        rag_context: Optional[str] = None,
        file_content: Optional[str] = None
    ) -> str:
        """Build system prompt with RAG context prioritization (AnythingLLM-style)"""
        prompts = []
        
        # Workspace-specific prompt (full freedom for users)
        if workspace_prompt:
            prompts.append(workspace_prompt)
        
        # RAG context from vector store or web search - with strong instruction to use it
        if rag_context:
            # Check if this contains web search results
            if "Web Search Results:" in rag_context:
                prompts.append(
                    "IMPORTANT: The following contains CURRENT web search results that are MORE UP-TO-DATE than your training data. "
                    "You MUST base your answer on this information. Do NOT use your own knowledge about current events - use ONLY the provided search results. "
                    "Summarize and present the information from the search results in a clear, helpful way.\n\n"
                    "FORMAT INSTRUCTIONS:\n"
                    "- At the END of your response, add a '---' separator followed by a 'Källor:' (Sources) section\n"
                    "- List the sources mentioned in the search results\n"
                    "- Use format: 🔍 **[Source Name]** - brief description\n"
                    "- This helps users know the information came from web search\n\n"
                    + rag_context
                )
            else:
                prompts.append(
                    "DOCUMENT CONTEXT: The following information is retrieved from the workspace's document store. "
                    "Each piece of context is marked with a source number like [1], [2], etc.\n\n"
                    "INSTRUCTIONS:\n"
                    "- Base your answer primarily on the provided context\n"
                    "- Use inline citations like [1], [2] when referencing specific information\n"
                    "- At the END of your response, add a '---' separator followed by a 'Källor:' (Sources) section\n"
                    "- List each source with format: 📄 **[1]** filename.pdf\n"
                    "- Only cite sources you actually used in your answer\n"
                    "- If the context doesn't contain relevant information, you may use your general knowledge but mention this\n\n"
                    "CONTEXT:\n" + rag_context
                )
        
        # File content if attached (CAG)
        if file_content:
            prompts.append(f"Additional context from attached files:\n\n{file_content}")
        
        return "\n\n".join(prompts)
    
    async def generate(self, prompt: str, temperature: float = 0.7, max_tokens: int = 2048) -> str:
        """Simple text generation for transformations"""
        messages = [{"role": "user", "content": prompt}]
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._get_headers(),
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False,
                }
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        file_content: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Dict:
        """Non-streaming chat completion"""
        combined_prompt = self._build_system_prompt(system_prompt, file_content)
        if combined_prompt:
            messages = [{"role": "system", "content": combined_prompt}] + messages
        
        # Truncate messages if too long
        messages = self._truncate_messages(messages, self.history_limit)
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._get_headers(),
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": False,
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        rag_context: Optional[str] = None,
        file_content: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """Streaming chat completion"""
        full_messages = []
        
        # Build combined system prompt with RAG context prioritization
        combined_prompt = self._build_system_prompt(system_prompt, rag_context, file_content)
        if combined_prompt:
            full_messages.append({"role": "system", "content": combined_prompt})
        
        # Add chat messages
        full_messages.extend(messages)
        
        # Truncate messages if too long
        full_messages = self._truncate_messages(full_messages, self.history_limit)
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self._get_headers(),
                json={
                    "model": self.model,
                    "messages": full_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                    "repetition_penalty": 1.1,  # Prevent repetitive text
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            import json
                            chunk = json.loads(data)
                            if chunk.get("choices") and chunk["choices"][0].get("delta", {}).get("content"):
                                yield chunk["choices"][0]["delta"]["content"]
                        except:
                            continue


llm_service = LLMService()
