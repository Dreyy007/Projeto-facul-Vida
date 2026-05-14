import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

function IconHome({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 4l9 8"/>
      <path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"/>
    </svg>
  )
}
function IconConsultas({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <circle cx="8" cy="14" r="1" fill={c}/>
      <circle cx="12" cy="14" r="1" fill={c}/>
      <circle cx="16" cy="14" r="1" fill={c}/>
      <circle cx="8" cy="18" r="1" fill={c}/>
      <circle cx="12" cy="18" r="1" fill={c}/>
    </svg>
  )
}
function IconChat({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      <line x1="8" y1="10" x2="14" y2="10"/>
      <line x1="8" y1="14" x2="12" y2="14"/>
    </svg>
  )
}
function IconPerfil({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5"/>
      <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7"/>
    </svg>
  )
}

const tabs = [
  { to: '/',          label: 'Início',    Icon: IconHome },
  { to: '/consultas', label: 'Consultas', Icon: IconConsultas },
  { to: '/chat',      label: 'Chat',      Icon: IconChat },
  { to: '/perfil',    label: 'Perfil',    Icon: IconPerfil },
]

export default function Layout() {
  const location = useLocation()

  useEffect(() => {
    function setVH() {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    setVH()
    window.addEventListener('resize', setVH)
    window.addEventListener('orientationchange', setVH)
    return () => {
      window.removeEventListener('resize', setVH)
      window.removeEventListener('orientationchange', setVH)
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg, #fff)',
      maxWidth: 430, margin: '0 auto',
    }}>
      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
        <Outlet />
      </div>

      {/* Navbar fixa ao fundo */}
      <nav style={{
        display: 'flex',
        backgroundColor: 'var(--nav-bg, #fff)',
        borderTop: '1px solid var(--nav-border, #E5E7EB)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        flexShrink: 0,
        zIndex: 100,
      }}>
        {tabs.map(tab => {
          const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none', padding: '10px 0' }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                border: active ? '1.5px solid var(--p, #0047AB)' : '1.5px dashed #BFDBFE',
                backgroundColor: active ? 'var(--p3, #EFF6FF)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                <tab.Icon active={active} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? 'var(--p, #0047AB)' : '#93C5FD' }}>
                {tab.label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}