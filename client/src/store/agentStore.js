import { create } from 'zustand'
import api from '../services/api'

/**
 * agentStore.js
 *
 * Zustand store for the v2 multi-agent system.
 * Manages: agent statuses, MCP tool list, recruiter AI chat history.
 */
export const useAgentStore = create((set, get) => ({
  // ── Agent statuses ────────────────────────────────────────────────────────
  agents: [],
  supervisor: null,
  tools: [],
  loading: false,
  error: null,

  fetchAgentStatus: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/agents/status')
      set({
        supervisor: data.supervisor || null,
        agents: data.agents || [],
        loading: false,
      })
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false })
    }
  },

  fetchTools: async () => {
    try {
      const { data } = await api.get('/agents/tools')
      set({ tools: data.tools || [] })
    } catch { /* silent */ }
  },

  // ── Recruiter AI Assistant Chat ───────────────────────────────────────────
  chatMessages: [],
  chatLoading: false,

  sendChatMessage: async (message, jobId = null) => {
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() }
    set(s => ({ chatMessages: [...s.chatMessages, userMsg], chatLoading: true }))

    try {
      const { data } = await api.post('/agents/chat', { message, jobId })
      const aiMsg = {
        role: 'assistant',
        content: data.message || 'Done.',
        suggestions: data.suggestions || [],
        data: data.data || null,
        timestamp: new Date().toISOString(),
      }
      set(s => ({ chatMessages: [...s.chatMessages, aiMsg], chatLoading: false }))
      return data
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        content: `Error: ${err.response?.data?.message || err.message}`,
        timestamp: new Date().toISOString(),
      }
      set(s => ({ chatMessages: [...s.chatMessages, errMsg], chatLoading: false }))
    }
  },

  clearChat: () => set({ chatMessages: [] }),

  // ── Vectorless Search ─────────────────────────────────────────────────────
  searchResults: [],
  searchLoading: false,

  searchCandidates: async (jobId, opts = {}) => {
    set({ searchLoading: true })
    try {
      const { data } = await api.post('/agents/search-candidates', { jobId, ...opts })
      set({ searchResults: data.candidates || [], searchLoading: false })
      return data
    } catch (err) {
      set({ searchLoading: false })
      throw err
    }
  },
}))

export default useAgentStore
