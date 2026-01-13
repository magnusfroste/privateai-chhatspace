import { X, FileText, Globe } from 'lucide-react'

interface SourceModalProps {
  isOpen: boolean
  onClose: () => void
  source: {
    num: number
    filename?: string
    title?: string
    url?: string
    type: 'rag' | 'web'
    content?: string
  }
}

export default function SourceModal({ isOpen, onClose, source }: SourceModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-800 rounded-xl border border-dark-600 max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-sm font-medium text-dark-300">
              {source.num}
            </div>
            <div className="flex items-center gap-2">
              {source.type === 'web' ? (
                <Globe className="w-4 h-4 text-blue-400" />
              ) : (
                <FileText className="w-4 h-4 text-green-400" />
              )}
              <span className="text-white font-medium">
                {source.title || source.filename}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {source.type === 'web' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-dark-400">
                <Globe className="w-4 h-4" />
                <span>Web Source</span>
              </div>
              {source.url && (
                <div>
                  <span className="text-xs text-dark-400">URL:</span>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-400 hover:text-blue-300 underline break-all"
                  >
                    {source.url}
                  </a>
                </div>
              )}
              {source.content && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div
                    className="text-dark-200 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: source.content }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-dark-400">
                <FileText className="w-4 h-4" />
                <span>Document Source</span>
              </div>
              <div className="text-sm text-dark-400">
                File: {source.filename}
              </div>
              {source.content && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div
                    className="text-dark-200 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: source.content }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
