import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }
const statusBg    = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }
const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }

const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
const hora    = d => d?.slice(0, 5)

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const acoes = [
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="13" y2="18"/></svg>,
    label: 'Consultas', sub: 'Ver histórico', bg: '#EFF6FF', color: '#0047AB', to: '/consultas'
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    label: 'Chat', sub: 'Fale conosco', bg: '#ECFDF5', color: '#059669', to: '/chat', badge: true
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    label: 'Agendar', sub: 'Nova consulta', bg: '#FFFBEB', color: '#D97706', to: '/agendar'
  },
  {
    icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    label: 'Resultados', sub: 'Meus exames', bg: '#F5F3FF', color: '#7C3AED', to: '/perfil'
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { paciente } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [proxima, setProxima] = useState(null)
  const [msgs, setMsgs] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { fetchDados() }, [paciente])

  async function fetchDados() {
    if (!paciente) return
    setRefreshing(true)
    const hoje = new Date().toISOString().split('T')[0]
    const [{ data: cons }, { data: mensagens }] = await Promise.all([
      supabase.from('consultas').select('*, medico:profiles(nome, especialidade)').eq('paciente_id', paciente.id).gte('data', hoje).order('data').order('hora').limit(5),
      supabase.from('mensagens').select('id').eq('paciente_id', paciente.id).eq('remetente', 'clinica').eq('lida', false),
    ])
    setConsultas(cons || [])
    setProxima(cons?.[0] || null)
    setMsgs(mensagens?.length || 0)
    setRefreshing(false)
  }

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100%' }}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerBg} />
        <div style={s.headerContent}>
          <div>
            <p style={s.greeting}>{saudacao()} <span style={{ fontSize: 18 }}>👋</span></p>
            <p style={s.nome}>{paciente?.nome?.split(' ')[0] || 'Paciente'}</p>
            <p style={s.headerSub}>Como você está hoje?</p>
          </div>
          <button style={s.notifBtn} onClick={() => navigate('/chat')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={msgs > 0 ? '#fff' : 'rgba(255,255,255,0.9)'} strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {msgs > 0 && <span style={s.badge}>{msgs}</span>}
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Card próxima consulta */}
        {proxima ? (
          <div style={s.proximaCard}>
            <div style={s.proximaCircle} />
            <div style={s.proximaCircle2} />
            <p style={s.proximaLabel}>● PRÓXIMA CONSULTA</p>
            <p style={s.proximaData}>{fmtData(proxima.data)}</p>
            <p style={s.proximaHora}>⏰ {hora(proxima.hora)} · Dr(a). {proxima.medico?.nome}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={s.proximaTipo}>{proxima.tipo}</span>
              <button style={s.verDetalhesBtn} onClick={() => navigate('/consultas')}>Ver detalhes →</button>
            </div>
          </div>
        ) : (
          <div style={s.semConsultaCard}>
            <div style={s.semConsultaLeft}>
              <p style={s.semConsultaTitulo}>Nenhuma consulta agendada</p>
              <p style={s.semConsultaSub}>Que tal agendar sua próxima consulta?</p>
              <button onClick={() => navigate('/agendar')} style={s.agendarBtn}>Agendar consulta</button>
            </div>
            <div style={s.semConsultaIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#BFDBFE" strokeWidth="1.2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>
              </svg>
            </div>
          </div>
        )}

        {/* Ações rápidas */}
        <p style={s.acoesTitle}>Ações rápidas</p>
        <div style={s.grid}>
          {acoes.map(card => (
            <button key={card.label} style={s.gridCard} onClick={() => navigate(card.to)}>
              <div style={{ ...s.gridIcon, backgroundColor: card.bg }}>
                {card.icon}
              </div>
              <p style={s.gridLabel}>{card.label}</p>
              <p style={s.gridSub}>{card.sub}</p>
              {card.badge && msgs > 0 && <span style={s.gridBadge}>{msgs}</span>}
            </button>
          ))}
        </div>

        {/* Próximas */}
        {consultas.length > 1 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#0D1B2A' }}>Próximas consultas</p>
              <button onClick={() => navigate('/consultas')} style={{ background: 'none', border: 'none', fontSize: 13, color: '#0047AB', fontWeight: 600, cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {consultas.slice(1).map(c => (
              <div key={c.id} style={s.consultaItem}>
                <div style={s.consultaDate}>
                  <p style={s.consultaDay}>{new Date(c.data + 'T12:00:00').getDate()}</p>
                  <p style={s.consultaMon}>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0047AB' }}>{hora(c.hora)}</p>
                  <p style={{ fontSize: 13, color: '#0D1B2A', fontWeight: 600 }}>Dr(a). {c.medico?.nome}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF' }}>{c.tipo}</p>
                </div>
                <span style={{ padding: '5px 10px', borderRadius: 50, fontSize: 10, fontWeight: 700, backgroundColor: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151' }}>
                  {statusLabel[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={fetchDados} disabled={refreshing} style={s.refreshBtn}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
        </svg>
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

const s = {
  header: { position: 'relative', overflow: 'hidden', marginBottom: 0 },
  headerBg: { position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)' },
  headerContent: { position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '52px 16px 28px' },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500, marginBottom: 2 },
  nome: { fontSize: 30, fontWeight: 900, color: '#fff', marginBottom: 4, lineHeight: 1.1 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  notifBtn: { position: 'relative', width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.4)', cursor: 'pointer', flexShrink: 0 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0047AB', fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 3px' },

  proximaCard: { position: 'relative', marginTop: -1, marginBottom: 20, background: 'linear-gradient(135deg, #003d99 0%, #0055cc 100%)', borderRadius: '0 0 24px 24px', padding: '20px 20px 24px', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,71,171,0.25)' },
  proximaCircle: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -50, right: -40 },
  proximaCircle2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: 20 },
  proximaLabel: { fontSize: 10, fontWeight: 800, color: '#93C5FD', letterSpacing: 1.5, marginBottom: 8 },
  proximaData: { fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 6 },
  proximaHora: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 14 },
  proximaTipo: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  verDetalhesBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#fff', fontWeight: 600, cursor: 'pointer' },

  semConsultaCard: { margin: '16px 0 20px', backgroundColor: '#0047AB', borderRadius: 22, padding: '20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 20px rgba(0,71,171,0.25)' },
  semConsultaLeft: { flex: 1 },
  semConsultaTitulo: { fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 },
  semConsultaSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 14 },
  agendarBtn: { background: '#fff', border: 'none', borderRadius: 12, padding: '9px 16px', fontSize: 13, color: '#0047AB', fontWeight: 700, cursor: 'pointer', display: 'inline-block' },
  semConsultaIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 16, flexShrink: 0 },

  acoesTitle: { fontSize: 18, fontWeight: 800, color: '#0D1B2A', marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 },
  gridCard: { position: 'relative', backgroundColor: '#fff', borderRadius: 20, padding: '18px 16px', border: '1px solid #F3F4F6', textAlign: 'left', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  gridIcon: { width: 50, height: 50, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  gridLabel: { fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 3 },
  gridSub: { fontSize: 12, color: '#9CA3AF' },
  gridBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' },

  consultaItem: { backgroundColor: '#fff', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, border: '1px solid #F3F4F6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  consultaDate: { width: 52, height: 52, backgroundColor: '#EFF6FF', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  consultaDay: { fontSize: 22, fontWeight: 800, color: '#0047AB', lineHeight: 1.1 },
  consultaMon: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 700 },

  refreshBtn: { position: 'fixed', bottom: 84, right: 16, width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,71,171,0.4)', border: 'none', cursor: 'pointer' },
}