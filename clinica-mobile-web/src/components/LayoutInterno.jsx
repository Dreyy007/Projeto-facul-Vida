import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const icons = {
  home: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#93C5FD'} strokeWidth="2" strokeLinecap="round">
      <path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"/>
    </svg>
  ),
  agenda: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#93C5FD'} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  aprovacoes: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#93C5FD'} strokeWidth="2" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  chat: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#93C5FD'} strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  mais: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#0047AB' : '#93C5FD'} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  ),
}

export default function LayoutInterno() {
  const { perfil } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ aprovacoes: 0, chat: 0 })
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    fetchBadges()
    const ch = supabase.channel('interno-badges-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, fetchBadges)
      .subscribe()
    const polling = setInterval(fetchBadges, 30000)
    return () => { supabase.removeChannel(ch); clearInterval(polling) }
  }, [])

  async function fetchBadges() {
    const [{ data: solics }, { data: msgs }] = await Promise.all([
      supabase.from('solicitacoes').select('id').eq('status', 'pendente'),
      supabase.from('mensagens').select('id').eq('lida', false).eq('remetente', 'paciente').is('tipo', null),
    ])
    setBadges({ aprovacoes: solics?.length || 0, chat: msgs?.length || 0 })
  }

  const tabs = [
    { to: '/interno', label: 'Início', icon: 'home', exact: true },
    { to: '/interno/agenda', label: 'Agenda', icon: 'agenda' },
    { to: '/interno/aprovacoes', label: 'Aprovações', icon: 'aprovacoes', badge: 'aprovacoes' },
    { to: '/interno/chat', label: 'Chat', icon: 'chat', badge: 'chat' },
    { label: 'Mais', icon: 'mais', action: () => setMenuAberto(v => !v) },
  ]

  const menuItems = [
    { to: '/interno/pacientes', label: '👥 Pacientes' },
    { to: '/interno/resultados', label: '📄 Resultados' },
    ...(perfil?.tipo === 'estagiario' ? [{ to: '/interno/escala', label: '📅 Minha Escala' }] : []),
    { to: '/interno/perfil', label: '👤 Meu Perfil' },
  ]

  return (
    <>
      <div className="page-content">
        <Outlet />
      </div>

      {/* Menu flutuante "Mais" */}
      {menuAberto && (
        <>
          <div onClick={() => setMenuAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'fixed', bottom: 80, right: 16, background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 50, overflow: 'hidden', minWidth: 200 }}>
            {menuItems.map(item => (
              <NavLink key={item.to} to={item.to} onClick={() => setMenuAberto(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', fontSize: 14, fontWeight: 600, color: '#0D1B2A', textDecoration: 'none', borderBottom: '1px solid #F3F4F6' }}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </>
      )}

      <nav className="navbar">
        {tabs.map((tab, i) => {
          if (tab.action) {
            const subAtivo = menuItems.some(m => location.pathname.startsWith(m.to))
            return (
              <button key={i} onClick={tab.action}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, border: subAtivo ? '1.5px solid #0047AB' : '1.5px dashed #BFDBFE', backgroundColor: subAtivo ? '#EFF6FF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icons[tab.icon](subAtivo)}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: subAtivo ? '#0047AB' : '#93C5FD' }}>{tab.label}</span>
              </button>
            )
          }

          const active = tab.exact ? location.pathname === tab.to : location.pathname.startsWith(tab.to)
          const badgeCount = tab.badge ? badges[tab.badge] : 0

          return (
            <NavLink key={tab.to} to={tab.to}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, textDecoration: 'none', padding: '8px 0' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, border: active ? '1.5px solid #0047AB' : '1.5px dashed #BFDBFE', backgroundColor: active ? '#EFF6FF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  {icons[tab.icon](active)}
                </div>
                {badgeCount > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 50, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#0047AB' : '#93C5FD' }}>{tab.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
