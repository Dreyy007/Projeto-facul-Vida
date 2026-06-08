import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import './Layout.css'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Ícones ────────────────────────────────────────────────
function IconHome({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M3 12L12 4l9 8"/><path d="M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"/></svg>
}
function IconAgenda({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconAprov({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
}
function IconChat({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
}
function IconMais({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
}

const mainTabs = [
  { to: '/dashboard', label: 'Início',     Icon: IconHome,   exact: true },
  { to: '/agenda',    label: 'Agenda',     Icon: IconAgenda  },
  { to: '/aprovacoes',label: 'Aprovações', Icon: IconAprov   },
  { to: '/chat',      label: 'Chat',       Icon: IconChat    },
]

// Menu "Mais" — rotas secundárias
const maisItens = [
  { to: '/pacientes',    label: '👥 Pacientes'   },
  { to: '/consultas',    label: '📋 Consultas'   },
  { to: '/resultados',   label: '📄 Resultados'  },
  { to: '/usuarios',     label: '👤 Usuários',   roles: ['admin', 'coordenador'] },
  { to: '/relatorios',   label: '📊 Relatórios', roles: ['admin', 'coordenador'] },
  { to: '/configuracoes',label: '⚙️ Configurações' },
]

export default function LayoutInterno() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [pendentes, setPendentes] = useState(0)
  const [chatNaoLidas, setChatNaoLidas] = useState(0)
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchBadges()
    const sub = supabase.channel('interno-badges-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, fetchBadges)
      .subscribe()
    const polling = setInterval(fetchBadges, 30000)
    return () => { supabase.removeChannel(sub); clearInterval(polling) }
  }, [profile])

  async function fetchBadges() {
    const { data: solics } = await supabase
      .from('solicitacoes').select('id, consulta:consultas(medico_id)').eq('status', 'pendente')
    const pending = (solics || []).filter(s =>
      profile?.tipo === 'estagiario' ? s.consulta?.medico_id === profile.id : true
    )
    setPendentes(pending.length)

    const { count } = await supabase.from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('remetente', 'paciente').eq('lida', false).is('tipo', null)
    setChatNaoLidas(count || 0)
  }

  const badges = { '/aprovacoes': pendentes, '/chat': chatNaoLidas }

  // Verifica se alguma rota do "Mais" está ativa
  const maisAtivo = maisItens.some(m => location.pathname.startsWith(m.to))

  const itensVisiveis = maisItens.filter(item =>
    !item.roles || item.roles.includes(profile?.tipo)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#F8FAFC' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>

      {/* Menu "Mais" flutuante */}
      {menuAberto && (
        <>
          <div onClick={() => setMenuAberto(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="mais-menu" style={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))', right: 12, background: 'var(--card)', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 50, overflow: 'hidden', minWidth: 200, border: '1px solid var(--border)' }}>
            {itensVisiveis.map(item => (
              <div key={item.to}
                onClick={() => { navigate(item.to); setMenuAberto(false) }}
                style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', fontSize: 14, fontWeight: 600, color: location.pathname.startsWith(item.to) ? 'var(--p)' : 'var(--text)', background: location.pathname.startsWith(item.to) ? 'var(--p3)' : 'transparent', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Navbar inferior */}
      <nav style={{ display: 'flex', backgroundColor: '#0D1B2A', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 4px', paddingBottom: 'max(20px, calc(8px + env(safe-area-inset-bottom, 0px)))', flexShrink: 0 }}>
        {mainTabs.map(tab => {
          const active = tab.exact
            ? location.pathname === tab.to || location.pathname === '/'
            : location.pathname.startsWith(tab.to)
          const badge = badges[tab.to] || 0
          return (
            <NavLink key={tab.to} to={tab.to} className="nav-tab-btn"
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', position: 'relative' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, border: active ? '1.5px solid #0047AB' : '1.5px dashed #BFDBFE', backgroundColor: active ? '#EFF6FF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', position: 'relative' }}>
                <tab.Icon active={active} />
                {badge > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 50, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, color: active ? '#0047AB' : '#93C5FD', fontWeight: active ? 700 : 400 }}>{tab.label}</span>
            </NavLink>
          )
        })}

        {/* Botão "Mais" */}
        <button onClick={() => setMenuAberto(v => !v)} className="nav-tab-btn"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, border: maisAtivo || menuAberto ? '1.5px solid #0047AB' : '1.5px dashed #BFDBFE', backgroundColor: maisAtivo || menuAberto ? '#EFF6FF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconMais active={maisAtivo || menuAberto} />
          </div>
          <span style={{ fontSize: 10, color: maisAtivo || menuAberto ? '#0047AB' : '#93C5FD', fontWeight: maisAtivo || menuAberto ? 700 : 400 }}>Mais</span>
        </button>
      </nav>
    </div>
  )
}