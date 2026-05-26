import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function HomeInterno() {
  const { perfil, signOut } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ hoje: 0, pendentes: 0, msgs: 0 })
  const [consultasHoje, setConsultasHoje] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDados() }, [])

  async function fetchDados() {
    const hoje = new Date().toISOString().split('T')[0]
    const isEst = perfil?.tipo === 'estagiario'

    let qConsultas = supabase.from('consultas')
      .select('*, paciente:pacientes(nome), sala:salas(nome)')
      .eq('data', hoje)
      .order('hora')
    if (isEst) qConsultas = qConsultas.eq('medico_id', perfil.id)

    const [{ data: consultas }, { data: solics }, { data: msgs }] = await Promise.all([
      qConsultas,
      supabase.from('solicitacoes').select('id').eq('status', 'pendente'),
      supabase.from('mensagens').select('id').eq('lida', false).eq('remetente', 'paciente').is('tipo', null),
    ])

    setConsultasHoje(consultas || [])
    setStats({ hoje: consultas?.length || 0, pendentes: solics?.length || 0, msgs: msgs?.length || 0 })
    setLoading(false)
  }

  const tagColor = s => ({ confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }[s] || '#374151')
  const tagBg = s => ({ confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }[s] || '#F3F4F6')
  const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada' }[s] || s)
  const hora = h => h?.slice(0, 5) || ''

  const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', estagiario: 'Estagiário', recepcionista: 'Recepcionista' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', padding: '52px 20px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>Olá, bem-vindo(a) 👋</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{perfil?.nome?.split(' ')[0]}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{roleLabel[perfil?.tipo] || perfil?.tipo}</span>
              {perfil?.codigo && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{perfil.codigo}</span>}
            </div>
          </div>
          <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '8px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>Sair</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Consultas hoje', value: stats.hoje, color: '#0047AB', bg: '#EFF6FF', icon: '📅' },
            { label: 'Aprovações pend.', value: stats.pendentes, color: '#ca8a04', bg: '#FEFCE8', icon: '⏳', to: '/interno/aprovacoes' },
            { label: 'Msgs não lidas', value: stats.msgs, color: '#dc2626', bg: '#FEF2F2', icon: '💬', to: '/interno/chat' },
          ].map((s, i) => (
            <div key={i} onClick={() => s.to && navigate(s.to)}
              style={{ background: s.bg, borderRadius: 14, padding: '12px 10px', textAlign: 'center', cursor: s.to ? 'pointer' : 'default', border: `1px solid ${s.color}20` }}>
              <p style={{ fontSize: 20, margin: '0 0 4px' }}>{s.icon}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: '0 0 2px' }}>{s.value}</p>
              <p style={{ fontSize: 10, color: '#6B7280', margin: 0, fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Atalhos */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A', marginBottom: 12 }}>Acesso rápido</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Agenda', icon: '📅', to: '/interno/agenda', color: '#0047AB' },
            { label: 'Aprovações', icon: '✅', to: '/interno/aprovacoes', color: '#16a34a' },
            { label: 'Chat', icon: '💬', to: '/interno/chat', color: '#7c3aed' },
            { label: 'Pacientes', icon: '👥', to: '/interno/pacientes', color: '#0891b2' },
            { label: 'Resultados', icon: '📄', to: '/interno/resultados', color: '#ca8a04' },
            { label: perfil?.tipo === 'estagiario' ? 'Minha Escala' : 'Perfil', icon: perfil?.tipo === 'estagiario' ? '🗓️' : '👤', to: perfil?.tipo === 'estagiario' ? '/interno/escala' : '/interno/perfil', color: '#64748b' },
          ].map((item, i) => (
            <button key={i} onClick={() => navigate(item.to)}
              style={{ background: '#fff', borderRadius: 14, padding: '16px 14px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #F3F4F6', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A' }}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Consultas de hoje */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A', marginBottom: 12 }}>Consultas de hoje</p>
        {loading ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Carregando...</p>
        ) : consultasHoje.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 14, padding: 20, textAlign: 'center', color: '#9CA3AF', border: '1px solid #F3F4F6' }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
            <p style={{ fontSize: 13 }}>Nenhuma consulta hoje.</p>
          </div>
        ) : (
          consultasHoje.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#0047AB' }}>{hora(c.hora)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: tagBg(c.status), color: tagColor(c.status) }}>{tagLabel(c.status)}</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: '0 0 4px' }}>{c.paciente?.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{c.tipo}{c.sala?.nome ? ` · ${c.sala.nome}` : ''}</p>
            </div>
          ))
        )}
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}