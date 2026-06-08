import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useNavigate } from 'react-router-dom'
import './Pages.css'

export default function Dashboard() {
  const { profile } = useAuth()
  const { tema } = useTheme()
  const navigate = useNavigate()
  const dark = tema === 'escuro'
  const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
  const isEstagiario = profile?.tipo === 'estagiario'
  const [stats, setStats] = useState({ hoje: 0, pacientes: 0, pendentes: 0, msgs: 0 })
  const [consultas, setConsultas] = useState([])
  const [consultasFiltradas, setConsultasFiltradas] = useState([])
  const [aprovacoes, setAprovacoes] = useState([])
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [grafico, setGrafico] = useState([])
  const [filtro, setFiltro] = useState('hoje')
  const [dataCustom, setDataCustom] = useState('')

  useEffect(() => { fetchDashboard() }, [])
  useEffect(() => { aplicarFiltro(filtro, consultas) }, [filtro, dataCustom, consultas])

  async function fetchDashboard() {
    const hoje = new Date().toISOString().split('T')[0]

    const [{ data: todasConsultas }, { data: pacientes }, { data: solics }, { data: msgs }] =
      await Promise.all([
        (() => {
          let q = supabase.from('consultas').select('*, paciente:pacientes(nome), estagiario:profiles(nome, codigo), sala:salas(nome)').order('data', { ascending: false }).order('hora')
          if (isEstagiario) q = q.eq('medico_id', profile.id)
          return q
        })(),
        supabase.from('pacientes').select('id').eq('ativo', true),
        (() => {
          let q = supabase.from('solicitacoes').select('*, consulta:consultas(*, paciente:pacientes(nome), estagiario:profiles(nome, codigo))').eq('status', 'pendente')
          return q
        })(),
        supabase.from('mensagens').select('paciente_id, paciente:pacientes(nome)').eq('lida', false).eq('remetente', 'paciente'),
      ])

    const consultasHoje = todasConsultas?.filter(c => c.data === hoje) || []
    setConsultas(todasConsultas || [])
    setAprovacoes(solics || [])
    setStats({
      hoje: consultasHoje.length,
      pacientes: pacientes?.length || 0,
      pendentes: solics?.length || 0,
      msgs: msgs?.length || 0,
    })

    const grouped = {}
    msgs?.forEach(m => {
      if (!grouped[m.paciente_id]) grouped[m.paciente_id] = { ...m.paciente, count: 0, paciente_id: m.paciente_id }
      grouped[m.paciente_id].count++
    })
    setChats(Object.values(grouped).slice(0, 4))

    // Build last 7 days chart data
    const dias = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      const count = (todasConsultas || []).filter(c => c.data === key).length
      dias.push({ dia: label, consultas: count })
    }
    setGrafico(dias)
    setLoading(false)
  }

  function aplicarFiltro(tipo, lista) {
    const hoje = new Date().toISOString().split('T')[0]
    const agora = new Date()
    if (tipo === 'hoje') {
      setConsultasFiltradas(lista.filter(c => c.data === hoje))
    } else if (tipo === 'semana') {
      const inicio = new Date(agora)
      const diaSemana = agora.getDay() === 0 ? 6 : agora.getDay() - 1
      inicio.setDate(agora.getDate() - diaSemana)
      const fim = new Date(inicio)
      fim.setDate(inicio.getDate() + 6)
      setConsultasFiltradas(lista.filter(c => c.data >= inicio.toISOString().split('T')[0] && c.data <= fim.toISOString().split('T')[0]))
    } else if (tipo === 'mes') {
      const mes = hoje.slice(0, 7)
      setConsultasFiltradas(lista.filter(c => c.data?.startsWith(mes)))
    } else if (tipo === 'todas') {
      setConsultasFiltradas(lista)
    } else if (tipo === 'data' && dataCustom) {
      setConsultasFiltradas(lista.filter(c => c.data === dataCustom))
    }
  }

  async function handleAprovacao(id, aprovado) {
    const campo = profile?.tipo === 'estagiario' ? 'aprovado_medico' : 'aprovado_admin'
    await supabase.from('solicitacoes').update({ [campo]: aprovado }).eq('id', id)
    const { data } = await supabase.from('solicitacoes').select('*').eq('id', id).single()
    if (data?.aprovado_medico && data?.aprovado_admin) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', id)
      if (data.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', data.consulta_id)
      } else if (data.tipo === 'reagendamento') {
        await supabase.from('consultas').update({ data: data.nova_data, hora: data.nova_hora, status: 'aguardando' }).eq('id', data.consulta_id)
      }
    }
    if (aprovado === false) {
      await supabase.from('solicitacoes').update({ status: 'recusada' }).eq('id', id)
    }
    fetchDashboard()
  }

  const tagClass = (status) => {
    if (status === 'confirmada') return 'tag tg'
    if (status === 'aguardando') return 'tag ta'
    if (status === 'cancelada' || status === 'cancelamento_pendente') return 'tag tr'
    return 'tag tp'
  }

  const tagLabel = (status) => {
    const map = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancelamento pend.', reagendamento_pendente: 'Reagend. pend.' }
    return map[status] || status
  }

  if (loading) return (
    <div className="page">
      <div className="stats-grid" style={{ animation: 'skpulse 1.5s ease-in-out infinite' }}>
        {[1,2,3,4].map(i => <div key={i} className="stat-card" style={{ height: 90, background: 'var(--color-background-secondary)' }} />)}
      </div>
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12, animation: 'skpulse 1.5s ease-in-out 0.1s infinite' }}>
        <div style={{ height: 14, background: 'var(--color-background-secondary)', borderRadius: 6, width: '30%' }} />
        <div style={{ height: 14, background: 'var(--color-background-secondary)', borderRadius: 6, width: '70%' }} />
        <div style={{ height: 14, background: 'var(--color-background-secondary)', borderRadius: 6, width: '50%' }} />
        <div style={{ height: 14, background: 'var(--color-background-secondary)', borderRadius: 6, width: '60%' }} />
      </div>
      <style>{`@keyframes skpulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">Bem-vindo, {profile?.nome?.split(' ')[0]}!</p>
        </div>
        <button className="btn-primary" onClick={() => window.location.href = '/agenda'}>+ Nova consulta</button>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Consultas hoje',      num: stats.hoje,      cls: 'blue', sub: 'Agendadas para hoje',    to: '/agenda' },
          { label: 'Pacientes ativos',    num: stats.pacientes, cls: 'green',sub: 'Cadastrados na clínica', to: '/pacientes' },
          { label: 'Aprovações pend.',    num: stats.pendentes, cls: 'warn', sub: 'Cancel. e reagend.',     to: '/aprovacoes' },
          { label: 'Msgs não lidas',      num: stats.msgs,      cls: 'red',  sub: 'Pacientes aguardando',   to: '/chat' },
        ].map(({ label, num, cls, sub, to }) => (
          <button key={label} className="stat-card" onClick={() => navigate(to)}
            style={{ cursor: 'pointer', background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'left', fontFamily: 'inherit', width: '100%', transition: 'transform .12s, box-shadow .12s' }}
            onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,71,171,0.15)' }}
            onTouchEnd={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
          >
            <div className="stat-label">{label}</div>
            <div className={`stat-num ${cls}`}>{num}</div>
            <div className="stat-sub">{sub}</div>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="card-head" style={{ marginBottom: 12 }}>
          <h3>Consultas — últimos 7 dias</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={grafico} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#1A1D30' : '#f0f0f0'} />
            <XAxis dataKey="dia" tick={{ fontSize: 11, fill: dark ? '#94A3B8' : '#6b7280' }} />
            <YAxis tick={{ fontSize: 11, fill: dark ? '#94A3B8' : '#6b7280' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${dark ? '#1A1D30' : '#e5e7eb'}`, background: dark ? '#13152A' : '#fff', color: dark ? '#fff' : '#0D1B2A' }}
              formatter={(v) => [v, 'Consultas']}
            />
            <Bar dataKey="consultas" fill={dark ? '#818CF8' : '#0047AB'} radius={[4,4,0,0]} name="Consultas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <h3>{isEstagiario ? 'Minhas Consultas' : 'Consultas'}</h3>
            <a href="/agenda">Ver agenda →</a>
          </div>

          <div className="chip-row" style={{ padding: '0 16px 12px' }}>
            {['hoje', 'semana', 'mes', 'todas', 'data'].map(op => (
              <button key={op} onClick={() => setFiltro(op)} className={`chip${filtro === op ? ' chip-active' : ''}`} style={{ padding: '4px 12px', fontSize: 12 }}>
                {op === 'hoje' ? 'Hoje' : op === 'semana' ? 'Esta semana' : op === 'mes' ? 'Este mês' : op === 'todas' ? 'Todas' : 'Data específica'}
              </button>
            ))}
            {filtro === 'data' && (
              <input type="date" value={dataCustom} onChange={e => setDataCustom(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, fontFamily: 'inherit', background: 'var(--card)', color: 'var(--text)' }} />
            )}
          </div>

          <div className="card-body">
            {consultasFiltradas.length === 0 ? (
              <div className="empty">Nenhuma consulta encontrada.</div>
            ) : (
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Paciente</th>
                    <th>Estagiário</th>
                    <th style={{ textAlign: 'center' }}>Sala</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consultasFiltradas.map(c => (
                    <tr key={c.id}>
                      <td>{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                      <td>{c.hora?.slice(0, 5)}</td>
                      <td>
                        <div className="td-user">
                          <div className="av">{c.paciente?.nome?.slice(0, 2).toUpperCase()}</div>
                          {c.paciente?.nome}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{c.estagiario?.nome || '—'}</span>
                          {c.estagiario?.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>{c.estagiario.codigo}</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{c.sala?.nome ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.sala.nome}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
                      <td><span className={tagClass(c.status)}>{tagLabel(c.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="dash-side">
          {aprovacoes.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>⏳ Aprovações pendentes</h3>
                <a href="/aprovacoes">Ver todas →</a>
              </div>
              {aprovacoes.slice(0, 3).map(s => (
                <div key={s.id} className="aprov-item">
                  <div className="aprov-ico">{s.tipo === 'cancelamento' ? '❌' : s.tipo === 'novo_agendamento' ? '🗓️' : '📅'}</div>
                  <div className="aprov-info">
                    <h4>{s.tipo === 'cancelamento' ? 'Cancelamento' : s.tipo === 'novo_agendamento' ? 'Novo Agendamento' : 'Reagendamento'}</h4>
                    <p>{s.consulta?.paciente?.nome} · {s.consulta?.estagiario?.nome}</p>
                  </div>
                  <div className="aprov-btns">
                    <button className="btn-ok" onClick={() => handleAprovacao(s.id, true)}>✓</button>
                    <button className="btn-no" onClick={() => handleAprovacao(s.id, false)}>✗</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {chats.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h3>💬 Chat recente</h3>
                <a href="/chat">Abrir →</a>
              </div>
              {chats.map(c => (
                <div key={c.paciente_id} className="chat-preview-item" onClick={() => window.location.href = '/chat'}>
                  <div className="chat-av">{c.nome?.slice(0, 2).toUpperCase()}</div>
                  <div className="chat-info">
                    <h4>{c.nome}</h4>
                    <p>Nova mensagem</p>
                  </div>
                  {c.count > 0 && <span className="unread">{c.count}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}