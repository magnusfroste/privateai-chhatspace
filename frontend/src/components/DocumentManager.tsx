import { useState, useEffect, useRef } from 'react'
import { api, Document } from '../lib/api'
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Check,
  Clock,
  Loader2,
  Database,
} from 'lucide-react'

interface DocumentManagerProps {
  workspaceId: number
}

export default function DocumentManager({ workspaceId }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [embedding, setEmbedding] = useState<number | null>(null)
  const [embeddingAll, setEmbeddingAll] = useState(false)
  const [qdrantStatus, setQdrantStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDocuments()
    checkQdrantStatus()
  }, [workspaceId])

  const checkQdrantStatus = async () => {
    try {
      const response = await fetch('/api/health/qdrant')
      if (response.ok) {
        setQdrantStatus('online')
      } else {
        setQdrantStatus('offline')
      }
    } catch {
      setQdrantStatus('offline')
    }
  }

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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const doc = await api.documents.upload(workspaceId, file)
      setDocuments([doc, ...documents])
    } catch (err) {
      console.error('Failed to upload document:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleEmbed = async (documentId: number) => {
    setEmbedding(documentId)
    try {
      const updated = await api.documents.embed(documentId)
      setDocuments(documents.map((d) => (d.id === documentId ? updated : d)))
    } catch (err) {
      console.error('Failed to embed document:', err)
    } finally {
      setEmbedding(null)
    }
  }

  const handleEmbedAll = async () => {
    setEmbeddingAll(true)
    try {
      await api.documents.embedAll(workspaceId)
      await loadDocuments()
    } catch (err) {
      console.error('Failed to embed all documents:', err)
    } finally {
      setEmbeddingAll(false)
    }
  }

  const handleDelete = async (documentId: number) => {
    try {
      await api.documents.delete(documentId)
      setDocuments(documents.filter((d) => d.id !== documentId))
    } catch (err) {
      console.error('Failed to delete document:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-dark-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            accept=".pdf,.txt,.md,.docx"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </button>
          {documents.length > 0 && (
            <button
              onClick={handleEmbedAll}
              disabled={embeddingAll || qdrantStatus !== 'online'}
              className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {embeddingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Embed All
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-dark-400" />
          <span className="text-xs text-dark-400">Qdrant:</span>
          {qdrantStatus === 'checking' ? (
            <Loader2 className="w-3 h-3 animate-spin text-dark-400" />
          ) : qdrantStatus === 'online' ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
              Offline
            </span>
          )}
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-8 text-dark-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No documents uploaded yet</p>
          <p className="text-sm">Upload PDF, TXT, MD, or DOCX files</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-dark-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {doc.original_filename}
                  </p>
                  <p className="text-xs text-dark-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.is_embedded ? (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <Check className="w-3 h-3" />
                    Embedded
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-dark-500">
                    <Clock className="w-3 h-3" />
                    Not embedded
                  </span>
                )}
                <button
                  onClick={() => handleEmbed(doc.id)}
                  disabled={embedding === doc.id}
                  className="p-1.5 text-dark-400 hover:text-blue-400 disabled:opacity-50"
                  title={doc.is_embedded ? 'Re-embed' : 'Embed'}
                >
                  {embedding === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-dark-400 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
