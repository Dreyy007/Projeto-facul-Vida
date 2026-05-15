import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Sidebar.css'

const Icons = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  agenda: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  pacientes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  consultas: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  aprovacoes: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  usuarios: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  relatorios: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  config: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  resultados: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/><polyline points="12 17 14 19 18 15"/></svg>,
  logout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
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

  useEffect(() => {
    fetchBadges()
    const chatCh = supabase.channel('sb-chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, fetchBadges)
      .subscribe()
    const aprovCh = supabase.channel('sb-aprov')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchBadges)
      .subscribe()
    return () => { supabase.removeChannel(chatCh); supabase.removeChannel(aprovCh) }
  }, [])

  async function fetchBadges() {
    const [{ data: msgs }, { data: solics }] = await Promise.all([
      supabase.from('mensagens').select('id').eq('lida', false).eq('remetente', 'paciente'),
      supabase.from('solicitacoes').select('id').eq('status', 'pendente'),
    ])
    setUnreadChat(msgs?.length || 0)
    setPendingAprov(solics?.length || 0)
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const prefixos = ['dr', 'dr.', 'dra', 'dra.', 'prof', 'prof.']
  const partes = profile?.nome?.split(' ') || []
  const primeiroNome = partes.find(p => !prefixos.includes(p.toLowerCase())) || partes[0] || '...'

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
          <div className="user-name">{primeiroNome}</div>
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
              {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
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