import { Outlet, NavLink, useLocation } from 'react-router-dom'

const tabs = [
  { to: '/',          label: 'Início',    icon: '🏠' },
  { to: '/consultas', label: 'Consultas', icon: '📋' },
  { to: '/chat',      label: 'Chat',      icon: '💬' },
  { to: '/perfil',    label: 'Perfil',    icon: '👤' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Conteúdo com scroll */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Outlet />
      </div>

      {/* Bottom Tab Bar */}
      <nav style={{
        display: 'flex',
        backgroundColor: '#fff',
        borderTop: '1px solid #E5E7EB',
        height: 72,
        flexShrink: 0,
      }}>
        {tabs.map(tab => {
          const active = tab.to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.to)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                textDecoration: 'none',
                color: active ? '#0047AB' : '#9CA3AF',
              }}
            >
              <span style={{ fontSize: active ? 22 : 20, opacity: active ? 1 : 0.5, lineHeight: 1 }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 11, fontWeight: '600' }}>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
