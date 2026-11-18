import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, FileText, Code2, MessageSquare, Trophy,
  Activity, Briefcase,
} from 'lucide-react'
import Lenis from 'lenis'
import Logo from '../components/Logo'

const workflow = [
  {
    step: '01',
    title: 'Post a role',
    body: 'Publish a job with its requirements and skills. It becomes the reference for every screening and assessment that follows.',
  },
  {
    step: '02',
    title: 'Screen resumes',
    body: 'Each resume is scored against the job description, with extracted skills, strengths and gaps the team can read.',
  },
  {
    step: '03',
    title: 'Assess and interview',
    body: 'Candidates take a timed coding test in a real editor and a structured interview with adaptive questions.',
  },
  {
    step: '04',
    title: 'Rank and decide',
    body: 'Resume, code and interview scores combine into one weighted figure. Sort the shortlist and move stages.',
  },
]

const capabilities = [
  {
    icon: FileText,
    title: 'Resume screening',
    body: 'Upload a PDF, DOC or TXT resume or screen an applicant directly. Returns a score, a summary, strengths, gaps and the skills found.',
  },
  {
    icon: Code2,
    title: 'Coding assessments',
    body: 'Generate a test from a role and difficulty, with hidden expected outputs. Candidates write and run code in Monaco against real test cases.',
  },
  {
    icon: MessageSquare,
    title: 'Structured AI interview',
    body: 'Five questions generated from the candidate’s resume, read aloud, answered by voice or text, with a timer per question.',
  },
  {
    icon: Trophy,
    title: 'Candidate ranking',
    body: 'Every applicant gets one score out of 100, broken down by input, so a shortlist can be argued from the numbers.',
  },
  {
    icon: Activity,
    title: 'Agent monitor',
    body: 'Watch the supervisor and specialist agents, their task counts, success rates, errors and the MCP tools each one may call.',
  },
  {
    icon: Briefcase,
    title: 'Pipeline and stages',
    body: 'Applications move through applied, screening, interview, shortlisted, hired and rejected, with notifications on each change.',
  },
]

// ── Motion ──────────────────────────────────────────────────────────────────

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Lenis is mounted for the public landing page only. The library owns its own
 * animation loop (autoRaf), so there is exactly one raf loop and no manual
 * bookkeeping to leave behind. Destroyed on unmount, which also makes React
 * Strict Mode's double mount safe.
 */
function useLandingSmoothScroll() {
  const lenisRef = useRef(null)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined

    let lenis
    try {
      lenis = new Lenis({ duration: 1.05, smoothWheel: true, autoRaf: true })
    } catch {
      return undefined
    }

    lenisRef.current = lenis
    return () => {
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return lenisRef
}

/** Reveals a block once, when it first enters the viewport. */
function Reveal({ as: Tag = 'div', delay = 0, className = '', children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`landing-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

const enter = (delay) => ({ animationDelay: `${delay}ms` })

export default function LandingPage() {
  const lenisRef = useLandingSmoothScroll()

  const goTo = (id) => (event) => {
    event.preventDefault()
    const section = document.getElementById(id)
    if (!section) return
    if (lenisRef.current) {
      lenisRef.current.scrollTo(section, { offset: -8 })
    } else {
      section.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
    }
  }

  return (
    <div className="relative isolate min-h-screen bg-ink-950 text-white/90">
      {/*
        One shared photographic layer for the whole page. Positioned rather than
        background-attachment: fixed so it stays stable through Lenis scrolling
        and costs nothing on mobile, where fixed attachment is unreliable.
      */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-ink-950">
        <div
          className="absolute inset-0 bg-no-repeat bg-cover bg-[position:46%_36%] sm:bg-[position:52%_42%] lg:bg-center"
          style={{ backgroundImage: "url('/hero-collaboration.jpeg')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(5,5,5,0.87) 0%, rgba(5,5,5,0.75) 26%, rgba(5,5,5,0.79) 62%, rgba(5,5,5,0.84) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(115% 75% at 50% 8%, rgba(5,5,5,0.02) 0%, rgba(5,5,5,0.5) 100%)',
          }}
        />
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/55 backdrop-blur-[6px]">
        <nav className="landing-in max-w-[1180px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-6">
          <Logo to="/" size="md" tone="light" />

          <div className="hidden md:flex items-center gap-7 text-[13px]">
            {[
              { id: 'workflow', label: 'Workflow' },
              { id: 'capabilities', label: 'Capabilities' },
              { id: 'scoring', label: 'Scoring' },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={goTo(item.id)}
                className="relative py-1 text-white/65 transition-colors hover:text-white after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent-500 after:transition-transform after:duration-200 hover:after:scale-x-100"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/candidate/login"
              className="hidden sm:inline text-[13px] text-white/65 transition-colors hover:text-white"
            >
              Candidate sign in
            </Link>
            <Link
              to="/recruiter/login"
              className="btn-secondary btn-sm sm:h-9 sm:px-3.5"
            >
              Recruiter sign in
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 flex items-center pt-16 pb-20 sm:pt-24 sm:pb-28 lg:min-h-[calc(100vh-4rem)] lg:py-0">
        <div className="max-w-[720px]">
          <p
            className="landing-in inline-flex items-center gap-2.5 text-[11.5px] tracking-[0.02em] text-white/55"
            style={enter(40)}
          >
            <span className="h-[2px] w-5 rounded-full bg-accent-500" aria-hidden="true" />
            Technical recruitment and candidate evaluation
          </p>

          <h1
            className="landing-in text-[38px] leading-[1.06] sm:text-[54px] sm:leading-[1.03] lg:text-[60px] font-semibold tracking-[-0.03em] mt-5 text-white text-balance"
            style={enter(110)}
          >
            Evaluate technical talent with confidence.
          </h1>

          <p
            className="landing-in text-[15.5px] leading-8 text-white/70 mt-6 max-w-[560px]"
            style={enter(190)}
          >
            From resume screening to coding assessments and structured interviews, Nexthire
            gives hiring teams one consistent, evidence-based workflow for evaluating software
            engineering talent.
          </p>

          <div className="landing-in flex flex-wrap items-center gap-3 mt-9" style={enter(270)}>
            <Link to="/recruiter/signup" className="btn-accent">
              Create a recruiter account
              <ArrowRight size={15} strokeWidth={1.8} />
            </Link>
            <a href="#workflow" onClick={goTo('workflow')} className="btn-outline">
              Explore the hiring process
            </a>
          </div>

          <p className="landing-in text-[13px] text-white/55 mt-7" style={enter(330)}>
            Applying for a job?{' '}
            <Link
              to="/candidate/signup"
              className="text-white/85 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white/60"
            >
              Create a candidate account
            </Link>
          </p>
        </div>
      </section>

      {/* ── Workflow ───────────────────────────────────────────────────── */}
      <section id="workflow" className="border-t border-white/10 bg-ink-950/25 scroll-mt-4">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <Reveal>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-white/45">
              The hiring workflow
            </h2>
            <p className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-[-0.02em] text-white mt-3 max-w-[560px]">
              How a hire moves through Nexthire
            </p>
            <p className="text-[14px] text-white/60 mt-3 max-w-[560px]">
              Four stages, each one producing something a hiring team can read and compare.
            </p>
          </Reveal>

          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mt-12">
            {workflow.map((item, i) => (
              <Reveal
                as="li"
                key={item.step}
                delay={i * 70}
                className="group border-t border-white/15 pt-4 transition-colors duration-200 hover:border-accent-500"
              >
                <span className="num text-[11.5px] text-white/35 transition-colors duration-200 group-hover:text-accent-300">
                  {item.step}
                </span>
                <h3 className="text-[14.5px] font-medium text-white mt-1.5">{item.title}</h3>
                <p className="text-[13px] leading-6 text-white/60 mt-1.5">{item.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────────── */}
      <section id="capabilities" className="border-t border-white/10 scroll-mt-4">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <Reveal>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-white/45">
              Capabilities
            </h2>
            <p className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-[-0.02em] text-white mt-3 max-w-[560px]">
              What the platform does
            </p>
            <p className="text-[14px] text-white/60 mt-3 max-w-[560px]">
              Every module writes back to the same candidate record, so scores, submissions and
              interviews stay in one place.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 mt-12 border border-white/10 rounded-[14px] overflow-hidden">
            {capabilities.map(({ icon: Icon, title, body }, i) => (
              <Reveal
                key={title}
                delay={(i % 3) * 60}
                className="group bg-ink-950/60 p-6 transition-colors duration-200 hover:bg-ink-950/35"
              >
                <Icon
                  size={16}
                  strokeWidth={1.6}
                  className="text-white/45 transition-colors duration-200 group-hover:text-accent-300"
                />
                <h3 className="text-[13.5px] font-medium text-white mt-3">{title}</h3>
                <p className="text-[12.5px] leading-6 text-white/60 mt-1.5">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Scoring ────────────────────────────────────────────────────── */}
      <section
        id="scoring"
        className="border-t border-white/10 bg-ink-950/65 scroll-mt-4"
      >
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-20 grid lg:grid-cols-2 gap-12 items-start">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/45">
              <span className="w-4 h-[2px] rounded-full bg-accent-500" aria-hidden="true" />
              Ranking engine
            </span>
            <h2 className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-[-0.02em] text-white mt-3">
              One score, three inputs
            </h2>
            <p className="text-[14px] leading-7 text-white/70 mt-4 max-w-[440px]">
              The ranking engine weights each assessment. Code carries the most because it is the
              closest signal to the work; the resume and the interview each carry 30 per cent.
            </p>
            <p className="text-[13px] leading-6 text-white/50 mt-4 max-w-[440px]">
              Candidates are scored out of 100. A missing assessment scores zero, so a shortlist
              always shows what has been measured and what has not.
            </p>
            <Link to="/recruiter/signup" className="btn-accent mt-7">
              Start a workspace
              <ArrowRight size={15} strokeWidth={1.8} />
            </Link>
          </Reveal>

          <Reveal
            delay={100}
            className="rounded-[14px] border border-white/[0.14] bg-ink-950/70 p-6"
          >
            <p className="text-[12px] text-white/50">Scoring weights</p>
            <div className="mt-5 space-y-5">
              {[
                { label: 'Coding assessment', weight: 40 },
                { label: 'Resume screening', weight: 30 },
                { label: 'AI interview', weight: 30 },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-white/85">{row.label}</span>
                    <span className="num text-[13px] font-medium text-white">{row.weight}%</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.12] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full"
                      style={{ width: `${row.weight}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="num text-[11.5px] text-white/45 mt-6 pt-4 border-t border-white/[0.12]">
              final = (resume × 0.30) + (code × 0.40) + (interview × 0.30)
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Two audiences ──────────────────────────────────────────────── */}
      <section className="border-t border-white/10">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-20 grid md:grid-cols-2 gap-6">
          <Reveal className="rounded-[14px] border border-white/12 bg-ink-950/60 p-6 sm:p-7">
            <h2 className="text-[16px] font-semibold text-white">For recruiters</h2>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/70">
              <li>Post roles and track every application in one pipeline</li>
              <li>Screen a resume in seconds, with the reasoning attached</li>
              <li>Generate a coding test for a role and difficulty</li>
              <li>Sort candidates by weighted score and move stages</li>
            </ul>
            <Link to="/recruiter/signup" className="btn-accent mt-6">
              Create a recruiter account
            </Link>
          </Reveal>

          <Reveal delay={90} className="rounded-[14px] border border-white/12 bg-ink-950/40 p-6 sm:p-7">
            <h2 className="text-[16px] font-semibold text-white">For candidates</h2>
            <ul className="mt-4 space-y-2.5 text-[13.5px] text-white/70">
              <li>Apply with a resume and a short cover letter</li>
              <li>Take a timed coding test in the language you choose</li>
              <li>Complete an interview on your own schedule</li>
              <li>Follow your application status from one screen</li>
            </ul>
            <Link to="/candidate/signup" className="btn-outline mt-6">
              Create a candidate account
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-ink-950/60">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-10 grid sm:grid-cols-[1.4fr_1fr_1fr] gap-8">
          <div>
            <Logo to="/" tone="light" />
            <p className="text-[12.5px] text-white/55 mt-3 max-w-[300px] leading-6">
              A recruitment and technical evaluation platform: resume screening, coding
              assessments, structured interviews and weighted rankings.
            </p>
          </div>

          <div>
            <p className="text-[12px] text-white/45">Product</p>
            <ul className="mt-3 space-y-2 text-[12.5px] text-white/65">
              <li><a href="#workflow" onClick={goTo('workflow')} className="transition-colors hover:text-white">Workflow</a></li>
              <li><a href="#capabilities" onClick={goTo('capabilities')} className="transition-colors hover:text-white">Capabilities</a></li>
              <li><a href="#scoring" onClick={goTo('scoring')} className="transition-colors hover:text-white">Scoring</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[12px] text-white/45">Accounts</p>
            <ul className="mt-3 space-y-2 text-[12.5px] text-white/65">
              <li><Link to="/recruiter/login" className="transition-colors hover:text-white">Recruiter sign in</Link></li>
              <li><Link to="/candidate/login" className="transition-colors hover:text-white">Candidate sign in</Link></li>
              <li><Link to="/candidate/signup" className="transition-colors hover:text-white">Create an account</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11.5px] text-white/40">© {new Date().getFullYear()} Nexthire</p>
            <p className="num text-[11px] text-white/40">
              Node · MongoDB · Socket.IO · Judge0 · Groq
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
