import { Link } from 'react-router-dom'
import Logo from './Logo'

/**
 * Shared frame for every authentication screen: an ink panel on the left and a
 * raised paper form card on the right. Collapses to one column on small screens.
 */
export default function AuthShell({ role = 'recruiter', eyebrow, title, description, children, footer }) {
  const copy = role === 'candidate'
    ? {
        headline: 'Apply, get assessed, hear back.',
        points: [
          'Apply to open roles with your resume',
          'Take a timed coding assessment',
          'Complete a structured AI interview',
        ],
        switchText: 'Hiring instead?',
        switchLabel: 'Recruiter sign in',
        switchHref: '/recruiter/login',
      }
    : {
        headline: 'Shortlists built from evidence.',
        points: [
          'Resume screening with strengths and gaps',
          'Coding tests run in a real sandbox',
          'One weighted score per candidate',
        ],
        switchText: 'Looking for a job?',
        switchLabel: 'Candidate sign in',
        switchHref: '/candidate/login',
      }

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)]">
      {/* Ink panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-ink-950 text-white p-10 xl:p-12">
        <Logo to="/" tone="light" />

        <div className="max-w-[380px]">
          <span className="inline-flex items-center gap-2 text-[11px] text-white/45 mb-4">
            <span className="w-4 h-[2px] rounded-full bg-accent-500" aria-hidden="true" />
            {role === 'candidate' ? 'For candidates' : 'For hiring teams'}
          </span>
          <h2 className="text-[26px] leading-8 font-medium tracking-[-0.015em]">
            {copy.headline}
          </h2>
          <ul className="mt-7 space-y-2.5">
            {copy.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[13px] text-white/70">
                <span className="mt-[7px] w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] text-white/35">
          Resume screening · Coding tests · AI interviews · Rankings
        </p>
      </aside>

      {/* Form */}
      <div className="flex flex-col min-h-screen lg:min-h-0">
        <div className="lg:hidden px-5 h-14 flex items-center bg-paper border-b border-line">
          <Logo to="/" />
        </div>

        <div className="flex-1 flex items-center justify-center px-5 py-10">
          <div className="w-full max-w-[392px] animate-rise-in">
            <div className="bg-paper border border-line rounded-panel shadow-raised p-6 sm:p-7">
              {eyebrow && (
                <p className="text-[11px] text-ink-500 mb-2">{eyebrow}</p>
              )}
              <h1 className="text-[21px] leading-7 font-semibold text-ink-950">{title}</h1>
              {description && (
                <p className="text-[13.5px] text-ink-500 mt-1.5">{description}</p>
              )}

              <div className="mt-6">{children}</div>

              {footer && <div className="mt-6 pt-5 border-t border-line">{footer}</div>}
            </div>

            <p className="mt-6 text-[12.5px] text-ink-500 text-center">
              {copy.switchText}{' '}
              <Link to={copy.switchHref} className="link">
                {copy.switchLabel}
              </Link>
            </p>
          </div>
        </div>

        <div className="px-5 py-4 text-[11px] text-ink-400 lg:text-right">
          <Link to="/" className="hover:text-ink-700">Back to Nexthire</Link>
        </div>
      </div>
    </div>
  )
}
