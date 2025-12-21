import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, X } from 'lucide-react'

export interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void
  disabled?: boolean
  placeholder?: string
}

export default function ChatInput({ onSend, disabled, placeholder = 'Send a message...' }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

  const handleSubmit = () => {
    if ((!message.trim() && attachedFiles.length === 0) || disabled) return
    onSend(message.trim(), attachedFiles)
    setMessage('')
    setAttachedFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Filter to only allow PDF, DOCX, TXT, MD files
    const allowedFiles = files.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ['pdf', 'docx', 'txt', 'md'].includes(ext || '')
    })
    setAttachedFiles(prev => [...prev, ...allowedFiles])
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-dark-700 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Attached files display */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-1 text-sm text-white"
              >
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-32">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-dark-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-end bg-dark-800 rounded-xl border border-dark-600 focus-within:border-dark-500">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-dark-500 px-4 py-3 resize-none focus:outline-none disabled:opacity-50"
          />

          {/* File upload button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-3 text-dark-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Attach files (PDF, DOCX, TXT, MD)"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <button
            onClick={handleSubmit}
            disabled={(!message.trim() && attachedFiles.length === 0) || disabled}
            className="p-3 text-dark-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-dark-500 text-center mt-2">
          Press Enter to send, Shift+Enter for new line • Supports PDF, DOCX, TXT, MD files
        </p>
      </div>
    </div>
  )
}
