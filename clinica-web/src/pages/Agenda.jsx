import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Agenda() {
  const { profile } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [medicos, setMedicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [modal, setModal] = useState(false)
  const [modalSolic, setModalSolic] = useState(null)
  const [form, setForm] = useState({ paciente_id: '', medico_id: '', tipo: 'Psicoterapia', data: '', hora: '', sala: '' })
  const [saving, setSaving] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroMedico, setFiltroMedico] = useState('todos')
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState('dia')

  useEffect(() => { fetchConsultas() }, [data, viewMode])
  useEffect(() => { fetchSelects() }, [])

  async function fetchConsultas() {
    setLoading(true)
    let query = supabase.from('consultas')
      .select('*, paciente:pacientes(nome), medico:profiles(nome, especialidade, crp_crm)')
      .order('data').order('hora')

    if (viewMode === 'dia') {
      query = query.eq('data', data)
    } else if (viewMode === 'semana') {
      const inicio = new Date(data)
      inicio.setDate(inicio.getDate() - inicio.getDay())
      const fim = new Date(inicio)
      fim.setDate(fim.getDate() + 6)
      query = query.gte('data', inicio.toISOString().split('T')[0]).lte('data', fim.toISOString().split('T')[0])
    }

    const { data: rows } = await query
    setConsultas(rows || [])
    setLoading(false)
  }

  async function fetchSelects() {
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from('pacientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('profiles').select('id, nome, especialidade').eq('tipo', 'medico').order('nome'),
    ])
    setPacientes(p || [])
    setMedicos(m || [])
  }

  async function handleAgendar() {
    setSaving(true)
    const { error } = await supabase.from('consultas').insert([{
      paciente_id: form.paciente_id,
      medico_id: form.medico_id,
      tipo: form.tipo,
      data: form.data,
      hora: form.hora,
      sala: form.sala || null,
      status: 'aguardando',
      criado_por: profile.id,
    }])
    if (!error) {
      setModal(false)
      setForm({ paciente_id: '', medico_id: '', tipo: 'Psicoterapia', data: '', hora: '', sala: '' })
      fetchConsultas()
    } else alert('Erro: ' + error.message)
    setSaving(false)
  }

  async function handleEnviarSolic() {
    const { consulta, tipo, nova_data, nova_hora, motivo } = modalSolic
    await supabase.from('solicitacoes').insert([{ consulta_id: consulta.id, tipo, nova_data: nova_data || null, nova_hora: nova_hora || null, motivo: motivo || null }])
    await supabase.from('consultas').update({ status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente' }).eq('id', consulta.id)
    setModalSolic(null)
    fetchConsultas()
    alert('Solicitação enviada!')
  }

  const navData = dias => {
    const d = new Date(data)
    d.setDate(d.getDate() + dias)
    setData(d.toISOString().split('T')[0])
  }

  const tagClass = s => ({ confirmada: 'tag tg', aguardando: 'tag ta', cancelada: 'tag tr', realizada: 'tag tp', cancelamento_pendente: 'tag tr', reagendamento_pendente: 'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }[s] || s)
  const canApprove = ['admin', 'coordenador'].includes(profile?.tipo)
  const tipos = [...new Set(consultas.map(c => c.tipo).filter(Boolean))]

  const filtered = consultas.filter(c => {
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    const matchTipo = filtroTipo === 'todos' || c.tipo === filtroTipo
    const matchMed = filtroMedico === 'todos' || c.medico_id === filtroMedico
    const matchBusca = !busca || c.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.medico?.nome?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchTipo && matchMed && matchBusca
  })

  const dataLabel = viewMode === 'todos' ? 'Todas as consultas'
    : new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <p className="page-sub">{filtered.length} consulta(s) · {dataLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[['dia','Dia'],['semana','Semana'],['todos','Todos']].map(([m,l]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: viewMode === m ? 'var(--p)' : '#fff', color: viewMode === m ? '#fff' : 'var(--text)', transition: '.15s' }}>
                {l}
              </button>
            ))}
          </div>
          {viewMode !== 'todos' && (
            <>
              <button className="btn-outline" onClick={() => navData(-1)}>← Anterior</button>
              <button className="btn-outline" style={{ fontWeight: 700 }} onClick={() => setData(new Date().toISOString().split('T')[0])}>Hoje</button>
              <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
              <button className="btn-outline" onClick={() => navData(1)}>Próximo →</button>
            </>
          )}
          <button className="btn-primary" onClick={() => setModal(true)}>+ Agendar</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" placeholder="🔍 Buscar paciente ou profissional..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 280 }} />
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
            <option value="todos">Todos os status</option>
            <option value="aguardando">Aguardando</option>
            <option value="confirmada">Confirmada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
            <option value="cancelamento_pendente">Cancelamento pend.</option>
            <option value="reagendamento_pendente">Reagend. pend.</option>
          </select>
          {tipos.length > 0 && (
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
              <option value="todos">Todos os tipos</option>
              {tipos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {medicos.length > 0 && (
            <select value={filtroMedico} onChange={e => setFiltroMedico(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
              <option value="todos">Todos os profissionais</option>
              {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          )}
          {(filtroStatus !== 'todos' || filtroTipo !== 'todos' || filtroMedico !== 'todos' || busca) && (
            <button className="btn-outline" style={{ fontSize: 12, padding: '8px 12px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={() => { setFiltroStatus('todos'); setFiltroTipo('todos'); setFiltroMedico('todos'); setBusca('') }}>
              ✕ Limpar
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Consultas {viewMode === 'semana' ? 'da semana' : viewMode === 'todos' ? '— todas' : 'do dia'}</h3>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="empty">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="empty">Nenhuma consulta encontrada.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  {viewMode !== 'dia' && <th>Data</th>}
                  <th>Horário</th>
                  <th>Paciente</th>
                  <th>Profissional</th>
                  <th>Especialidade</th>
                  <th>Tipo</th>
                  <th>Sala</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    {viewMode !== 'dia' && (
                      <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </td>
                    )}
                    <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0, 5)}</td>
                    <td>
                      <div className="td-user">
                        <div className="av">{c.paciente?.nome?.slice(0, 2).toUpperCase()}</div>
                        {c.paciente?.nome}
                      </div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{c.medico?.nome || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.medico?.especialidade || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.tipo}</td>
                    <td>
                      {c.sala
                        ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.sala}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td><span className={tagClass(c.status)}>{tagLabel(c.status)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status === 'aguardando' && canApprove && (
                          <button className="btn-ok" style={{ padding: '4px 10px', fontSize: 12 }} onClick={async () => {
                            await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', c.id)
                            fetchConsultas()
                          }}>Confirmar</button>
                        )}
                        {c.status === 'confirmada' && canApprove && (
                          <button className="btn-ok" style={{ padding: '4px 10px', fontSize: 12, background: 'var(--p3)', color: 'var(--p)' }} onClick={async () => {
                            await supabase.from('consultas').update({ status: 'realizada' }).eq('id', c.id)
                            fetchConsultas()
                          }}>Realizada</button>
                        )}
                        {!['cancelada', 'realizada', 'cancelamento_pendente'].includes(c.status) && (
                          <>
                            <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalSolic({ consulta: c, tipo: 'reagendamento', nova_data: '', nova_hora: '', motivo: '' })}>Reagendar</button>
                            <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalSolic({ consulta: c, tipo: 'cancelamento', nova_data: '', nova_hora: '', motivo: '' })}>Cancelar</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal agendar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <h2>Agendar Consulta</h2>
            <div className="form-grid">
              <div className="fld"><label>Paciente *</label>
                <select value={form.paciente_id} onChange={e => setForm({ ...form, paciente_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="fld"><label>Profissional *</label>
                <select value={form.medico_id} onChange={e => setForm({ ...form, medico_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}{m.especialidade ? ` — ${m.especialidade}` : ''}</option>)}
                </select>
              </div>
              <div className="fld"><label>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  {['Psicoterapia', 'Avaliação Psicológica', 'Consulta Psiquiátrica', 'Neuropsicologia', 'Psicologia Infantil'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="fld"><label>Sala</label>
                <input value={form.sala} onChange={e => setForm({ ...form, sala: e.target.value })} placeholder="Ex: Sala 1, Sala A..." />
              </div>
              <div className="fld"><label>Data *</label>
                <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
              </div>
              <div className="fld"><label>Horário *</label>
                <input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleAgendar} disabled={saving || !form.paciente_id || !form.medico_id || !form.data || !form.hora}>
                {saving ? 'Agendando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal solicitação */}
      {modalSolic && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSolic(null)}>
          <div className="modal">
            <h2>{modalSolic.tipo === 'cancelamento' ? 'Solicitar Cancelamento' : 'Solicitar Reagendamento'}</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Paciente: <strong>{modalSolic.consulta.paciente?.nome}</strong> · {modalSolic.consulta.medico?.nome}
            </p>
            <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>
              ⚠️ Requer aprovação do profissional responsável e do administrador.
            </div>
            <div className="form-grid">
              {modalSolic.tipo === 'reagendamento' && (
                <>
                  <div className="fld"><label>Nova data</label><input type="date" value={modalSolic.nova_data} onChange={e => setModalSolic({ ...modalSolic, nova_data: e.target.value })} /></div>
                  <div className="fld"><label>Novo horário</label><input type="time" value={modalSolic.nova_hora} onChange={e => setModalSolic({ ...modalSolic, nova_hora: e.target.value })} /></div>
                </>
              )}
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Motivo (opcional)</label>
                <textarea rows={2} value={modalSolic.motivo} onChange={e => setModalSolic({ ...modalSolic, motivo: e.target.value })} placeholder="Descreva o motivo..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModalSolic(null)}>Voltar</button>
              <button className="btn-primary" onClick={handleEnviarSolic}>Enviar solicitação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}