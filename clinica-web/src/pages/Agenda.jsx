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
  const [form, setForm] = useState({ paciente_id: '', medico_id: '', tipo: 'Psicoterapia', data: '', hora: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchConsultas() }, [data])
  useEffect(() => { fetchSelects() }, [])

  async function fetchConsultas() {
    let query = supabase.from('consultas')
      .select('*, paciente:pacientes(nome), medico:profiles(nome)')
      .eq('data', data)
      .order('hora')
    if (profile?.tipo === 'medico') query = query.eq('medico_id', profile.id)
    const { data: rows } = await query
    setConsultas(rows || [])
    setLoading(false)
  }

  async function fetchSelects() {
    const { data: p } = await supabase.from('pacientes').select('id, nome').eq('ativo', true)
    const { data: m } = await supabase.from('profiles').select('id, nome').eq('tipo', 'medico')
    setPacientes(p || [])
    setMedicos(m || [])
  }

  async function handleAgendar() {
    setSaving(true)
    const { error } = await supabase.from('consultas').insert([{ ...form, criado_por: profile.id }])
    if (!error) { setModal(false); setForm({ paciente_id:'', medico_id:'', tipo:'Psicoterapia', data:'', hora:'' }); fetchConsultas() }
    else alert('Erro: ' + error.message)
    setSaving(false)
  }

  async function handleSolicitar(consulta, tipo) {
    // Recepcionista só pode solicitar, não cancelar direto
    setModalSolic({ consulta, tipo, nova_data: '', nova_hora: '' })
  }

  async function handleEnviarSolic() {
    const { consulta, tipo, nova_data, nova_hora } = modalSolic
    await supabase.from('solicitacoes').insert([{
      consulta_id: consulta.id,
      tipo,
      nova_data: nova_data || null,
      nova_hora: nova_hora || null,
    }])
    await supabase.from('consultas').update({ status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente' }).eq('id', consulta.id)
    setModalSolic(null)
    fetchConsultas()
    alert('Solicitação enviada! Aguarda aprovação do médico e administrador.')
  }

  const navData = (dias) => {
    const d = new Date(data)
    d.setDate(d.getDate() + dias)
    setData(d.toISOString().split('T')[0])
  }

  const tagClass = s => ({ confirmada:'tag tg', aguardando:'tag ta', cancelada:'tag tr', realizada:'tag tp', cancelamento_pendente:'tag tr', reagendamento_pendente:'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada:'Confirmada', aguardando:'Aguardando', cancelada:'Cancelada', realizada:'Realizada', cancelamento_pendente:'Cancelamento pend.', reagendamento_pendente:'Reagend. pend.' }[s] || s)

  const canApprove = ['admin', 'coordenador'].includes(profile?.tipo)

  if (loading) return <div className="page-loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <p className="page-sub">{consultas.length} consulta(s) em {new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" onClick={() => navData(-1)}>← Anterior</button>
          <button className="btn-outline" style={{ fontWeight: 700 }} onClick={() => setData(new Date().toISOString().split('T')[0])}>Hoje</button>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}/>
          <button className="btn-outline" onClick={() => navData(1)}>Próximo →</button>
          <button className="btn-primary" onClick={() => setModal(true)}>+ Agendar consulta</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Consultas do dia</h3></div>
        <div className="card-body">
          {consultas.length === 0 ? (
            <div className="empty">Nenhuma consulta neste dia.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Horário</th><th>Paciente</th><th>Profissional</th><th>Tipo</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {consultas.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0,5)}</td>
                    <td>
                      <div className="td-user">
                        <div className="av">{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>
                        {c.paciente?.nome}
                      </div>
                    </td>
                    <td>{c.medico?.nome}</td>
                    <td>{c.tipo}</td>
                    <td><span className={tagClass(c.status)}>{tagLabel(c.status)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {c.status === 'aguardando' && canApprove && (
                          <button className="btn-ok" onClick={async () => {
                            await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', c.id)
                            fetchConsultas()
                          }}>Confirmar</button>
                        )}
                        {!['cancelada', 'realizada', 'cancelamento_pendente'].includes(c.status) && (
                          <>
                            <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSolicitar(c, 'reagendamento')}>Reagendar</button>
                            <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSolicitar(c, 'cancelamento')}>Cancelar</button>
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
          <div className="modal">
            <h2>Agendar Consulta</h2>
            <div className="form-grid">
              <div className="fld"><label>Paciente *</label>
                <select value={form.paciente_id} onChange={e => setForm({...form, paciente_id: e.target.value})}>
                  <option value="">Selecionar...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="fld"><label>Profissional *</label>
                <select value={form.medico_id} onChange={e => setForm({...form, medico_id: e.target.value})}>
                  <option value="">Selecionar...</option>
                  {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="fld"><label>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  {['Psicoterapia','Avaliação Psicológica','Consulta Psiquiátrica','Neuropsicologia','Psicologia Infantil'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="fld"><label>Data *</label><input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})}/></div>
              <div className="fld"><label>Horário *</label><input type="time" value={form.hora} onChange={e => setForm({...form, hora: e.target.value})}/></div>
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
              ⚠️ Esta solicitação precisa de aprovação do médico responsável e do administrador.
            </div>
            {modalSolic.tipo === 'reagendamento' && (
              <div className="form-grid">
                <div className="fld"><label>Nova data</label><input type="date" value={modalSolic.nova_data} onChange={e => setModalSolic({...modalSolic, nova_data: e.target.value})}/></div>
                <div className="fld"><label>Novo horário</label><input type="time" value={modalSolic.nova_hora} onChange={e => setModalSolic({...modalSolic, nova_hora: e.target.value})}/></div>
              </div>
            )}
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
