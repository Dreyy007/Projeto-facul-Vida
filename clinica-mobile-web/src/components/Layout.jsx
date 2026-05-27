import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import './Layout.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const close = () => setSidebarOpen(false)
    window.addEventListener('closeSidebar', close)
    return () => window.removeEventListener('closeSidebar', close)
  }, [])

  return (
    <div className="layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <header className="mobile-topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className="mobile-logo">
          <svg width="18" height="18" viewBox="0 0 52 52" fill="none">
            <path d="M26 7C17.16 7 10 14.16 10 23C10 28.2 12.4 32.8 16.2 35.8V43H35.8V35.8C39.6 32.8 42 28.2 42 23C42 14.16 34.84 7 26 7Z" fill="rgba(255,255,255,0.95)"/>
            <path d="M15 25 Q19.5 20 24 25 Q28.5 30 33 25" fill="none" stroke="#003280" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span>Clínica Vida+</span>
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main">
        <Outlet />
      </div>
    </div>
  )
}