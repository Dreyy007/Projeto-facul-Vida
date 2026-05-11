import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ hoje: 0, pacientes: 0, pendentes: 0, msgs: 0 })
  const [consultasHoje, setConsultasHoje] = useState([])
  const [aprovacoes, setAprovacoes] = useState([])
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  async function fetchDashboard() {
    const hoje = new Date().toISOString().split('T')[0]

    const [{ data: consultas }, { data: pacientes }, { data: solics }, { data: msgs }] =
      await Promise.all([
        supabase.from('consultas').select('*, paciente:pacientes(nome), medico:profiles(nome)').eq('data', hoje).order('hora'),
        supabase.from('pacientes').select('id').eq('ativo', true),
        supabase.from('solicitacoes').select('*, consulta:consultas(*, paciente:pacientes(nome), medico:profiles(nome))').eq('status', 'pendente'),
        supabase.from('mensagens').select('paciente_id, paciente:pacientes(nome)').eq('lida', false).eq('remetente', 'paciente'),
      ])

    setConsultasHoje(consultas || [])
    setAprovacoes(solics || [])
    setStats({
      hoje: consultas?.length || 0,
      pacientes: pacientes?.length || 0,
      pendentes: solics?.length || 0,
      msgs: msgs?.length || 0,
    })

    // agrupa msgs por paciente
    const grouped = {}
    msgs?.forEach(m => {
      if (!grouped[m.paciente_id]) grouped[m.paciente_id] = { ...m.paciente, count: 0, paciente_id: m.paciente_id }
      grouped[m.paciente_id].count++
    })
    setChats(Object.values(grouped).slice(0, 4))
    setLoading(false)
  }

  async function handleAprovacao(id, aprovado) {
    const campo = profile?.tipo === 'medico' ? 'aprovado_medico' : 'aprovado_admin'
    await supabase.from('solicitacoes').update({ [campo]: aprovado }).eq('id', id)

    // verifica se ambos aprovaram
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
            <h3>Consultas de hoje</h3>
            <a href="/agenda">Ver agenda →</a>
          </div>
          <div className="card-body">
            {consultasHoje.length === 0 ? (
              <div className="empty">Nenhuma consulta hoje.</div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Paciente</th>
                    <th>Profissional</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consultasHoje.map(c => (
                    <tr key={c.id}>
                      <td>{c.hora?.slice(0, 5)}</td>
                      <td>
                        <div className="td-user">
                          <div className="av">{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>
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
              {aprovacoes.slice(0,3).map(s => (
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
                  <div className="chat-av">{c.nome?.slice(0,2).toUpperCase()}</div>
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
