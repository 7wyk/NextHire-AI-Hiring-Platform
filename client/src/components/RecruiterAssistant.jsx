import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Loader2 } from 'lucide-react'
import { useAgentStore } from '../store/agentStore'

const SUGGESTIONS = [
  'Which candidates scored highest?',
  'Summarise the pipeline for my latest job',
  'Rank candidates for my latest job',
  'Show me recent coding submissions',
]

export default function RecruiterAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const { chatMessages, chatLoading, sendChatMessage, clearChat } = useAgentStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || chatLoading) return
    setInput('')
    await sendChatMessage(msg)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {!open && (
        <button
          id="assistant-open"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-10 h-10 rounded-[9px] bg-ink-950 text-white flex items-center justify-center shadow-float hover:bg-ink-800 transition-colors"
          aria-label="Open the hiring assistant"
          title="Hiring assistant"
        >
          <MessageSquare size={16} strokeWidth={1.8} />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(368px,calc(100vw-32px))] h-[520px] max-h-[calc(100vh-40px)] rounded-panel border border-line bg-paper shadow-float flex flex-col overflow-hidden animate-rise-in">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line flex-shrink-0">
            <div>
              <p className="text-[13px] font-medium text-ink-900">Hiring assistant</p>
              <p className="text-[11px] text-ink-500">Runs on the agent system</p>
            </div>
            <div className="flex items-center gap-1">
              {chatMessages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-[11.5px] text-ink-500 hover:text-ink-900 px-2 py-1 rounded-md hover:bg-ink-50"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-50"
                aria-label="Close assistant"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {chatMessages.length === 0 && (
              <div>
                <p className="text-[13px] text-ink-800">Ask about your pipeline</p>
                <p className="text-[12px] text-ink-500 mt-0.5">
                  Answers come from your own candidates, jobs and submissions.
                </p>
                <div className="mt-3 space-y-1.5">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="block w-full text-left text-[12.5px] px-2.5 py-2 rounded-md border border-line text-ink-700 hover:bg-ink-50 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-[12.5px] leading-5 whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-50 text-ink-800 border border-line'
                  }`}
                >
                  {msg.content}
                  {msg.suggestions?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-line/70 space-y-1">
                      {msg.suggestions.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => { setInput(s); inputRef.current?.focus() }}
                          className="block text-left text-[11.5px] text-accent-600 hover:underline"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2 text-[12.5px] text-ink-500">
                <Loader2 size={13} className="animate-spin" />
                Working
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-line flex-shrink-0">
            <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/10">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about candidates or jobs"
                className="flex-1 bg-transparent text-[12.5px] text-ink-900 py-2 outline-none placeholder:text-ink-400"
                disabled={chatLoading}
                aria-label="Message"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatLoading}
                className="p-1.5 rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30"
                aria-label="Send"
              >
                <Send size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
