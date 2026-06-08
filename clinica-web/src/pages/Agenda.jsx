import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Pages.css'

const ETAPAS_ATENDIMENTO = ['Triagem', 'Avaliação', 'Consulta', 'Direcionamento Final']
const ETAPA_ICONS  = ['🔍', '📋', '🩺', '🎯']
const ETAPA_COLORS = ['#0891b2', '#7c3aed', '#0047AB', '#059669']
const ETAPA_BGS    = ['#e0f7fa', '#f3e8ff', '#eff6ff', '#d1fae5']

// ── Utilitários ──────────────────────────────────────────────────────────────
function fmtCpf(cpf) {
  if (!cpf) return ''
  return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
function fmtData(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtHora(h) { return h ? h.slice(0, 5) : '—' }

/** Gera array de N datas (YYYY-MM-DD) a partir de uma data base */
function gerarDias(base, n = 10) {
  const dias = []
  for (let i = 0; i < n; i++) {
    const d = new Date(base + 'T12:00:00')
    d.setDate(d.getDate() + i)
    dias.push(d.toISOString().split('T')[0])
  }
  return dias
}

export default function Agenda() {
  const { profile } = useAuth()
  const toast = useToast()

  // ── Estado principal ──────────────────────────────────────────────────────
  const [consultas,   setConsultas]   = useState([])
  const [pacientes,   setPacientes]   = useState([])
  const [estagiarios, setEstagiarios] = useState([])
  const [salas,       setSalas]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [dataAgenda,  setDataAgenda]  = useState(new Date().toISOString().split('T')[0])
  const [viewMode,    setViewMode]    = useState('dia')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroSala,   setFiltroSala]   = useState('todos')
  const [busca,        setBusca]        = useState('')

  // ── Modal de agendamento ──────────────────────────────────────────────────
  const [modal,        setModal]       = useState(false)
  const [modalSolic,   setModalSolic]  = useState(null)
  const [modalTrocaSala, setModalTrocaSala] = useState(null)

  const [buscaPaciente,      setBuscaPaciente]      = useState('')
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null)
  const [showDropPaciente,   setShowDropPaciente]   = useState(false)
  const [buscaEstagiario,    setBuscaEstagiario]    = useState('')
  const [estagiarioSelecionado, setEstagiarioSelecionado] = useState(null)
  const [showDropEst,        setShowDropEst]        = useState(false)

  const [form, setForm] = useState({
    paciente_id: '', estagiario_id: '',
    tipo: 'Triagem', data: '', hora: '', sala_id: '',
  })
  const [saving, setSaving] = useState(false)

  // ── 10 dias: estado ───────────────────────────────────────────────────────
  const [baseDias,       setBaseDias]       = useState(new Date().toISOString().split('T')[0])
  const [disponib10,     setDisponib10]     = useState({}) // { 'YYYY-MM-DD': { sala_id: { paciente, estagiario } | null } }
  const [loadingDias,    setLoadingDias]    = useState(false)

  // ── Conflitos (validação final) ───────────────────────────────────────────
  const [conflitoEstagiario, setConflitoEstagiario] = useState(null)
  const [conflitoPaciente,   setConflitoPaciente]   = useState(null)
  const [salaOcupada,        setSalaOcupada]        = useState(null)

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { fetchConsultas() }, [dataAgenda, viewMode])
  useEffect(() => { fetchSelects()   }, [])
  useEffect(() => {
    setConflitoEstagiario(null); setConflitoPaciente(null); setSalaOcupada(null)
  }, [form.estagiario_id, form.paciente_id, form.data, form.hora, form.sala_id])

  // Carrega 10 dias sempre que hora OU sala mudam (e ambos estão preenchidos)
  useEffect(() => {
    if (form.hora && form.sala_id) {
      carregar10Dias(baseDias, form.hora, form.sala_id)
    } else {
      setDisponib10({})
      setForm(f => ({ ...f, data: '' })) // limpa data ao trocar sala/hora
    }
  }, [form.hora, form.sala_id, baseDias])

  // ── Busca principal (tabela) ──────────────────────────────────────────────
  async function fetchConsultas() {
    setLoading(true)
    let q = supabase.from('consultas')
      .select('*, paciente:pacientes(nome,cpf), estagiario:profiles(nome,codigo), sala:salas(nome,id)')
      .order('data').order('hora')
    if (viewMode === 'dia') q = q.eq('data', dataAgenda)
    else if (viewMode === 'semana') {
      const d = new Date(dataAgenda + 'T12:00:00')
      const ds = d.getDay() === 0 ? 6 : d.getDay() - 1
      const ini = new Date(d); ini.setDate(d.getDate() - ds)
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      q = q.gte('data', ini.toISOString().split('T')[0]).lte('data', fim.toISOString().split('T')[0])
    }
    if (profile?.tipo === 'estagiario') q = q.eq('medico_id', profile.id)
    const { data: rows } = await q
    setConsultas(rows || [])
    setLoading(false)
  }

  async function fetchSelects() {
    const [{ data: p }, { data: e }, { data: s }] = await Promise.all([
      supabase.from('pacientes').select('id,nome,cpf').eq('ativo', true).order('nome'),
      supabase.from('profiles').select('id,nome,codigo').eq('tipo', 'estagiario').order('nome'),
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

  // ── Carrega 10 dias de disponibilidade para sala + hora ──────────────────
  async function carregar10Dias(base, hora, salaId) {
    setLoadingDias(true)
    const dias = gerarDias(base, 10)

    const { data: rows } = await supabase
      .from('consultas')
      .select('data, sala_id, medico_id, paciente:pacientes(nome), estagiario:profiles(nome,codigo)')
      .in('data', dias)
      .eq('hora', hora)
      .not('status', 'in', '("cancelada","realizada")')

    // Monta mapa: { 'YYYY-MM-DD': { [sala_id]: { paciente, estagiario, codigo } } }
    const mapa = {}
    dias.forEach(d => { mapa[d] = {} })
    ;(rows || []).forEach(c => {
      if (!mapa[c.data]) mapa[c.data] = {}
      mapa[c.data][c.sala_id] = {
        paciente:   c.paciente?.nome || '—',
        estagiario: c.estagiario?.nome || '—',
        codigo:     c.estagiario?.codigo || '',
      }
    })
    setDisponib10(mapa)
    setLoadingDias(false)
  }

  // ── Paciente / Estagiário ─────────────────────────────────────────────────
  const pacsFiltrados = pacientes.filter(p => {
    const q = buscaPaciente.toLowerCase().replace(/\D/g, '') || buscaPaciente.toLowerCase()
    return p.nome?.toLowerCase().includes(buscaPaciente.toLowerCase()) ||
           (p.cpf || '').replace(/\D/g, '').includes(q)
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

  // ── Verificação final antes de salvar ────────────────────────────────────
  async function verificarConflitos() {
    setConflitoEstagiario(null); setConflitoPaciente(null); setSalaOcupada(null)
    if (!form.estagiario_id || !form.data || !form.hora) return false

    const { data: c1 } = await supabase.from('consultas')
      .select('id,paciente:pacientes(nome),data,hora')
      .eq('medico_id', form.estagiario_id).eq('data', form.data).eq('hora', form.hora)
      .not('status', 'in', '("cancelada","realizada")')
    if (c1?.length) { setConflitoEstagiario({ paciente: c1[0].paciente?.nome, data: c1[0].data, hora: c1[0].hora }); return true }

    const { data: c2 } = await supabase.from('consultas')
      .select('id,data,hora').eq('paciente_id', form.paciente_id).eq('data', form.data).eq('hora', form.hora)
      .not('status', 'in', '("cancelada","realizada")')
    if (c2?.length) { setConflitoPaciente({ data: c2[0].data, hora: c2[0].hora }); return true }

    if (form.sala_id) {
      const ocu = disponib10[form.data]?.[form.sala_id]
      if (ocu) { setSalaOcupada({ ...ocu, data: form.data, hora: form.hora }); return true }
    }
    return false
  }

  async function handleAgendar() {
    setSaving(true)
    if (await verificarConflitos()) { setSaving(false); return }
    const statusInicial = ['admin','coordenador'].includes(profile?.tipo) ? 'confirmada' : 'aguardando'
    const { error } = await supabase.from('consultas').insert([{
      paciente_id: form.paciente_id, medico_id: form.estagiario_id,
      tipo: form.tipo, data: form.data, hora: form.hora,
      sala_id: form.sala_id || null, status: statusInicial, criado_por: profile.id,
    }])
    if (!error) {
      fecharModal(); fetchConsultas()
      toast.success('Consulta agendada com sucesso!')
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
    setDisponib10({})
    setBaseDias(new Date().toISOString().split('T')[0])
    setForm({ paciente_id: '', estagiario_id: profile?.tipo === 'estagiario' ? profile.id : '', tipo: 'Triagem', data: '', hora: '', sala_id: '' })
    if (profile?.tipo !== 'estagiario') { setEstagiarioSelecionado(null); setBuscaEstagiario('') }
  }

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const navData = d => {
    const dt = new Date(dataAgenda + 'T12:00:00')
    dt.setDate(dt.getDate() + d)
    setDataAgenda(dt.toISOString().split('T')[0])
  }
  const tagClass = s => ({ confirmada:'tag tg', aguardando:'tag ta', cancelada:'tag tr', realizada:'tag tp', cancelamento_pendente:'tag tr', reagendamento_pendente:'tag ta', troca_sala_pendente:'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada:'Confirmada', aguardando:'Aguardando', cancelada:'Cancelada', realizada:'Realizada', cancelamento_pendente:'Cancel. pend.', reagendamento_pendente:'Reagend. pend.', troca_sala_pendente:'Troca sala pend.' }[s] || s)
  const canApprove = ['admin','coordenador'].includes(profile?.tipo)
  const isEstagiario = profile?.tipo === 'estagiario'

  const filtered = consultas.filter(c => {
    const matchStatus = filtroStatus === 'todos' || c.status === filtroStatus
    const matchSala   = filtroSala   === 'todos' || c.sala_id === filtroSala
    const matchBusca  = !busca ||
      c.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.paciente?.cpf?.replace(/\D/g,'').includes(busca.replace(/\D/g,'')) ||
      c.estagiario?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.estagiario?.codigo?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchSala && matchBusca
  })

  const dataLabel = viewMode === 'todos'
    ? 'Todas as consultas'
    : new Date(dataAgenda + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const dropStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#fff', border: '1.5px solid var(--border)',
    borderRadius: 8, zIndex: 100, maxHeight: 220, overflowY: 'auto',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  }

  // Dias exibidos no picker
  const dias10 = form.hora && form.sala_id ? gerarDias(baseDias, 10) : []

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* ── Cabeçalho ── */}
      <div className="page-header">
        <div>
          <h1>Agenda</h1>
          <p className="page-sub">{filtered.length} consulta(s) · {dataLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {[['dia','Dia'],['semana','Semana'],['todos','Todos']].map(([m,l]) => (
              <button key={m} onClick={() => setViewMode(m)} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: viewMode === m ? 'var(--p)' : '#fff', color: viewMode === m ? '#fff' : 'var(--text)', transition: '.15s' }}>{l}</button>
            ))}
          </div>
          {viewMode !== 'todos' && (<>
            <button className="btn-outline" onClick={() => navData(-1)}>← Anterior</button>
            <button className="btn-outline" style={{ fontWeight: 700 }} onClick={() => setDataAgenda(new Date().toISOString().split('T')[0])}>Hoje</button>
            <input type="date" value={dataAgenda} onChange={e => setDataAgenda(e.target.value)} style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
            <button className="btn-outline" onClick={() => navData(1)}>Próximo →</button>
          </>)}
          <button className="btn-primary" onClick={() => setModal(true)}>+ Agendar</button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" placeholder="🔍 Buscar paciente, CPF, estagiário ou código..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 340 }} />
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
            <option value="todos">Todos os status</option>
            <option value="aguardando">Aguardando</option>
            <option value="confirmada">Confirmada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
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

      {/* ── Tabela ── */}
      <div className="card">
        <div className="card-head"><h3>Consultas {viewMode === 'semana' ? 'da semana' : viewMode === 'todos' ? '— todas' : 'do dia'}</h3></div>
        <div className="card-body">
          {loading ? <div className="empty">Carregando...</div> : filtered.length === 0 ? (
            <div className="empty">
              <span style={{ fontSize: 32 }}>📅</span>
              <span>Nenhuma consulta encontrada</span>
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setModal(true)}>+ Agendar</button>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  {viewMode !== 'dia' && <th>Data</th>}
                  <th>Horário</th><th>Paciente</th><th>CPF</th><th>Estagiário</th><th>Código</th><th>Etapa</th><th>Sala</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const eIdx = ETAPAS_ATENDIMENTO.indexOf(c.tipo)
                  return (
                    <tr key={c.id}>
                      {viewMode !== 'dia' && <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'})}</td>}
                      <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0,5)}</td>
                      <td><div className="td-user"><div className="av">{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>{c.paciente?.nome}</div></td>
                      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtCpf(c.paciente?.cpf) || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{c.estagiario?.nome || '—'}</td>
                      <td>{c.estagiario?.codigo ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.estagiario.codigo}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
                      <td>
                        <span style={{ background: eIdx >= 0 ? ETAPA_BGS[eIdx] : 'var(--p3)', color: eIdx >= 0 ? ETAPA_COLORS[eIdx] : 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                          {eIdx >= 0 ? ETAPA_ICONS[eIdx] : ''} {c.tipo || '—'}
                        </span>
                      </td>
                      <td>{c.sala?.nome ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, display: 'inline-block' }}>{c.sala.nome}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
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
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL AGENDAR
      ══════════════════════════════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <h2 style={{ marginBottom: 4 }}>Agendar Consulta</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Preencha os dados e selecione o dia disponível</p>

            <div className="form-grid">

              {/* ── Paciente ── */}
              <div className="fld" style={{ position: 'relative', gridColumn: '1/-1' }}>
                <label>Paciente * <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>— busque por CPF ou nome</span></label>
                <input value={buscaPaciente}
                  onChange={e => { setBuscaPaciente(e.target.value); setShowDropPaciente(true); setPacienteSelecionado(null); setForm(f => ({ ...f, paciente_id: '' })) }}
                  onFocus={() => setShowDropPaciente(true)}
                  placeholder="CPF (123.456.789-00) ou nome" />
                {pacienteSelecionado && (
                  <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--p3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--p)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{pacienteSelecionado.nome?.slice(0,2).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--p)' }}>{pacienteSelecionado.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>CPF: {fmtCpf(pacienteSelecionado.cpf) || '—'}</div>
                    </div>
                    <button onClick={() => { setPacienteSelecionado(null); setBuscaPaciente(''); setForm(f => ({ ...f, paciente_id: '' })) }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>×</button>
                  </div>
                )}
                {showDropPaciente && !pacienteSelecionado && pacsFiltrados.length > 0 && (
                  <div style={dropStyle}>
                    {pacsFiltrados.map(p => (
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
                {showDropPaciente && !pacienteSelecionado && buscaPaciente.length >= 2 && pacsFiltrados.length === 0 && (
                  <div style={{ ...dropStyle, padding: '12px 14px', fontSize: 13, color: 'var(--muted)' }}>Nenhum paciente encontrado.</div>
                )}
              </div>

              {/* ── Estagiário ── */}
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

              {/* ── Horário ── */}
              <div className="fld">
                <label>Horário *</label>
                <input type="time" value={form.hora}
                  onChange={e => setForm(f => ({ ...f, hora: e.target.value, data: '', sala_id: '' }))} />
              </div>

              {/* ── Etapa ── */}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Etapa do atendimento *</label>
                <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid var(--border)', marginTop: 6 }}>
                  {ETAPAS_ATENDIMENTO.map((etapa, idx) => {
                    const ativo = form.tipo === etapa
                    return (
                      <button key={etapa} type="button" onClick={() => setForm(f => ({ ...f, tipo: etapa }))}
                        style={{
                          flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 12, fontWeight: ativo ? 700 : 500,
                          background: ativo ? ETAPA_COLORS[idx] : '#fff',
                          color: ativo ? '#fff' : '#64748b',
                          borderRight: idx < 3 ? '1px solid var(--border)' : 'none',
                          transition: 'all .15s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        }}>
                        <span style={{ fontSize: 16 }}>{ETAPA_ICONS[idx]}</span>
                        <span>{etapa}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Sala ── */}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Sala *</label>
                {!form.hora ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 4 }}>ℹ️ Preencha o horário primeiro para ver as salas.</p>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                    {salas.map(s => {
                      const sel = form.sala_id === s.id
                      return (
                        <button key={s.id} type="button" onClick={() => setForm(f => ({ ...f, sala_id: s.id, data: '' }))}
                          style={{
                            padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                            fontSize: 13, fontWeight: sel ? 700 : 500,
                            border: sel ? '2px solid var(--p)' : '1.5px solid var(--border)',
                            background: sel ? 'var(--p3)' : '#fff',
                            color: sel ? 'var(--p)' : 'var(--text)',
                            transition: 'all .15s',
                          }}>
                          🚪 {s.nome}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── Picker de 10 dias ── */}
              {form.hora && form.sala_id && (
                <div className="fld" style={{ gridColumn: '1/-1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <label style={{ marginBottom: 0 }}>
                      📅 Selecione o dia *
                      {form.data && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--p)', fontWeight: 700 }}>→ {fmtData(form.data)}</span>}
                    </label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {loadingDias && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Carregando...</span>}
                      <button type="button" className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => {
                          const d = new Date(baseDias + 'T12:00:00'); d.setDate(d.getDate() - 10)
                          setBaseDias(d.toISOString().split('T')[0])
                        }}>← 10 dias</button>
                      <button type="button" className="btn-outline" style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700 }}
                        onClick={() => setBaseDias(new Date().toISOString().split('T')[0])}>Hoje</button>
                      <button type="button" className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => {
                          const d = new Date(baseDias + 'T12:00:00'); d.setDate(d.getDate() + 10)
                          setBaseDias(d.toISOString().split('T')[0])
                        }}>+10 dias →</button>
                    </div>
                  </div>

                  {/* Grade dos 10 dias */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {dias10.map(dia => {
                      const ocupante  = disponib10[dia]?.[form.sala_id]
                      const ocupada   = !!ocupante
                      const selecionado = form.data === dia
                      const hoje      = new Date().toISOString().split('T')[0]
                      const passado   = dia < hoje
                      const dtObj     = new Date(dia + 'T12:00:00')
                      const semana    = dtObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.','')
                      const diaN      = dtObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                      const isSabDom  = [0,6].includes(dtObj.getDay())

                      return (
                        <button key={dia} type="button"
                          disabled={ocupada || passado}
                          onClick={() => setForm(f => ({ ...f, data: dia }))}
                          style={{
                            borderRadius: 12, padding: '10px 8px', border: 'none', cursor: ocupada || passado ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit', textAlign: 'center', transition: 'all .15s',
                            background: selecionado ? 'var(--p)' : ocupada ? '#FEF2F2' : passado ? '#f8fafc' : isSabDom ? '#fafaf0' : '#fff',
                            border: selecionado ? '2px solid var(--p)' : ocupada ? '1.5px solid #FECACA' : '1.5px solid var(--border)',
                            opacity: passado && !selecionado ? 0.45 : 1,
                            boxShadow: selecionado ? '0 2px 10px rgba(0,71,171,0.25)' : 'none',
                          }}>
                          {/* Dia da semana */}
                          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5,
                            color: selecionado ? 'rgba(255,255,255,0.8)' : isSabDom ? '#f59e0b' : 'var(--muted)', marginBottom: 2 }}>
                            {semana}
                          </div>
                          {/* Data */}
                          <div style={{ fontSize: 14, fontWeight: 800,
                            color: selecionado ? '#fff' : ocupada ? '#b91c1c' : passado ? '#cbd5e1' : 'var(--text)' }}>
                            {diaN}
                          </div>
                          {/* Status */}
                          <div style={{ fontSize: 10, marginTop: 4, fontWeight: 600,
                            color: selecionado ? 'rgba(255,255,255,0.9)' : ocupada ? '#dc2626' : passado ? '#cbd5e1' : '#16a34a' }}>
                            {selecionado ? '✓ Selecionado' : ocupada ? '🔴 Ocupado' : passado ? 'Passado' : '🟢 Livre'}
                          </div>
                          {/* Quem ocupa */}
                          {ocupada && !selecionado && (
                            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3, lineHeight: 1.4 }}>
                              {ocupante.paciente}<br />
                              {ocupante.codigo ? `${ocupante.codigo} – ` : ''}{ocupante.estagiario}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Alerta se nenhum dia livre nos 10 dias */}
                  {!loadingDias && dias10.every(d => disponib10[d]?.[form.sala_id] || d < new Date().toISOString().split('T')[0]) && (
                    <div style={{ marginTop: 10, padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
                      ⚠️ Nenhum dia disponível neste período. Navegue para os próximos dias ou escolha outra sala.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Resumo do agendamento ── */}
            {form.data && form.hora && form.sala_id && (
              <div style={{ margin: '16px 0', padding: '14px 18px', background: 'var(--p3)', borderRadius: 12, border: '1.5px solid var(--p)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>📅</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Data</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--p)' }}>{fmtData(form.data)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>⏰</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Horário</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--p)' }}>{fmtHora(form.hora)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>🚪</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Sala</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--p)' }}>{salas.find(s => s.id === form.sala_id)?.nome || '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>{ETAPA_ICONS[ETAPAS_ATENDIMENTO.indexOf(form.tipo)] || '🩺'}</span>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>Etapa</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--p)' }}>{form.tipo}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Conflitos ── */}
            {conflitoEstagiario && (
              <div style={{ display: 'flex', gap: 12, background: '#FEF2F2', padding: '14px 16px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 8 }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#991B1B', margin: '0 0 4px' }}>Conflito — Estagiário ocupado</p>
                  <p style={{ color: '#7f1d1d', margin: 0 }}><strong>{estagiarioSelecionado?.nome}</strong> já tem consulta com <strong>{conflitoEstagiario.paciente}</strong>.</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>📅 {fmtData(conflitoEstagiario.data)} ⏰ {fmtHora(conflitoEstagiario.hora)}</p>
                </div>
              </div>
            )}
            {conflitoPaciente && (
              <div style={{ display: 'flex', gap: 12, background: '#FEF2F2', padding: '14px 16px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 8 }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#991B1B', margin: '0 0 4px' }}>Conflito — Paciente já agendado</p>
                  <p style={{ color: '#7f1d1d', margin: 0 }}><strong>{pacienteSelecionado?.nome}</strong> já tem consulta neste horário.</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>📅 {fmtData(conflitoPaciente.data)} ⏰ {fmtHora(conflitoPaciente.hora)}</p>
                </div>
              </div>
            )}
            {salaOcupada && (
              <div style={{ display: 'flex', gap: 12, background: '#FFFBEB', padding: '14px 16px', borderRadius: 10, border: '1px solid #FDE68A', marginTop: 8 }}>
                <span style={{ fontSize: 22 }}>🚪</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>Sala ocupada neste dia</p>
                  <p style={{ color: '#78350f', margin: 0 }}><strong>{salaOcupada.paciente}</strong> com <strong>{salaOcupada.codigo ? `${salaOcupada.codigo} – ` : ''}{salaOcupada.estagiario}</strong>.</p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>📅 {fmtData(salaOcupada.data)} ⏰ {fmtHora(salaOcupada.hora)}</p>
                </div>
              </div>
            )}

            <div className="modal-btns">
              <button className="btn-outline" onClick={fecharModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleAgendar}
                disabled={saving || !form.paciente_id || !form.estagiario_id || !form.data || !form.hora || !form.sala_id}>
                {saving ? 'Verificando...' : `Confirmar — ${form.tipo} · ${fmtData(form.data)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ MODAL REAGENDAMENTO/CANCELAMENTO ══════ */}
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

      {/* ══════ MODAL TROCA DE SALA ══════ */}
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
