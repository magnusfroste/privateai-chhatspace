import { useState } from 'react'
import { useWorkspaceStore } from '../store/workspace'
import { api, Workspace } from '../lib/api'
import { 
  Settings, 
  X, 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Save,
  Loader2
} from 'lucide-react'

interface WorkspaceSettingsSidebarProps {
  workspace: Workspace
  isOpen: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  rightOffset?: number
}

export default function WorkspaceSettingsSidebar({
  workspace,
  isOpen,
  isExpanded,
  onToggleExpand,
  onClose,
  rightOffset = 0,
}: WorkspaceSettingsSidebarProps) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [systemPrompt, setSystemPrompt] = useState(workspace.system_prompt || '')
  const [chatMode, setChatMode] = useState<'chat' | 'query'>((workspace.chat_mode as 'chat' | 'query') || 'chat')
  const [topN, setTopN] = useState(workspace.top_n || 5)
  const [similarityThreshold, setSimilarityThreshold] = useState(workspace.similarity_threshold || 0.25)
  const [useHybridSearch, setUseHybridSearch] = useState(workspace.use_hybrid_search !== false)
  const [useWebSearch, setUseWebSearch] = useState(workspace.use_web_search === true)
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { setCurrentWorkspace, setWorkspaces, workspaces } = useWorkspaceStore()

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await api.workspaces.update(workspace.id, {
        name,
        description,
        system_prompt: systemPrompt,
        chat_mode: chatMode,
        top_n: topN,
        similarity_threshold: similarityThreshold,
        use_hybrid_search: useHybridSearch,
        use_web_search: useWebSearch,
      })
      setCurrentWorkspace(updated)
      setWorkspaces(workspaces.map((w) => (w.id === updated.id ? updated : w)))
      onClose()
    } catch (err) {
      console.error('Failed to update workspace:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const width = isExpanded ? 'w-[800px]' : 'w-64'

  return (
    <div 
      className={`fixed top-0 h-full ${width} bg-dark-800 border-l border-dark-700 flex flex-col z-40 transition-all duration-300`}
      style={{ right: `${rightOffset}px` }}
    >
      {/* Header */}
      <div className="h-14 border-b border-dark-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpand}
            className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <Settings className="w-5 h-5 text-blue-400" />
          {isExpanded && <h2 className="text-lg font-medium text-white">Workspace Settings</h2>}
        </div>
        <button
          onClick={onClose}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      {isExpanded ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 resize-y font-mono"
              placeholder="Instructions for the AI assistant..."
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.target.checked)}
              className="w-4 h-4 rounded bg-dark-700 border-dark-600 text-blue-600"
            />
            <div>
              <span className="text-sm text-white">Web Search</span>
              <p className="text-xs text-dark-500">Include real-time web results</p>
            </div>
          </label>

          {/* Advanced Settings - Collapsible */}
          <div className="border border-dark-600 rounded">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-dark-300 hover:text-white transition-colors"
            >
              <span>Advanced Settings</span>
              {showAdvanced ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            
            {showAdvanced && (
              <div className="px-3 pb-3 space-y-3 border-t border-dark-600">
                <div className="pt-3">
                  <label className="block text-sm font-medium text-dark-300 mb-2">Chat Mode</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={chatMode === 'chat'}
                        onChange={() => setChatMode('chat')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-white">Chat</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={chatMode === 'query'}
                        onChange={() => setChatMode('query')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-white">Query</span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-dark-500">
                    Chat: AI uses docs + knowledge. Query: Only docs.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Context Chunks</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={topN}
                      onChange={(e) => setTopN(parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-dark-500">Number of document chunks</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-1">Similarity</label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={similarityThreshold}
                      onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value) || 0.25)}
                      className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-dark-500">Minimum relevance score</p>
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useHybridSearch}
                    onChange={(e) => setUseHybridSearch(e.target.checked)}
                    className="w-4 h-4 rounded bg-dark-700 border-dark-600 text-blue-600"
                  />
                  <div>
                    <span className="text-sm text-white">Hybrid Search</span>
                    <p className="text-xs text-dark-500">Combine semantic + keyword search</p>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded transition-colors"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="text-center py-12 text-dark-500">
            <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-xs">Expand to edit</p>
          </div>
        </div>
      )}
    </div>
  )
}
