import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Navbar from '../components/Navbar'

export default function MainLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the mobile drawer on navigation
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      {/* Ink rail — desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Ink rail — mobile drawer */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-ink-950/40"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 animate-rise-in">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <Navbar onMenuClick={() => setNavOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-4 sm:px-6 py-5 max-w-[1480px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
