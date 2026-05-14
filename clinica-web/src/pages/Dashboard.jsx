import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ hoje: 0, pacientes: 0, pendentes: 0, msgs: 0 })
  const [consultas, setConsultas] = useState([])
  const [consultasFiltradas, setConsultasFiltradas] = useState([])
  const [aprovacoes, setAprovacoes] = useState([])
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoje')
  const [dataCustom, setDataCustom] = useState('')

  useEffect(() => {
    fetchDashboard()
  }, [])

  useEffect(() => {
    aplicarFiltro(filtro, consultas)
  }, [filtro, dataCustom, consultas])

  async function fetchDashboard() {
    const hoje = new Date().toISOString().split('T')[0]
    const isMedico = profile?.tipo === 'medico'

    let consultasQuery = supabase.from('consultas').select('*, paciente:pacientes(nome), medico:profiles(nome)').order('data', { ascending: false }).order('hora')
    if (isMedico) consultasQuery = consultasQuery.eq('medico_id', profile.id)

    let pacientesQuery = supabase.from('pacientes').select('id').eq('ativo', true)
    if (isMedico) pacientesQuery = pacientesQuery.eq('medico_id', profile.id)

    const [{ data: todasConsultas }, { data: pacientes }, { data: solics }, { data: msgs }] =
      await Promise.all([
        consultasQuery,
        pacientesQuery,
        supabase.from('solicitacoes').select('*, consulta:consultas(*, paciente:pacientes(nome), medico:profiles(nome))').eq('status', 'pendente'),
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
    setLoading(false)
  }

  function aplicarFiltro(tipo, lista) {
    const hoje = new Date().toISOString().split('T')[0]
    const agora = new Date()

    if (tipo === 'hoje') {
      setConsultasFiltradas(lista.filter(c => c.data === hoje))
    } else if (tipo === 'semana') {
      const inicio = new Date(agora)
      inicio.setDate(agora.getDate() - agora.getDay())
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
    const campo = profile?.tipo === 'medico' ? 'aprovado_medico' : 'aprovado_admin'
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

  if (loading) return <div className="page-loading">Carregando...</div>

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
        <div className="stat-card">
          <div className="stat-label">Consultas hoje</div>
          <div className="stat-num blue">{stats.hoje}</div>
          <div className="stat-sub">Agendadas para hoje</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pacientes ativos</div>
          <div className="stat-num green">{stats.pacientes}</div>
          <div className="stat-sub">Cadastrados na clínica</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aprovações pendentes</div>
          <div className="stat-num warn">{stats.pendentes}</div>
          <div className="stat-sub">Cancel. e reagend.</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Msgs não lidas</div>
          <div className="stat-num red">{stats.msgs}</div>
          <div className="stat-sub">Pacientes aguardando</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <h3>Consultas</h3>
            <a href="/agenda">Ver agenda →</a>
          </div>

          {/* FILTRO */}
          <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {['hoje', 'semana', 'mes', 'todas', 'data'].map(op => (
              <button
                key={op}
                onClick={() => setFiltro(op)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  border: '1px solid #d1d5db',
                  background: filtro === op ? '#2563eb' : '#fff',
                  color: filtro === op ? '#fff' : '#374151',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: filtro === op ? 600 : 400,
                }}
              >
                {op === 'hoje' ? 'Hoje' : op === 'semana' ? 'Esta semana' : op === 'mes' ? 'Este mês' : op === 'todas' ? 'Todas' : 'Data específica'}
              </button>
            ))}
            {filtro === 'data' && (
              <input
                type="date"
                value={dataCustom}
                onChange={e => setDataCustom(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
              />
            )}
          </div>

          <div className="card-body">
            {consultasFiltradas.length === 0 ? (
              <div className="empty">Nenhuma consulta encontrada.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Paciente</th>
                    <th>Profissional</th>
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
                      <td>{c.medico?.nome}</td>
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
                  <div className="aprov-ico">{s.tipo === 'cancelamento' ? '❌' : '📅'}</div>
                  <div className="aprov-info">
                    <h4>{s.tipo === 'cancelamento' ? 'Cancelamento' : 'Reagendamento'}</h4>
                    <p>{s.consulta?.paciente?.nome} · {s.consulta?.medico?.nome}</p>
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
