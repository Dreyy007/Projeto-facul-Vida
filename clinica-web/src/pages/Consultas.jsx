import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

function limparNome(nome) {
  if (!nome) return nome
  return nome.replace(/^(Dr\.?\s*|Dra\.?\s*)/i, '').trim()
}

export default function Consultas() {
  const { profile } = useAuth()
  const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
  const isEstagiario = profile?.tipo === 'estagiario'

  const [consultas, setConsultas] = useState([])
  const [filtradas, setFiltradas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoje')
  const [dataCustom, setDataCustom] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  useEffect(() => { fetchConsultas() }, [])
  useEffect(() => { aplicarFiltro(filtro, consultas) }, [filtro, dataCustom, busca, filtroStatus, consultas])

  async function fetchConsultas() {
    let q = supabase
      .from('consultas')
      .select('*, paciente:pacientes(nome, cpf), estagiario:profiles(nome, codigo), sala:salas(nome)')
      .order('data', { ascending: false })
      .order('hora')

    if (isEstagiario) q = q.eq('medico_id', profile.id)

    const { data } = await q
    setConsultas(data || [])
    setLoading(false)
  }

  function aplicarFiltro(tipo, lista) {
    const hoje = new Date().toISOString().split('T')[0]
    const agora = new Date()
    let result = [...lista]

    if (tipo === 'hoje') {
      result = result.filter(c => c.data === hoje)
    } else if (tipo === 'semana') {
      const inicio = new Date(agora)
      const diaSemana = agora.getDay() === 0 ? 6 : agora.getDay() - 1
      inicio.setDate(agora.getDate() - diaSemana)
      const fim = new Date(inicio)
      fim.setDate(inicio.getDate() + 6)
      result = result.filter(c => c.data >= inicio.toISOString().split('T')[0] && c.data <= fim.toISOString().split('T')[0])
    } else if (tipo === 'mes') {
      result = result.filter(c => c.data?.startsWith(hoje.slice(0, 7)))
    } else if (tipo === 'data' && dataCustom) {
      result = result.filter(c => c.data === dataCustom)
    }

    if (busca) {
      const q = busca.toLowerCase()
      result = result.filter(c =>
        c.paciente?.nome?.toLowerCase().includes(q) ||
        c.paciente?.cpf?.includes(q) ||
        c.estagiario?.nome?.toLowerCase().includes(q) ||
        c.estagiario?.codigo?.toLowerCase().includes(q)
      )
    }

    if (filtroStatus) result = result.filter(c => c.status === filtroStatus)

    setFiltradas(result)
  }

  const tagClass = s => ({ confirmada: 'tag tg', aguardando: 'tag ta', cancelada: 'tag tr', realizada: 'tag tg', agendada: 'tag tp' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', agendada: 'Agendada', troca_sala_pendente: 'Troca sala pend.' }[s] || s)

  if (loading) return <div className="page-loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{isEstagiario ? 'Minhas Consultas' : 'Consultas'}</h1>
          <p className="page-sub">{filtradas.length} consulta(s) encontrada(s)</p>
        </div>
      </div>

      {/* FILTROS */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['hoje', 'semana', 'mes', 'todas', 'data'].map(op => (
          <button key={op} onClick={() => setFiltro(op)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #d1d5db', background: filtro === op ? '#2563eb' : '#fff', color: filtro === op ? '#fff' : '#374151', cursor: 'pointer', fontSize: 13, fontWeight: filtro === op ? 600 : 400 }}>
            {op === 'hoje' ? 'Hoje' : op === 'semana' ? 'Esta semana' : op === 'mes' ? 'Este mês' : op === 'todas' ? 'Todas' : 'Data específica'}
          </button>
        ))}
        {filtro === 'data' && (
          <input type="date" value={dataCustom} onChange={e => setDataCustom(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input placeholder="🔍 Buscar paciente, CPF, estagiário ou código..." value={busca} onChange={e => setBusca(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: '#fff' }}>
          <option value="">Todos os status</option>
          <option value="confirmada">Confirmada</option>
          <option value="aguardando">Aguardando</option>
          <option value="agendada">Agendada</option>
          <option value="cancelada">Cancelada</option>
          <option value="realizada">Realizada</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: '0 4px' }}>
          {filtradas.length === 0 ? (
            <div className="empty">Nenhuma consulta encontrada.</div>
          ) : (
            <table className="tbl" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Paciente</th>
                  <th>CPF</th>
                  {isAdmin && <th>Estagiário</th>}
                  <th>Tipo</th>
                  <th style={{ textAlign: 'center' }}>Sala</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.data ? new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                    <td>{c.hora?.slice(0, 5)}</td>
                    <td>
                      <div className="td-user">
                        <div className="av">{c.paciente?.nome?.slice(0, 2).toUpperCase()}</div>
                        <span>{c.paciente?.nome}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.paciente?.cpf || '—'}</td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{limparNome(c.estagiario?.nome) || '—'}</span>
                          {c.estagiario?.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6 }}>{c.estagiario.codigo}</span>}
                        </div>
                      </td>
                    )}
                    <td style={{ fontSize: 13 }}>{c.tipo || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {c.sala?.nome
                        ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{c.sala.nome}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td><span className={tagClass(c.status)}>{tagLabel(c.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}