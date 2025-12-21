import httpx
import uuid
from typing import Optional
from app.core.config import settings


class SearchAgentService:
    """Service for calling external search agent (n8n webhook)"""
    
    def __init__(self):
        self.url = settings.SEARCH_AGENT_URL
    
    def is_available(self) -> bool:
        """Check if search agent is configured"""
        return bool(self.url)
    
    async def search(
        self,
        query: str,
        session_id: Optional[str] = None,
        system_prompt: Optional[str] = None
    ) -> Optional[str]:
        """
        Call the search agent webhook
        
        Args:
            query: The search query
            session_id: Optional session ID for conversation continuity
            system_prompt: Optional system prompt to guide the agent
            
        Returns:
            The agent's response or None if failed
        """
        if not self.is_available():
            return None
        
        if not session_id:
            session_id = str(uuid.uuid4())
        
        payload = {
            "chatInput": query,
            "sessionId": session_id,
        }
        
        if system_prompt:
            payload["systemPrompt"] = system_prompt
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    # n8n typically returns the response in 'output' or directly
                    if isinstance(data, dict):
                        return data.get("output") or data.get("response") or data.get("text") or str(data)
                    return str(data)
                else:
                    print(f"Search agent error: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"Search agent exception: {e}")
            return None


search_agent_service = SearchAgentService()
