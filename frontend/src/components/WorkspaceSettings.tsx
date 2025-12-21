import { useState } from 'react'
import { useWorkspaceStore } from '../store/workspace'
import { api, Workspace } from '../lib/api'

interface WorkspaceSettingsProps {
  workspace: Workspace
  onClose: () => void
}

export default function WorkspaceSettings({
  workspace,
  onClose,
}: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [systemPrompt, setSystemPrompt] = useState(workspace.system_prompt || '')
  const [chatMode, setChatMode] = useState<'chat' | 'query'>((workspace.chat_mode as 'chat' | 'query') || 'chat')
  const [topN, setTopN] = useState(workspace.top_n || 4)
  const [similarityThreshold, setSimilarityThreshold] = useState(workspace.similarity_threshold || 0.25)
  const [useHybridSearch, setUseHybridSearch] = useState(workspace.use_hybrid_search !== false)
  const [useWebSearch, setUseWebSearch] = useState(workspace.use_web_search === true)
  const [saving, setSaving] = useState(false)
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

  return (
    <div className="p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          placeholder="Optional description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-y"
          placeholder="Instructions for the AI assistant..."
        />
      </div>

      <div>
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
          <label className="block text-sm font-medium text-dark-300 mb-1">Top N</label>
          <input
            type="number"
            min="1"
            max="20"
            value={topN}
            onChange={(e) => setTopN(parseInt(e.target.value) || 4)}
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
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
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
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
          <p className="text-xs text-dark-500">Semantic + keyword search</p>
        </div>
      </label>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={useWebSearch}
          onChange={(e) => setUseWebSearch(e.target.checked)}
          className="w-4 h-4 rounded bg-dark-700 border-dark-600 text-blue-600"
        />
        <div>
          <span className="text-sm text-white">Web Search</span>
          <p className="text-xs text-dark-500">Use external search agent (n8n)</p>
        </div>
      </label>

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
