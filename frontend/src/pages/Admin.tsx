import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, User } from '../lib/api'
import {
  ArrowLeft,
  Users as UsersIcon,
  MessageSquare,
  BarChart3,
  Plus,
  Trash2,
  Loader2,
  Activity,
  Database,
  Server,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'

interface Stats {
  total_users: number
  total_workspaces: number
  total_chats: number
  total_messages: number
  total_logs: number
}

interface ChatLog {
  id: number
  user_id: number
  workspace_id: number | null
  chat_id: number | null
  prompt: string
  response: string
  latency_ms: number | null
  created_at: string
}

interface ServiceStatus {
  name: string
  status: string
  url: string
  latency_ms?: number
  error?: string
}

interface SystemHealth {
  llm: ServiceStatus
  embedder: ServiceStatus
  qdrant: ServiceStatus
}

interface WorkspaceInfo {
  id: number
  name: string
  owner_email: string
  document_count: number
  embedded_count: number
  has_rag_collection: boolean
  rag_points: number
  admin_pinned: boolean
}

interface SystemOverview {
  workspaces: WorkspaceInfo[]
  total_rag_collections: number
}

interface TestResult {
  status: string
  url?: string
  message?: string
  models?: string[]
  configured_model?: string
  embedding_dimension?: number
  collections?: Array<{ name: string; points_count: number; vectors_count: number }>
  total_collections?: number
  error?: string
}

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'system' | 'stats' | 'users' | 'logs'>('system')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [logs, setLogs] = useState<ChatLog[]>([])
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [overview, setOverview] = useState<SystemOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [testResults, setTestResults] = useState<{ llm?: TestResult; embedder?: TestResult; qdrant?: TestResult; marker?: TestResult }>({})
  const [testing, setTesting] = useState<{ llm: boolean; embedder: boolean; qdrant: boolean; marker: boolean }>({ llm: false, embedder: false, qdrant: false, marker: false })

  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'user' })

  useEffect(() => {
    loadData()
  }, [tab])

  const loadData = async () => {
    setLoading(true)
    try {
      if (tab === 'system') {
        const [healthData, overviewData] = await Promise.all([
          api.admin.healthServices(),
          api.admin.systemOverview()
        ])
        setHealth(healthData)
        setOverview(overviewData)
      } else if (tab === 'stats') {
        const data = await api.admin.stats()
        setStats(data)
      } else if (tab === 'users') {
        const data = await api.admin.users()
        setUsers(data)
      } else if (tab === 'logs') {
        const data = await api.admin.logs({ limit: 100 })
        setLogs(data)
      }
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const refreshHealth = async () => {
    setRefreshing(true)
    try {
      const healthData = await api.admin.healthServices()
      setHealth(healthData)
    } catch (err) {
      console.error('Failed to refresh health:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const testService = async (service: 'llm' | 'embedder' | 'qdrant' | 'marker') => {
    setTesting(prev => ({ ...prev, [service]: true }))
    setTestResults(prev => ({ ...prev, [service]: undefined }))
    try {
      let result: TestResult
      if (service === 'llm') {
        result = await api.admin.testLlm()
      } else if (service === 'embedder') {
        result = await api.admin.testEmbedder()
      } else if (service === 'marker') {
        result = await api.admin.testMarker()
      } else {
        result = await api.admin.testQdrant()
      }
      setTestResults(prev => ({ ...prev, [service]: result }))
    } catch (err) {
      setTestResults(prev => ({ ...prev, [service]: { status: 'error', url: '', error: String(err) } }))
    } finally {
      setTesting(prev => ({ ...prev, [service]: false }))
    }
  }

  const handleTogglePin = async (workspaceId: number) => {
    try {
      const result = await api.admin.toggleWorkspacePin(workspaceId)
      if (overview) {
        setOverview({
          ...overview,
          workspaces: overview.workspaces.map(ws => 
            ws.id === workspaceId ? { ...ws, admin_pinned: result.admin_pinned } : ws
          )
        })
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  const handleCreateUser = async () => {
    try {
      const user = await api.admin.createUser(newUser)
      setUsers([user, ...users])
      setShowNewUser(false)
      setNewUser({ email: '', password: '', name: '', role: 'user' })
    } catch (err) {
      console.error('Failed to create user:', err)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      await api.admin.deleteUser(userId)
      setUsers(users.filter((u) => u.id !== userId))
    } catch (err) {
      console.error('Failed to delete user:', err)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="h-14 border-b border-dark-700 flex items-center px-4 gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium text-white">Admin Panel</h1>
      </header>

      <div className="flex">
        <nav className="w-48 border-r border-dark-700 p-2">
          <button
            onClick={() => setTab('system')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              tab === 'system'
                ? 'bg-dark-700 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            System
          </button>
          <button
            onClick={() => setTab('stats')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              tab === 'stats'
                ? 'bg-dark-700 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Statistics
          </button>
          <button
            onClick={() => setTab('users')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              tab === 'users'
                ? 'bg-dark-700 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            Users
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              tab === 'logs'
                ? 'bg-dark-700 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat Logs
          </button>
        </nav>

        <main className="flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-dark-400" />
            </div>
          ) : (
            <>
              {tab === 'system' && health && overview && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-medium text-white">Service Status</h2>
                    <button
                      onClick={refreshHealth}
                      disabled={refreshing}
                      className="flex items-center gap-2 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[health.llm, health.embedder, health.qdrant].map((service) => (
                      <div key={service.name} className="bg-dark-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {service.name === 'LLM' && <Cpu className="w-5 h-5 text-dark-400" />}
                            {service.name === 'Embedder' && <Server className="w-5 h-5 text-dark-400" />}
                            {service.name === 'Qdrant' && <Database className="w-5 h-5 text-dark-400" />}
                            <span className="font-medium text-white">{service.name}</span>
                          </div>
                          {service.status === 'online' && <CheckCircle className="w-5 h-5 text-green-500" />}
                          {service.status === 'offline' && <XCircle className="w-5 h-5 text-red-500" />}
                          {service.status === 'error' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                        </div>
                        <p className="text-xs text-dark-500 truncate mb-1">{service.url}</p>
                        {service.status === 'online' && service.latency_ms && (
                          <p className="text-xs text-green-400">{service.latency_ms.toFixed(0)}ms</p>
                        )}
                        {service.error && (
                          <p className="text-xs text-red-400 truncate">{service.error}</p>
                        )}
                        <button
                          onClick={() => testService(service.name.toLowerCase() as 'llm' | 'embedder' | 'qdrant')}
                          disabled={testing[service.name.toLowerCase() as keyof typeof testing]}
                          className="mt-2 w-full px-2 py-1 bg-dark-700 hover:bg-dark-600 text-xs text-dark-300 rounded disabled:opacity-50"
                        >
                          {testing[service.name.toLowerCase() as keyof typeof testing] ? 'Testing...' : 'Test Connection'}
                        </button>
                        {testResults[service.name.toLowerCase() as keyof typeof testResults] && (
                          <div className="mt-2 p-2 bg-dark-900 rounded text-xs">
                            {testResults[service.name.toLowerCase() as keyof typeof testResults]?.models && (
                              <div className="mb-1">
                                <span className="text-dark-500">Models: </span>
                                <span className="text-green-400">{testResults[service.name.toLowerCase() as keyof typeof testResults]?.models?.join(', ')}</span>
                              </div>
                            )}
                            {testResults[service.name.toLowerCase() as keyof typeof testResults]?.configured_model && (
                              <div className="mb-1">
                                <span className="text-dark-500">Configured: </span>
                                <span className="text-blue-400">{testResults[service.name.toLowerCase() as keyof typeof testResults]?.configured_model}</span>
                              </div>
                            )}
                            {testResults[service.name.toLowerCase() as keyof typeof testResults]?.embedding_dimension && (
                              <div className="mb-1">
                                <span className="text-dark-500">Dimension: </span>
                                <span className="text-blue-400">{testResults[service.name.toLowerCase() as keyof typeof testResults]?.embedding_dimension}</span>
                              </div>
                            )}
                            {testResults[service.name.toLowerCase() as keyof typeof testResults]?.collections && (
                              <div>
                                <span className="text-dark-500">Collections: </span>
                                <span className="text-green-400">
                                  {testResults[service.name.toLowerCase() as keyof typeof testResults]?.collections?.map(c => `${c.name} (${c.points_count})`).join(', ') || 'None'}
                                </span>
                              </div>
                            )}
                            {testResults[service.name.toLowerCase() as keyof typeof testResults]?.error && (
                              <div className="text-red-400">{testResults[service.name.toLowerCase() as keyof typeof testResults]?.error}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Marker OCR Service */}
                    <div className="bg-dark-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Server className="w-5 h-5 text-dark-400" />
                          <span className="font-medium text-white">Marker OCR</span>
                        </div>
                        {testResults.marker?.status === 'connected' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {testResults.marker?.status === 'not_configured' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                        {testResults.marker?.status === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                      </div>
                      {testResults.marker?.url && (
                        <p className="text-xs text-dark-500 truncate mb-1">{testResults.marker.url}</p>
                      )}
                      {testResults.marker?.message && (
                        <p className="text-xs text-dark-400 mb-2">{testResults.marker.message}</p>
                      )}
                      {testResults.marker?.error && (
                        <p className="text-xs text-red-400 truncate mb-2">{testResults.marker.error}</p>
                      )}
                      <button
                        onClick={() => testService('marker')}
                        disabled={testing.marker}
                        className="mt-2 w-full px-2 py-1 bg-dark-700 hover:bg-dark-600 text-xs text-dark-300 rounded disabled:opacity-50"
                      >
                        {testing.marker ? 'Testing...' : 'Test OCR Service'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-medium text-white mb-4">
                      Workspaces & RAG Collections
                      <span className="ml-2 text-sm font-normal text-dark-400">
                        ({overview.total_rag_collections} collections)
                      </span>
                    </h2>
                    <div className="bg-dark-800 rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-dark-700">
                            <th className="text-center px-4 py-3 text-sm font-medium text-dark-400">Pin</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Workspace</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Owner</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Documents</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">RAG Status</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overview.workspaces.map((ws) => (
                            <tr key={ws.id} className="border-b border-dark-700 last:border-0">
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={ws.admin_pinned}
                                  onChange={() => handleTogglePin(ws.id)}
                                  className="w-4 h-4 rounded bg-dark-700 border-dark-600 text-blue-600 cursor-pointer"
                                  title="Show in admin sidebar"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-white">{ws.name}</td>
                              <td className="px-4 py-3 text-sm text-dark-300">{ws.owner_email}</td>
                              <td className="px-4 py-3 text-sm text-dark-300">
                                {ws.embedded_count}/{ws.document_count} embedded
                              </td>
                              <td className="px-4 py-3">
                                {ws.has_rag_collection ? (
                                  <span className="flex items-center gap-1 text-xs text-green-400">
                                    <CheckCircle className="w-3 h-3" /> Active
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs text-dark-500">
                                    <XCircle className="w-3 h-3" /> None
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-dark-300">
                                {ws.rag_points > 0 ? ws.rag_points.toLocaleString() : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'stats' && stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="bg-dark-800 rounded-xl p-4">
                    <p className="text-dark-400 text-sm">Users</p>
                    <p className="text-2xl font-bold text-white">{stats.total_users}</p>
                  </div>
                  <div className="bg-dark-800 rounded-xl p-4">
                    <p className="text-dark-400 text-sm">Workspaces</p>
                    <p className="text-2xl font-bold text-white">{stats.total_workspaces}</p>
                  </div>
                  <div className="bg-dark-800 rounded-xl p-4">
                    <p className="text-dark-400 text-sm">Chats</p>
                    <p className="text-2xl font-bold text-white">{stats.total_chats}</p>
                  </div>
                  <div className="bg-dark-800 rounded-xl p-4">
                    <p className="text-dark-400 text-sm">Messages</p>
                    <p className="text-2xl font-bold text-white">{stats.total_messages}</p>
                  </div>
                  <div className="bg-dark-800 rounded-xl p-4">
                    <p className="text-dark-400 text-sm">Logged Interactions</p>
                    <p className="text-2xl font-bold text-white">{stats.total_logs}</p>
                  </div>
                </div>
              )}

              {tab === 'users' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-white">Users</h2>
                    <button
                      onClick={() => setShowNewUser(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Add User
                    </button>
                  </div>

                  {showNewUser && (
                    <div className="bg-dark-800 rounded-xl p-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="email"
                          placeholder="Email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={newUser.password}
                          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                          className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Name"
                          value={newUser.name}
                          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                          className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
                        />
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className="px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={handleCreateUser}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => setShowNewUser(false)}
                          className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="bg-dark-800 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-dark-700">
                          <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Email</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Name</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Role</th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-dark-400">Created</th>
                          <th className="w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-dark-700 last:border-0">
                            <td className="px-4 py-3 text-sm text-white">{user.email}</td>
                            <td className="px-4 py-3 text-sm text-dark-300">{user.name || '-'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs px-2 py-1 rounded ${
                                  user.role === 'admin'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-dark-600 text-dark-300'
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-dark-400">
                              {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1 text-dark-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'logs' && (
                <div>
                  <h2 className="text-lg font-medium text-white mb-4">Chat Logs</h2>
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="bg-dark-800 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-dark-500">
                            User #{log.user_id} • {new Date(log.created_at).toLocaleString()}
                            {log.latency_ms && ` • ${log.latency_ms.toFixed(0)}ms`}
                          </span>
                        </div>
                        <div className="mb-3">
                          <p className="text-xs text-dark-400 mb-1">Prompt:</p>
                          <p className="text-sm text-white bg-dark-700 rounded p-2">
                            {log.prompt.length > 200 ? log.prompt.slice(0, 200) + '...' : log.prompt}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-dark-400 mb-1">Response:</p>
                          <p className="text-sm text-dark-300 bg-dark-700 rounded p-2">
                            {log.response.length > 300 ? log.response.slice(0, 300) + '...' : log.response}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
