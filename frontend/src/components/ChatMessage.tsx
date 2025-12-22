import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, ChevronDown, ChevronUp, Globe, ExternalLink, StickyNote } from 'lucide-react'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  onSendToNotes?: (content: string) => void
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg overflow-hidden my-4">
      <div className="flex items-center justify-between bg-dark-700 px-4 py-2 text-xs">
        <span className="text-dark-300 uppercase font-medium">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-dark-400 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: '1rem',
          fontSize: '0.875rem',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
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

function SourcesSection({ sources }: { sources: string }) {
  const lines = sources.split('\n').filter(line => line.trim())
  
  return (
    <div className="mt-4 pt-3 border-t border-dark-700">
      <div className="flex items-center gap-2 text-xs text-dark-400 mb-2">
        <Globe className="w-3.5 h-3.5" />
        <span className="font-medium uppercase tracking-wide">Källor</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {lines.map((line, idx) => {
          const cleanLine = line.replace(/^[🔍\-\*•]\s*/, '').trim()
          if (!cleanLine) return null
          
          return (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-dark-800 hover:bg-dark-700 rounded-full text-xs text-dark-300 transition-colors cursor-default"
            >
              <ExternalLink className="w-3 h-3 text-dark-500" />
              <span>{cleanLine}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ChatMessage({ role, content, onSendToNotes }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [sentToNotes, setSentToNotes] = useState(false)
  const isUser = role === 'user'

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

  // Split content into main content and sources section
  const hasSourcesSection = content.includes('---') && content.toLowerCase().includes('källor')
  let mainContent = content
  let sourcesContent = ''
  
  if (hasSourcesSection) {
    const parts = content.split(/\n---\n/)
    if (parts.length >= 2) {
      mainContent = parts[0]
      // Find the Källor section in remaining parts
      const sourcePart = parts.slice(1).join('\n---\n')
      const källorMatch = sourcePart.match(/källor[:\s]*([\s\S]*)/i)
      if (källorMatch) {
        sourcesContent = källorMatch[1].trim()
      }
    }
  }

  return (
    <div className="py-3 px-4">
      <div className="max-w-3xl mx-auto">
        {isUser ? (
          <UserMessage content={content} />
        ) : (
          <div className="group">
            <div className="prose prose-invert prose-sm max-w-none">
              {content ? (
                <ReactMarkdown
                  components={{
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || '')
                      const codeString = String(children).replace(/\n$/, '')
                      
                      if (match) {
                        return <CodeBlock language={match[1]}>{codeString}</CodeBlock>
                      }
                      
                      return (
                        <code
                          className="bg-dark-700 px-1.5 py-0.5 rounded text-sm"
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    },
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 underline transition-colors"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {mainContent}
                </ReactMarkdown>
              ) : (
                <span className="inline-block w-2 h-4 bg-dark-400 animate-pulse" />
              )}
            </div>
            
            {sourcesContent && <SourcesSection sources={sourcesContent} />}
            
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
