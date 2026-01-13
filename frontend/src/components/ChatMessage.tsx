import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp, Globe, StickyNote, Database, FileText } from 'lucide-react'
import renderMarkdown from '../utils/renderMarkdown'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ num: number; filename?: string; title?: string; url?: string; type: 'rag' | 'web' }>
  onSendToNotes?: (content: string) => void
  onOpenSource?: (filename: string) => void
}

function UserMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  const lines = content.split('\n')
  const isLong = lines.length > 4 || content.length > 300
  
  const displayContent = expanded || !isLong 
    ? content 
    : lines.slice(0, 4).join('\n').slice(0, 300) + '...'

  return (
    <div className="flex justify-end">
      <div className="bg-blue-600 rounded-2xl px-4 py-2.5 max-w-[85%]">
        <p className="text-white whitespace-pre-wrap">{displayContent}</p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs text-blue-200 hover:text-white transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>Show more</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default function ChatMessage({ role, content, sources, onSendToNotes, onOpenSource }: ChatMessageProps) {
  const isUser = role === 'user'
  const [copied, setCopied] = useState(false)
  const [sentToNotes, setSentToNotes] = useState(false)

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendToNotes = () => {
    if (onSendToNotes) {
      onSendToNotes(content)
      setSentToNotes(true)
      setTimeout(() => setSentToNotes(false), 2000)
    }
  }

  return (
    <div className="py-3 px-4">
      <div className="max-w-5xl mx-auto">
        {isUser ? (
          <UserMessage content={content} />
        ) : (
          <div className="group">
            <div className="markdown-content">
              {content ? (
                <span
                  className="flex flex-col gap-y-1"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(content),
                  }}
                />
              ) : (
                <span className="inline-block w-2 h-4 bg-dark-400 animate-pulse" />
              )}
            </div>
            
            {sources && sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-dark-700">
                <div className="flex items-center gap-2 text-xs text-dark-400 mb-2">
                  {sources[0].type === 'web' ? (
                    <Globe className="w-3.5 h-3.5" />
                  ) : (
                    <Database className="w-3.5 h-3.5" />
                  )}
                  <span className="font-medium uppercase tracking-wide">
                    Sources ({sources[0].type === 'web' ? 'WEB' : 'RAG'})
                  </span>
                </div>
                <div className="space-y-1">
                  {sources.map((source) => (
                    <div key={source.num} className="flex items-start gap-2 text-xs text-dark-400">
                      <span className="flex-shrink-0 w-5 h-5 bg-dark-700 rounded flex items-center justify-center text-dark-300 font-medium">
                        {source.num}
                      </span>
                      {source.type === 'web' ? (
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {source.title}
                        </a>
                      ) : (
                        <button
                          onClick={() => onOpenSource?.(source.filename || '')}
                          className="flex-1 text-left hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          {source.filename}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {content && (
              <div className="mt-2 opacity-0 group-hover:opacity-100 flex items-center gap-3">
                <button
                  onClick={handleCopyMessage}
                  className="flex items-center gap-1 text-xs text-dark-500 hover:text-dark-300 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                
                {onSendToNotes && (
                  <button
                    onClick={handleSendToNotes}
                    className="flex items-center gap-1 text-xs text-dark-500 hover:text-blue-400 transition-all"
                  >
                    {sentToNotes ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <StickyNote className="w-3 h-3" />
                        <span>Send to Notes</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
