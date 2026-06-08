import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Pages.css'

// Etapas do fluxo de atendimento
const ETAPAS_ATENDIMENTO = ['Triagem', 'Avaliação', 'Consulta', 'Direcionamento Final']

export default function Agenda() {
  const { profile } = useAuth()
  const toast = useToast()
  const [consultas, setConsultas] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [estagiarios, setEstagiarios] = useState([])
  const [salas, setSalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [modal, setModal] = useState(false)
  const [modalSolic, setModalSolic] = useState(null)
  const [modalTrocaSala, setModalTrocaSala] = useState(null)

  // Conflitos detalhados
  const [conflitoEstagiario, setConflitoEstagiario] = useState(null)
  const [conflitoPaciente, setConflitoPaciente] = useState(null)
  const [salaOcupada, setSalaOcupada] = useState(null)

  // Busca paciente por CPF
  const [buscaPaciente, setBuscaPaciente] = useState('')
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null)
  const [showDropPaciente, setShowDropPaciente] = useState(false)

  // Busca estagiário por nome/código
  const [buscaEstagiario, setBuscaEstagiario] = useState('')
  const [estagiarioSelecionado, setEstagiarioSelecionado] = useState(null)
  const [showDropEst, setShowDropEst] = useState(false)

  const [form, setForm] = useState({
    paciente_id: '', estagiario_id: '',
    tipo: 'Triagem', data: '', hora: '', sala_id: ''
  })
  const [saving, setSaving] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroSala, setFiltroSala] = useState('todos')
  const [busca, setBusca] = useState('')
  const [viewMode, setViewMode] = useState('dia')

  // Ocupação de salas em tempo real
  const [ocupacaoSalas, setOcupacaoSalas] = useState({})
  const [loadingOcupacao, setLoadingOcupacao] = useState(false)

  useEffect(() => { fetchConsultas() }, [data, viewMode])
  useEffect(() => { fetchSelects() }, [])

  useEffect(() => {
    setConflitoEstagiario(null)
    setConflitoPaciente(null)
    setSalaOcupada(null)
  }, [form.estagiario_id, form.paciente_id, form.data, form.hora, form.sala_id])

  useEffect(() => {
    if (form.data && form.hora) carregarOcupacaoSalas(form.data, form.hora)
    else setOcupacaoSalas({})
  }, [form.data, form.hora])

  async function carregarOcupacaoSalas(dataVal, horaVal) {
    setLoadingOcupacao(true)
    const { data: rows } = await supabase
      .from('consultas')
      .select('sala_id, paciente:pacientes(nome), estagiario:profiles(nome, codigo), data, hora')
      .eq('data', dataVal)
      .eq('hora', horaVal)
      .not('status', 'in', '("cancelada","realizada")')
      .not('sala_id', 'is', null)

    const mapa = {}
    ;(rows || []).forEach(c => {
      if (c.sala_id) mapa[c.sala_id] = {
        paciente: c.paciente?.nome || '—',
        estagiario: c.estagiario?.nome || '—',
        codigo: c.estagiario?.codigo || '',
        data: c.data,
        hora: c.hora,
      }
    })
    setOcupacaoSalas(mapa)
    setLoadingOcupacao(false)
  }

  async function fetchConsultas() {
    setLoading(true)
    let query = supabase.from('consultas')
      .select('*, paciente:pacientes(nome, cpf), estagiario:profiles(nome, codigo), sala:salas(nome, id)')
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
      supabase.from('pacientes').select('id, nome, cpf').eq('ativo', true).order('nome'),
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

  function fmtCpf(cpf) {
    if (!cpf) return ''
    const d = cpf.replace(/\D/g, '')
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  function fmtData(d) {
    if (!d) return '—'
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
  }

  function fmtHora(h) {
    return h ? h.slice(0, 5) : '—'
  }

  const pacientesFiltrados = pacientes.filter(p => {
    const q = buscaPaciente.toLowerCase().replace(/\D/g, '') || buscaPaciente.toLowerCase()
    const cpfLimpo = (p.cpf || '').replace(/\D/g, '')
    return p.nome?.toLowerCase().includes(buscaPaciente.toLowerCase()) || cpfLimpo.includes(q)
  }).slice(0, 8)

  function selecionarPaciente(p) {
    setPacienteSelecionado(p)
    setBuscaPaciente(fmtCpf(p.cpf) || p.nome)
    setForm(f => ({ ...f, paciente_id: p.id }))
    setShowDropPaciente(false)
  }

  const estFiltrados = estagiarios.filter(e => {
    const q = buscaEstagiario.toLowerCase()
    return e.nome?.toLowerCase().includes(q) || e.codigo?.toLowerCase().includes(q)
  })

  function selecionarEst(e) {
    setEstagiarioSelecionado(e)
    setBuscaEstagiario(e.codigo ? `${e.codigo} — ${e.nome}` : e.nome)
    setForm(f => ({ ...f, estagiario_id: e.id }))
    setShowDropEst(false)
  }

  async function verificarConflitos() {
    setConflitoEstagiario(null); setConflitoPaciente(null); setSalaOcupada(null)
    if (!form.estagiario_id || !form.data || !form.hora) return false

    const { data: c1 } = await supabase.from('consultas')
      .select('id, paciente:pacientes(nome), data, hora')
      .eq('medico_id', form.estagiario_id).eq('data', form.data).eq('hora', form.hora)
      .not('status', 'in', '("cancelada","realizada")')
    if (c1?.length > 0) {
      setConflitoEstagiario({ paciente: c1[0].paciente?.nome || '—', data: c1[0].data, hora: c1[0].hora })
      return true
    }

    const { data: c2 } = await supabase.from('consultas')
      .select('id, data, hora').eq('paciente_id', form.paciente_id).eq('data', form.data).eq('hora', form.hora)
      .not('status', 'in', '("cancelada","realizada")')
    if (c2?.length > 0) {
      setConflitoPaciente({ data: c2[0].data, hora: c2[0].hora })
      return true
    }

    if (form.sala_id) {
      const ocu = ocupacaoSalas[form.sala_id]
      if (ocu) { setSalaOcupada({ ...ocu, data: form.data, hora: form.hora }); return true }
    }
    return false
  }

  async function handleAgendar() {
    setSaving(true)
    if (await verificarConflitos()) { setSaving(false); return }
    const statusInicial = ['admin', 'coordenador'].includes(profile?.tipo) ? 'confirmada' : 'aguardando'
    const { error } = await supabase.from('consultas').insert([{
      paciente_id: form.paciente_id, medico_id: form.estagiario_id,
      tipo: form.tipo, data: form.data, hora: form.hora,
      sala_id: form.sala_id || null, status: statusInicial, criado_por: profile.id,
    }])
    if (!error) {
      fecharModal(); fetchConsultas()
      toast.success('Consulta agendada!')
    } else toast.error('Erro: ' + error.message)
    setSaving(false)
  }

  async function handleEnviarSolic() {
    const { consulta, tipo, nova_data, nova_hora, motivo } = modalSolic
    await supabase.from('solicitacoes').insert([{ consulta_id: consulta.id, tipo, nova_data: nova_data || null, nova_hora: nova_hora || null, motivo: motivo || null }])
    await supabase.from('consultas').update({ status: tipo === 'cancelamento' ? 'cancelamento_pendente' : 'reagendamento_pendente' }).eq('id', consulta.id)
    setModalSolic(null); fetchConsultas(); toast.success('Solicitação enviada!')
  }

  async function handleTrocaSala() {
    const { consulta, sala_nova_id, motivo } = modalTrocaSala
    await supabase.from('solicitacoes').insert([{ consulta_id: consulta.id, tipo: 'troca_sala', sala_atual_id: consulta.sala_id || null, sala_nova_id: sala_nova_id || null, motivo: motivo || null }])
    await supabase.from('consultas').update({ status: 'troca_sala_pendente' }).eq('id', consulta.id)
    setModalTrocaSala(null); fetchConsultas(); toast.success('Solicitação enviada!')
  }

  function fecharModal() {
    setModal(false)
    setConflitoEstagiario(null); setConflitoPaciente(null); setSalaOcupada(null)
    setShowDropPaciente(false); setShowDropEst(false)
    setBuscaPaciente(''); setPacienteSelecionado(null)
    setOcupacaoSalas({})
    setForm({ paciente_id: '', estagiario_id: profile?.tipo === 'estagiario' ? profile.id : '', tipo: 'Triagem', data: '', hora: '', sala_id: '' })
    if (profile?.tipo !== 'estagiario') { setEstagiarioSelecionado(null); setBuscaEstagiario('') }
  }

  const navData = d => { const dt = new Date(data + 'T12:00:00'); dt.setDate(dt.getDate() + d); setData(dt.toISOString().split('T')[0]) }
  const tagClass = s => ({ confirmada: 'tag tg', aguardando: 'tag ta', cancelada: 'tag tr', realizada: 'tag tp', cancelamento_pendente: 'tag tr', reagendamento_pendente: 'tag ta', troca_sala_pendente: 'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.', troca_sala_pendente: 'Troca sala pend.' }[s] || s)
  const canApprove = ['admin', 'coordenador'].includes(profile?.tipo)
  const isEstagiario = profile?.tipo === 'estagiario'

  const filtered = consultas.filter(c => {
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    const matchSala = filtroSala === 'todos' || c.sala_id === filtroSala
    const matchBusca = !busca || c.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.paciente?.cpf?.replace(/\D/g,'').includes(busca.replace(/\D/g,'')) || c.estagiario?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.estagiario?.codigo?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchSala && matchBusca
  })

  const dataLabel = viewMode === 'todos' ? 'Todas as consultas' : new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dropStyle = { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8, zIndex: 100, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div><h1>Agenda</h1><p className="page-sub">{filtered.length} consulta(s) · {dataLabel}</p></div>
        <button className="btn-primary" onClick={() => setModal(true)}>+ Agendar</button>
      </div>

      {/* View mode chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="chip-row">
          {[['dia','Dia'],['semana','Semana'],['todos','Todos']].map(([m,l]) => (
            <button key={m} className={`chip${viewMode === m ? ' chip-active' : ''}`} onClick={() => setViewMode(m)}>{l}</button>
          ))}
        </div>
        {viewMode !== 'todos' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navData(-1)}>←</button>
            <button className="btn-outline" style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700 }} onClick={() => setData(new Date().toISOString().split('T')[0])}>Hoje</button>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: 'var(--card)', color: 'var(--text)', outline: 'none' }} />
            <button className="btn-outline" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navData(1)}>→</button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="search-input" placeholder="🔍 Buscar paciente, estagiário..." value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1 }} />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          style={{ padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: 'var(--card)', color: 'var(--text)' }}>
          <option value="todos">Todos os status</option>
          <option value="aguardando">Aguardando</option>
          <option value="confirmada">Confirmada</option>
          <option value="realizada">Realizada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select value={filtroSala} onChange={e => setFiltroSala(e.target.value)}
          style={{ padding: '9px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: 'var(--card)', color: 'var(--text)' }}>
          <option value="todos">Todas as salas</option>
          {salas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        {(filtroStatus !== 'todos' || filtroSala !== 'todos' || busca) && (
          <button className="btn-outline" style={{ fontSize: 12, padding: '8px 10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
            onClick={() => { setFiltroStatus('todos'); setFiltroSala('todos'); setBusca('') }}>✕</button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="page-loading" style={{ height: 160 }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span style={{ fontSize: 32 }}>📅</span>
            <span style={{ fontWeight: 600 }}>Nenhuma consulta encontrada</span>
            <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setModal(true)}>+ Agendar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const etapaColors = { Triagem: '#0891b2', Avaliação: '#7c3aed', Consulta: '#0047AB', 'Direcionamento Final': '#059669' }
            const etapaBgs   = { Triagem: '#e0f7fa', Avaliação: '#f3e8ff', Consulta: '#eff6ff', 'Direcionamento Final': '#d1fae5' }
            return (
              <div key={c.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--p)' }}>{c.hora?.slice(0,5)}</span>
                    {viewMode !== 'dia' && (
                      <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                        {new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'})}
                      </span>
                    )}
                  </div>
                  <span className={tagClass(c.status)} style={{ fontSize: 11 }}>{tagLabel(c.status)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className="av" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0 }}>{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{c.paciente?.nome || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtCpf(c.paciente?.cpf) || 'Sem CPF'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, background: etapaBgs[c.tipo] || 'var(--p3)', color: etapaColors[c.tipo] || 'var(--p)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{c.tipo}</span>
                  {c.estagiario && <span style={{ fontSize: 11, background: 'var(--sbg)', color: 'var(--success)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{c.estagiario.codigo || c.estagiario.nome}</span>}
                  {c.sala?.nome && <span style={{ fontSize: 11, background: 'var(--wbg)', color: 'var(--warn)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{c.sala.nome}</span>}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  {c.status === 'aguardando' && canApprove && (
                    <button className="btn-ok" style={{ padding: '5px 12px', fontSize: 12 }}
                      onClick={async () => { await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', c.id); fetchConsultas() }}>✓ Confirmar</button>
                  )}
                  {c.status === 'confirmada' && canApprove && (
                    <button className="btn-ok" style={{ padding: '5px 12px', fontSize: 12, background: 'var(--p3)', color: 'var(--p)' }}
                      onClick={async () => { await supabase.from('consultas').update({ status: 'realizada' }).eq('id', c.id); fetchConsultas() }}>✓ Realizada</button>
                  )}
                  {!['cancelada','realizada','cancelamento_pendente','reagendamento_pendente'].includes(c.status) && (
                    <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 12 }}
                      onClick={() => setModalSolic({ consulta: c, tipo: 'reagendamento', nova_data: '', nova_hora: '', motivo: '' })}>Reagendar</button>
                  )}
                  {!['cancelada','realizada','troca_sala_pendente'].includes(c.status) && (
                    <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 12, color: 'var(--warn)', borderColor: 'var(--warn)' }}
                      onClick={() => setModalTrocaSala({ consulta: c, sala_nova_id: '', motivo: '' })}>Trocar sala</button>
                  )}
                  {!['cancelada','realizada','cancelamento_pendente'].includes(c.status) && (
                    <button className="btn-danger" style={{ padding: '5px 12px', fontSize: 12 }}
                      onClick={() => setModalSolic({ consulta: c, tipo: 'cancelamento', nova_data: '', nova_hora: '', motivo: '' })}>Cancelar</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════ MODAL AGENDAR ══════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <h2>Agendar Consulta</h2>
            <div className="form-grid">

              {/* Busca paciente */}
              <div className="fld" style={{ position: 'relative', gridColumn: '1/-1' }}>
                <label>Paciente * <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>— busque por CPF ou nome</span></label>
                <input value={buscaPaciente}
                  onChange={e => { setBuscaPaciente(e.target.value); setShowDropPaciente(true); setPacienteSelecionado(null); setForm(f => ({ ...f, paciente_id: '' })) }}
                  onFocus={() => setShowDropPaciente(true)}
                  placeholder="Digite o CPF ou nome" />
                {pacienteSelecionado && (
                  <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--p3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--p)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {pacienteSelecionado.nome?.slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--p)' }}>{pacienteSelecionado.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>CPF: {fmtCpf(pacienteSelecionado.cpf) || '—'}</div>
                    </div>
                    <button onClick={() => { setPacienteSelecionado(null); setBuscaPaciente(''); setForm(f => ({ ...f, paciente_id: '' })) }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                )}
                {showDropPaciente && !pacienteSelecionado && pacientesFiltrados.length > 0 && (
                  <div style={dropStyle}>
                    {pacientesFiltrados.map(p => (
                      <div key={p.id} onClick={() => selecionarPaciente(p)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseOver={ev => ev.currentTarget.style.background = 'var(--p3)'}
                        onMouseOut={ev => ev.currentTarget.style.background = 'transparent'}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>CPF: {fmtCpf(p.cpf) || '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {showDropPaciente && !pacienteSelecionado && buscaPaciente.length >= 2 && pacientesFiltrados.length === 0 && (
                  <div style={{ ...dropStyle, padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>Nenhum paciente encontrado.</div>
                )}
              </div>

              {/* Busca estagiário */}
              <div className="fld" style={{ position: 'relative' }}>
                <label>Estagiário * {isEstagiario && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(você)</span>}</label>
                <input value={buscaEstagiario}
                  onChange={e => { setBuscaEstagiario(e.target.value); setShowDropEst(true); setEstagiarioSelecionado(null); setForm(f => ({ ...f, estagiario_id: '' })) }}
                  onFocus={() => setShowDropEst(true)}
                  placeholder="Nome ou código (ex: EST01)"
                  disabled={isEstagiario}
                  style={{ opacity: isEstagiario ? 0.7 : 1 }} />
                {showDropEst && !isEstagiario && estFiltrados.length > 0 && (
                  <div style={dropStyle}>
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

              {/* Data e Hora */}
              <div className="fld">
                <label>Data *</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value, sala_id: '' }))} />
              </div>
              <div className="fld">
                <label>Horário *</label>
                <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value, sala_id: '' }))} />
              </div>

              {/* ── Etapas do Atendimento ── */}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Etapa do atendimento *</label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)', marginTop: 6 }}>
                  {ETAPAS_ATENDIMENTO.map((etapa, idx) => {
                    const ativo = form.tipo === etapa
                    const cores = ['#0891b2', '#7c3aed', '#0047AB', '#059669']
                    return (
                      <button key={etapa} type="button" onClick={() => setForm(f => ({ ...f, tipo: etapa }))}
                        style={{
                          flex: 1, padding: '10px 4px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 11, fontWeight: ativo ? 700 : 500,
                          background: ativo ? cores[idx] : 'var(--card)', color: ativo ? '#fff' : 'var(--muted)',
                          borderRight: idx < 3 ? '1px solid var(--border)' : 'none', transition: 'all .15s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        }}>
                        <span style={{ fontSize: 16 }}>{['🔍','📋','🩺','🎯'][idx]}</span>
                        <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{etapa}</span>
                      </button>
                    )
                  })}
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                  {form.tipo === 'Triagem' && '🔍 Primeiro contato e identificação do quadro.'}
                  {form.tipo === 'Avaliação' && '📋 Avaliação aprofundada do paciente.'}
                  {form.tipo === 'Consulta' && '🩺 Sessão de atendimento padrão.'}
                  {form.tipo === 'Direcionamento Final' && '🎯 Encerramento e direcionamento futuro.'}
                </p>
              </div>

              {/* ── Salas com ocupação visual ── */}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>
                  Sala
                  {loadingOcupacao && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>Verificando...</span>}
                  {!loadingOcupacao && form.data && form.hora && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>
                      Disponibilidade em {fmtData(form.data)} às {fmtHora(form.hora)}
                    </span>
                  )}
                </label>

                {(!form.data || !form.hora) ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 6 }}>ℹ️ Preencha data e horário para ver disponibilidade.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {/* Sem sala */}
                    <button type="button" onClick={() => setForm(f => ({ ...f, sala_id: '' }))}
                      style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        border: form.sala_id === '' ? '2px solid var(--p)' : '1.5px solid var(--border)',
                        background: form.sala_id === '' ? 'var(--p3)' : 'var(--card)', transition: 'all .15s' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: form.sala_id === '' ? 'var(--p)' : 'var(--muted)' }}>Sem sala — definir depois</span>
                    </button>

                    {salas.map(s => {
                      const ocupante = ocupacaoSalas[s.id]
                      const ocupada = !!ocupante
                      const selecionada = form.sala_id === s.id
                      return (
                        <button key={s.id} type="button"
                          onClick={() => !ocupada && setForm(f => ({ ...f, sala_id: s.id }))}
                          style={{
                            padding: '12px 14px', borderRadius: 10, fontFamily: 'inherit',
                            cursor: ocupada ? 'not-allowed' : 'pointer', textAlign: 'left',
                            border: selecionada ? '2px solid var(--p)' : ocupada ? '1.5px solid #FECACA' : '1.5px solid var(--border)',
                            background: selecionada ? 'var(--p3)' : ocupada ? '#FEF2F2' : 'var(--card)',
                            transition: 'all .15s',
                          }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ocupada ? 6 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: selecionada ? 'var(--p)' : ocupada ? '#b91c1c' : 'var(--text)' }}>
                              🚪 {s.nome}
                            </span>
                            <span>{selecionada ? '✅' : ocupada ? '🔴' : '🟢'}</span>
                          </div>
                          {ocupada ? (
                            <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
                              <span style={{ color: '#b91c1c', fontWeight: 600 }}>Ocupada — </span>
                              <strong style={{ color: '#374151' }}>{ocupante.paciente}</strong>
                              {' · '}{ocupante.codigo ? `${ocupante.codigo} – ` : ''}<strong style={{ color: '#374151' }}>{ocupante.estagiario}</strong>
                              <br />
                              <span style={{ color: '#9ca3af' }}>📅 {fmtData(form.data)} ⏰ {fmtHora(ocupante.hora)}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>Disponível</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Alertas de conflito */}
            {conflitoEstagiario && (
              <div style={{ display: 'flex', gap: 10, background: '#FEF2F2', padding: '12px 14px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#991B1B', margin: '0 0 2px' }}>Conflito — Estagiário ocupado</p>
                  <p style={{ color: '#7f1d1d', margin: 0 }}><strong>{estagiarioSelecionado?.nome}</strong> já tem consulta com <strong>{conflitoEstagiario.paciente}</strong>.</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '3px 0 0' }}>📅 {fmtData(conflitoEstagiario.data)} ⏰ {fmtHora(conflitoEstagiario.hora)}</p>
                </div>
              </div>
            )}
            {conflitoPaciente && (
              <div style={{ display: 'flex', gap: 10, background: '#FEF2F2', padding: '12px 14px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#991B1B', margin: '0 0 2px' }}>Conflito — Paciente com consulta</p>
                  <p style={{ color: '#7f1d1d', margin: 0 }}><strong>{pacienteSelecionado?.nome}</strong> já tem consulta neste horário.</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '3px 0 0' }}>📅 {fmtData(conflitoPaciente.data)} ⏰ {fmtHora(conflitoPaciente.hora)}</p>
                </div>
              </div>
            )}
            {salaOcupada && (
              <div style={{ display: 'flex', gap: 10, background: '#FFFBEB', padding: '12px 14px', borderRadius: 10, border: '1px solid #FDE68A', marginTop: 10 }}>
                <span style={{ fontSize: 20 }}>🚪</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#92400E', margin: '0 0 2px' }}>Sala já reservada</p>
                  <p style={{ color: '#78350f', margin: 0 }}>Ocupada por <strong>{salaOcupada.paciente}</strong> com <strong>{salaOcupada.codigo ? `${salaOcupada.codigo} – ` : ''}{salaOcupada.estagiario}</strong>.</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '3px 0 0' }}>📅 {fmtData(salaOcupada.data)} ⏰ {fmtHora(salaOcupada.hora)}</p>
                </div>
              </div>
            )}

            <div className="modal-btns">
              <button className="btn-outline" onClick={fecharModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleAgendar}
                disabled={saving || !form.paciente_id || !form.estagiario_id || !form.data || !form.hora}>
                {saving ? 'Verificando...' : `Confirmar — ${form.tipo}`}
              </button>
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
            <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>⚠️ Requer aprovação do administrador.</div>
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
            <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>⚠️ Requer aprovação do administrador.</div>
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
