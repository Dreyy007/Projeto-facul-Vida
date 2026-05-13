import { Outlet, NavLink, useLocation } from 'react-router-dom'

function IconHome({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#0047AB' : 'none'} stroke={active ? '#0047AB' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}
function IconConsultas({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
      <line x1="8" y1="18" x2="13" y2="18"/>
    </svg>
  )
}
function IconChat({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#0047AB' : 'none'} stroke={active ? '#0047AB' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}
function IconPerfil({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Outlet />
      </div>

      <nav style={{ display: 'flex', backgroundColor: '#fff', borderTop: '1px solid #E5E7EB', height: 72, flexShrink: 0, paddingBottom: 4 }}>
        {tabs.map(tab => {
          const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none' }}
            >
              <div style={{
                width: 44, height: 30, borderRadius: 15,
                backgroundColor: active ? '#EFF6FF' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}>
                <tab.Icon active={active} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#0047AB' : '#9CA3AF', letterSpacing: 0.2 }}>
                {tab.label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}