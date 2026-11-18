import { Link } from 'react-router-dom'

/**
 * The wordmark is the product name in the interface family with a small flat
 * tile: ink on paper, paper on ink. No gradient, no glow, no sparkle.
 */
export default function Logo({ to = '/', size = 'md', tone = 'dark', subtitle }) {
  const mark = size === 'lg' ? 'w-8 h-8 text-[13px]' : 'w-7 h-7 text-[12px]'
  const word = size === 'lg' ? 'text-[19px]' : 'text-[15px]'
  const isLight = tone === 'light'

  const content = (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${mark} rounded-[6px] flex items-center justify-center font-semibold flex-shrink-0 ${
          isLight
            ? 'bg-paper text-ink-950'
            : 'bg-ink-950 text-white'
        }`}
        style={{ boxShadow: isLight ? '0 1px 2px rgba(5,5,5,0.3)' : '0 1px 2px rgba(5,5,5,0.18)' }}
        aria-hidden="true"
      >
        N
      </span>
      <span className="leading-tight">
        <span className={`${word} font-semibold ${isLight ? 'text-white' : 'text-ink-950'} tracking-[-0.01em] block`}>
          Nexthire
        </span>
        {subtitle && (
          <span className={`text-[11px] ${isLight ? 'text-white/55' : 'text-ink-500'} block`}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  )

  if (!to) return content
  return (
    <Link to={to} className="inline-flex rounded-md">
      {content}
    </Link>
  )
}
