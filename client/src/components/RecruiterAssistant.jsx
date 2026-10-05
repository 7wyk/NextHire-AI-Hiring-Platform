import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Send, X, Sparkles, Loader2, ChevronDown } from 'lucide-react'
import { useAgentStore } from '../store/agentStore'

/**
 * RecruiterAssistant.jsx
 *
 * Floating AI chat widget for recruiters.
 * Natural language interface to the agent system.
 */
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

  const suggestions = [
    'Find best candidates for my latest job',
    'Rank candidates by score',
    'Generate a coding test',
    'Show me hiring analytics',
  ]

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 shadow-2xl shadow-primary-900/50 flex items-center justify-center text-white hover:shadow-primary-800/60 transition-shadow"
          >
            <Bot className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-surface-800 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[560px] rounded-2xl border border-white/10 bg-surface-800/95 backdrop-blur-xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] bg-gradient-to-r from-primary-600/10 to-accent-600/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-sm font-semibold">AI Hiring Assistant</h3>
                  <p className="text-primary-400 text-[10px] font-medium">Powered by Agent System</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors text-xs"
                  title="Clear chat"
                >
                  Clear
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center pt-8 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center mx-auto">
                    <Bot className="w-7 h-7 text-primary-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">How can I help?</p>
                    <p className="text-slate-400 text-xs mt-1">Ask me anything about your recruitment pipeline.</p>
                  </div>
                  <div className="space-y-2 pt-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(s); inputRef.current?.focus() }}
                        className="block w-full text-left text-xs px-4 py-2.5 rounded-xl bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:text-white transition-all ring-1 ring-white/5"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-600/30 text-white rounded-tr-md'
                      : 'bg-white/[0.05] text-slate-200 rounded-tl-md ring-1 ring-white/5'
                  }`}>
                    {msg.content}
                    {msg.suggestions?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.suggestions.map((s, j) => (
                          <button
                            key={j}
                            onClick={() => { setInput(s); inputRef.current?.focus() }}
                            className="block text-xs text-primary-400 hover:text-primary-300 transition-colors"
                          >
                            → {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {chatLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="animate-pulse">Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2 bg-white/[0.05] rounded-xl px-4 py-2 ring-1 ring-white/10 focus-within:ring-primary-500/50 transition-all">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about candidates, jobs, tests..."
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-slate-500 outline-none"
                  disabled={chatLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || chatLoading}
                  className="p-2 rounded-lg text-primary-400 hover:text-primary-300 hover:bg-primary-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
