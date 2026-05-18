import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './Sidebar.css'

const Icons = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  agenda: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2.5"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      <circle cx="8" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="15" r="1" fill="currentColor"/><circle cx="16" cy="15" r="1" fill="currentColor"/>
    </svg>
  ),
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      <line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="13" x2="13" y2="13"/>
    </svg>
  ),
  pacientes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4"/>
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
      <path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/>
    </svg>
  ),
  consultas: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  aprovacoes: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  usuarios: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  relatorios: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5"/>
      <line x1="8" y1="17" x2="8" y2="12"/><line x1="12" y1="17" x2="12" y2="7"/><line x1="16" y1="17" x2="16" y2="14"/>
    </svg>
  ),
  config: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  resultados: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <polyline points="11 17 13 19 17 15"/>
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
}

const navItems = [
  { section: 'Principal' },
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/agenda', icon: 'agenda', label: 'Agenda' },
  { to: '/chat', icon: 'chat', label: 'Chat', badge: 'chat' },
  { section: 'Gestão' },
  { to: '/pacientes', icon: 'pacientes', label: 'Pacientes' },
  { to: '/consultas', icon: 'consultas', label: 'Consultas' },
  { to: '/aprovacoes', icon: 'aprovacoes', label: 'Aprovações', badge: 'aprov' },
  { to: '/resultados', icon: 'resultados', label: 'Resultados' },
  { section: 'Administração', roles: ['admin', 'coordenador'] },
  { to: '/usuarios', icon: 'usuarios', label: 'Usuários', roles: ['admin', 'coordenador'] },
  { to: '/relatorios', icon: 'relatorios', label: 'Relatórios', roles: ['admin', 'coordenador'] },
  { section: 'Sistema' },
  { to: '/configuracoes', icon: 'config', label: 'Configurações' },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [unreadChat, setUnreadChat] = useState(0)
  const [pendingAprov, setPendingAprov] = useState(0)

  // CORRIGIDO: filtra mensagens de bot (tipo != null) para não contar no badge
  const fetchBadges = useCallback(async () => {
    const [{ data: msgs }, { data: solics }] = await Promise.all([
      supabase
        .from('mensagens')
        .select('id')
        .eq('lida', false)
        .eq('remetente', 'paciente')
        .is('tipo', null), // só mensagens reais, ignora bot
      supabase
        .from('solicitacoes')
        .select('id')
        .eq('status', 'pendente'),
    ])
    setUnreadChat(msgs?.length || 0)
    setPendingAprov(solics?.length || 0)
  }, [])

  useEffect(() => {
    fetchBadges()

    // CORRIGIDO: nomes únicos nos canais evitam conflito entre instâncias
    const uid = Date.now()
    const chatCh = supabase
      .channel(`sidebar-msgs-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, fetchBadges)
      .subscribe()

    const aprovCh = supabase
      .channel(`sidebar-solics-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchBadges)
      .subscribe()

    // CORRIGIDO: polling de segurança a cada 30s para redes lentas/celular
    const polling = setInterval(fetchBadges, 30000)

    return () => {
      supabase.removeChannel(chatCh)
      supabase.removeChannel(aprovCh)
      clearInterval(polling)
    }
  }, [fetchBadges])

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const prefixos = ['dr', 'dr.', 'dra', 'dra.', 'prof', 'prof.']
  const partes = profile?.nome?.split(' ') || []
  const initials = partes.length
    ? partes.filter(p => !prefixos.includes(p.toLowerCase())).map(n => n[0]).slice(0, 2).join('').toUpperCase() || partes.map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', medico: 'Médico', recepcionista: 'Recepcionista' }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
            <path d="M26 7C17.16 7 10 14.16 10 23C10 28.2 12.4 32.8 16.2 35.8V43H35.8V35.8C39.6 32.8 42 28.2 42 23C42 14.16 34.84 7 26 7Z" fill="rgba(255,255,255,0.95)"/>
            <path d="M15 25 Q19.5 20 24 25 Q28.5 30 33 25" fill="none" stroke="#003280" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className="logo-name">Clínica Vida+</div>
          <div className="logo-sub">Painel Interno</div>
        </div>
      </div>

      <div className="sidebar-user">
        <div className="user-av">{initials}</div>
        <div className="user-info">
          <div className="user-name">{partes.slice(0, 2).join(' ') || '...'}</div>
          <div className="user-role">{roleLabel[profile?.tipo] || ''}</div>
        </div>
        <div className="user-online" title="Online" />
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.section) {
            if (item.roles && !item.roles.includes(profile?.tipo)) return null
            return <div key={i} className="nav-section">{item.section}</div>
          }
          if (item.roles && !item.roles.includes(profile?.tipo)) return null
          const badgeCount = item.badge === 'chat' ? unreadChat : item.badge === 'aprov' ? pendingAprov : 0
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}>
              <span className="nav-ico">{Icons[item.icon]}</span>
              <span className="nav-label">{item.label}</span>
              {badgeCount > 0 && <span className="nav-badge">{badgeCount > 99 ? '99+' : badgeCount}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <button className="logout-btn" onClick={handleLogout}>
          {Icons.logout}
          <span>Sair da conta</span>
        </button>
      </div>
    </aside>
  )
}