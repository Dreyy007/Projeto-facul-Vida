import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }
const statusBg    = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }
const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function HomeInterno() {
  const navigate = useNavigate()
  const { perfil: profile } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [pendentes, setPendentes] = useState(0)
  const [proxima, setProxima] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDados() }, [profile])

  async function fetchDados() {
    if (!profile) return
    const hoje = new Date().toISOString().split('T')[0]

    let q = supabase.from('consultas')
      .select('*, paciente:pacientes(nome)')
      .gte('data', hoje)
      .not('status', 'in', '("cancelada","realizada")')
      .order('data').order('hora')

    if (profile.tipo === 'estagiario') q = q.eq('medico_id', profile.id)

    const { data: cons } = await q
    setConsultas(cons || [])
    setProxima(cons?.[0] || null)

    // pendentes
    const { data: solics } = await supabase.from('solicitacoes').select('id, consulta:consultas(medico_id)').eq('status', 'pendente')
    let pend = (solics || [])
    if (profile.tipo === 'estagiario') pend = pend.filter(s => s.consulta?.medico_id === profile.id)
    setPendentes(pend.length)

    setLoading(false)
  }

  const acoes = [
    { label: 'Agenda', sub: 'Ver consultas', bg: '#EFF6FF', color: '#0047AB', to: '/interno/agenda',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { label: 'Aprovações', sub: `${pendentes} pendente(s)`, bg: pendentes > 0 ? '#FEF3C7' : '#F3F4F6', color: pendentes > 0 ? '#92400E' : '#6B7280', to: '/interno/aprovacoes',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={pendentes > 0 ? '#D97706' : '#6B7280'} strokeWidth="2" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
    { label: 'Pacientes', sub: 'Meus pacientes', bg: '#F0FDF4', color: '#166534', to: '/interno/pacientes',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="19" cy="7" r="2"/><path d="M23 21v-1a2 2 0 00-2-2h-1"/></svg> },
    { label: 'Chat', sub: 'Mensagens', bg: '#ECFDF5', color: '#059669', to: '/interno/chat',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
    { label: 'Escala', sub: 'Meus horários', bg: '#F5F3FF', color: '#7C3AED', to: '/interno/escala',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: 'Resultados', sub: 'Laudos', bg: '#FFF7ED', color: '#EA580C', to: '/interno/resultados',
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ]

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #DBEAFE', borderTop: '3px solid #0047AB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 24, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 }} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{saudacao()},</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{profile?.nome?.split(' ')[0]}</p>
        {profile?.codigo && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{profile.codigo}</span>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Próxima consulta */}
        {proxima && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 16, border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Próxima consulta</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#0D1B2A', marginBottom: 4 }}>{proxima.paciente?.nome}</p>
                <p style={{ fontSize: 13, color: '#0047AB', fontWeight: 700 }}>
                  {new Date(proxima.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} · {proxima.hora?.slice(0, 5)}
                </p>
              </div>
              <span style={{ background: statusBg[proxima.status] || '#F3F4F6', color: statusColor[proxima.status] || '#374151', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 50 }}>
                {statusLabel[proxima.status] || proxima.status}
              </span>
            </div>
          </div>
        )}

        {/* Ações rápidas */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acesso rápido</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {acoes.map(a => (
            <button key={a.to} style={{ backgroundColor: a.bg, borderRadius: 16, padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 10, border: 'none', cursor: 'pointer', textAlign: 'left' }}
              onClick={() => navigate(a.to)}>
              <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {a.icon}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: a.color, marginBottom: 2 }}>{a.label}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{a.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Consultas do dia */}
        {consultas.length > 0 && (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Hoje ({consultas.filter(c => c.data === new Date().toISOString().split('T')[0]).length})</p>
            {consultas.filter(c => c.data === new Date().toISOString().split('T')[0]).map(c => (
              <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F3F4F6' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A' }}>{c.paciente?.nome}</p>
                  <p style={{ fontSize: 12, color: '#0047AB', fontWeight: 600 }}>{c.hora?.slice(0, 5)} · {c.tipo}</p>
                </div>
                <span style={{ background: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 50 }}>
                  {statusLabel[c.status] || c.status}
                </span>
              </div>
            ))}
          </>
        )}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}