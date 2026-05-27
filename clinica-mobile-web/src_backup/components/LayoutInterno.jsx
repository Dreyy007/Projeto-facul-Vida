import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const tabs = [
  { to: '/interno',           label: 'Início',      exact: true },
  { to: '/interno/agenda',    label: 'Agenda'       },
  { to: '/interno/aprovacoes',label: 'Aprovações'   },
  { to: '/interno/chat',      label: 'Chat'         },
  { to: '/interno/perfil',    label: 'Perfil'       },
]

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
function IconPerfil({ active }) {
  const c = active ? '#0047AB' : '#93C5FD'
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>
}

const icons = [IconHome, IconAgenda, IconAprov, IconChat, IconPerfil]

export default function LayoutInterno() {
  const location = useLocation()
  const { perfil: profile } = useAuth()
  const [pendentes, setPendentes] = useState(0)
  const [chatNaoLidas, setChatNaoLidas] = useState(0)

  useEffect(() => {
    if (!profile) return
    fetchBadges()
    const sub = supabase.channel('interno-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, fetchBadges)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [profile])

  async function fetchBadges() {
    // Aprovações pendentes
    const { data: solics } = await supabase
      .from('solicitacoes')
      .select('id, consulta:consultas(medico_id)')
      .eq('status', 'pendente')

    let pending = (solics || []).filter(s => {
      if (profile?.tipo === 'estagiario') return s.consulta?.medico_id === profile.id
      return true
    })
    setPendentes(pending.length)

    // Chat não lidas
    const { count } = await supabase
      .from('mensagens')
      .select('id', { count: 'exact', head: true })
      .eq('remetente', 'paciente')
      .eq('lida', false)
    setChatNaoLidas(count || 0)
  }

  const badges = [0, 0, pendentes, chatNaoLidas, 0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#F8FAFC' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Outlet />
      </div>

      <nav style={{ display: 'flex', backgroundColor: '#0D1B2A', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 4px 20px', flexShrink: 0 }}>
        {tabs.map((tab, i) => {
          const active = tab.exact
            ? location.pathname === tab.to
            : location.pathname.startsWith(tab.to)
          const Icon = icons[i]
          const badge = badges[i]
          return (
            <NavLink key={tab.to} to={tab.to} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', position: 'relative' }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, border: active ? '1.5px solid #0047AB' : '1.5px dashed #BFDBFE', backgroundColor: active ? '#EFF6FF' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', position: 'relative' }}>
                <Icon active={active} />
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
      </nav>
    </div>
  )
}