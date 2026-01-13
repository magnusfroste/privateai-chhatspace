import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth'
import { useWorkspaceStore } from '../store/workspace'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'
import ChatMessage from '../components/ChatMessage'
import ChatInput, { ChatInputHandle } from '../components/ChatInput'
import WorkspaceSettingsSidebar from '../components/WorkspaceSettingsSidebar'
import DocumentManager from '../components/DocumentManager'
import NotesSidebar from '../components/NotesSidebar'
import DocumentsSidebar from '../components/DocumentsSidebar'
import { HelpModal } from '../components/HelpModal'
import ToggleSwitch from '../components/ToggleSwitch'
import { showToast } from '../components/Toast'
import { Settings, Database, X, StickyNote, HelpCircle } from 'lucide-react'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{ num: number; filename?: string; title?: string; url?: string; type: 'rag' | 'web' }>
}

export default function Chat() {
  const { currentWorkspace, currentChat, addChat, setCurrentChat, setCurrentWorkspace } = useWorkspaceStore()
  const token = useAuthStore((state) => state.token)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [notesRefreshTrigger, setNotesRefreshTrigger] = useState(0)
  const [showDocsSidebar, setShowDocsSidebar] = useState(false)
  const [docsExpanded, setDocsExpanded] = useState(false)
  const [docsRefreshTrigger, setDocsRefreshTrigger] = useState(0)
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [useRag, setUseRag] = useState(true)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [hasEmbeddedDocs, setHasEmbeddedDocs] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const skipLoadMessagesRef = useRef(false)

  useEffect(() => {
    if (currentChat) {
      // Skip loading if we just created this chat (messages are being streamed)
      if (skipLoadMessagesRef.current) {
        skipLoadMessagesRef.current = false
        return
      }
      loadMessages()
    } else {
      setMessages([])
    }
  }, [currentChat?.id])

  useEffect(() => {
    if (currentWorkspace) {
      checkEmbeddedDocs()
      setUseWebSearch(currentWorkspace.use_web_search || false)
    } else {
      setHasEmbeddedDocs(false)
      setUseWebSearch(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (currentWorkspace) {
      checkEmbeddedDocs()
    }
  }, [docsRefreshTrigger, currentWorkspace?.id])

  const checkEmbeddedDocs = async () => {
    if (!currentWorkspace) return
    try {
      const docs = await api.documents.list(currentWorkspace.id)
      setHasEmbeddedDocs(docs.some(d => d.is_embedded))
    } catch (err) {
      setHasEmbeddedDocs(false)
    }
  }

  const loadMessages = async () => {
    if (!currentChat) return
    try {
      const data = await api.chats.getMessages(currentChat.id)
      setMessages(data)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  const handleSendToNotes = async (content: string) => {
    if (!currentWorkspace) return
    try {
      await api.notes.create({
        workspace_id: currentWorkspace.id,
        title: `Note from ${new Date().toLocaleDateString()}`,
        content: content
      })
      setShowNotes(true)
      setNotesRefreshTrigger(prev => prev + 1)
    } catch (err) {
      console.error('Failed to create note:', err)
      alert('Failed to save note')
    }
  }

  const handleAttachNoteToChat = (content: string) => {
    chatInputRef.current?.setMessage(content)
  }

  const handleOpenSource = (_filename: string) => {
    // Open documents sidebar and expand it to show the source
    setShowDocsSidebar(true)
    setDocsExpanded(true)
  }

  const handleToggleWebSearch = async () => {
    if (!currentWorkspace) return
    
    const newValue = !useWebSearch
    setUseWebSearch(newValue)
    
    try {
      const updated = await api.workspaces.update(currentWorkspace.id, {
        use_web_search: newValue
      })
      // Update workspace store so other components see the change
      setCurrentWorkspace(updated)
    } catch (err) {
      console.error('Failed to update web search setting:', err)
      setUseWebSearch(!newValue)
    }
  }

  const handleSend = async (content: string, files?: File[]) => {
    if (!currentChat || !token) return

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)

    const assistantMessage: Message = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      let response: Response
      
      if (files && files.length > 0) {
        // Use FormData when files are attached - use /upload endpoint
        const formData = new FormData()
        formData.append('content', content)
        formData.append('use_rag', useRag.toString())
        files.forEach((file) => {
          formData.append('files', file)
        })
        
        response = await fetch(`/api/chats/${currentChat.id}/messages/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      } else {
        // Use JSON for regular messages (no files)
        response = await fetch(`/api/chats/${currentChat.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content, use_rag: useRag }),
        })
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastIndex = updated.length - 1
                  if (updated[lastIndex]?.role === 'assistant') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: updated[lastIndex].content + data.content
                    }
                  }
                  return updated
                })
              }
              if (data.sources) {
                setMessages((prev) => {
                  const updated = [...prev]
                  const lastIndex = updated.length - 1
                  if (updated[lastIndex]?.role === 'assistant') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      sources: data.sources
                    }
                  }
                  return updated
                })
              }
              if (data.error) {
                console.error('Stream error:', data.error)
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
    } catch (err: any) {
      console.error('Failed to send message:', err)
      const errorMsg = err.message?.includes('timeout') 
        ? 'Request timed out. Please try again.'
        : err.message?.includes('network') 
          ? 'Network error. Check your connection.'
          : 'Failed to send message. Please try again.'
      showToast(errorMsg, 'error')
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.content !== ''))
    } finally {
      setIsStreaming(false)
    }
  }

  const handleLandingSend = async (content: string, files?: File[]) => {
    if (!currentWorkspace || !token) return
    
    // Create chat with title from first words of message
    const title = content.slice(0, 30) + (content.length > 30 ? '...' : '')
    try {
      const chat = await api.chats.create(currentWorkspace.id, title)
      addChat(chat)
      
      // Mark that we should skip loadMessages for this new chat
      skipLoadMessagesRef.current = true
      setCurrentChat(chat)
      
      // Wait for next render cycle before sending message
      await new Promise(resolve => setTimeout(resolve, 50))
      await handleSendToChat(chat.id, content, files)
    } catch (err) {
      console.error('Failed to create chat:', err)
    }
  }

  const handleSendToChat = async (chatId: number, content: string, files?: File[]) => {
    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content,
    }
    setMessages([userMessage])
    setIsStreaming(true)

    const assistantMessage: Message = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
    }
    setMessages((prev) => [...prev, assistantMessage])

    try {
      let response: Response
      
      if (files && files.length > 0) {
        // Use FormData when files are attached
        const formData = new FormData()
        formData.append('content', content)
        formData.append('use_rag', useRag.toString())
        files.forEach((file) => {
          formData.append('files', file)
        })
        
        response = await fetch(`/api/chats/${chatId}/messages/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        })
      } else {
        // Use JSON for regular messages
        response = await fetch(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content, use_rag: useRag }),
        })
      }

      if (!response.body) return

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.content) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + data.content }
                      : msg
                  )
                )
              }
              if (data.sources) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, sources: data.sources }
                      : msg
                  )
                )
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to send message:', err)
      const errorMsg = err.message?.includes('timeout') 
        ? 'Request timed out. Please try again.'
        : err.message?.includes('network') 
          ? 'Network error. Check your connection.'
          : 'Failed to send message. Please try again.'
      showToast(errorMsg, 'error')
      setMessages(prev => prev.filter(m => m.content !== ''))
    } finally {
      setIsStreaming(false)
    }
  }

  const notesWidth = showNotes ? (notesExpanded ? 800 : 256) : 0
  const docsWidth = showDocsSidebar ? (docsExpanded ? 800 : 256) : 0
  const settingsWidth = showSettingsSidebar ? (settingsExpanded ? 800 : 256) : 0
  const totalRightMargin = notesWidth + docsWidth + settingsWidth

  return (
    <div className="flex h-screen bg-dark-900">
      <Sidebar />

      <div 
        className="flex-1 flex flex-col transition-all duration-300"
        style={{ marginRight: `${totalRightMargin}px` }}
      >
        {currentWorkspace ? (
          <>
            <header className="h-14 border-b border-dark-700 flex items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-medium text-white">
                  {currentWorkspace.name}
                </h2>
                {currentChat && (
                  <span className="text-dark-400 text-sm">
                    / {currentChat.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasEmbeddedDocs && (
                  <ToggleSwitch
                    enabled={useRag}
                    onChange={setUseRag}
                    label="RAG"
                  />
                )}
                <ToggleSwitch
                  enabled={useWebSearch}
                  onChange={() => handleToggleWebSearch()}
                  label="Web"
                />
                <button
                  onClick={() => setShowNotes(!showNotes)}
                  className={`p-2 hover:bg-dark-700 rounded-lg transition-colors ${
                    showNotes ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
                  }`}
                  title="Notes"
                >
                  <StickyNote className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDocsSidebar(!showDocsSidebar)}
                  className={`p-2 hover:bg-dark-700 rounded-lg transition-colors ${
                    showDocsSidebar 
                      ? 'bg-dark-700 text-white' 
                      : hasEmbeddedDocs 
                        ? 'text-green-400' 
                        : 'text-dark-400 hover:text-white'
                  }`}
                  title={hasEmbeddedDocs ? 'RAG Database (embedded)' : 'RAG Database'}
                >
                  <Database className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowSettingsSidebar(!showSettingsSidebar)}
                  className={`p-2 hover:bg-dark-700 rounded-lg transition-colors ${
                    showSettingsSidebar ? 'bg-dark-700 text-white' : 'text-dark-400 hover:text-white'
                  }`}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowHelpModal(true)}
                  className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-dark-400 hover:text-white"
                  title="Help & Guide"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              {currentChat ? (
                <div className="max-w-3xl mx-auto py-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-20">
                      <h3 className="text-xl font-medium text-white mb-2">
                        Start a conversation
                      </h3>
                      <p className="text-dark-400">
                        Send a message to begin chatting
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        sources={msg.sources}
                        onSendToNotes={msg.role === 'assistant' ? handleSendToNotes : undefined}
                        onOpenSource={handleOpenSource}
                      />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <h1 className="text-4xl font-bold text-white mb-8">
                    {currentWorkspace.name}
                  </h1>
                  <div className="w-full max-w-2xl">
                    <ChatInput onSend={handleLandingSend} disabled={isStreaming} placeholder="What do you want to know?" />
                  </div>
                </div>
              )}
            </div>

            {currentChat && (
              <ChatInput ref={chatInputRef} onSend={handleSend} disabled={isStreaming} />
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-xl font-medium text-white mb-2">
                Welcome to Private AI
              </h3>
              <p className="text-dark-400">
                Select or create a workspace to get started
              </p>
            </div>
          </div>
        )}
      </div>

      {showDocuments && currentWorkspace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h3 className="text-lg font-medium text-white">Documents</h3>
              <button
                onClick={() => {
                  setShowDocuments(false)
                  checkEmbeddedDocs()
                }}
                className="p-1 text-dark-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <DocumentManager workspaceId={currentWorkspace.id} />
          </div>
        </div>
      )}

      {currentWorkspace && (
        <NotesSidebar
          workspaceId={currentWorkspace.id}
          isOpen={showNotes}
          isExpanded={notesExpanded}
          onToggleExpand={() => setNotesExpanded(!notesExpanded)}
          onClose={() => setShowNotes(false)}
          refreshTrigger={notesRefreshTrigger}
          onAttachToChat={handleAttachNoteToChat}
          rightOffset={docsWidth + settingsWidth}
        />
      )}

      {currentWorkspace && (
        <DocumentsSidebar
          workspaceId={currentWorkspace.id}
          isOpen={showDocsSidebar}
          isExpanded={docsExpanded}
          onToggleExpand={() => setDocsExpanded(!docsExpanded)}
          onClose={() => setShowDocsSidebar(false)}
          refreshTrigger={docsRefreshTrigger}
          rightOffset={settingsWidth}
          onDocumentChange={() => setDocsRefreshTrigger((prev: number) => prev + 1)}
        />
      )}

      {currentWorkspace && (
        <WorkspaceSettingsSidebar
          workspace={currentWorkspace}
          isOpen={showSettingsSidebar}
          isExpanded={settingsExpanded}
          onToggleExpand={() => setSettingsExpanded(!settingsExpanded)}
          onClose={() => setShowSettingsSidebar(false)}
          rightOffset={0}
        />
      )}

      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </div>
  )
}
