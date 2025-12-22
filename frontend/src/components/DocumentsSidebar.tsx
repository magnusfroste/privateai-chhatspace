import { useState, useEffect, useRef } from 'react'
import { api, Document } from '../lib/api'
import { 
  Database, 
  Trash2, 
  X, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Upload,
  FileText
} from 'lucide-react'

interface DocumentsSidebarProps {
  workspaceId: number
  isOpen: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onClose: () => void
  refreshTrigger?: number
  rightOffset?: number
}

export default function DocumentsSidebar({ workspaceId, isOpen, isExpanded, onToggleExpand, onClose, refreshTrigger, rightOffset = 0 }: DocumentsSidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null)
  const [docContent, setDocContent] = useState<string>('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadDocuments()
    }
  }, [workspaceId, isOpen, refreshTrigger])

  const loadDocuments = async () => {
    try {
      const data = await api.documents.list(workspaceId)
      setDocuments(data)
    } catch (err) {
      console.error('Failed to load documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this document? It will also be removed from RAG.')) return
    try {
      await api.documents.delete(id)
      setDocuments(docs => docs.filter(d => d.id !== id))
      if (viewingDoc?.id === id) {
        setViewingDoc(null)
        setDocContent('')
      }
    } catch (err) {
      console.error('Failed to delete document:', err)
      alert('Failed to delete document')
    }
  }

  const handleView = async (doc: Document) => {
    setViewingDoc(doc)
    setLoadingContent(true)
    try {
      const result = await api.documents.getContent(doc.id)
      setDocContent(result.content)
    } catch (err) {
      console.error('Failed to load document content:', err)
      setDocContent('Failed to load document content')
    } finally {
      setLoadingContent(false)
    }
  }

  const handleDownload = (doc: Document) => {
    // Create download link for original file
    const link = document.createElement('a')
    link.href = `/api/documents/${doc.id}/download`
    link.download = doc.original_filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const closeViewer = () => {
    setViewingDoc(null)
    setDocContent('')
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    
    setUploading(true)
    try {
      // Upload files sequentially to avoid overwhelming the server
      for (const file of Array.from(files)) {
        try {
          // Upload document
          const uploadedDoc = await api.documents.upload(workspaceId, file)
          
          // Add to documents list immediately
          setDocuments(prev => [uploadedDoc, ...prev])
          
          // Automatically embed to RAG in background
          api.documents.embed(uploadedDoc.id).then(updated => {
            setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d))
          }).catch(err => {
            console.error('Failed to embed document:', err)
          })
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err)
          alert(`Failed to upload ${file.name}`)
        }
      }
      
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUpload(e.target.files)
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
          <Database className="w-5 h-5 text-green-400" />
          {isExpanded && <h2 className="text-lg font-medium text-white">RAG Database</h2>}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-dark-400 hover:text-green-400 hover:bg-dark-700 rounded-lg transition-colors disabled:opacity-50"
            title="Upload documents (auto-embedded to RAG)"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && viewingDoc ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
            <h3 className="text-sm font-medium text-white truncate flex-1">{viewingDoc.original_filename}</h3>
            <button
              onClick={closeViewer}
              className="flex items-center gap-1 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-white text-sm rounded"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {loadingContent ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-dark-400" />
              </div>
            ) : (
              <div className="bg-dark-900 border border-dark-600 rounded p-4">
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-dark-200 text-sm font-mono">{docContent}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-dark-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-dark-500">
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-50" />
              {isExpanded && (
                <>
                  <p>No documents yet</p>
                  <p className="text-sm mt-1">Click Upload to add PDFs</p>
                  <p className="text-xs mt-2 text-dark-600">Auto-embedded to RAG</p>
                </>
              )}
            </div>
          ) : (
            documents.map(doc => (
              <div
                key={doc.id}
                className="bg-dark-900 rounded-lg p-2 border border-dark-700 hover:border-dark-600 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white text-sm flex-1 truncate">{doc.original_filename}</h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleView(doc)}
                          className="p-1 text-dark-400 hover:text-blue-400 hover:bg-dark-800 rounded"
                          title="View document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1 text-dark-400 hover:text-green-400 hover:bg-dark-800 rounded"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded"
                          title="Delete (removes from RAG)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {doc.is_embedded ? (
                        <span className="text-green-400">✓ Embedded</span>
                      ) : (
                        <span className="text-dark-500">Not embedded</span>
                      )}
                      <span className="text-dark-500">•</span>
                      <span className="text-dark-500">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </>
                ) : (
                  <div 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => {
                      if (!isExpanded) {
                        onToggleExpand()
                      }
                      handleView(doc)
                    }}
                  >
                    <FileText className={`w-4 h-4 flex-shrink-0 ${doc.is_embedded ? 'text-green-400' : 'text-dark-400'}`} />
                    <p className="text-xs text-white truncate">{doc.original_filename}</p>
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
