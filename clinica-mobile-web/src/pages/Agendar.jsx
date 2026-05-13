import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function gerarHorarios(horaInicio, horaFim, intervalo) {
  const horarios = []
  const [hI, mI] = horaInicio.split(':').map(Number)
  const [hF, mF] = horaFim.split(':').map(Number)
  let atual = hI * 60 + mI
  const fim = hF * 60 + mF
  while (atual < fim) {
    const h = String(Math.floor(atual / 60)).padStart(2, '0')
    const m = String(atual % 60).padStart(2, '0')
    horarios.push(`${h}:${m}`)
    atual += intervalo
  }
  return horarios
}

export default function Agendar() {
  const navigate = useNavigate()
  const { paciente } = useAuth()
  const [step, setStep] = useState(1) // 1=médico, 2=data, 3=horário, 4=confirmação
  const [medicos, setMedicos] = useState([])
  const [medicoSel, setMedicoSel] = useState(null)
  const [dataSel, setDataSel] = useState('')
  const [horarioSel, setHorarioSel] = useState('')
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([])
  const [tipo, setTipo] = useState('Consulta')
  const [saving, setSaving] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchMedicos() }, [])

  async function fetchMedicos() {
    const { data } = await supabase.from('profiles').select('*').eq('tipo', 'medico').eq('ativo', true)
    setMedicos(data || [])
  }

  async function fetchHorarios(medicoId, data) {
    setLoading(true)
    const diaSemana = new Date(data + 'T12:00:00').getDay()

    // Busca escala do médico para esse dia
    const { data: escalas } = await supabase
      .from('escalas')
      .select('*')
      .eq('medico_id', medicoId)
      .eq('dia_semana', diaSemana)
      .eq('ativo', true)

    if (!escalas || escalas.length === 0) {
      setHorariosDisponiveis([])
      setLoading(false)
      return
    }

    // Gera todos os horários da escala
    let todosHorarios = []
    escalas.forEach(e => {
      todosHorarios = [...todosHorarios, ...gerarHorarios(e.hora_inicio, e.hora_fim, e.intervalo_minutos)]
    })

    // Remove horários já agendados
    const { data: agendados } = await supabase
      .from('consultas')
      .select('hora')
      .eq('medico_id', medicoId)
      .eq('data', data)
      .not('status', 'in', '("cancelada")')

    const horariosOcupados = (agendados || []).map(a => a.hora.slice(0, 5))
    const disponiveis = todosHorarios.filter(h => !horariosOcupados.includes(h))

    setHorariosDisponiveis(disponiveis)
    setLoading(false)
  }

  function handleSelecionarData(data) {
    setDataSel(data)
    setHorarioSel('')
    fetchHorarios(medicoSel.id, data)
    setStep(3)
  }

  async function handleConfirmar() {
    if (!medicoSel || !dataSel || !horarioSel || !paciente) return
    setSaving(true)
    const { error } = await supabase.from('consultas').insert([{
      paciente_id: paciente.id,
      medico_id: medicoSel.id,
      data: dataSel,
      hora: horarioSel,
      tipo,
      status: 'aguardando',
    }])
    if (!error) setSucesso(true)
    setSaving(false)
  }

  // Gera próximos 30 dias úteis do médico selecionado
  async function getDiasDisponiveis() {
    if (!medicoSel) return []
    const { data: escalas } = await supabase
      .from('escalas')
      .select('dia_semana')
      .eq('medico_id', medicoSel.id)
      .eq('ativo', true)
    const diasComEscala = (escalas || []).map(e => e.dia_semana)
    const dias = []
    const hoje = new Date()
    for (let i = 1; i <= 60; i++) {
      const d = new Date(hoje)
      d.setDate(hoje.getDate() + i)
      if (diasComEscala.includes(d.getDay())) {
        dias.push(d.toISOString().split('T')[0])
      }
      if (dias.length >= 30) break
    }
    return dias
  }

  const [diasDisponiveis, setDiasDisponiveis] = useState([])

  useEffect(() => {
    if (medicoSel) {
      getDiasDisponiveis().then(setDiasDisponiveis)
    }
  }, [medicoSel])

  if (sucesso) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, backgroundColor: '#F8FAFC' }}>
        <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#0D1B2A', marginBottom: 8, textAlign: 'center' }}>Agendado com sucesso!</p>
        <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 8 }}>
          {new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p style={{ fontSize: 14, color: '#0047AB', fontWeight: 700, marginBottom: 32 }}>⏰ {horarioSel} · Dr(a). {medicoSel?.nome}</p>
        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 32 }}>
          Sua consulta está aguardando confirmação da clínica.
        </p>
        <button
          style={{ background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', border: 'none', borderRadius: 14, padding: '14px 32px', fontSize: 15, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          onClick={() => navigate('/consultas')}
        >
          Ver minhas consultas
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerCircle} />
        <button style={s.backBtn} onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p style={s.headerTitle}>Agendar Consulta</p>
        <p style={s.headerSub}>
          {step === 1 && 'Selecione um profissional'}
          {step === 2 && 'Selecione a data'}
          {step === 3 && 'Selecione o horário'}
          {step === 4 && 'Confirme o agendamento'}
        </p>
        {/* Steps */}
        <div style={s.steps}>
          {[1,2,3,4].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ ...s.stepDot, backgroundColor: n <= step ? '#fff' : 'rgba(255,255,255,0.3)' }} />
              {n < 4 && <div style={{ ...s.stepLine, backgroundColor: n < step ? '#fff' : 'rgba(255,255,255,0.3)' }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Step 1 — Médico */}
        {step === 1 && (
          <div>
            <p style={s.sectionTitle}>Profissionais disponíveis</p>
            {medicos.map(m => (
              <button key={m.id} style={{ ...s.medicoCard, ...(medicoSel?.id === m.id ? s.medicoCardSel : {}) }} onClick={() => { setMedicoSel(m); setStep(2) }}>
                <div style={{ ...s.medicoAvatar, backgroundColor: medicoSel?.id === m.id ? '#0047AB' : '#EFF6FF' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={medicoSel?.id === m.id ? '#fff' : '#0047AB'} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={s.medicoNome}>{m.nome}</p>
                  <p style={s.medicoEsp}>{m.especialidade}</p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — Data */}
        {step === 2 && medicoSel && (
          <div>
            <div style={s.medicoSelecionado}>
              <div style={s.medicoAvatarSm}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A' }}>{medicoSel.nome}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{medicoSel.especialidade}</p>
              </div>
            </div>

            <p style={s.sectionTitle}>Datas disponíveis</p>
            {diasDisponiveis.length === 0 && (
              <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 32 }}>Nenhuma data disponível.</p>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {diasDisponiveis.map(d => {
                const dt = new Date(d + 'T12:00:00')
                const diaSemana = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                const dia = dt.getDate()
                const mes = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
                return (
                  <button key={d} style={{ ...s.diaCard, ...(dataSel === d ? s.diaCardSel : {}) }} onClick={() => handleSelecionarData(d)}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: dataSel === d ? 'rgba(255,255,255,0.8)' : '#9CA3AF', textTransform: 'uppercase' }}>{diaSemana}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: dataSel === d ? '#fff' : '#0D1B2A' }}>{dia}</p>
                    <p style={{ fontSize: 11, color: dataSel === d ? 'rgba(255,255,255,0.8)' : '#6B7280', textTransform: 'uppercase' }}>{mes}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3 — Horário */}
        {step === 3 && (
          <div>
            <div style={s.medicoSelecionado}>
              <div style={s.medicoAvatarSm}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A' }}>{medicoSel.nome}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
            </div>

            <p style={s.sectionTitle}>Horários disponíveis</p>
            {loading && <p style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 32 }}>Carregando...</p>}
            {!loading && horariosDisponiveis.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 32 }}>
                <p style={{ color: '#9CA3AF', fontSize: 14, marginBottom: 16 }}>Nenhum horário disponível nessa data.</p>
                <button style={s.voltarBtn} onClick={() => setStep(2)}>Escolher outra data</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {horariosDisponiveis.map(h => (
                <button key={h} style={{ ...s.horarioCard, ...(horarioSel === h ? s.horarioCardSel : {}) }}
                  onClick={() => { setHorarioSel(h); setStep(4) }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: horarioSel === h ? '#fff' : '#0D1B2A' }}>{h}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 — Confirmação */}
        {step === 4 && (
          <div>
            <p style={s.sectionTitle}>Confirme seu agendamento</p>

            <div style={s.confirmCard}>
              <div style={s.confirmRow}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                <div>
                  <p style={s.confirmLabel}>Profissional</p>
                  <p style={s.confirmValue}>{medicoSel?.nome}</p>
                  <p style={s.confirmSub}>{medicoSel?.especialidade}</p>
                </div>
              </div>
              <div style={s.confirmDivider} />
              <div style={s.confirmRow}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <div>
                  <p style={s.confirmLabel}>Data</p>
                  <p style={s.confirmValue}>{new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div style={s.confirmDivider} />
              <div style={s.confirmRow}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div>
                  <p style={s.confirmLabel}>Horário</p>
                  <p style={s.confirmValue}>{horarioSel}</p>
                </div>
              </div>
              <div style={s.confirmDivider} />
              <div>
                <p style={s.confirmLabel}>Tipo de consulta</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {['Consulta', 'Retorno', 'Avaliação'].map(t => (
                    <button key={t} style={{ ...s.tipoBtn, ...(tipo === t ? s.tipoBtnSel : {}) }} onClick={() => setTipo(t)}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={s.avisoBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p style={{ fontSize: 13, color: '#92400E', marginLeft: 8 }}>Seu agendamento ficará aguardando confirmação da clínica.</p>
            </div>

            <button style={{ ...s.confirmarBtn, opacity: saving ? 0.7 : 1 }} onClick={handleConfirmar} disabled={saving}>
              {saving ? 'Agendando...' : 'Confirmar agendamento'}
            </button>
          </div>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}

const s = {
  header: { position: 'relative', background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', paddingTop: 52, paddingLeft: 20, paddingRight: 20, paddingBottom: 20, overflow: 'hidden' },
  headerCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  steps: { display: 'flex', alignItems: 'center' },
  stepDot: { width: 8, height: 8, borderRadius: 4, transition: 'background 0.3s' },
  stepLine: { width: 24, height: 2, borderRadius: 1, transition: 'background 0.3s' },
  sectionTitle: { fontSize: 16, fontWeight: 800, color: '#0D1B2A', marginBottom: 14 },
  medicoCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: 16, display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, border: '1.5px solid #F3F4F6', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  medicoCardSel: { border: '1.5px solid #0047AB', backgroundColor: '#EFF6FF' },
  medicoAvatar: { width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  medicoNome: { fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 3 },
  medicoEsp: { fontSize: 12, color: '#6B7280' },
  medicoSelecionado: { backgroundColor: '#EFF6FF', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, border: '1px solid #DBEAFE' },
  medicoAvatarSm: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  diaCard: { backgroundColor: '#fff', borderRadius: 16, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, border: '1.5px solid #F3F4F6', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
  diaCardSel: { background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', border: '1.5px solid #0047AB' },
  horarioCard: { backgroundColor: '#fff', borderRadius: 14, padding: '14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F3F4F6', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
  horarioCardSel: { background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', border: '1.5px solid #0047AB' },
  confirmCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 14, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  confirmRow: { display: 'flex', alignItems: 'flex-start', gap: 14, padding: '4px 0' },
  confirmDivider: { height: 1, backgroundColor: '#F9FAFB', margin: '14px 0' },
  confirmLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 3 },
  confirmValue: { fontSize: 14, fontWeight: 700, color: '#0D1B2A' },
  confirmSub: { fontSize: 12, color: '#6B7280' },
  tipoBtn: { padding: '8px 16px', borderRadius: 10, border: '1.5px solid #E5E7EB', fontSize: 13, fontWeight: 600, color: '#374151', backgroundColor: '#fff', cursor: 'pointer' },
  tipoBtnSel: { backgroundColor: '#0047AB', color: '#fff', border: '1.5px solid #0047AB' },
  avisoBox: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', border: '1px solid #FDE68A' },
  confirmarBtn: { width: '100%', background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', borderRadius: 16, padding: 16, fontSize: 16, fontWeight: 700, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,71,171,0.35)' },
  voltarBtn: { background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' },
}