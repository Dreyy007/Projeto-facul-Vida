import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const statusColor  = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }
const statusBg     = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }
const statusLabel  = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }

const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
const hora    = d => d?.slice(0, 5)

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

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
    <div style={{ backgroundColor: '#fff', minHeight: '100%' }}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <p style={s.greeting}>{saudacao()} 👋</p>
          <p style={s.nome}>{paciente?.nome?.split(' ')[0]}</p>
        </div>
        <button style={s.chatBtn} onClick={() => navigate('/chat')}>
          <span style={{ fontSize: 20 }}>🔔</span>
          {msgs > 0 && <span style={s.badge}>{msgs}</span>}
        </button>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Card próxima consulta */}
        {proxima ? (
          <div style={s.proximaCard}>
            <div style={s.proximaCircle} />
            <p style={s.proximaLabel}>● PRÓXIMA CONSULTA</p>
            <p style={s.proximaData}>{fmtData(proxima.data)}</p>
            <p style={s.proximaHora}>⏰ {hora(proxima.hora)} · Dr(a). {proxima.medico?.nome}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={s.proximaTipo}>{proxima.tipo}</span>
              <span style={s.statusTagDark}>{statusLabel[proxima.status] || proxima.status}</span>
            </div>
          </div>
        ) : (
          <div style={s.semConsultaCard}>
            <p style={{ fontSize: 36, marginBottom: 10 }}>📭</p>
            <p style={s.semConsultaText}>Nenhuma consulta agendada</p>
            <button onClick={() => navigate('/consultas')} style={{ background: 'none', border: 'none', fontSize: 14, color: '#0047AB', fontWeight: 700, cursor: 'pointer' }}>
              Agendar →
            </button>
          </div>
        )}

        {/* Ações rápidas */}
        <p style={s.acoesTitle}>Ações rápidas</p>

        <div style={s.grid}>
          {[
            { icon: '📋', label: 'Consultas', sub: 'Ver histórico', bg: '#EFF6FF', to: '/consultas' },
            { icon: '💬', label: 'Chat', sub: 'Fale conosco', bg: '#F0FDF4', to: '/chat', badge: msgs },
            { icon: '➕', label: 'Agendar', sub: 'Nova consulta', bg: '#FFF7ED', to: '/consultas' },
            { icon: '📄', label: 'Resultados', sub: 'Meus exames', bg: '#FAF5FF', to: '/perfil' },
          ].map(card => (
            <button key={card.label} style={s.gridCard} onClick={() => navigate(card.to)}>
              <div style={{ ...s.gridIcon, backgroundColor: card.bg }}>
                <span style={{ fontSize: 22 }}>{card.icon}</span>
              </div>
              <p style={s.gridLabel}>{card.label}</p>
              <p style={s.gridSub}>{card.sub}</p>
              {card.badge > 0 && <span style={s.gridBadge}>{card.badge}</span>}
            </button>
          ))}
        </div>

        {/* Próximas consultas */}
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
                  <p style={{ fontSize: 13, color: '#0D1B2A', fontWeight: 500 }}>Dr(a). {c.medico?.nome}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF' }}>{c.tipo}</p>
                </div>
                <span style={{ ...s.statusTagSm, backgroundColor: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151' }}>
                  {statusLabel[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pull-to-refresh button */}
      <button
        onClick={fetchDados}
        disabled={refreshing}
        style={{ position: 'fixed', bottom: 84, right: 16, width: 40, height: 40, borderRadius: '50%', background: '#0047AB', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,71,171,0.3)', opacity: refreshing ? 0.5 : 1 }}
      >
        {refreshing ? '⏳' : '↻'}
      </button>
    </div>
  )
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '48px 20px 20px', backgroundColor: '#fff' },
  greeting: { fontSize: 13, color: '#9CA3AF', fontWeight: 500 },
  nome: { fontSize: 26, fontWeight: 800, color: '#0D1B2A', marginTop: 2 },
  chatBtn: { position: 'relative', width: 42, height: 42, borderRadius: 12, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 3px' },

  proximaCard: { position: 'relative', marginBottom: 24, backgroundColor: '#0047AB', borderRadius: 22, padding: 22, overflow: 'hidden' },
  proximaCircle: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#1a6fdf', top: -30, right: -30, opacity: 0.5 },
  proximaLabel: { fontSize: 10, fontWeight: 800, color: '#93C5FD', letterSpacing: 1, marginBottom: 8 },
  proximaData: { fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 6 },
  proximaHora: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 14 },
  proximaTipo: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  statusTagDark: { padding: '5px 12px', borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', fontSize: 11, color: '#fff', fontWeight: 600 },

  semConsultaCard: { marginBottom: 24, backgroundColor: '#F8FAFC', borderRadius: 22, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px dashed #E5E7EB' },
  semConsultaText: { fontSize: 14, color: '#6B7280', marginBottom: 10 },

  acoesTitle: { fontSize: 17, fontWeight: 800, color: '#0D1B2A', marginBottom: 12 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 },
  gridCard: { position: 'relative', backgroundColor: '#fff', borderRadius: 18, padding: 18, border: '1px solid #E5E7EB', textAlign: 'left', cursor: 'pointer' },
  gridIcon: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  gridLabel: { fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 3 },
  gridSub: { fontSize: 11, color: '#9CA3AF' },
  gridBadge: { position: 'absolute', top: 14, right: 14, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' },

  consultaItem: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, border: '1px solid #E5E7EB' },
  consultaDate: { width: 48, height: 48, backgroundColor: '#EFF6FF', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  consultaDay: { fontSize: 20, fontWeight: 800, color: '#0047AB', lineHeight: 1.1 },
  consultaMon: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 },
  statusTagSm: { padding: '5px 10px', borderRadius: 50, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' },
}
