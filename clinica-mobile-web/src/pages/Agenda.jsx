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
function gerarMes(base) {
  const d = new Date(base + 'T12:00:00')
  const ano = d.getFullYear(), mes = d.getMonth()
  const primeiro = new Date(ano, mes, 1), ultimo = new Date(ano, mes + 1, 0)
  const cells = []
  for (let i = 0; i < primeiro.getDay(); i++) cells.push(null)
  for (let i = 1; i <= ultimo.getDate(); i++)
    cells.push(`${ano}-${String(mes+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`)
  return cells
}
function navMes(base, delta) {
  const d = new Date(base + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() + delta)
  return d.toISOString().split('T')[0]
}
function labelMes(base) {
  return new Date(base + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function mesPrimeiroDia(base) {
  const d = new Date(base + 'T12:00:00')
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}
function mesUltimoDia(base) {
  const d = new Date(base + 'T12:00:00'), ult = new Date(d.getFullYear(), d.getMonth()+1, 0)
  return `${ult.getFullYear()}-${String(ult.getMonth()+1).padStart(2,'0')}-${String(ult.getDate()).padStart(2,'0')}`
}

function etapaVazia() {
  return {
    sala_id: '',
    hora: '',
    selectedDias: [],    // array de datas selecionadas — múltiplos slots por etapa
    baseDias: new Date().toISOString().split('T')[0],
    ocupacao: {},        // { 'YYYY-MM-DD': [{ hora, paciente, estagiario, codigo }] }
    horasDia: {},        // { 'YYYY-MM-DD': 'HH:MM' } — hora personalizada por dia
    loading: false,
  }
}

// ─── Configurador Global (mobile) ────────────────────────────────────────────
function GlobalConfigurator({ salas, onAplicar }) {
  const hoje = new Date().toISOString().split('T')[0]
  const [gSala,     setGSala]     = useState('')
  const [gHora,     setGHora]     = useState('')
  const [gBaseDias, setGBaseDias] = useState(hoje)
  const [gOcupacao, setGOcupacao] = useState({})
  const [gLoading,  setGLoading]  = useState(false)
  const [altSalas,  setAltSalas]  = useState({})
  const [flashDia,  setFlashDia]  = useState(null)

  async function carregarOcupacao(sala_id, base) {
    setGLoading(true); setAltSalas({})
    const { data: rows } = await supabase
      .from('consultas').select('data,hora')
      .eq('sala_id', sala_id)
      .gte('data', mesPrimeiroDia(base)).lte('data', mesUltimoDia(base))
      .not('status', 'in', '("cancelada","realizada")')
    const occ = {}
    ;(rows || []).forEach(c => { if (!occ[c.data]) occ[c.data] = []; occ[c.data].push(c.hora?.slice(0, 5)) })
    setGOcupacao(occ); setGLoading(false)
  }

  async function buscarAlternativas(dia) {
    const { data: ocup } = await supabase
      .from('consultas').select('sala_id')
      .eq('data', dia).eq('hora', gHora)
      .not('status', 'in', '("cancelada","realizada")')
    const ocupadasIds = new Set((ocup || []).map(c => c.sala_id))
    setAltSalas(prev => ({ ...prev, [dia]: salas.filter(s => s.id !== gSala && !ocupadasIds.has(s.id)) }))
  }

  function diaOcupado(dia) { return gHora ? (gOcupacao[dia] || []).includes(gHora) : false }

  function handleDia(dia) {
    if (!gHora) return
    if (diaOcupado(dia)) { buscarAlternativas(dia); return }
    onAplicar(gSala, gHora, dia)
    setFlashDia(dia); setTimeout(() => setFlashDia(null), 2500)
  }

  return (
    <div style={{ background: 'linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)', border: '2px solid #bfdbfe', borderRadius: 14, padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20 }}>⚡</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>Configuração Rápida</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Sala + horário + clique no dia → aplica às 4 etapas</div>
        </div>
      </div>

      {/* Salas */}
      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>Sala</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {salas.map(s => {
            const sel = gSala === s.id
            return (
              <button key={s.id} type="button"
                onClick={() => { setGSala(s.id); setGOcupacao({}); setAltSalas({}); setFlashDia(null); carregarOcupacao(s.id, gBaseDias) }}
                style={{ padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: sel ? 700 : 500, border: sel ? '2px solid #2563eb' : '1.5px solid #bfdbfe', background: sel ? '#2563eb' : '#fff', color: sel ? '#fff' : '#374151' }}>
                🚪 {s.nome}
              </button>
            )
          })}
        </div>
      </div>

      {gSala && (
        <>
          {/* Horário */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>⏰ Hora:</span>
            <input type="time" value={gHora}
              onChange={e => { setGHora(e.target.value); setAltSalas({}) }}
              style={{ padding: '5px 8px', border: '1.5px solid #bfdbfe', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, outline: 'none', flex: 1 }} />
            {gLoading && <span style={{ fontSize: 10, color: '#64748b' }}>⏳</span>}
          </div>

          {/* Navegação mês */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <button type="button"
              onClick={() => { const nb = navMes(gBaseDias, -1); setGBaseDias(nb); carregarOcupacao(gSala, nb) }}
              style={{ padding: '3px 10px', fontSize: 16, border: '1px solid #bfdbfe', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 12, color: '#1e40af', textTransform: 'capitalize' }}>{labelMes(gBaseDias)}</span>
            <button type="button"
              onClick={() => { const nb = navMes(gBaseDias, 1); setGBaseDias(nb); carregarOcupacao(gSala, nb) }}
              style={{ padding: '3px 10px', fontSize: 16, border: '1px solid #bfdbfe', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>›</button>
          </div>

          {/* Cabeçalho semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
            {['D','S','T','Q','Q','S','S'].map((dn, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: i === 0 || i === 6 ? '#f59e0b' : '#94a3b8' }}>{dn}</div>
            ))}
          </div>

          {/* Grid mês */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {gerarMes(gBaseDias).map((dia, i) => {
              if (!dia) return <div key={`g${i}`} />
              const passado  = dia < hoje
              const ocupado  = diaOcupado(dia)
              const flash    = flashDia === dia
              const alts     = altSalas[dia]
              const clicavel = !passado && gHora

              let bg = '#fff', border = '#e2e8f0', txtColor = '#374151'
              if (flash)        { bg = '#dcfce7'; border = '#16a34a'; txtColor = '#15803d' }
              else if (ocupado) { bg = '#FFF5F5'; border = '#FECACA'; txtColor = '#dc2626' }
              else if (passado) { bg = '#fafafa'; border = '#f1f5f9'; txtColor = '#d1d5db' }
              else if (gHora)   { bg = '#f0fdf4'; border = '#86efac'; txtColor = '#15803d' }
              else              { bg = '#f8fafc'; border = '#bfdbfe'; txtColor = '#64748b' }

              return (
                <div key={dia} style={{ position: 'relative' }}>
                  <div onClick={() => clicavel && handleDia(dia)}
                    style={{ borderRadius: 5, border: `1.5px solid ${border}`, background: bg, cursor: clicavel ? 'pointer' : 'default',
                      textAlign: 'center', padding: '4px 1px', userSelect: 'none', opacity: passado ? 0.45 : 1,
                      boxShadow: flash ? '0 1px 6px #16a34a40' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: txtColor, lineHeight: 1.2 }}>
                      {new Date(dia + 'T12:00:00').getDate()}
                    </div>
                    <div style={{ fontSize: 9, lineHeight: 1 }}>
                      {flash ? '✅' : !gHora ? '' : ocupado ? '🔴' : passado ? '' : '🟢'}
                    </div>
                  </div>
                  {alts !== undefined && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 6, minWidth: 110, boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#1e40af', marginBottom: 3 }}>Salas livres:</div>
                      {alts.length === 0
                        ? <div style={{ fontSize: 9, color: '#b91c1c' }}>Nenhuma</div>
                        : alts.map(s => (
                          <button key={s.id} type="button"
                            onClick={() => { onAplicar(s.id, gHora, dia); setGSala(s.id); carregarOcupacao(s.id, gBaseDias); setFlashDia(dia); setTimeout(() => setFlashDia(null), 2500); setAltSalas({}) }}
                            style={{ display: 'block', width: '100%', marginBottom: 2, padding: '3px 5px', fontSize: 10, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', color: '#1d4ed8', fontWeight: 600 }}>
                            🚪 {s.nome}
                          </button>
                        ))
                      }
                      <button onClick={() => setAltSalas({})} style={{ fontSize: 8, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>fechar</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!gHora && <p style={{ margin: '6px 0 0', fontSize: 10, color: '#64748b' }}>⏰ Informe o horário para ver disponibilidade</p>}
        </>
      )}

      {!gSala && <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>👆 Selecione uma sala para abrir o calendário</p>}
    </div>
  )
}

// ─── Painel de cada etapa ─────────────────────────────────────────────────────
function EtapaPanel({ cfg, estado, salas, onUpdate, onCarregarOcupacao }) {
  const { sala_id, hora, selectedDias, baseDias, ocupacao, horasDia, loading } = estado
  const hoje = new Date().toISOString().split('T')[0]

  function horaDoDia(dia) { return horasDia[dia] || hora }
  function estaOcupado(dia) {
    const h = horaDoDia(dia)
    if (!h) return false
    return !!(ocupacao[dia] || []).some(c => c.hora?.slice(0, 5) === h)
  }
  function ocupantesDia(dia) {
    const h = horaDoDia(dia)
    if (!h) return []
    return (ocupacao[dia] || []).filter(c => c.hora?.slice(0, 5) === h)
  }
  function toggleDia(dia) {
    const jaSel = selectedDias.includes(dia)
    const novaLista = jaSel ? selectedDias.filter(d => d !== dia) : [...selectedDias, dia].sort()
    onUpdate({ selectedDias: novaLista })
  }

  const concluido = !!(sala_id && selectedDias.length > 0 && selectedDias.some(d => horaDoDia(d)))

  return (
    <div style={{
      border: `2px solid ${concluido ? cfg.color : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden', marginBottom: 12,
      transition: 'border-color .2s', flexShrink: 0,
    }}>
      {/* ── Header ── */}
      <div style={{ padding: '12px 18px', background: concluido ? cfg.bg : '#f8fafc', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22 }}>{cfg.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: concluido ? cfg.color : '#374151' }}>{cfg.label}</div>
          {concluido
            ? <div style={{ fontSize: 12, color: cfg.color, opacity: 0.85, marginTop: 1 }}>
                ✓ {selectedDias.length} dia{selectedDias.length > 1 ? 's' : ''} · {salas.find(s => s.id === sala_id)?.nome || '—'}
              </div>
            : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                {sala_id ? 'Selecione os dias no calendário' : 'Selecione uma sala para ver o calendário'}
              </div>
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
                  onClick={() => onUpdate({ sala_id: s.id, selectedDias: [], hora: '', horasDia: {} }, () => onCarregarOcupacao(s.id, baseDias))}
                  style={{
                    padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: sel ? 700 : 500, transition: 'all .15s',
                    border: sel ? `2px solid ${cfg.color}` : '1.5px solid #e2e8f0',
                    background: sel ? cfg.bg : '#fff', color: sel ? cfg.color : '#374151',
                  }}>
                  🚪 {s.nome}
                </button>
              )
            })}
          </div>
        </div>

        {/* Calendário mensal */}
        {sala_id && (
          <div>
            {/* Hora padrão */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                {loading ? '⏳ Carregando...' : `📅 ${selectedDias.length} dia${selectedDias.length !== 1 ? 's' : ''} selecionado${selectedDias.length !== 1 ? 's' : ''}`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>⚡ Hora:</span>
                <input type="time" value={hora}
                  onChange={e => onUpdate({ hora: e.target.value })}
                  style={{ padding: '4px 6px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontFamily: 'inherit', fontSize: 11, outline: 'none', color: '#374151' }} />
              </div>
            </div>

            {/* Navegação mês */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <button type="button"
                onClick={() => { const nb = navMes(baseDias, -1); onUpdate({ baseDias: nb }, (novo) => onCarregarOcupacao(sala_id, novo.baseDias)) }}
                style={{ padding: '3px 10px', fontSize: 16, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#374151', textTransform: 'capitalize' }}>{labelMes(baseDias)}</span>
              <button type="button"
                onClick={() => { const nb = navMes(baseDias, 1); onUpdate({ baseDias: nb }, (novo) => onCarregarOcupacao(sala_id, novo.baseDias)) }}
                style={{ padding: '3px 10px', fontSize: 16, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}>›</button>
            </div>

            {/* Cabeçalho semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
              {['D','S','T','Q','Q','S','S'].map((dn, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: i === 0 || i === 6 ? '#f59e0b' : '#94a3b8' }}>{dn}</div>
              ))}
            </div>

            {/* Grid mês */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {gerarMes(baseDias).map((dia, i) => {
                if (!dia) return <div key={`e${i}`} />
                const horaDia = horaDoDia(dia)
                const ocupado = estaOcupado(dia)
                const sel     = selectedDias.includes(dia)
                const passado = dia < hoje
                const clicavel = !ocupado && !passado && horaDia

                let bg = '#fafafa', border = '#e2e8f0', txtColor = '#94a3b8'
                if (sel)          { bg = cfg.color;  border = cfg.color;  txtColor = '#fff' }
                else if (ocupado) { bg = '#FFF5F5';  border = '#FECACA';  txtColor = '#dc2626' }
                else if (passado) { bg = '#fafafa';  border = '#f1f5f9';  txtColor = '#d1d5db' }
                else if (horaDia) { bg = '#f0fdf4';  border = '#86efac';  txtColor = '#15803d' }

                return (
                  <div key={dia}
                    onClick={() => clicavel && toggleDia(dia)}
                    title={ocupado ? 'Horário ocupado' : horaDia ? (sel ? 'Clique para remover' : 'Clique para selecionar') : 'Defina a hora padrão'}
                    style={{ borderRadius: 5, border: `1.5px solid ${border}`, background: bg, cursor: clicavel ? 'pointer' : 'default',
                      textAlign: 'center', padding: '4px 1px', userSelect: 'none', opacity: passado ? 0.45 : 1,
                      boxShadow: sel ? `0 1px 6px ${cfg.color}40` : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: sel ? 800 : 600, color: txtColor, lineHeight: 1.2 }}>
                      {new Date(dia + 'T12:00:00').getDate()}
                    </div>
                    <div style={{ fontSize: 9, lineHeight: 1, color: sel ? 'rgba(255,255,255,.85)' : txtColor }}>
                      {sel ? '✓' : ocupado ? '🔴' : horaDia && !passado ? horaDia : ''}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chips dias selecionados */}
            {selectedDias.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: '#374151' }}>📌 Selecionados:</p>
                {selectedDias.map(d => {
                  const hd = horasDia[d], hEfetiva = hd || hora
                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, background: cfg.bg, border: `1.5px solid ${cfg.color}`, borderRadius: 8, padding: '4px 8px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, flex: 1 }}>{fmtData(d)}</span>
                      <input type="time" value={hEfetiva}
                        onChange={e => onUpdate({ horasDia: { ...horasDia, [d]: e.target.value } })}
                        style={{ padding: '2px 5px', border: `1px solid ${cfg.color}40`, borderRadius: 5, fontFamily: 'inherit', fontSize: 10, outline: 'none', background: '#fff', color: '#374151' }} />
                      {hd && <button type="button" onClick={() => { const h = { ...horasDia }; delete h[d]; onUpdate({ horasDia: h }) }}
                        style={{ fontSize: 9, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>↩</button>}
                      <button type="button" onClick={() => toggleDia(d)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: cfg.color, fontWeight: 900, fontSize: 15, lineHeight: 1 }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}
            {!hora && selectedDias.length === 0 && (
              <p style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>💡 Defina a hora e clique nos dias do calendário para selecionar.</p>
            )}
          </div>
        )}

        {!sala_id && <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>👆 Selecione uma sala para ver os dias disponíveis.</p>}
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

  // ── Aplica sala+hora+data a todas as 4 etapas de uma vez ──────────────────
  function aplicarGlobal(sala_id, hora, data) {
    setEtapas(prev => prev.map(e => {
      const novosDias = e.selectedDias.includes(data) ? e.selectedDias : [...e.selectedDias, data].sort()
      return { ...e, sala_id, hora: e.hora || hora, selectedDias: novosDias, horasDia: e.horasDia }
    }))
    ETAPAS_CONFIG.forEach((_, idx) => carregarOcupacaoEtapa(idx, sala_id, data))
  }

  // ── Carrega ocupação de uma sala no mês inteiro de uma etapa ─────────────────
  async function carregarOcupacaoEtapa(idx, salaId, baseDias) {
    if (!salaId) return
    updateEtapa(idx, { loading: true })
    const { data: rows } = await supabase
      .from('consultas')
      .select('data, hora, paciente:pacientes(nome), estagiario:profiles(nome,codigo)')
      .eq('sala_id', salaId)
      .gte('data', mesPrimeiroDia(baseDias))
      .lte('data', mesUltimoDia(baseDias))
      .not('status', 'in', '("cancelada","realizada")')
    const ocupacao = {}
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

    const slots = []
    etapas.forEach((e, i) => {
      if (!e.sala_id || e.selectedDias.length === 0) return
      e.selectedDias.forEach(dia => {
        const horaSlot = e.horasDia[dia] || e.hora
        if (!horaSlot) return
        slots.push({ cfg: ETAPAS_CONFIG[i], sala_id: e.sala_id, data: dia, hora: horaSlot })
      })
    })

    if (slots.length === 0) {
      toast.error('Selecione ao menos um dia com horário definido em alguma etapa.')
      return
    }

    setSaving(true)

    // ── Verificar conflitos reais no banco antes de inserir ─────────────────────
    for (const slot of slots) {
      const { data: conflitos } = await supabase
        .from('consultas')
        .select('id, paciente:pacientes(nome), estagiario:profiles(nome,codigo)')
        .eq('sala_id', slot.sala_id)
        .eq('data', slot.data)
        .eq('hora', slot.hora)
        .not('status', 'in', '("cancelada","realizada")')
      if (conflitos && conflitos.length > 0) {
        const nomeSala = salas.find(s => s.id === slot.sala_id)?.nome || 'sala'
        const ocupante = conflitos[0]?.paciente?.nome || '—'
        const est = conflitos[0]?.estagiario?.codigo || conflitos[0]?.estagiario?.nome || '—'
        toast.error(`❌ Conflito em "${slot.cfg.label}": ${nomeSala} às ${slot.hora} em ${fmtData(slot.data)}.\nPaciente: ${ocupante} · Estagiário: ${est}`)
        setSaving(false)
        return
      }
    }

    // Agendamento direto — sempre confirmado. Aprovação só ocorre em troca de sala.
    const inserts = slots.map(slot => ({
      paciente_id: pacienteSelecionado.id,
      medico_id:   estagiarioSelecionado.id,
      tipo:        slot.cfg.id,
      data:        slot.data,
      hora:        slot.hora,
      sala_id:     slot.sala_id,
      status:      'confirmada',
      criado_por:  profile.id,
    }))

    const { error } = await supabase.from('consultas').insert(inserts)
    if (!error) {
      toast.success(`${inserts.length} consulta(s) agendada(s) com sucesso!`)
      fecharModal()
      fetchConsultas()
    } else {
      toast.error('Erro: ' + error.message)
    }
    setSaving(false)
  }

  async function handleEnviarSolic() {
    const { consulta, tipo, nova_data, nova_hora } = modalSolic

    if (tipo === 'cancelamento') {
      await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', consulta.id)
      setModalSolic(null); fetchConsultas()
      toast.success('Consulta cancelada. Sala liberada.')
      return
    }

    if (tipo === 'reagendamento') {
      if (!nova_data || !nova_hora) { toast.error('Informe a nova data e horário.'); return }
      const { data: conflitos } = await supabase
        .from('consultas')
        .select('id, paciente:pacientes(nome)')
        .eq('sala_id', consulta.sala_id)
        .eq('data', nova_data)
        .eq('hora', nova_hora)
        .not('status', 'in', '("cancelada","realizada")')
        .neq('id', consulta.id)
      if (conflitos && conflitos.length > 0) {
        const ocupante = conflitos[0]?.paciente?.nome || '—'
        const nomeSala = salas.find(s => s.id === consulta.sala_id)?.nome || 'sala'
        toast.error(`❌ Conflito: "${nomeSala}" já está ocupada em ${nova_data} às ${nova_hora}.\nPaciente: ${ocupante}`)
        return
      }
      await supabase.from('consultas').update({ data: nova_data, hora: nova_hora, status: 'confirmada' }).eq('id', consulta.id)
      setModalSolic(null); fetchConsultas()
      toast.success('Reagendado! Sala confirmada para o novo horário.')
    }
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
  const tagClass = s => ({ confirmada:'tag tg', aguardando:'tag ta', cancelada:'tag tr', realizada:'tag tp', troca_sala_pendente:'tag ta' }[s] || 'tag tp')
  const tagLabel = s => ({ confirmada:'Confirmada', aguardando:'Aguardando', cancelada:'Cancelada', realizada:'Realizada', troca_sala_pendente:'Troca sala pend.' }[s] || s)
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

  const slotsConfirmados = etapas.flatMap((e, i) => {
    if (!e.sala_id || e.selectedDias.length === 0) return []
    return e.selectedDias
      .filter(d => e.horasDia[d] || e.hora)
      .map(d => ({ cfg: ETAPAS_CONFIG[i], sala_id: e.sala_id, data: d, hora: e.horasDia[d] || e.hora }))
  })

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
                            {!['cancelada','realizada'].includes(c.status) && <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalSolic({ consulta: c, tipo: 'reagendamento', nova_data: '', nova_hora: '', motivo: '' })}>Reagendar</button>}
                            {!['cancelada','realizada','troca_sala_pendente'].includes(c.status) && <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12, color: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={() => setModalTrocaSala({ consulta: c, sala_nova_id: '', motivo: '' })}>Trocar sala</button>}
                            {!['cancelada','realizada'].includes(c.status) && <button className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setModalSolic({ consulta: c, tipo: 'cancelamento', nova_data: '', nova_hora: '', motivo: '' })}>Cancelar</button>}
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
          <div className="modal" style={{ maxWidth: 820, maxHeight: '92vh', overflowY: 'auto', display: 'block', padding: 0 }}>
            <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ margin: 0 }}>Agendar Consultas</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>Selecione paciente, estagiário e configure cada etapa do atendimento</p>
            </div>
            <div style={{ padding: '16px 20px 20px' }}>

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

            {/* ── Configurador Global ── */}
            <GlobalConfigurator salas={salas} onAplicar={aplicarGlobal} />

            {/* Linha divisória + título etapas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ajuste por Etapa (opcional)</span>
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
            {slotsConfirmados.length > 0 && (
              <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '14px 18px', marginTop: 8 }}>
                <p style={{ fontWeight: 700, color: '#166534', fontSize: 13, margin: '0 0 10px' }}>✅ Resumo — {slotsConfirmados.length} consulta{slotsConfirmados.length > 1 ? 's' : ''} a agendar</p>
                {slotsConfirmados.map((slot, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: i < slotsConfirmados.length - 1 ? '1px solid #bbf7d0' : 'none' }}>
                    <span style={{ fontSize: 14 }}>{slot.cfg.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 12, color: slot.cfg.color, minWidth: 120 }}>{slot.cfg.label}</span>
                    <span style={{ fontSize: 11, color: '#374151' }}>📅 {fmtData(slot.data)} ⏰ {fmtHora(slot.hora)} 🚪 {salas.find(s => s.id === slot.sala_id)?.nome}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-btns" style={{ marginTop: 20 }}>
              <button className="btn-outline" onClick={fecharModal}>Cancelar</button>
              <button className="btn-primary" onClick={handleAgendar}
                disabled={saving || !pacienteSelecionado || !estagiarioSelecionado || slotsConfirmados.length === 0}>
                {saving ? 'Salvando...' : `Confirmar ${slotsConfirmados.length > 0 ? `(${slotsConfirmados.length} consulta${slotsConfirmados.length > 1 ? 's' : ''})` : ''}`}
              </button>
            </div>
            </div>{/* fim do padding wrapper */}
          </div>
        </div>
      )}

      {/* Modal reagendamento/cancelamento */}
      {modalSolic && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSolic(null)}>
          <div className="modal">
            <h2>{modalSolic.tipo === 'cancelamento' ? 'Solicitar Cancelamento' : 'Solicitar Reagendamento'}</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Paciente: <strong>{modalSolic.consulta.paciente?.nome}</strong> · {modalSolic.consulta.estagiario?.nome}</p>
            <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534', fontWeight: 500 }}>
              {modalSolic?.tipo === 'cancelamento' ? '🗑️ A consulta será cancelada e a sala liberada imediatamente.' : '📅 A nova data/hora será aplicada se a sala estiver disponível.'}
            </div>
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
