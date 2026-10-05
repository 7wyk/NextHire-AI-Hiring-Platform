import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Layouts
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'

// Pages — Auth (role-specific)
import LandingPage        from './pages/LandingPage'
import CandidateLogin     from './pages/auth/CandidateLogin'
import CandidateSignup    from './pages/auth/CandidateSignup'
import RecruiterLogin     from './pages/auth/RecruiterLogin'
import RecruiterSignup    from './pages/auth/RecruiterSignup'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage  from './pages/auth/ResetPasswordPage'

// Pages — Recruiter
import Dashboard        from './pages/dashboard/Dashboard'
import JobsPage         from './pages/jobs/JobsPage'
import CandidatesPage   from './pages/candidates/CandidatesPage'
import ResumePage       from './pages/resume/ResumePage'
import RankingPage      from './pages/ranking/RankingPage'
import CreateCodingTest from './pages/coding/CreateCodingTest'
import JobApplicantsPage from './pages/applications/JobApplicantsPage'

// Pages — Candidate
import PublicJobsPage     from './pages/jobs/PublicJobsPage'
import MyApplicationsPage from './pages/applications/MyApplicationsPage'
import CodingTestPage     from './pages/coding/CodingTestPage'
import CandidateInterviewPage from './pages/interview/CandidateInterviewPage'

// Pages — Shared
import CodingPage from './pages/coding/CodingPage'

// Pages — v2 Agent System
import AgentMonitor from './pages/agents/AgentMonitor'

// Components — v2
import RecruiterAssistant from './components/RecruiterAssistant'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Where to redirect after login based on role */
function roleHome(role) {
  return role === 'candidate' ? '/public-jobs' : '/dashboard'
}

/** Where to redirect unauthenticated users */
function loginPath(attemptedRole) {
  return attemptedRole === 'recruiter' ? '/recruiter/login' : '/candidate/login'
}

/** Blocks unauthenticated users — redirects to role-appropriate login */
function ProtectedRoute({ children }) {
  const { token } = useAuthStore()
  if (!token) return <Navigate to="/candidate/login" replace />
  return children
}

/**
 * Blocks users whose role is not in allowedRoles.
 * Redirects them to their role home instead of a blank error page.
 */
function RoleRoute({ children, allowedRoles }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to={loginPath(allowedRoles?.[0])} replace />
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to={roleHome(user?.role)} replace />
  }
  return children
}

/** Redirects already-authenticated users away from login/register */
function GuestRoute({ children }) {
  const { token, user } = useAuthStore()
  if (token) return <Navigate to={roleHome(user?.role)} replace />
  return children
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, token } = useAuthStore()
  const isRecruiter = token && (user?.role === 'recruiter' || user?.role === 'admin')

  return (
    <>
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────── */}
      <Route path="/" element={<LandingPage />} />

      {/* ── Auth (guest-only, role-specific) ────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/candidate/login"   element={<GuestRoute><CandidateLogin /></GuestRoute>} />
        <Route path="/candidate/signup"  element={<GuestRoute><CandidateSignup /></GuestRoute>} />
        <Route path="/recruiter/login"   element={<GuestRoute><RecruiterLogin /></GuestRoute>} />
        <Route path="/recruiter/signup"  element={<GuestRoute><RecruiterSignup /></GuestRoute>} />

        {/* Legacy routes — redirect to candidate login/signup */}
        <Route path="/login"    element={<Navigate to="/candidate/login" replace />} />
        <Route path="/register" element={<Navigate to="/candidate/signup" replace />} />
      </Route>

      {/* ── Public auth utilities (no guest guard — links come from email) ── */}
      <Route path="/forgot-password"       element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* ── Protected app shell ─────────────────────────────────────── */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>

        {/* ── Dashboard — both roles; renders role-specific content ──── */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ── Recruiter-only ──────────────────────────────────────────── */}
        <Route
          path="/jobs"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><JobsPage /></RoleRoute>}
        />
        <Route
          path="/candidates"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><CandidatesPage /></RoleRoute>}
        />
        <Route
          path="/resume-ai"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><ResumePage /></RoleRoute>}
        />
        <Route
          path="/ranking"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><RankingPage /></RoleRoute>}
        />
        <Route
          path="/create-coding-test"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><CreateCodingTest /></RoleRoute>}
        />
        <Route
          path="/jobs/:jobId/applicants"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><JobApplicantsPage /></RoleRoute>}
        />
        <Route
          path="/agent-monitor"
          element={<RoleRoute allowedRoles={['recruiter','admin']}><AgentMonitor /></RoleRoute>}
        />

        {/* ── Candidate-only ──────────────────────────────────────────── */}
        <Route
          path="/public-jobs"
          element={<RoleRoute allowedRoles={['candidate']}><PublicJobsPage /></RoleRoute>}
        />
        <Route
          path="/my-applications"
          element={<RoleRoute allowedRoles={['candidate']}><MyApplicationsPage /></RoleRoute>}
        />
        <Route
          path="/coding-test/:jobId"
          element={<RoleRoute allowedRoles={['candidate']}><CodingTestPage /></RoleRoute>}
        />
        <Route
          path="/ai-interview"
          element={<RoleRoute allowedRoles={['candidate']}><CandidateInterviewPage /></RoleRoute>}
        />

        {/* ── Shared (both roles) — generic coding sandbox ────────────── */}
        <Route path="/coding" element={<CodingPage />} />
      </Route>

      {/* ── 404 catch-all ──────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    {/* v2: Floating AI Assistant for recruiters — visible on all pages */}
    {isRecruiter && <RecruiterAssistant />}
    </>
  )
}
