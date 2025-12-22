import { useAuthStore } from '../store/auth'

const API_BASE = '/api'

export interface Workspace {
  id: number
  name: string
  description: string | null
  system_prompt: string | null
  chat_mode: string | null
  top_n: number | null
  similarity_threshold: number | null
  use_hybrid_search: boolean | null
  use_web_search: boolean | null
  admin_pinned: boolean | null
  owner_id: number
}

export interface Chat {
  id: number
  title: string
  workspace_id: number
  user_id: number
  created_at: string
  updated_at: string
}

export interface Document {
  id: number
  workspace_id: number
  original_filename: string
  is_embedded: boolean
  embedded_at: string | null
  created_at: string
}

export interface User {
  id: number
  email: string
  name: string | null
  role: string
  created_at?: string
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })
  
  if (response.status === 401) {
    useAuthStore.getState().logout()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || 'Request failed')
  }
  
  return response.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchApi<{ access_token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    me: () => fetchApi<{ id: number; email: string; name: string | null; role: string }>('/auth/me'),
  },
  
  workspaces: {
    list: () => fetchApi<Workspace[]>('/workspaces'),
    get: (id: number) => fetchApi<Workspace>(`/workspaces/${id}`),
    create: (data: { name: string; description?: string; system_prompt?: string; chat_mode?: string; top_n?: number; similarity_threshold?: number; use_hybrid_search?: boolean; use_web_search?: boolean }) =>
      fetchApi<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; description?: string; system_prompt?: string; chat_mode?: string; top_n?: number; similarity_threshold?: number; use_hybrid_search?: boolean; use_web_search?: boolean }) =>
      fetchApi<Workspace>(`/workspaces/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi(`/workspaces/${id}`, { method: 'DELETE' }),
  },
  
  chats: {
    list: (workspaceId: number) => fetchApi<Chat[]>(`/chats/workspace/${workspaceId}`),
    get: (id: number) => fetchApi<Chat>(`/chats/${id}`),
    create: (workspaceId: number, title?: string) =>
      fetchApi<Chat>('/chats', { method: 'POST', body: JSON.stringify({ workspace_id: workspaceId, title }) }),
    update: (id: number, data: { title?: string }) =>
      fetchApi<Chat>(`/chats/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => fetchApi(`/chats/${id}`, { method: 'DELETE' }),
    getMessages: (chatId: number) => fetchApi<any[]>(`/chats/${chatId}/messages`),
  },
  
  documents: {
    list: (workspaceId: number) => fetchApi<Document[]>(`/documents/workspace/${workspaceId}`),
    upload: async (workspaceId: number, file: File) => {
      const token = useAuthStore.getState().token
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(`${API_BASE}/documents/workspace/${workspaceId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      
      if (!response.ok) throw new Error('Upload failed')
      return response.json()
    },
    embed: (documentId: number) =>
      fetchApi<Document>(`/documents/${documentId}/embed`, { method: 'POST' }),
    embedAll: (workspaceId: number) =>
      fetchApi<{ embedded: number; total: number; errors?: Array<{ document_id: number; error: string }> }>(`/documents/workspace/${workspaceId}/embed-all`, { method: 'POST' }),
    delete: (id: number) => fetchApi(`/documents/${id}`, { method: 'DELETE' }),
    getContent: (id: number) => fetchApi<{ content: string }>(`/documents/${id}/content`),
  },
  
  admin: {
    stats: () => fetchApi<any>('/admin/stats'),
    users: () => fetchApi<User[]>('/admin/users'),
    createUser: (data: { email: string; password: string; name: string; role: string }) =>
      fetchApi<User>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (id: number, data: { name?: string; role?: string; password?: string }) =>
      fetchApi(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteUser: (id: number) => fetchApi(`/admin/users/${id}`, { method: 'DELETE' }),
    logs: (params?: { limit?: number; offset?: number; user_id?: number; workspace_id?: number }) => {
      const query = new URLSearchParams()
      if (params?.limit) query.set('limit', params.limit.toString())
      if (params?.offset) query.set('offset', params.offset.toString())
      if (params?.user_id) query.set('user_id', params.user_id.toString())
      if (params?.workspace_id) query.set('workspace_id', params.workspace_id.toString())
      return fetchApi<any[]>(`/admin/logs?${query}`)
    },
    healthServices: () => fetchApi<{
      llm: { name: string; status: string; url: string; latency_ms?: number; error?: string }
      embedder: { name: string; status: string; url: string; latency_ms?: number; error?: string }
      qdrant: { name: string; status: string; url: string; latency_ms?: number; error?: string }
    }>('/admin/health/services'),
    systemOverview: () => fetchApi<{
      workspaces: Array<{
        id: number
        name: string
        owner_email: string
        document_count: number
        embedded_count: number
        has_rag_collection: boolean
        rag_points: number
        admin_pinned: boolean
      }>
      total_rag_collections: number
    }>('/admin/system/overview'),
    testLlm: () => fetchApi<{
      status: string
      url: string
      models?: string[]
      configured_model?: string
      error?: string
    }>('/admin/test/llm'),
    testEmbedder: () => fetchApi<{
      status: string
      url: string
      models?: string[]
      configured_model?: string
      embedding_dimension?: number
      error?: string
    }>('/admin/test/embedder'),
    testQdrant: () => fetchApi<{
      status: string
      url: string
      collections?: Array<{ name: string; points_count: number; vectors_count: number }>
      total_collections?: number
      error?: string
    }>('/admin/test/qdrant'),
    testMarker: () => fetchApi<{
      status: string
      url?: string
      message?: string
      error?: string
    }>('/admin/test/marker'),
    toggleWorkspacePin: (workspaceId: number) => fetchApi<{ id: number; admin_pinned: boolean }>(`/admin/workspaces/${workspaceId}/pin`, { method: 'PUT' }),
  },
}
