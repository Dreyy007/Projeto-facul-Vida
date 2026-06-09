import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Pages.css'

// ─── Configuração das 4 etapas ────────────────────────────────────────────────
const ETAPAS_CONFIG = [
  { id: 'Triagem',             label: 'Triagem',             icon: '🔍', color: '#0891b2', bg: '#e0f7fa' },
  { id: 'Avaliação',           label: 'Avaliação',           icon: '📋', color: '#7c3aed', bg: '#f3e8ff' },
  { id: 'Consulta',            label: 'Consulta',            icon: '🩺', color: '#0047AB', bg: '#eff6ff' },
  { id: 'Direcionamento Final',label: 'Direcionamento Final',icon: '🎯', color: '#059669', bg: '#d1fae5' },
]

// ─── Utilitários ──────────────────────────────────────────────────────────────
function fmtCpf(cpf) {
  if (!cpf) return ''
  return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}
function fmtData(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
}
function fmtHora(h) { return h ? h.slice(0, 5) : '—' }

function gerarDias(base, n = 10) {
  const dias = []
  for (let i = 0; i < n; i++) {
    const d = new Date(base + 'T12:00:00')
    d.setDate(d.getDate() + i)
    dias.push(d.toISOString().split('T')[0])
  }
  return dias
}

function etapaVazia() {
  return {
    sala_id: '',
    hora: '',
    data: '',
    baseDias: new Date().toISOString().split('T')[0],
    ocupacao: {},        // { 'YYYY-MM-DD': [{ hora, paciente, estagiario, codigo }] }
    horasDia: {},        // { 'YYYY-MM-DD': 'HH:MM' } — hora personalizada por dia
    loading: false,
  }
}

// ─── Painel de cada etapa ─────────────────────────────────────────────────────
function EtapaPanel({ cfg, estado, salas, onUpdate, onCarregarOcupacao }) {
  const { sala_id, hora, data, baseDias, ocupacao, horasDia, loading } = estado
  const hoje = new Date().toISOString().split('T')[0]
  const dias = sala_id && hora ? gerarDias(baseDias, 10) : []

  function horaDoDia(dia) { return horasDia[dia] || hora }
  function estaOcupado(dia) {
    const h = horaDoDia(dia)
    return !!(h && (ocupacao[dia] || []).some(c => c.hora?.slice(0, 5) === h))
  }
  function ocupantesDia(dia) {
    const h = horaDoDia(dia)
    return (ocupacao[dia] || []).filter(c => c.hora?.slice(0, 5) === h)
  }

  const concluido = !!(sala_id && hora && data)

  return (
    <div style={{
      border: `2px solid ${concluido ? cfg.color : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden', marginBottom: 12,
      transition: 'border-color .2s',
    }}>
      {/* ── Header ── */}
      <div style={{ padding: '12px 18px', background: concluido ? cfg.bg : '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: concluido ? cfg.color : '#374151' }}>{cfg.label}</div>
          {concluido
            ? <div style={{ fontSize: 12, color: cfg.color, opacity: 0.85, marginTop: 1 }}>
                ✓ {fmtData(data)} às {fmtHora(horaDoDia(data))} · {salas.find(s => s.id === sala_id)?.nome || '—'}
              </div>
            : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>Selecione sala → horário → dia</div>
          }
        </div>
        {concluido && (
          <span style={{ background: cfg.color, color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20 }}>✓ OK</span>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '16px 18px', background: '#fff' }}>

        {/* Sala */}
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Sala</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {salas.map(s => {
              const sel = sala_id === s.id
              return (
                <button key={s.id} type="button"
                  onClick={() => onUpdate({ sala_id: s.id, data: '', horasDia: {} }, () => onCarregarOcupacao(s.id, baseDias))}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: sel ? 700 : 500, transition: 'all .15s',
                    border: sel ? `2px solid ${cfg.color}` : '1.5px solid #e2e8f0',
                    background: sel ? cfg.bg : '#fff',
                    color: sel ? cfg.color : '#374151',
                  }}>
                  🚪 {s.nome}
                </button>
              )
            })}
          </div>
        </div>

        {/* Hora padrão */}
        {sala_id && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>
              Horário padrão
              <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>— pode ajustar individualmente em cada dia abaixo</span>
            </p>
            <input type="time" value={hora}
              onChange={e => onUpdate({ hora: e.target.value, data: '' })}
              style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', color: '#374151' }} />
          </div>
        )}

        {/* Grade de 10 dias */}
        {sala_id && hora && (
          <div>
            {/* Navegação */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>
                Selecione o dia
                {data && <span style={{ marginLeft: 8, color: cfg.color, fontWeight: 700 }}>→ {fmtData(data)}</span>}
              </p>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {loading && <span style={{ fontSize: 11, color: '#94a3b8' }}>Carregando...</span>}
                <button type="button" onClick={() => { const d = new Date(baseDias + 'T12:00:00'); d.setDate(d.getDate() - 10); onUpdate({ baseDias: d.toISOString().split('T')[0] }, (novo) => onCarregarOcupacao(sala_id, novo.baseDias)) }}
                  style={{ padding: '3px 10px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>← 10d</button>
                <button type="button" onClick={() => { const t = new Date().toISOString().split('T')[0]; onUpdate({ baseDias: t }, () => onCarregarOcupacao(sala_id, t)) }}
                  style={{ padding: '3px 10px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Hoje</button>
                <button type="button" onClick={() => { const d = new Date(baseDias + 'T12:00:00'); d.setDate(d.getDate() + 10); onUpdate({ baseDias: d.toISOString().split('T')[0] }, (novo) => onCarregarOcupacao(sala_id, novo.baseDias)) }}
                  style={{ padding: '3px 10px', fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>+10d →</button>
              </div>
            </div>

            {/* Grid horizontal com scroll */}
            <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
                {dias.map(dia => {
                  const horaDia = horaDoDia(dia)
                  const ocupado = estaOcupado(dia)
                  const ocup = ocupantesDia(dia)
                  const sel = data === dia
                  const passado = dia < hoje
                  const dtObj = new Date(dia + 'T12:00:00')
                  const semana = dtObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                  const diaN = String(dtObj.getDate()).padStart(2, '0')
                  const mesN = dtObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
                  const isFds = [0, 6].includes(dtObj.getDay())
                  const temHoraCustom = !!horasDia[dia]

                  return (
                    <div key={dia} style={{
                      width: 108, flexShrink: 0, borderRadius: 12,
                      border: sel ? `2.5px solid ${cfg.color}` : ocupado ? '1.5px solid #FECACA' : '1.5px solid #e2e8f0',
                      background: sel ? cfg.bg : ocupado ? '#FFF5F5' : '#fff',
                      opacity: passado && !sel ? 0.4 : 1,
                      boxShadow: sel ? `0 3px 12px ${cfg.color}35` : '0 1px 3px rgba(0,0,0,0.05)',
                      overflow: 'hidden',
                    }}>
                      {/* Cabeçalho clicável do dia */}
                      <div
                        onClick={() => !ocupado && !passado && onUpdate({ data: dia })}
                        style={{
                          padding: '8px', textAlign: 'center',
                          cursor: ocupado || passado ? 'not-allowed' : 'pointer',
                          background: sel ? cfg.color : 'transparent',
                          borderBottom: '1px solid #e2e8f0',
                          userSelect: 'none',
                        }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: sel ? 'rgba(255,255,255,.75)' : isFds ? '#f59e0b' : '#94a3b8' }}>{semana}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1, color: sel ? '#fff' : ocupado ? '#b91c1c' : passado ? '#cbd5e1' : '#0f172a', marginTop: 2 }}>{diaN}</div>
                        <div style={{ fontSize: 10, color: sel ? 'rgba(255,255,255,.7)' : '#94a3b8', marginTop: 1 }}>{mesN}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, color: sel ? '#fff' : ocupado ? '#dc2626' : passado ? '#cbd5e1' : '#16a34a' }}>
                          {sel ? '✓' : ocupado ? '🔴' : passado ? '—' : '🟢'}
                        </div>
                      </div>

                      {/* Hora ajustável por dia */}
                      {!passado && (
                        <div style={{ padding: '6px', borderBottom: '1px solid #e2e8f0', background: temHoraCustom ? '#fefce8' : '#fff' }}>
                          <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 3, fontWeight: 500, textAlign: 'center' }}>
                            {temHoraCustom ? '⚡ Hora ajustada' : '⏰ Hora'}
                          </div>
                          <input type="time" value={horaDia}
                            onClick={e => e.stopPropagation()}
                            onChange={e => {
                              const novasHoras = { ...horasDia, [dia]: e.target.value }
                              // Se o dia selecionado mudou a hora, desseleciona para reconfirmar
                              onUpdate({ horasDia: novasHoras, data: data === dia ? '' : data })
                            }}
                            style={{
                              width: '100%', boxSizing: 'border-box',
                              padding: '3px 4px', fontSize: 11, fontFamily: 'inherit',
                              border: `1px solid ${temHoraCustom ? '#fde68a' : '#e2e8f0'}`,
                              borderRadius: 6, outline: 'none',
                              background: temHoraCustom ? '#fffbeb' : '#f8fafc', color: '#374151',
                            }} />
                          {temHoraCustom && (
                            <button type="button"
                              onClick={e => { e.stopPropagation(); const h = { ...horasDia }; delete h[dia]; onUpdate({ horasDia: h }) }}
                              style={{ display: 'block', width: '100%', marginTop: 3, fontSize: 9, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                              ↩ padrão
                            </button>
                          )}
                        </div>
                      )}

                      {/* Quem está ocupando */}
                      {ocupado && ocup.length > 0 && (
                        <div style={{ padding: '5px 6px', fontSize: 9, color: '#6b7280', lineHeight: 1.5, background: '#FFF5F5' }}>
                          <div style={{ fontWeight: 600, color: '#b91c1c' }}>Ocupada às {ocup[0].hora?.slice(0, 5)}</div>
                          <div>{ocup[0].paciente.split(' ')[0]}</div>
                          <div style={{ color: '#94a3b8' }}>{ocup[0].codigo || ocup[0].estagiario.split(' ')[0]}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Aviso sem dias livres */}
            {!loading && dias.length > 0 && dias.every(d => estaOcupado(d) || d < hoje) && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#92400E', background: '#FFFBEB', padding: '8px 12px', borderRadius: 8, border: '1px solid #FDE68A' }}>
                ⚠️ Nenhum horário livre nos 10 dias exibidos. Navegue ou troque de sala.
              </p>
            )}
          </div>
        )}

        {!sala_id && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>👆 Selecione uma sala para continuar.</p>}
        {sala_id && !hora && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>⏰ Informe o horário padrão para ver os dias disponíveis.</p>}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Agenda() {
  const { profile } = useAuth()
  const toast = useToast()

  // Estado da agenda (tabela)
  const [consultas,    setConsultas]   = useState([])
  const [pacientes,    setPacientes]   = useState([])
  const [estagiarios,  setEstagiarios] = useState([])
  const [salas,        setSalas]       = useState([])
  const [loading,      setLoading]     = useState(true)
  const [dataAgenda,   setDataAgenda]  = useState(new Date().toISOString().split('T')[0])
  const [viewMode,     setViewMode]    = useState('dia')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroSala,   setFiltroSala]   = useState('todos')
  const [busca,        setBusca]        = useState('')

  // Modal principal
  const [modal,          setModal]          = useState(false)
  const [modalSolic,     setModalSolic]     = useState(null)
  const [modalTrocaSala, setModalTrocaSala] = useState(null)
  const [saving,         setSaving]         = useState(false)

  // Paciente / Estagiário
  const [buscaPaciente,       setBuscaPaciente]       = useState('')
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null)
  const [showDropPaciente,    setShowDropPaciente]    = useState(false)
  const [buscaEstagiario,     setBuscaEstagiario]     = useState('')
  const [estagiarioSelecionado, setEstagiarioSelecionado] = useState(null)
  const [showDropEst,         setShowDropEst]         = useState(false)

  // Estado das 4 etapas
  const [etapas, setEtapas] = useState(ETAPAS_CONFIG.map(() => etapaVazia()))

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { fetchConsultas() }, [dataAgenda, viewMode])
  useEffect(() => { fetchSelects()   }, [])

  // ── Busca de dados ──────────────────────────────────────────────────────────
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
    }
  }

  // ── Atualiza uma etapa ──────────────────────────────────────────────────────
  function updateEtapa(idx, changes, callback) {
    setEtapas(prev => {
      const next = prev.map((e, i) => i === idx ? { ...e, ...changes } : e)
      if (callback) setTimeout(() => callback(next[idx]), 0)
      return next
    })
  }

  // ── Carrega ocupação de uma sala nos 10 dias de uma etapa ──────────────────
  async function carregarOcupacaoEtapa(idx, salaId, baseDias) {
    if (!salaId) return
    updateEtapa(idx, { loading: true })
    const dias = gerarDias(baseDias, 10)
    const { data: rows } = await supabase
      .from('consultas')
      .select('data, hora, paciente:pacientes(nome), estagiario:profiles(nome,codigo)')
      .eq('sala_id', salaId)
      .in('data', dias)
      .not('status', 'in', '("cancelada","realizada")')
    const ocupacao = {}
    dias.forEach(d => { ocupacao[d] = [] })
    ;(rows || []).forEach(c => {
      if (ocupacao[c.data]) ocupacao[c.data].push({
        hora:       c.hora,
        paciente:   c.paciente?.nome  || '—',
        estagiario: c.estagiario?.nome || '—',
        codigo:     c.estagiario?.codigo || '',
      })
    })
    updateEtapa(idx, { ocupacao, loading: false })
  }

  // ── Paciente / Estagiário ──────────────────────────────────────────────────
  const pacsFiltrados = pacientes.filter(p => {
    const q = buscaPaciente.toLowerCase()
    const cpf = (p.cpf || '').replace(/\D/g, '')
    return p.nome?.toLowerCase().includes(q) || cpf.includes(q.replace(/\D/g, ''))
  }).slice(0, 8)

  function selecionarPaciente(p) {
    setPacienteSelecionado(p); setBuscaPaciente(fmtCpf(p.cpf) || p.nome); setShowDropPaciente(false)
  }

  const estFiltrados = estagiarios.filter(e => {
    const q = buscaEstagiario.toLowerCase()
    return e.nome?.toLowerCase().includes(q) || e.codigo?.toLowerCase().includes(q)
  })

  function selecionarEst(e) {
    setEstagiarioSelecionado(e)
    setBuscaEstagiario(e.codigo ? `${e.codigo} — ${e.nome}` : e.nome)
    setShowDropEst(false)
  }

  // ── Confirmar agendamento ──────────────────────────────────────────────────
  async function handleAgendar() {
    if (!pacienteSelecionado) { toast.error('Selecione um paciente.'); return }
    if (!estagiarioSelecionado) { toast.error('Selecione um estagiário.'); return }

    const etapasConcluidas = etapas
      .map((e, i) => ({ ...e, cfg: ETAPAS_CONFIG[i] }))
      .filter(e => e.sala_id && e.hora && e.data)

    if (etapasConcluidas.length === 0) {
      toast.error('Selecione data, hora e sala em pelo menos uma etapa.')
      return
    }

    setSaving(true)

    // ── Verificar conflitos reais no banco antes de inserir ─────────────────────
    for (const e of etapasConcluidas) {
      const hora = e.horasDia[e.data] || e.hora
      const { data: conflitos } = await supabase
        .from('consultas')
        .select('id, paciente:pacientes(nome), estagiario:profiles(nome,codigo)')
        .eq('sala_id', e.sala_id)
        .eq('data', e.data)
        .eq('hora', hora)
        .not('status', 'in', '("cancelada","realizada")')
      if (conflitos && conflitos.length > 0) {
        const nomeSala = salas.find(s => s.id === e.sala_id)?.nome || 'sala'
        const ocupante = conflitos[0]?.paciente?.nome || '—'
        const est = conflitos[0]?.estagiario?.codigo || conflitos[0]?.estagiario?.nome || '—'
        toast.error(`❌ Conflito em "${e.cfg.label}": ${nomeSala} já está ocupada às ${hora} em ${fmtData(e.data)}.\nPaciente: ${ocupante} · Estagiário: ${est}`)
        setSaving(false)
        return
      }
    }

    const statusInicial = ['admin', 'coordenador'].includes(profile?.tipo) ? 'confirmada' : 'aguardando'

    const inserts = etapasConcluidas.map(e => ({
      paciente_id: pacienteSelecionado.id,
      medico_id:   estagiarioSelecionado.id,
      tipo:        e.cfg.id,
      data:        e.data,
      hora:        e.horasDia[e.data] || e.hora,
      sala_id:     e.sala_id,
      status:      statusInicial,
      criado_por:  profile.id,
    }))

    const { error } = await supabase.from('consultas').insert(inserts)
    if (!error) {
      toast.success(`${etapasConcluidas.length} consulta(s) agendada(s) com sucesso!`)
      fecharModal()
      fetchConsultas()
    } else {
      toast.error('Erro: ' + error.message)
    }
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
    setBuscaPaciente(''); setPacienteSelecionado(null); setShowDropPaciente(false)
    setBuscaEstagiario(''); setEstagiarioSelecionado(null); setShowDropEst(false)
    setEtapas(ETAPAS_CONFIG.map(() => etapaVazia()))
  }

  // ── Helpers de tabela ──────────────────────────────────────────────────────
  const navData = d => { const dt = new Date(dataAgenda + 'T12:00:00'); dt.setDate(dt.getDate() + d); setDataAgenda(dt.toISOString().split('T')[0]) }
  const ETAPA_MAP = Object.fromEntries(ETAPAS_CONFIG.map(e => [e.id, e]))
  const tagClass = s => ({ confirmada:'tag tg', aguardando:'tag ta', cancelada:'tag tr', realizada:'tag tp', cancelamento_pendente:'tag tr', reagendamento_pendente:'tag ta', troca_sala_pendente:'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada:'Confirmada', aguardando:'Aguardando', cancelada:'Cancelada', realizada:'Realizada', cancelamento_pendente:'Cancel. pend.', reagendamento_pendente:'Reagend. pend.', troca_sala_pendente:'Troca sala pend.' }[s] || s)
  const canApprove = ['admin','coordenador'].includes(profile?.tipo)
  const isEstagiario = profile?.tipo === 'estagiario'

  const filtered = consultas.filter(c => {
    return (filtroStatus === 'todos' || c.status === filtroStatus) &&
           (filtroSala   === 'todos' || c.sala_id === filtroSala) &&
           (!busca ||
            c.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
            c.paciente?.cpf?.replace(/\D/g,'').includes(busca.replace(/\D/g,'')) ||
            c.estagiario?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
            c.estagiario?.codigo?.toLowerCase().includes(busca.toLowerCase()))
  })

  const dataLabel = viewMode === 'todos'
    ? 'Todas as consultas'
    : new Date(dataAgenda + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const dropStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8,
    zIndex: 100, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  }

  const etapasConcluidas = etapas.filter((e, i) => e.sala_id && e.hora && e.data)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* Cabeçalho */}
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

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" placeholder="🔍 Buscar paciente, CPF, estagiário..." value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 300 }} />
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

      {/* Tabela */}
      <div className="card">
        <div className="card-head"><h3>Consultas {viewMode === 'semana' ? 'da semana' : viewMode === 'todos' ? '— todas' : 'do dia'}</h3></div>
        <div className="card-body">
          {loading ? <div className="empty">Carregando...</div>
            : filtered.length === 0 ? (
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
                    const cfg = ETAPA_MAP[c.tipo]
                    return (
                      <tr key={c.id}>
                        {viewMode !== 'dia' && <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(c.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'})}</td>}
                        <td style={{ fontWeight: 700, color: 'var(--p)' }}>{c.hora?.slice(0,5)}</td>
                        <td><div className="td-user"><div className="av">{c.paciente?.nome?.slice(0,2).toUpperCase()}</div>{c.paciente?.nome}</div></td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtCpf(c.paciente?.cpf) || '—'}</td>
                        <td style={{ fontWeight: 500 }}>{c.estagiario?.nome || '—'}</td>
                        <td>{c.estagiario?.codigo ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>{c.estagiario.codigo}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                        <td>
                          <span style={{ background: cfg?.bg || 'var(--p3)', color: cfg?.color || 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
                            {cfg?.icon || ''} {c.tipo || '—'}
                          </span>
                        </td>
                        <td>{c.sala?.nome ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>{c.sala.nome}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
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
          MODAL AGENDAR — 4 ETAPAS
      ══════════════════════════════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) fecharModal() }}>
          <div className="modal" style={{ maxWidth: 820, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Agendar Consultas</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>Selecione paciente, estagiário e configure cada etapa do atendimento</p>
            </div>

            {/* Paciente */}
            <div className="fld" style={{ position: 'relative', marginBottom: 14 }}>
              <label>Paciente * <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>— busque por CPF ou nome</span></label>
              <input value={buscaPaciente}
                onChange={e => { setBuscaPaciente(e.target.value); setShowDropPaciente(true); setPacienteSelecionado(null) }}
                onFocus={() => setShowDropPaciente(true)} placeholder="CPF ou nome completo" />
              {pacienteSelecionado && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--p3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--p)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0 }}>{pacienteSelecionado.nome?.slice(0,2).toUpperCase()}</div>
                  <div><div style={{ fontWeight: 700, color: 'var(--p)' }}>{pacienteSelecionado.nome}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtCpf(pacienteSelecionado.cpf)}</div></div>
                  <button onClick={() => { setPacienteSelecionado(null); setBuscaPaciente('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>×</button>
                </div>
              )}
              {showDropPaciente && !pacienteSelecionado && pacsFiltrados.length > 0 && (
                <div style={dropStyle}>
                  {pacsFiltrados.map(p => (
                    <div key={p.id} onClick={() => selecionarPaciente(p)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      onMouseOver={ev => ev.currentTarget.style.background = 'var(--p3)'}
                      onMouseOut={ev => ev.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontWeight: 600 }}>{p.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtCpf(p.cpf)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estagiário */}
            <div className="fld" style={{ position: 'relative', marginBottom: 24 }}>
              <label>Estagiário * {isEstagiario && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(você)</span>}</label>
              <input value={buscaEstagiario}
                onChange={e => { setBuscaEstagiario(e.target.value); setShowDropEst(true); setEstagiarioSelecionado(null) }}
                onFocus={() => setShowDropEst(true)}
                placeholder="Nome ou código" disabled={isEstagiario} style={{ opacity: isEstagiario ? 0.7 : 1 }} />
              {estagiarioSelecionado && !isEstagiario && (
                <div style={{ marginTop: 6, padding: '6px 12px', background: 'var(--p3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: 'var(--p)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>{estagiarioSelecionado.codigo}</span>
                  <span style={{ fontWeight: 600, color: 'var(--p)' }}>{estagiarioSelecionado.nome}</span>
                  <button onClick={() => { setEstagiarioSelecionado(null); setBuscaEstagiario('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>×</button>
                </div>
              )}
              {showDropEst && !isEstagiario && !estagiarioSelecionado && estFiltrados.length > 0 && (
                <div style={dropStyle}>
                  {estFiltrados.map(e => (
                    <div key={e.id} onClick={() => selecionarEst(e)} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}
                      onMouseOver={ev => ev.currentTarget.style.background = 'var(--p3)'}
                      onMouseOut={ev => ev.currentTarget.style.background = 'transparent'}>
                      {e.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{e.codigo}</span>}
                      <span>{e.nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linha divisória + título etapas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Etapas do Atendimento</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* 4 etapas */}
            {ETAPAS_CONFIG.map((cfg, idx) => (
              <EtapaPanel
                key={cfg.id}
                cfg={cfg}
                estado={etapas[idx]}
                salas={salas}
                onUpdate={(changes, cb) => {
                  setEtapas(prev => {
                    const next = prev.map((e, i) => i === idx ? { ...e, ...changes } : e)
                    if (cb) setTimeout(() => cb(next[idx]), 0)
                    return next
                  })
                }}
                onCarregarOcupacao={(salaId, baseDias) => carregarOcupacaoEtapa(idx, salaId, baseDias)}
              />
            ))}

            {/* Resumo */}
            {etapasConcluidas.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '14px 18px', marginTop: 8 }}>
                <p style={{ fontWeight: 700, color: '#166534', fontSize: 13, margin: '0 0 10px' }}>✅ Resumo do agendamento ({etapasConcluidas.length} etapa{etapasConcluidas.length > 1 ? 's' : ''})</p>
                {etapas.map((e, i) => {
                  if (!e.sala_id || !e.hora || !e.data) return null
                  const cfg = ETAPAS_CONFIG[i]
                  const horaDia = e.horasDia[e.data] || e.hora
                  return (
                    <div key={cfg.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < etapas.length - 1 ? '1px solid #bbf7d0' : 'none' }}>
                      <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: cfg.color, minWidth: 160 }}>{cfg.label}</span>
                      <span style={{ fontSize: 12, color: '#374151' }}>📅 {fmtData(e.data)} ⏰ {fmtHora(horaDia)} 🚪 {salas.find(s => s.id === e.sala_id)?.nome}</span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="modal-btns" style={{ marginTop: 20 }}>
              <button className="btn-outline" onClick={fecharModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleAgendar}
                disabled={saving || !pacienteSelecionado || !estagiarioSelecionado || etapasConcluidas.length === 0}>
                {saving ? 'Salvando...' : `Confirmar ${etapasConcluidas.length > 0 ? `(${etapasConcluidas.length} etapa${etapasConcluidas.length > 1 ? 's' : ''})` : ''}`}
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
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Paciente: <strong>{modalTrocaSala.consulta.paciente?.nome}</strong>{modalTrocaSala.consulta.sala?.nome && ` · Sala: ${modalTrocaSala.consulta.sala.nome}`}</p>
            <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warn)', fontWeight: 500 }}>⚠️ Requer aprovação.</div>
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
