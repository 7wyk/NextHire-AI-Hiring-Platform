import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Brain, FileText, MessageSquare, Code2, Trophy,
  Bell, Activity, Cpu, Wrench, RefreshCw, CheckCircle2,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Zap
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'

const AGENT_ICONS = {
  resume:       FileText,
  interview:    MessageSquare,
  coding:       Code2,
  ranking:      Trophy,
  notification: Bell,
}

const AGENT_COLORS = {
  resume:       { bg: 'from-blue-600/20 to-blue-800/10',   border: 'border-blue-500/30',   dot: 'bg-blue-500',   text: 'text-blue-400'   },
  interview:    { bg: 'from-purple-600/20 to-purple-800/10', border: 'border-purple-500/30', dot: 'bg-purple-500', text: 'text-purple-400' },
  coding:       { bg: 'from-green-600/20 to-green-800/10',  border: 'border-green-500/30',  dot: 'bg-green-500',  text: 'text-green-400'  },
  ranking:      { bg: 'from-amber-600/20 to-amber-800/10',  border: 'border-amber-500/30',  dot: 'bg-amber-500',  text: 'text-amber-400'  },
  notification: { bg: 'from-rose-600/20 to-rose-800/10',    border: 'border-rose-500/30',   dot: 'bg-rose-500',   text: 'text-rose-400'   },
}

const STATUS_BADGES = {
  idle:       { label: 'Idle',       bg: 'bg-slate-500/20',  text: 'text-slate-400',  ring: 'ring-slate-500/30'  },
  processing: { label: 'Processing', bg: 'bg-blue-500/20',   text: 'text-blue-400',   ring: 'ring-blue-500/30'   },
  using_tool: { label: 'Using Tool', bg: 'bg-amber-500/20',  text: 'text-amber-400',  ring: 'ring-amber-500/30'  },
  completed:  { label: 'Completed',  bg: 'bg-green-500/20',  text: 'text-green-400',  ring: 'ring-green-500/30'  },
  error:      { label: 'Error',      bg: 'bg-red-500/20',    text: 'text-red-400',    ring: 'ring-red-500/30'    },
}

function StatusBadge({ status }) {
  const s = STATUS_BADGES[status] || STATUS_BADGES.idle
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      {status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
      {status === 'using_tool' && <Wrench className="w-3 h-3 animate-pulse" />}
      {status === 'completed'  && <CheckCircle2 className="w-3 h-3" />}
      {status === 'error'      && <AlertCircle className="w-3 h-3" />}
      {s.label}
    </span>
  )
}

function AgentCard({ agent }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = AGENT_ICONS[agent.key] || Bot
  const colors = AGENT_COLORS[agent.key] || AGENT_COLORS.resume

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${colors.border} bg-gradient-to-br ${colors.bg} backdrop-blur-sm overflow-hidden`}
    >
      <div
        className="p-5 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center ${colors.text}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{agent.name}</h3>
              <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{agent.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={agent.status} />
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="flex items-center gap-4 mt-4">
          <div className="text-center">
            <p className="text-white text-lg font-bold">{agent.metrics?.totalTasks || 0}</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Tasks</p>
          </div>
          <div className="text-center">
            <p className="text-green-400 text-lg font-bold">{agent.metrics?.successRate || 100}%</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Success</p>
          </div>
          <div className="text-center">
            <p className="text-red-400 text-lg font-bold">{agent.metrics?.errorCount || 0}</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Errors</p>
          </div>
          {agent.currentTool && (
            <div className="flex-1 text-right">
              <span className="text-amber-400 text-xs bg-amber-500/10 px-2 py-1 rounded-lg">
                <Wrench className="w-3 h-3 inline mr-1" />
                {agent.currentTool}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded: Tools + History */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/5"
          >
            <div className="p-5 space-y-4">
              {/* Tools */}
              <div>
                <h4 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Allowed Tools</h4>
                <div className="flex flex-wrap gap-1.5">
                  {(agent.allowedTools || []).map(t => (
                    <span key={t} className="text-[10px] px-2 py-1 rounded-md bg-white/5 text-slate-300 font-mono">{t}</span>
                  ))}
                  {(!agent.allowedTools || agent.allowedTools.length === 0) && (
                    <span className="text-xs text-slate-500 italic">No direct tools — delegates to child agents</span>
                  )}
                </div>
              </div>

              {/* Recent History */}
              {agent.recentHistory?.length > 0 && (
                <div>
                  <h4 className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Recent Activity</h4>
                  <div className="space-y-1.5">
                    {agent.recentHistory.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white/[0.03]">
                        <span className={h.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                          {h.status === 'success' ? '✓' : '✗'} {h.type}
                        </span>
                        <span className="text-slate-500">{h.duration}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function AgentMonitor() {
  const { supervisor, agents, tools, loading, fetchAgentStatus, fetchTools } = useAgentStore()
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchAgentStatus()
    fetchTools()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchAgentStatus, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-900/40">
              <Brain className="w-5 h-5 text-white" />
            </div>
            Agent Monitor
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time multi-agent system dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(r => !r)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              autoRefresh
                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
                : 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/30'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={fetchAgentStatus}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-white/5 text-slate-300 hover:bg-white/10 transition-all ring-1 ring-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Supervisor Status */}
      {supervisor && (
        <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-600/10 to-primary-900/5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/30 to-primary-700/20 flex items-center justify-center text-primary-400">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-white font-semibold">Supervisor Agent</h2>
                <p className="text-slate-400 text-xs">Central orchestrator — routes tasks to specialized agents</p>
              </div>
            </div>
            <StatusBadge status={supervisor.status} />
          </div>
          <div className="flex items-center gap-6 mt-4 text-sm">
            <span className="text-slate-400">Tasks: <strong className="text-white">{supervisor.metrics?.totalTasks || 0}</strong></span>
            <span className="text-slate-400">Success: <strong className="text-green-400">{supervisor.metrics?.successRate || 100}%</strong></span>
            <span className="text-slate-400">Errors: <strong className="text-red-400">{supervisor.metrics?.errorCount || 0}</strong></span>
          </div>
        </div>
      )}

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map(agent => (
          <AgentCard key={agent.key} agent={agent} />
        ))}
      </div>

      {/* MCP Tools */}
      <div className="rounded-2xl border border-white/[0.07] bg-surface-800/50 p-5">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2 mb-4">
          <Wrench className="w-4 h-4 text-slate-400" />
          MCP Tool Registry
          <span className="text-slate-500 font-normal">({tools.length} tools)</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {tools.map(tool => (
            <div key={tool.name} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] ring-1 ring-white/5">
              <div className="min-w-0">
                <p className="text-xs font-mono text-slate-300 truncate">{tool.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{tool.description}</p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono ml-2 flex-shrink-0">
                ×{tool.stats?.executionCount || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Diagram */}
      <div className="rounded-2xl border border-white/[0.07] bg-surface-800/50 p-6">
        <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-400" />
          Architecture: Multi-Agent + MCP + Vectorless
        </h2>
        <div className="flex flex-col items-center gap-3 text-xs text-center">
          <div className="px-4 py-2 rounded-xl bg-primary-500/20 text-primary-300 ring-1 ring-primary-500/30 font-medium">
            User Request (API / Chat)
          </div>
          <div className="text-slate-500">↓</div>
          <div className="px-4 py-2 rounded-xl bg-primary-600/15 text-primary-400 ring-1 ring-primary-500/20 font-medium">
            Supervisor Agent — routes & orchestrates
          </div>
          <div className="text-slate-500">↓</div>
          <div className="flex flex-wrap justify-center gap-2">
            {['Resume', 'Interview', 'Coding', 'Ranking', 'Notification'].map(name => (
              <div key={name} className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10">
                {name} Agent
              </div>
            ))}
          </div>
          <div className="text-slate-500">↓</div>
          <div className="flex flex-wrap justify-center gap-2">
            {['MongoDB', 'Judge0', 'Cloudinary', 'Socket.IO'].map(name => (
              <div key={name} className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 font-mono">
                MCP: {name}
              </div>
            ))}
          </div>
          <div className="text-slate-500">↓</div>
          <div className="px-4 py-2 rounded-xl bg-green-500/15 text-green-400 ring-1 ring-green-500/20 font-medium">
            Response + AI Memory
          </div>
        </div>
      </div>
    </div>
  )
}
