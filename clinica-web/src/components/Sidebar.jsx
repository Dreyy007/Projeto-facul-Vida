import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Sidebar.css'

const navItems = [
  { section: 'Principal' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/agenda', icon: '📅', label: 'Agenda' },
  { to: '/chat', icon: '💬', label: 'Chat', badge: true },
  { section: 'Gestão' },
  { to: '/pacientes', icon: '👥', label: 'Pacientes' },
  { to: '/consultas', icon: '📋', label: 'Consultas' },
  { to: '/aprovacoes', icon: '✅', label: 'Aprovações', badge: true },
  { section: 'Administração', roles: ['admin', 'coordenador'] },
  { to: '/usuarios', icon: '👤', label: 'Usuários', roles: ['admin', 'coordenador'] },
  { to: '/relatorios', icon: '📈', label: 'Relatórios', roles: ['admin', 'coordenador'] },
  { section: 'Sistema' },
  { to: '/configuracoes', icon: '⚙️', label: 'Configurações' },
]

export default function Sidebar({ unreadChat = 0, pendingAprov = 0 }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.nome
    ? profile.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  const roleLabel = {
    admin: 'Administrador',
    coordenador: 'Coordenador',
    medico: 'Médico / Psicólogo',
    recepcionista: 'Recepcionista',
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="20" height="20" viewBox="0 0 52 52" fill="none">
            <path d="M26 7C17.16 7 10 14.16 10 23C10 28.2 12.4 32.8 16.2 35.8V43H35.8V35.8C39.6 32.8 42 28.2 42 23C42 14.16 34.84 7 26 7Z" fill="rgba(255,255,255,0.9)"/>
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
        <div>
          <div className="user-name">{profile?.nome || 'Carregando...'}</div>
          <div className="user-role">{roleLabel[profile?.tipo] || ''}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.section) {
            if (item.roles && !item.roles.includes(profile?.tipo)) return null
            return <div key={i} className="nav-section">{item.section}</div>
          }
          if (item.roles && !item.roles.includes(profile?.tipo)) return null
          const badgeCount = item.badge
            ? (item.label === 'Chat' ? unreadChat : pendingAprov)
            : 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' on' : ''}`}
            >
              <span className="nav-ico">{item.icon}</span>
              <span>{item.label}</span>
              {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-bottom">
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Sair
        </button>
      </div>
    </aside>
  )
}
