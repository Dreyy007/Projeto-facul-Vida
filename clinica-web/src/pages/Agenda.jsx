import { useEffect, useState, useCallback } from 'react'
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
  const [conflitoEstagiario, setConflitoEstagiario] = useState(null)   // { paciente, data, hora }
  const [conflitoPaciente, setConflitoPaciente] = useState(null)        // { data, hora }
  const [salaOcupada, setSalaOcupada] = useState(null)                  // { paciente, estagiario, data, hora }

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

  // Ocupação de salas para o modal (carregada automaticamente quando data+hora mudam)
  const [ocupacaoSalas, setOcupacaoSalas] = useState({}) // { sala_id: { paciente, estagiario, hora, data } }
  const [loadingOcupacao, setLoadingOcupacao] = useState(false)

  useEffect(() => { fetchConsultas() }, [data, viewMode])
  useEffect(() => { fetchSelects() }, [])

  // Limpa conflitos quando campos mudam
  useEffect(() => {
    setConflitoEstagiario(null)
    setConflitoPaciente(null)
    setSalaOcupada(null)
  }, [form.estagiario_id, form.paciente_id, form.data, form.hora, form.sala_id])

  // Carrega ocupação das salas em tempo real quando data + hora são preenchidos
  useEffect(() => {
    if (form.data && form.hora) {
      carregarOcupacaoSalas(form.data, form.hora)
    } else {
      setOcupacaoSalas({})
    }
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
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function fmtHora(h) {
    if (!h) return '—'
    return h.slice(0, 5)
  }

  // Filtra pacientes por CPF ou nome
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

  // Filtra estagiários por nome ou código
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
    setConflitoEstagiario(null)
    setConflitoPaciente(null)
    setSalaOcupada(null)

    if (!form.estagiario_id || !form.data || !form.hora) return false

    // Conflito estagiário no horário
    const { data: c1 } = await supabase
      .from('consultas')
      .select('id, paciente:pacientes(nome), data, hora')
      .eq('medico_id', form.estagiario_id)
      .eq('data', form.data)
      .eq('hora', form.hora)
      .not('status', 'in', '("cancelada","realizada")')
    if (c1?.length > 0) {
      setConflitoEstagiario({
        paciente: c1[0].paciente?.nome || '—',
        data: c1[0].data,
        hora: c1[0].hora,
      })
      return true
    }

    // Conflito paciente no horário
    const { data: c2 } = await supabase
      .from('consultas')
      .select('id, data, hora')
      .eq('paciente_id', form.paciente_id)
      .eq('data', form.data)
      .eq('hora', form.hora)
      .not('status', 'in', '("cancelada","realizada")')
    if (c2?.length > 0) {
      setConflitoPaciente({ data: c2[0].data, hora: c2[0].hora })
      return true
    }

    // Sala ocupada
    if (form.sala_id) {
      const ocu = ocupacaoSalas[form.sala_id]
      if (ocu) {
        setSalaOcupada({ ...ocu, data: form.data, hora: form.hora })
        return true
      }
    }
    return false
  }

  async function handleAgendar() {
    setSaving(true)
    if (await verificarConflitos()) { setSaving(false); return }
    // Admin e Coordenador confirmam direto; Estagiário vai para aprovação
    const statusInicial = ['admin', 'coordenador'].includes(profile?.tipo) ? 'confirmada' : 'aguardando'
    const { error } = await supabase.from('consultas').insert([{
      paciente_id: form.paciente_id, medico_id: form.estagiario_id,
      tipo: form.tipo, data: form.data, hora: form.hora,
      sala_id: form.sala_id || null, status: statusInicial, criado_por: profile.id,
    }])
    if (!error) {
      setModal(false)
      setConflitoEstagiario(null); setConflitoPaciente(null); setSalaOcupada(null)
      setBuscaPaciente(''); setPacienteSelecionado(null)
      setForm({ paciente_id: '', estagiario_id: profile?.tipo === 'estagiario' ? profile.id : '', tipo: 'Triagem', data: '', hora: '', sala_id: '' })
      if (profile?.tipo !== 'estagiario') { setEstagiarioSelecionado(null); setBuscaEstagiario('') }
      fetchConsultas()
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
    setModalTrocaSala(null); fetchConsultas(); toast.success('Solicitação de troca de sala enviada!')
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
    const matchBusca = !busca ||
      c.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.paciente?.cpf?.replace(/\D/g, '').includes(busca.replace(/\D/g, '')) ||
      c.estagiario?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.estagiario?.codigo?.toLowerCase().includes(busca.toLowerCase())
    return matchStatus && matchSala && matchBusca
  })

  const dataLabel = viewMode === 'todos'
    ? 'Todas as consultas'
    : new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const dropStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#fff', border: '1.5px solid var(--border)',
    borderRadius: 8, zIndex: 100, maxHeight: 220, overflowY: 'auto',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  }

  // Índice da etapa atual no fluxo
  const etapaIdx = ETAPAS_ATENDIMENTO.indexOf(form.tipo)

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

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" placeholder="🔍 Buscar paciente, CPF, estagiário ou código..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 340 }} />
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

      {/* Tabela */}
      <div className="card">
        <div className="card-head"><h3>Consultas {viewMode === 'semana' ? 'da semana' : viewMode === 'todos' ? '— todas' : 'do dia'}</h3></div>
        <div className="card-body">
          {loading ? <div className="empty">Carregando...</div> : filtered.length === 0 ? (
            <div className="empty">
              <span style={{ fontSize: 32 }}>📅</span>
              <span>Nenhuma consulta encontrada</span>
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setModal(true)}>+ Agendar consulta</button>
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
                {filtered.map(c => (
                  <tr key={c.id}>
                    {viewMode !== 'dia' && <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>}
                    <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0, 5)}</td>
                    <td><div className="td-user"><div className="av">{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>{c.paciente?.nome}</div></td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtCpf(c.paciente?.cpf) || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{c.estagiario?.nome || '—'}</td>
                    <td>{c.estagiario?.codigo ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.estagiario.codigo}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
                    <td>
                      {/* Badge colorido por etapa */}
                      {(() => {
                        const colors = { Triagem: '#0891b2', Avaliação: '#7c3aed', Consulta: '#0047AB', 'Direcionamento Final': '#059669' }
                        const bgs   = { Triagem: '#e0f7fa', Avaliação: '#f3e8ff', Consulta: '#eff6ff', 'Direcionamento Final': '#d1fae5' }
                        return (
                          <span style={{ background: bgs[c.tipo] || 'var(--p3)', color: colors[c.tipo] || 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                            {c.tipo || '—'}
                          </span>
                        )
                      })()}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {c.sala?.nome
                        ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, display: 'inline-block' }}>{c.sala.nome}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                    </td>
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

      {/* ══════════════ MODAL AGENDAR ══════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <h2 style={{ marginBottom: 4 }}>Agendar Consulta</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Preencha os dados abaixo para registrar o atendimento</p>

            <div className="form-grid">

              {/* ── Busca Paciente ── */}
              <div className="fld" style={{ position: 'relative', gridColumn: '1/-1' }}>
                <label>Paciente * <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>— busque por CPF ou nome</span></label>
                <input
                  value={buscaPaciente}
                  onChange={e => { setBuscaPaciente(e.target.value); setShowDropPaciente(true); setPacienteSelecionado(null); setForm(f => ({ ...f, paciente_id: '' })) }}
                  onFocus={() => setShowDropPaciente(true)}
                  placeholder="Digite o CPF (ex: 123.456.789-00) ou nome"
                />
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

              {/* ── Busca Estagiário ── */}
              <div className="fld" style={{ position: 'relative' }}>
                <label>Estagiário * {isEstagiario && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(você)</span>}</label>
                <input
                  value={buscaEstagiario}
                  onChange={e => { setBuscaEstagiario(e.target.value); setShowDropEst(true); setEstagiarioSelecionado(null); setForm(f => ({ ...f, estagiario_id: '' })) }}
                  onFocus={() => setShowDropEst(true)}
                  placeholder="Nome ou código (ex: EST01)"
                  disabled={isEstagiario}
                  style={{ opacity: isEstagiario ? 0.7 : 1 }}
                />
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

              {/* ── Data e Hora ── */}
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
                    const colors = ['#0891b2', '#7c3aed', '#0047AB', '#059669']
                    const bgs   = ['#e0f7fa', '#f3e8ff', '#eff6ff', '#d1fae5']
                    return (
                      <button
                        key={etapa}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: etapa }))}
                        style={{
                          flex: 1, padding: '10px 8px', border: 'none', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 12, fontWeight: ativo ? 700 : 500,
                          background: ativo ? colors[idx] : '#fff',
                          color: ativo ? '#fff' : '#64748b',
                          borderRight: idx < 3 ? '1px solid var(--border)' : 'none',
                          transition: 'all .15s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{['🔍','📋','🩺','🎯'][idx]}</span>
                        <span>{etapa}</span>
                        {ativo && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)', display: 'block' }} />}
                      </button>
                    )
                  })}
                </div>
                {/* Descrição da etapa */}
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  {form.tipo === 'Triagem' && '🔍 Primeiro contato: identificação do motivo da consulta e encaminhamento.'}
                  {form.tipo === 'Avaliação' && '📋 Avaliação aprofundada do quadro clínico do paciente.'}
                  {form.tipo === 'Consulta' && '🩺 Sessão de atendimento padrão com o estagiário.'}
                  {form.tipo === 'Direcionamento Final' && '🎯 Encerramento do ciclo e direcionamento para próximos passos.'}
                </p>
              </div>

              {/* ── Seleção de Sala com Ocupação Visual ── */}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Sala
                  {loadingOcupacao && <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>Verificando disponibilidade...</span>}
                  {!loadingOcupacao && form.data && form.hora && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                      Disponibilidade em {fmtData(form.data)} às {fmtHora(form.hora)}
                    </span>
                  )}
                </label>

                {(!form.data || !form.hora) ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>
                    ℹ️ Preencha a data e o horário para ver a disponibilidade das salas.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 6 }}>
                    {/* Opção: sem sala */}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, sala_id: '' }))}
                      style={{
                        padding: '12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                        border: form.sala_id === '' ? '2px solid var(--p)' : '1.5px solid var(--border)',
                        background: form.sala_id === '' ? 'var(--p3)' : '#fff',
                        textAlign: 'left', transition: 'all .15s',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: form.sala_id === '' ? 'var(--p)' : 'var(--muted)' }}>Sem sala</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Definir depois</div>
                    </button>

                    {salas.map(s => {
                      const ocupante = ocupacaoSalas[s.id]
                      const ocupada = !!ocupante
                      const selecionada = form.sala_id === s.id
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => !ocupada && setForm(f => ({ ...f, sala_id: s.id }))}
                          style={{
                            padding: '12px', borderRadius: 10, fontFamily: 'inherit',
                            cursor: ocupada ? 'not-allowed' : 'pointer',
                            border: selecionada
                              ? '2px solid var(--p)'
                              : ocupada
                              ? '1.5px solid #FECACA'
                              : '1.5px solid var(--border)',
                            background: selecionada
                              ? 'var(--p3)'
                              : ocupada
                              ? '#FEF2F2'
                              : '#fff',
                            textAlign: 'left', transition: 'all .15s',
                            opacity: ocupada && !selecionada ? 0.9 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: selecionada ? 'var(--p)' : ocupada ? '#b91c1c' : 'var(--text)' }}>
                              🚪 {s.nome}
                            </span>
                            {selecionada && <span style={{ fontSize: 12, color: 'var(--p)' }}>✓</span>}
                            {ocupada && <span style={{ fontSize: 16 }}>🔴</span>}
                            {!ocupada && !selecionada && <span style={{ fontSize: 16 }}>🟢</span>}
                          </div>

                          {ocupada ? (
                            /* ── Bloco de ocupação detalhado ── */
                            <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                              <div style={{ color: '#b91c1c', fontWeight: 600, marginBottom: 2 }}>Ocupada</div>
                              <div style={{ color: '#6b7280' }}>
                                <span style={{ fontWeight: 600, color: '#374151' }}>👤 {ocupante.paciente}</span>
                              </div>
                              <div style={{ color: '#6b7280' }}>
                                <span style={{ fontWeight: 600, color: '#374151' }}>
                                  {ocupante.codigo ? `${ocupante.codigo} – ` : ''}{ocupante.estagiario}
                                </span>
                              </div>
                              <div style={{ color: '#9ca3af', marginTop: 3, display: 'flex', gap: 6 }}>
                                <span>📅 {fmtData(form.data)}</span>
                                <span>⏰ {fmtHora(ocupante.hora)}</span>
                              </div>
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

            {/* ── Alertas de conflito detalhados ── */}
            {conflitoEstagiario && (
              <div style={{ display: 'flex', gap: 12, background: '#FEF2F2', padding: '14px 16px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 12 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#991B1B', margin: '0 0 4px' }}>Conflito de horário — Estagiário</p>
                  <p style={{ color: '#7f1d1d', margin: 0 }}>
                    <strong>{estagiarioSelecionado?.nome || 'Este estagiário'}</strong> já tem consulta com{' '}
                    <strong>{conflitoEstagiario.paciente}</strong> neste horário.
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>
                    📅 {fmtData(conflitoEstagiario.data)} às {fmtHora(conflitoEstagiario.hora)}
                  </p>
                </div>
              </div>
            )}
            {conflitoPaciente && (
              <div style={{ display: 'flex', gap: 12, background: '#FEF2F2', padding: '14px 16px', borderRadius: 10, border: '1px solid #FECACA', marginTop: 12 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#991B1B', margin: '0 0 4px' }}>Conflito de horário — Paciente</p>
                  <p style={{ color: '#7f1d1d', margin: 0 }}>
                    <strong>{pacienteSelecionado?.nome || 'Este paciente'}</strong> já tem consulta agendada neste horário.
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>
                    📅 {fmtData(conflitoPaciente.data)} às {fmtHora(conflitoPaciente.hora)}
                  </p>
                </div>
              </div>
            )}
            {salaOcupada && (
              <div style={{ display: 'flex', gap: 12, background: '#FFFBEB', padding: '14px 16px', borderRadius: 10, border: '1px solid #FDE68A', marginTop: 12 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🚪</span>
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 700, color: '#92400E', margin: '0 0 4px' }}>Sala já reservada</p>
                  <p style={{ color: '#78350f', margin: 0 }}>
                    Sala ocupada por <strong>{salaOcupada.paciente}</strong> com{' '}
                    <strong>{salaOcupada.codigo ? `${salaOcupada.codigo} – ` : ''}{salaOcupada.estagiario}</strong>.
                  </p>
                  <p style={{ color: '#9ca3af', fontSize: 11, margin: '4px 0 0' }}>
                    📅 {fmtData(salaOcupada.data)} às {fmtHora(salaOcupada.hora)}
                  </p>
                </div>
              </div>
            )}

            <div className="modal-btns">
              <button className="btn-outline" onClick={fecharModal}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleAgendar}
                disabled={saving || !form.paciente_id || !form.estagiario_id || !form.data || !form.hora}
              >
                {saving ? 'Verificando...' : `Confirmar — ${form.tipo}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL REAGENDAMENTO / CANCELAMENTO ══════════════ */}
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

      {/* ══════════════ MODAL TROCA DE SALA ══════════════ */}
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
