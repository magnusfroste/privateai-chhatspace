import { useState, useEffect } from 'react'
import { api, Note } from '../lib/api'
import { 
  StickyNote, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  FileText
} from 'lucide-react'

interface NotesSidebarProps {
  workspaceId: number
  isOpen: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  refreshTrigger?: number
  onAttachToChat?: (content: string) => void
}

export default function NotesSidebar({ workspaceId, isOpen, isExpanded, onToggleExpand, onClose, refreshTrigger, onAttachToChat }: NotesSidebarProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [transforming, setTransforming] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadNotes()
    }
  }, [workspaceId, isOpen, refreshTrigger])

  const loadNotes = async () => {
    try {
      const data = await api.notes.list(workspaceId)
      setNotes(data)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }

  const generateTitle = (content: string): string => {
    const cleaned = content.trim().replace(/\n/g, ' ')
    return cleaned.substring(0, 50) || 'New Note'
  }

  const handleCreate = async () => {
    try {
      const newNote = await api.notes.create({
        workspace_id: workspaceId,
        title: 'New Note',
        content: ''
      })
      setNotes([newNote, ...notes])
      setEditingId(newNote.id)
      setEditContent(newNote.content)
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  const handleSave = async (id: number) => {
    try {
      const autoTitle = generateTitle(editContent)
      const updated = await api.notes.update(id, {
        title: autoTitle,
        content: editContent
      })
      setNotes(notes.map(n => n.id === id ? updated : n))
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save note:', err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this note?')) return
    try {
      await api.notes.delete(id)
      setNotes(notes.filter(n => n.id !== id))
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  const handleTransform = async (action: 'expand' | 'improve' | 'summarize' | 'continue' | 'translate') => {
    if (!editingId) return
    setTransforming(true)
    try {
      const result = await api.notes.transform(editingId, action)
      setEditContent(result.transformed)
    } catch (err) {
      console.error('Failed to transform note:', err)
      alert('Transformation failed')
    } finally {
      setTransforming(false)
    }
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id)
    setEditContent(note.content)
  }

  const handleNoteClick = (note: Note) => {
    if (!isExpanded) {
      onToggleExpand()
    }
    startEdit(note)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleDownload = (note: Note) => {
    const blob = new Blob([note.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleAttachToChat = async (note: Note) => {
    if (onAttachToChat) {
      const noteMessage = `[Note: ${note.title}]\n\n${note.content}`
      onAttachToChat(noteMessage)
    }
  }

  const handleAttachToRAG = async (note: Note) => {
    try {
      // Create a markdown file blob and upload as document
      const blob = new Blob([note.content], { type: 'text/markdown' })
      const file = new File([blob], `${note.title}.md`, { type: 'text/markdown' })
      
      // Upload to documents
      await api.documents.upload(workspaceId, file)
      alert(`"${note.title}" added to workspace documents!`)
    } catch (err) {
      console.error('Failed to attach to RAG:', err)
      alert('Failed to add note to documents')
    }
  }

  if (!isOpen) return null

  const width = isExpanded ? 'w-[800px]' : 'w-64'

  return (
    <div className={`fixed right-0 top-0 h-full ${width} bg-dark-800 border-l border-dark-700 flex flex-col z-40 transition-all duration-300`}>
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
          <StickyNote className="w-5 h-5 text-blue-400" />
          {isExpanded && <h2 className="text-lg font-medium text-white">Notes</h2>}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              onClick={handleCreate}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
              title="New Note"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && editingId ? (
        <div className="flex-1 flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-dark-400">Editing Note</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(editingId)}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded text-white text-sm focus:outline-none focus:border-blue-500 resize-none font-mono"
              placeholder="Write your note..."
            />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-dark-500">AI Transform:</span>
              {(['expand', 'improve', 'summarize', 'continue', 'translate'] as const).map(action => (
                <button
                  key={action}
                  onClick={() => handleTransform(action)}
                  disabled={transforming}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-dark-700 hover:bg-dark-600 text-white rounded disabled:opacity-50 capitalize"
                >
                  {transforming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-dark-400" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
              {isExpanded && (
                <>
                  <p>No notes yet</p>
                  <p className="text-sm mt-1">Click + to create one</p>
                </>
              )}
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note.id}
                className="bg-dark-900 rounded-lg p-2 border border-dark-700 hover:border-dark-600 cursor-pointer transition-colors"
                onClick={() => handleNoteClick(note)}
              >
                {isExpanded ? (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white text-sm flex-1">{note.title}</h3>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(note)
                          }}
                          className="p-1 text-dark-400 hover:text-blue-400 hover:bg-dark-800 rounded"
                          title="Download as .md"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAttachToChat(note)
                          }}
                          className="p-1 text-dark-400 hover:text-green-400 hover:bg-dark-800 rounded"
                          title="Attach to Chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAttachToRAG(note)
                          }}
                          className="p-1 text-dark-400 hover:text-purple-400 hover:bg-dark-800 rounded"
                          title="Add to RAG Documents"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(note.id)
                          }}
                          className="p-1 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-dark-300 whitespace-pre-wrap line-clamp-3">{note.content}</p>
                    <p className="text-xs text-dark-500 mt-2">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <p className="text-xs text-white truncate">{note.title}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
