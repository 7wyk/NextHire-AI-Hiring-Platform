import { Fragment, useState, useEffect } from 'react'
import {
  RefreshCw, ChevronDown, ChevronUp, Activity, Wrench,
  CheckCircle2, XCircle, Cpu,
} from 'lucide-react'
import { useAgentStore } from '../../store/agentStore'
import { PageHeader, Section, StatusPill, EmptyState, Alert } from '../../components/ui'

export default function AgentMonitor() {
  const { supervisor, agents, tools, loading, error, fetchAgentStatus, fetchTools } = useAgentStore()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    fetchAgentStatus()
    fetchTools()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchAgentStatus, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchAgentStatus])

  const toolCount = tools.length
  const totalTasks = agents.reduce((sum, a) => sum + (a.metrics?.totalTasks || 0), 0)
  const totalErrors = agents.reduce((sum, a) => sum + (a.metrics?.errorCount || 0), 0)
  const busy = agents.filter(a => a.status === 'processing' || a.status === 'using_tool').length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Agent monitor"
        description="State of the multi-agent system and the MCP tools it can call."
        actions={
          <>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={autoRefresh ? 'btn-secondary btn-sm sm:h-9 sm:px-3.5' : 'btn-ghost btn-sm sm:h-9 sm:px-3.5'}
              aria-pressed={autoRefresh}
            >
              <Activity size={13} strokeWidth={1.8} className={autoRefresh ? 'text-accent-600' : 'text-ink-400'} />
              {autoRefresh ? 'Polling every 5s' : 'Polling paused'}
            </button>
            <button
              onClick={fetchAgentStatus}
              className="btn-secondary btn-sm sm:h-9 sm:px-3.5"
            >
              <RefreshCw size={13} strokeWidth={1.8} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </>
        }
      />

      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

      {/* Supervisor */}
      {supervisor && (
        <div className="card px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-md bg-ink-100 text-ink-600 flex items-center justify-center flex-shrink-0">
                <Cpu size={15} strokeWidth={1.6} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink-900">
                  {supervisor.name || 'Supervisor agent'}
                </p>
                <p className="text-[12px] text-ink-500 truncate">
                  Routes requests to the specialist agents and coordinates multi-step work
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="num text-[13px] text-ink-900">{supervisor.metrics?.totalTasks || 0}</p>
                <p className="text-[11px] text-ink-500">tasks</p>
              </div>
              <div className="text-right">
                <p className="num text-[13px] text-ink-900">{supervisor.metrics?.successRate ?? 100}%</p>
                <p className="text-[11px] text-ink-500">success</p>
              </div>
              <div className="text-right">
                <p className="num text-[13px] text-ink-900">{supervisor.metrics?.errorCount || 0}</p>
                <p className="text-[11px] text-ink-500">errors</p>
              </div>
              <StatusPill status={supervisor.status} />
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="card grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-line lg:divide-x mt-4">
        {[
          { label: 'Agents', value: agents.length },
          { label: 'Tasks executed', value: totalTasks },
          { label: 'Currently working', value: busy },
          { label: 'Errors', value: totalErrors },
        ].map(s => (
          <div key={s.label} className="px-5 py-4">
            <p className="text-[11.5px] text-ink-500">{s.label}</p>
            <p className="num text-[22px] leading-7 font-medium text-ink-900 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Agents */}
      <div className="mt-4">
        <Section title="Agents" padded={false}>
          {agents.length === 0 ? (
            <EmptyState
              icon={Cpu}
              title="No agent data"
              description="The agent status endpoint has not returned any agents yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Agent</th>
                    <th className="th">Status</th>
                    <th className="th text-right">Tasks</th>
                    <th className="th text-right">Success</th>
                    <th className="th text-right">Errors</th>
                    <th className="th">Current tool</th>
                    <th className="th w-10"><span className="sr-only">Detail</span></th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(agent => (
                    <Fragment key={agent.key}>
                      <tr className="hover:bg-ink-50/60 transition-colors">
                        <td className="td">
                          <p className="text-ink-900">{agent.name}</p>
                          <p className="text-[12px] text-ink-500 max-w-[320px] truncate">
                            {agent.description}
                          </p>
                        </td>
                        <td className="td"><StatusPill status={agent.status} /></td>
                        <td className="td text-right num text-[12.5px] text-ink-800">
                          {agent.metrics?.totalTasks || 0}
                        </td>
                        <td className="td text-right num text-[12.5px] text-ink-800">
                          {agent.metrics?.successRate ?? 100}%
                        </td>
                        <td className={`td text-right num text-[12.5px] ${
                          (agent.metrics?.errorCount || 0) > 0 ? 'text-danger-600' : 'text-ink-500'
                        }`}>
                          {agent.metrics?.errorCount || 0}
                        </td>
                        <td className="td">
                          {agent.currentTool ? (
                            <span className="num text-[11.5px] text-ink-700">{agent.currentTool}</span>
                          ) : (
                            <span className="text-[12px] text-ink-400">—</span>
                          )}
                        </td>
                        <td className="td">
                          <button
                            onClick={() => setExpanded(expanded === agent.key ? null : agent.key)}
                            className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                            aria-label={`Details for ${agent.name}`}
                            aria-expanded={expanded === agent.key}
                          >
                            {expanded === agent.key
                              ? <ChevronUp size={14} />
                              : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {expanded === agent.key && (
                        <tr className="bg-ink-50/50">
                          <td className="td" colSpan={7}>
                            <div className="grid md:grid-cols-2 gap-5 py-1">
                              <div>
                                <p className="text-[11.5px] text-ink-500 mb-2 flex items-center gap-1.5">
                                  <Wrench size={11} strokeWidth={1.8} /> Allowed tools
                                </p>
                                {agent.allowedTools?.length ? (
                                  <ul className="space-y-1">
                                    {agent.allowedTools.map(t => (
                                      <li key={t} className="num text-[11.5px] text-ink-700">{t}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[12px] text-ink-500">
                                    No direct tools. Work is delegated to specialist agents.
                                  </p>
                                )}
                              </div>

                              <div>
                                <p className="text-[11.5px] text-ink-500 mb-2">Recent tasks</p>
                                {agent.recentHistory?.length ? (
                                  <ul className="space-y-1">
                                    {agent.recentHistory.map((h, i) => (
                                      <li key={i} className="flex items-center gap-2 text-[12px]">
                                        {h.status === 'success'
                                          ? <CheckCircle2 size={11} className="text-positive-600" strokeWidth={1.8} />
                                          : <XCircle size={11} className="text-danger-600" strokeWidth={1.8} />}
                                        <span className="text-ink-700 flex-1 truncate">{h.type}</span>
                                        <span className="num text-[11px] text-ink-500">{h.duration}ms</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-[12px] text-ink-500">No tasks recorded in this session.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {/* Tools */}
      <div className="mt-4">
        <Section
          title="MCP tool registry"
          description={`${toolCount} tool${toolCount === 1 ? '' : 's'} registered`}
          padded={false}
        >
          {toolCount === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No tools registered"
              description="Tools register with the registry when the server starts."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Tool</th>
                    <th className="th">Description</th>
                    <th className="th text-right">Executions</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map(tool => (
                    <tr key={tool.name} className="hover:bg-ink-50/60">
                      <td className="td num text-[12px] text-ink-900 whitespace-nowrap">{tool.name}</td>
                      <td className="td text-[12.5px] text-ink-600">{tool.description}</td>
                      <td className="td text-right num text-[12.5px] text-ink-800">
                        {tool.stats?.executionCount || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
