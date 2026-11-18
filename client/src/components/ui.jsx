import { useEffect } from 'react'
import { X, Loader2, Inbox } from 'lucide-react'

/* ── Page header ─────────────────────────────────────────────────────────── */

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold text-ink-900 leading-7">{title}</h1>
        {description && (
          <p className="text-[13.5px] text-ink-500 mt-0.5">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  )
}

/* ── Section ─────────────────────────────────────────────────────────────── */

export function Section({ title, description, action, children, padded = true, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line">
          <div>
            {title && <h2 className="text-[13.5px] font-semibold text-ink-900">{title}</h2>}
            {description && <p className="text-xs text-ink-500 mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

/* ── Stats ───────────────────────────────────────────────────────────────── */

export function Stat({ label, value, note }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="num text-[26px] leading-8 font-medium text-ink-900 mt-1">
        {value}
      </p>
      {note && <p className="text-xs text-ink-500 mt-0.5">{note}</p>}
    </div>
  )
}

export function StatRow({ children }) {
  return (
    <div className="card grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-line lg:divide-x">
      {children}
    </div>
  )
}

/* ── Status ──────────────────────────────────────────────────────────────── */

const STATUS = {
  applied:     { label: 'Applied',     tone: 'neutral'  },
  screening:   { label: 'Screening',   tone: 'warn'     },
  interview:   { label: 'Interview',   tone: 'accent'   },
  shortlisted: { label: 'Shortlisted', tone: 'positive' },
  hired:       { label: 'Hired',       tone: 'positive' },
  rejected:    { label: 'Rejected',    tone: 'danger'   },
  active:      { label: 'Active',      tone: 'positive' },
  draft:       { label: 'Draft',       tone: 'neutral'  },
  closed:      { label: 'Closed',      tone: 'neutral'  },
  idle:        { label: 'Idle',        tone: 'neutral'  },
  processing:  { label: 'Processing',  tone: 'accent'   },
  using_tool:  { label: 'Using tool',  tone: 'warn'     },
  completed:   { label: 'Completed',   tone: 'positive' },
  error:       { label: 'Error',       tone: 'danger'   },
}

export function StatusPill({ status, className = '' }) {
  const cfg = STATUS[status] || { label: status || 'Unknown', tone: 'neutral' }
  return (
    <span className={`pill-${cfg.tone} capitalize ${className}`}>{cfg.label}</span>
  )
}

/* ── Score ───────────────────────────────────────────────────────────────── */

export function ScoreBar({ value = 0, width = 'w-full' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={`flex items-center gap-2 ${width}`}>
      <div className="h-1 flex-1 rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent-600"
          style={{ width: `${v}%`, transition: 'width 240ms ease-out' }}
        />
      </div>
      <span className="num text-xs text-ink-600 w-6 text-right">{v}</span>
    </div>
  )
}

export function Score({ value = 0 }) {
  return (
    <span className="num text-[15px] font-medium text-ink-900">
      {Math.max(0, Math.min(100, Number(value) || 0))}
    </span>
  )
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <Icon size={20} className="text-ink-300" strokeWidth={1.5} />
      <p className="text-[13.5px] font-medium text-ink-800 mt-3">{title}</p>
      {description && (
        <p className="text-[13px] text-ink-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ── Alert ───────────────────────────────────────────────────────────────── */

const ALERT_TONE = {
  danger:  'bg-danger-50 text-danger-700 border-danger-100',
  warn:    'bg-warn-50 text-warn-700 border-warn-100',
  positive:'bg-positive-50 text-positive-700 border-positive-100',
  accent:  'bg-accent-50 text-accent-700 border-accent-100',
  neutral: 'bg-ink-50 text-ink-700 border-line',
}

export function Alert({ tone = 'neutral', children, className = '' }) {
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-[13px] ${ALERT_TONE[tone]} ${className}`}>
      {children}
    </div>
  )
}

/* ── Spinner / loading ───────────────────────────────────────────────────── */

export function Spinner({ className = '' }) {
  return <Loader2 size={16} className={`animate-spin ${className}`} />
}

export function LoadingBlock({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-ink-500 text-[13px]">
      <Spinner />
      {label}
    </div>
  )
}

/* ── Field ───────────────────────────────────────────────────────────────── */

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-danger-600 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

/* ── Modal ───────────────────────────────────────────────────────────────── */

export function Modal({ open, onClose, title, description, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-6 bg-ink-950/35 animate-fade-in overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className={`w-full ${width} bg-paper border border-line rounded-panel shadow-float my-auto`}>
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
            {description && <p className="text-[13px] text-ink-500 mt-0.5">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-400 hover:text-ink-800 -mr-1 p-1 rounded-md hover:bg-ink-50"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-ink-50 rounded-b-panel">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Pagination ──────────────────────────────────────────────────────────── */

export function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-1 text-[13px] text-ink-500">
      <span className="num">
        Page {page} of {pages}
      </span>
      <div className="flex items-center gap-2">
        <button className="btn-secondary btn-sm" disabled={page === 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary btn-sm" disabled={page === pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
