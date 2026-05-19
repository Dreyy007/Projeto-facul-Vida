import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Agenda() {
  const { profile } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [estagiarios, setEstagiarios] = useState([])
  const [salas, setSalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [modal, setModal] = useState(false)
  const [modalSolic, setModalSolic] = useState(null)
  const [modalTrocaSala, setModalTrocaSala] = useState(null)
  const [conflito, setConflito] = useState(null)
  const [salaOcupada, setSalaOcupada] = useState(null)
  const [buscaEstagiario, setBuscaEstagiario] = useState('')
  const [estagiarioSelecionado, setEstagiarioSelecionado] = useState(null)
  const [showDrop, setShowDrop] = useState(false)
  const [form, setForm] = useState({ paciente_id: '', estagiario_id: '', tipo: 'Psicoterapia', data: '', hora: '', sala_id: '' })
  const [saving, setSaving] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroSala, setFiltroSala] = useState('todos')
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState('dia')

  useEffect(() => { fetchConsultas() }, [data, viewMode])
  useEffect(() => { fetchSelects() }, [])
  useEffect(() => { setConflito(null); setSalaOcupada(null) }, [form.estagiario_id, form.paciente_id, form.data, form.hora, form.sala_id])

  async function fetchConsultas() {
    setLoading(true)
    let query = supabase.from('consultas')
      .select('*, paciente:pacientes(nome), estagiario:profiles(nome, codigo), sala:salas(nome, id)')
      .order('data').order('hora')

    if (viewMode === 'dia') query = query.eq('data', data)
    else if (viewMode === 'semana') {
      const d = new Date(data + 'T12:00:00')
      const ds = d.getDay() === 0 ? 6 : d.getDay() - 1
      const ini = new Date(d); ini.setDate(d.getDate() - ds)
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      query = query.gte('data', ini.toISOString().split('T')[0]).lte('data', fim.toISOString().split('T')[0])
    }
    if (profile?.tipo === 'estagiario') query = query.eq('medico_id', profile.id)

    const { data: rows } = await query
    setConsultas(rows || [])
    setLoading(false)
  }

  async function fetchSelects() {
    const [{ data: p }, { data: e }, { data: s }] = await Promise.all([
      supabase.from('pacientes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('profiles').select('id, nome, codigo').eq('tipo', 'estagiario').order('nome'),
      supabase.from('salas').select('*').eq('ativa', true).order('nome'),
    ])
    setPacientes(p || [])
    setEstagiarios(e || [])
    setSalas(s || [])
    if (profile?.tipo === 'estagiario') {
      setEstagiarioSelecionado(profile)
      setBuscaEstagiario(profile.codigo ? `${profile.codigo} — ${profile.nome}` : profile.nome)
      setForm(f => ({ ...f, estagiario_id: profile.id }))
    }
  }

  const estFiltrados = estagiarios.filter(e => {
    const q = buscaEstagiario.toLowerCase()
    return e.nome?.toLowerCase().includes(q) || e.codigo?.toLowerCase().includes(q)
  })

  function selecionarEst(e) {
    setEstagiarioSelecionado(e)
    setBuscaEstagiario(e.codigo ? `${e.codigo} — ${e.nome}` : e.nome)
    setForm(f => ({ ...f, estagiario_id: e.id }))
    setShowDrop(false)
  }

  async function verificarConflitos() {
    if (!form.estagiario_id || !form.data || !form.hora) return false
    const { data: c1 } = await supabase.from('consultas').select('id, paciente:pacientes(nome)').eq('medico_id', form.estagiario_id).eq('data', form.data).eq('hora', form.hora).not('status', 'in', '("cancelada","realizada")')
    if (c1?.length > 0) { setConflito(`Conflito: ${c1[0].paciente?.nome} já está agendado neste horário com este estagiário.`); return true }
    const { data: c2 } = await supabase.from('consultas').select('id').eq('paciente_id', form.paciente_id).eq('data', form.data).eq('hora', form.hora).not('status', 'in', '("cancelada","realizada")')
    if (c2?.length > 0) { setConflito('Conflito: este paciente já tem consulta neste horário.'); return true }
    if (form.sala_id) {
      const { data: c3 } = await supabase.from('consultas').select('id, paciente:pacientes(nome), estagiario:profiles(nome)').eq('sala_id', form.sala_id).eq('data', form.data).eq('hora', form.hora).not('status', 'in', '("cancelada","realizada")')
      if (c3?.length > 0) { setSalaOcupada(`Sala ocupada: ${c3[0].paciente?.nome} com ${c3[0].estagiario?.nome} neste horário.`); return true }
    }
    return false
  }

  async function handleAgendar() {
    setSaving(true); setConflito(null); setSalaOcupada(null)
    if (await verificarConflitos()) { setSaving(false); return }
    const { error } = await supabase.from('consultas').insert([{
      paciente_id: form.paciente_id, medico_id: form.estagiario_id,
      tipo: form.tipo, data: form.data, hora: form.hora,
      sala_id: form.sala_id || null, status: 'aguardando', criado_por: profile.id,
    }])
    if (!error) {
      setModal(false); setConflito(null); setSalaOcupada(null)
      setForm({ paciente_id: '', estagiario_id: profile?.tipo === 'estagiario' ? profile.id : '', tipo: 'Psicoterapia', data: '', hora: '', sala_id: '' })
      if (profile?.tipo !== 'estagiario') { setEstagiarioSelecionado(null); setBuscaEstagiario('') }
      fetchConsultas()
    } else alert('Erro: ' + error.message)
    setSaving(false)
  }

  async function handleEnviarSolic() {
    const { consulta, tipo, nova_data, nova_hora, motivo } = modalSolic
    await supabase.from('solicitacoes').insert([{ consulta_id: consulta.id, tipo, nova_data: nova_data || null, nova_hora: nova_hora || null, motivo: motivo || null }])
    await supabase.from('consultas').update({ status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente' }).eq('id', consulta.id)
    setModalSolic(null); fetchConsultas(); alert('Solicitação enviada para aprovação!')
  }

  async function handleTrocaSala() {
    const { consulta, sala_nova_id, motivo } = modalTrocaSala
    await supabase.from('solicitacoes').insert([{ consulta_id: consulta.id, tipo: 'troca_sala', sala_atual_id: consulta.sala_id || null, sala_nova_id: sala_nova_id || null, motivo: motivo || null }])
    await supabase.from('consultas').update({ status: 'troca_sala_pendente' }).eq('id', consulta.id)
    setModalTrocaSala(null); fetchConsultas(); alert('Solicitação de troca de sala enviada!')
  }

  const navData = d => { const dt = new Date(data + 'T12:00:00'); dt.setDate(dt.getDate() + d); setData(dt.toISOString().split('T')[0]) }
  const tagClass = s => ({ confirmada: 'tag tg', aguardando: 'tag ta', cancelada: 'tag tr', realizada: 'tag tp', cancelamento_pendente: 'tag tr', reagendamento_pendente: 'tag ta', troca_sala_pendente: 'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.', troca_sala_pendente: 'Troca sala pend.' }[s] || s)
  const canApprove = ['admin', 'coordenador'].includes(profile?.tipo)
  const isEstagiario = profile?.tipo === 'estagiario'
  const filtered = consultas.filter(c => {
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    const matchSala = filtroSala === 'todos' || c.sala_id === filtroSala
    const matchBusca = !busca || c.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.estagiario?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.estagiario?.codigo?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchSala && matchBusca
  })
  const dataLabel = viewMode === 'todos' ? 'Todas as consultas' : new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Agenda</h1><p className="page-sub">{filtered.length} consulta(s) · {dataLabel}</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[['dia','Dia'],['semana','Semana'],['todos','Todos']].map(([m,l]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: viewMode === m ? 'var(--p)' : '#fff', color: viewMode === m ? '#fff' : 'var(--text)', transition: '.15s' }}>{l}</button>
            ))}
          </div>
          {viewMode !== 'todos' && (<>
            <button className="btn-outline" onClick={() => navData(-1)}>← Anterior</button>
            <button className="btn-outline" style={{ fontWeight: 700 }} onClick={() => setData(new Date().toISOString().split('T')[0])}>Hoje</button>
            <input type="date" value={data} onChange={e => setData(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
            <button className="btn-outline" onClick={() => navData(1)}>Próximo →</button>
          </>)}
          <button className="btn-primary" onClick={() => setModal(true)}>+ Agendar</button>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" placeholder="🔍 Buscar paciente, estagiário ou código EST..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 300 }} />
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
            <option value="todos">Todos os status</option>
            <option value="aguardando">Aguardando</option>
            <option value="confirmada">Confirmada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
            <option value="troca_sala_pendente">Troca sala pend.</option>
          </select>
          <select value={filtroSala} onChange={e => setFiltroSala(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
            <option value="todos">Todas as salas</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          {(filtroStatus !== 'todos' || filtroSala !== 'todos' || busca) && (
            <button className="btn-outline" style={{ fontSize: 12, padding: '8px 12px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { setFiltroStatus('todos'); setFiltroSala('todos'); setBusca('') }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Consultas {viewMode === 'semana' ? 'da semana' : viewMode === 'todos' ? '— todas' : 'do dia'}</h3></div>
        <div className="card-body">
          {loading ? <div className="empty">Carregando...</div> : filtered.length === 0 ? <div className="empty">Nenhuma consulta encontrada.</div> : (
            <table className="tbl">
              <thead>
                <tr>
                  {viewMode !== 'dia' && <th>Data</th>}
                  <th>Horário</th><th>Paciente</th><th>Estagiário</th><th>Código</th><th>Tipo</th><th>Sala</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    {viewMode !== 'dia' && <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>}
                    <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0, 5)}</td>
                    <td><div className="td-user"><div className="av">{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>{c.paciente?.nome}</div></td>
                    <td style={{ fontWeight: 500 }}>{c.estagiario?.nome || '—'}</td>
                    <td>{c.estagiario?.codigo ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.estagiario.codigo}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
                    <td style={{ fontSize: 12 }}>{c.tipo}</td>
                    <td>{c.sala?.nome ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.sala.nome}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
                    <td><span className={tagClass(c.status)}>{tagLabel(c.status)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {c.status === 'aguardando' && canApprove && <button className="btn-ok" style={{ padding: '4px 10px', fontSize: 12 }} onClick={async () => { await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', c.id); fetchConsultas() }}>Confirmar</button>}
                        {c.status === 'confirmada' && canApprove && <button className="btn-ok" style={{ padding: '4px 10px', fontSize: 12, background: 'var(--p3)', color: 'var(--p)' }} onClick={async () => { await supabase.from('consultas').update({ status: 'realizada' }).eq('id', c.id); fetchConsultas() }}>Realizada</button>}
                        {!['cancelada','realizada','cancelamento_pendente','reagendamento_pendente'].includes(c.status) && <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalSolic({ consulta: c, tipo: 'reagendamento', nova_data: '', nova_hora: '', motivo: '' })}>Reagendar</button>}
                        {!['cancelada','realizada','troca_sala_pendente'].includes(c.status) && <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={() => setModalTrocaSala({ consulta: c, sala_nova_id: '', motivo: '' })}>Trocar sala</button>}
                        {!['cancelada','realizada','cancelamento_pendente'].includes(c.status) && <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalSolic({ consulta: c, tipo: 'cancelamento', nova_data: '', nova_hora: '', motivo: '' })}>Cancelar</button>}
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
          <div className="modal" style={{ maxWidth: 620 }}>
            <h2>Agendar Consulta</h2>
            <div className="form-grid">
              <div className="fld"><label>Paciente *</label>
                <select value={form.paciente_id} onChange={e => setForm({ ...form, paciente_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="fld" style={{ position: 'relative' }}>
                <label>Estagiário * {isEstagiario && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(você)</span>}</label>
                <input value={buscaEstagiario}
                  onChange={e => { setBuscaEstagiario(e.target.value); setShowDrop(true); setEstagiarioSelecionado(null); setForm(f => ({ ...f, estagiario_id: '' })) }}
                  onFocus={() => setShowDrop(true)}
                  placeholder="Nome ou código (ex: EST01)"
                  disabled={isEstagiario}
                  style={{ opacity: isEstagiario ? 0.7 : 1 }}
                />
                {showDrop && !isEstagiario && estFiltrados.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8, zIndex: 100, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                    {estFiltrados.map(e => (
                      <div key={e.id} onClick={() => selecionarEst(e)}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}
                        onMouseOver={ev => ev.currentTarget.style.background = 'var(--p3)'}
                        onMouseOut={ev => ev.currentTarget.style.background = 'transparent'}>
                        {e.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{e.codigo}</span>}
                        <span>{e.nome}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="fld"><label>Tipo</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                  {['Psicoterapia','Avaliação Psicológica','Consulta Psiquiátrica','Neuropsicologia','Psicologia Infantil'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="fld"><label>Sala</label>
                <select value={form.sala_id} onChange={e => setForm({ ...form, sala_id: e.target.value })}>
                  <option value="">Selecionar sala...</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="fld"><label>Data *</label><input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} /></div>
              <div className="fld"><label>Horário *</label><input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} /></div>
            </div>
            {conflito && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: '#FEF2F2', padding: '12px 16px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 4 }}><span style={{ fontSize: 18 }}>⚠️</span><p style={{ fontSize: 13, color: '#991B1B', fontWeight: 500 }}>{conflito}</p></div>}
            {salaOcupada && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', padding: '12px 16px', borderRadius: 10, border: '1px solid #FDE68A', marginTop: 4 }}><span style={{ fontSize: 18 }}>🚪</span><p style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>{salaOcupada}</p></div>}
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => { setModal(false); setConflito(null); setSalaOcupada(null) }}>Cancelar</button>
              <button className="btn-primary" onClick={handleAgendar} disabled={saving || !form.paciente_id || !form.estagiario_id || !form.data || !form.hora}>{saving ? 'Verificando...' : 'Confirmar agendamento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reagendamento/cancelamento */}
      {modalSolic && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSolic(null)}>
          <div className="modal">
            <h2>{modalSolic.tipo === 'cancelamento' ? 'Solicitar Cancelamento' : 'Solicitar Reagendamento'}</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Paciente: <strong>{modalSolic.consulta.paciente?.nome}</strong> · {modalSolic.consulta.estagiario?.nome}</p>
            <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>⚠️ Requer aprovação do administrador ou supervisor.</div>
            <div className="form-grid">
              {modalSolic.tipo === 'reagendamento' && (<>
                <div className="fld"><label>Nova data</label><input type="date" value={modalSolic.nova_data} onChange={e => setModalSolic({ ...modalSolic, nova_data: e.target.value })} /></div>
                <div className="fld"><label>Novo horário</label><input type="time" value={modalSolic.nova_hora} onChange={e => setModalSolic({ ...modalSolic, nova_hora: e.target.value })} /></div>
              </>)}
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Motivo</label><textarea rows={2} value={modalSolic.motivo} onChange={e => setModalSolic({ ...modalSolic, motivo: e.target.value })} placeholder="Descreva o motivo..." style={{ resize: 'vertical' }} /></div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModalSolic(null)}>Voltar</button>
              <button className="btn-primary" onClick={handleEnviarSolic}>Enviar solicitação</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal troca de sala */}
      {modalTrocaSala && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalTrocaSala(null)}>
          <div className="modal">
            <h2>Solicitar Troca de Sala</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Paciente: <strong>{modalTrocaSala.consulta.paciente?.nome}</strong>{modalTrocaSala.consulta.sala?.nome && ` · Sala atual: ${modalTrocaSala.consulta.sala.nome}`}</p>
            <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>⚠️ Requer aprovação do administrador ou supervisor.</div>
            <div className="form-grid">
              <div className="fld"><label>Nova sala *</label>
                <select value={modalTrocaSala.sala_nova_id} onChange={e => setModalTrocaSala({ ...modalTrocaSala, sala_nova_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {salas.filter(s => s.id !== modalTrocaSala.consulta.sala_id).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="fld" style={{ gridColumn: '1/-1' }}><label>Motivo *</label><textarea rows={2} value={modalTrocaSala.motivo} onChange={e => setModalTrocaSala({ ...modalTrocaSala, motivo: e.target.value })} placeholder="Por que precisa trocar de sala?" style={{ resize: 'vertical' }} /></div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModalTrocaSala(null)}>Voltar</button>
              <button className="btn-primary" onClick={handleTrocaSala} disabled={!modalTrocaSala.sala_nova_id || !modalTrocaSala.motivo}>Enviar solicitação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}