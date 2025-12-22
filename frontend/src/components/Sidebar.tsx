import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useWorkspaceStore } from '../store/workspace'
import { api } from '../lib/api'
import {
  MessageSquare,
  FolderOpen,
  LogOut,
  Settings,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
  X,
  Plus,
  MoreVertical,
  ChevronLeft,
  Menu,
} from 'lucide-react'

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuthStore()
  const {
    workspaces,
    currentWorkspace,
    chats,
    currentChat,
    setWorkspaces,
    setCurrentWorkspace,
    setChats,
    setCurrentChat,
    addWorkspace,
    removeChat,
    removeWorkspace,
  } = useWorkspaceStore()

  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<number>>(new Set())
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [editingChatId, setEditingChatId] = useState<number | null>(null)
  const [editingChatTitle, setEditingChatTitle] = useState('')
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<number | null>(null)
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    loadWorkspaces()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null)
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  useEffect(() => {
    if (currentWorkspace) {
      loadChats(currentWorkspace.id)
      setExpandedWorkspaces((prev) => new Set([...prev, currentWorkspace.id]))
    }
  }, [currentWorkspace?.id])

  const loadWorkspaces = async () => {
    try {
      const data = await api.workspaces.list()
      setWorkspaces(data)
      if (data.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(data[0])
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    }
  }

  const loadChats = async (workspaceId: number) => {
    try {
      const data = await api.chats.list(workspaceId)
      setChats(data)
    } catch (err) {
      console.error('Failed to load chats:', err)
    }
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || isCreatingWorkspace) return
    setIsCreatingWorkspace(true)
    try {
      const workspace = await api.workspaces.create({ name: newWorkspaceName })
      addWorkspace(workspace)
      setCurrentWorkspace(workspace)
      setExpandedWorkspaces((prev) => new Set([...prev, workspace.id]))
      setNewWorkspaceName('')
      setShowNewWorkspace(false)
    } catch (err) {
      console.error('Failed to create workspace:', err)
    } finally {
      setIsCreatingWorkspace(false)
    }
  }

  const handleDeleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.chats.delete(chatId)
      removeChat(chatId)
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  }

  const handleDeleteWorkspace = async (workspaceId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this workspace and all its chats?')) return
    try {
      await api.workspaces.delete(workspaceId)
      removeWorkspace(workspaceId)
    } catch (err) {
      console.error('Failed to delete workspace:', err)
    }
  }

  const handleRenameChat = async (chatId: number) => {
    if (!editingChatTitle.trim()) {
      setEditingChatId(null)
      return
    }
    try {
      const updated = await api.chats.update(chatId, { title: editingChatTitle })
      setChats(chats.map(c => c.id === chatId ? updated : c))
      if (currentChat?.id === chatId) {
        setCurrentChat(updated)
      }
    } catch (err) {
      console.error('Failed to rename chat:', err)
    }
    setEditingChatId(null)
  }

  const handleRenameWorkspace = async (workspaceId: number) => {
    if (!editingWorkspaceName.trim()) {
      setEditingWorkspaceId(null)
      return
    }
    try {
      const updated = await api.workspaces.update(workspaceId, { name: editingWorkspaceName })
      setWorkspaces(workspaces.map(w => w.id === workspaceId ? updated : w))
      if (currentWorkspace?.id === workspaceId) {
        setCurrentWorkspace(updated)
      }
    } catch (err) {
      console.error('Failed to rename workspace:', err)
    }
    setEditingWorkspaceId(null)
  }

  const toggleWorkspace = (workspaceId: number) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev)
      if (next.has(workspaceId)) {
        next.delete(workspaceId)
      } else {
        next.add(workspaceId)
      }
      return next
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-dark-950 border-r border-dark-700 flex flex-col h-full transition-all duration-300`}>
      <div className="p-4 border-b border-dark-700 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-xl font-bold text-white">AutoVersio</h1>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {!isCollapsed && (
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-medium text-dark-400 uppercase">
              Workspaces
            </span>
            <button
              onClick={() => setShowNewWorkspace(true)}
              className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {showNewWorkspace && (
          <div className="mb-2 p-2 bg-dark-800 rounded-lg">
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateWorkspace()}
              placeholder="Workspace name"
              className="w-full px-2 py-1 bg-dark-700 border border-dark-600 rounded text-sm text-white placeholder-dark-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCreateWorkspace}
                disabled={isCreatingWorkspace}
                className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm rounded"
              >
                {isCreatingWorkspace ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowNewWorkspace(false)}
                className="flex-1 px-2 py-1 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {workspaces.map((workspace) => (
          <div key={workspace.id} className="mb-1 group/ws">
            <div className="flex items-center">
              {editingWorkspaceId === workspace.id && !isCollapsed ? (
                <div className="flex-1 flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    value={editingWorkspaceName}
                    onChange={(e) => setEditingWorkspaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameWorkspace(workspace.id)
                      if (e.key === 'Escape') setEditingWorkspaceId(null)
                    }}
                    className="flex-1 px-2 py-1 bg-dark-700 border border-dark-500 rounded text-sm text-white"
                    autoFocus
                  />
                  <button
                    onClick={() => handleRenameWorkspace(workspace.id)}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingWorkspaceId(null)}
                    className="p-1 text-dark-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setCurrentWorkspace(workspace)
                      setCurrentChat(null)
                      if (!isCollapsed) {
                        toggleWorkspace(workspace.id)
                      }
                    }}
                    className={`flex-1 flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} px-2 py-2 rounded-lg text-left transition-colors ${
                      currentWorkspace?.id === workspace.id
                        ? 'bg-dark-700 text-white'
                        : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                    }`}
                    title={isCollapsed ? workspace.name : undefined}
                  >
                    {!isCollapsed && (expandedWorkspaces.has(workspace.id) ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" />
                    ))}
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span className="truncate text-sm">{workspace.name}</span>}
                  </button>
                  {!isCollapsed && (
                    <div className="relative flex-shrink-0 opacity-0 group-hover/ws:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === `ws-${workspace.id}` ? null : `ws-${workspace.id}`)
                        }}
                        className="p-1 text-dark-400 hover:text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === `ws-${workspace.id}` && (
                        <div className="absolute right-0 top-6 z-50 bg-dark-700 border border-dark-600 rounded-lg shadow-lg py-1 min-w-[120px]">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingWorkspaceId(workspace.id)
                              setEditingWorkspaceName(workspace.name)
                              setOpenMenuId(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-600 hover:text-white"
                          >
                            <Pencil className="w-4 h-4" />
                            Rename
                          </button>
                          <button
                            onClick={(e) => {
                              handleDeleteWorkspace(workspace.id, e)
                              setOpenMenuId(null)
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-dark-600"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {!isCollapsed && expandedWorkspaces.has(workspace.id) &&
              currentWorkspace?.id === workspace.id && chats.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                  {chats.map((chat) => (
                    <div key={chat.id} className="group">
                      {editingChatId === chat.id ? (
                        <div className="flex items-center gap-1 px-2 py-1">
                          <input
                            type="text"
                            value={editingChatTitle}
                            onChange={(e) => setEditingChatTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameChat(chat.id)
                              if (e.key === 'Escape') setEditingChatId(null)
                            }}
                            className="flex-1 px-1 py-0.5 bg-dark-700 border border-dark-500 rounded text-sm text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenameChat(chat.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingChatId(null)}
                            className="p-1 text-dark-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => setCurrentChat(chat)}
                          className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm cursor-pointer ${
                            currentChat?.id === chat.id
                              ? 'bg-dark-600 text-white'
                              : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <MessageSquare className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{chat.title}</span>
                          </div>
                          <div className="relative flex-shrink-0 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === chat.id ? null : chat.id)
                              }}
                              className="p-1 text-dark-400 hover:text-white"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {openMenuId === chat.id && (
                              <div className="absolute right-0 top-6 z-50 bg-dark-700 border border-dark-600 rounded-lg shadow-lg py-1 min-w-[120px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingChatId(chat.id)
                                    setEditingChatTitle(chat.title)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-600 hover:text-white"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => {
                                    handleDeleteChat(chat.id, e)
                                    setOpenMenuId(null)
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-dark-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-dark-700">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            {isAdmin() && (
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg"
                title="Admin Panel"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <>
            {isAdmin() && (
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-2 px-3 py-2 text-dark-300 hover:text-white hover:bg-dark-800 rounded-lg text-sm"
              >
                <Settings className="w-4 h-4" />
                Admin Panel
              </button>
            )}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-dark-400 truncate">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="p-1 text-dark-400 hover:text-white"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 py-1">
              <span className="text-[10px] text-dark-600">v2024-12-21 19:58</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
