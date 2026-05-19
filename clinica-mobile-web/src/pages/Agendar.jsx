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

function CalendarioMes({ diasDisponiveis, dataSel, onSelect }) {
  const disponiveisSet = new Set(diasDisponiveis)
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(() => {
    const d = diasDisponiveis[0] ? new Date(diasDisponiveis[0] + 'T12:00:00') : new Date()
    return { mes: d.getMonth(), ano: d.getFullYear() }
  })

  const DIAS_SEMANA_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const MESES_LABEL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const primeiroDia = new Date(mesAtual.ano, mesAtual.mes, 1).getDay()
  const totalDias = new Date(mesAtual.ano, mesAtual.mes + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < primeiroDia; i++) cells.push(null)
  for (let d = 1; d <= totalDias; d++) cells.push(d)

  function podeMesAnterior() {
    return mesAtual.mes > hoje.getMonth() || mesAtual.ano > hoje.getFullYear()
  }

  function mudarMes(dir) {
    setMesAtual(prev => {
      let mes = prev.mes + dir
      let ano = prev.ano
      if (mes < 0) { mes = 11; ano-- }
      if (mes > 11) { mes = 0; ano++ }
      return { mes, ano }
    })
  }

  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => podeMesAnterior() && mudarMes(-1)} style={{ width: 36, height: 36, borderRadius: 12, border: '1px solid #E5E7EB', background: podeMesAnterior() ? '#fff' : '#F9FAFB', cursor: podeMesAnterior() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={podeMesAnterior() ? '#374151' : '#D1D5DB'} strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p style={{ fontSize: 15, fontWeight: 800, color: '#0D1B2A' }}>{MESES_LABEL[mesAtual.mes]} {mesAtual.ano}</p>
        <button onClick={() => mudarMes(1)} style={{ width: 36, height: 36, borderRadius: 12, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
        {DIAS_SEMANA_LABEL.map(d => <p key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>{d}</p>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((dia, i) => {
          if (!dia) return <div key={`empty-${i}`} />
          const dateStr = `${mesAtual.ano}-${String(mesAtual.mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
          const disponivel = disponiveisSet.has(dateStr)
          const selecionado = dataSel === dateStr
          const isHoje = dateStr === hoje.toISOString().split('T')[0]
          return (
            <button key={dateStr} disabled={!disponivel} onClick={() => disponivel && onSelect(dateStr)}
              style={{ height: 40, borderRadius: 12, border: isHoje && !selecionado ? '2px solid #0047AB' : '1.5px solid transparent', background: selecionado ? 'linear-gradient(135deg, #0047AB, #1a6fdf)' : disponivel ? '#EFF6FF' : 'transparent', cursor: disponivel ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: selecionado || disponivel ? 700 : 400, color: selecionado ? '#fff' : disponivel ? '#0047AB' : '#D1D5DB' }}>{dia}</p>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#0047AB' }} />
          <p style={{ fontSize: 11, color: '#6B7280' }}>Disponível</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB' }} />
          <p style={{ fontSize: 11, color: '#6B7280' }}>Indisponível</p>
        </div>
      </div>
    </div>
  )
}

export default function Agendar() {
  const navigate = useNavigate()
  const { paciente } = useAuth()
  const [step, setStep] = useState(1)
  const [estagiarios, setEstagiarios] = useState([])
  const [estagiarioSel, setEstagiarioSel] = useState(null)
  const [diasDisponiveis, setDiasDisponiveis] = useState([])
  const [dataSel, setDataSel] = useState('')
  const [horarioSel, setHorarioSel] = useState('')
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([])
  const [tipo, setTipo] = useState('Consulta')
  const [saving, setSaving] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [loadingDatas, setLoadingDatas] = useState(false)
  const [loadingHorarios, setLoadingHorarios] = useState(false)

  useEffect(() => { fetchEstagiarios() }, [])

  // CORRIGIDO: busca estagiario em vez de medico
  async function fetchEstagiarios() {
    const { data } = await supabase.from('profiles').select('*').eq('tipo', 'estagiario').eq('ativo', true)
    setEstagiarios(data || [])
  }

  async function handleSelecionarEstagiario(est) {
    setEstagiarioSel(est)
    setDataSel('')
    setHorarioSel('')
    setLoadingDatas(true)
    const { data: escalas } = await supabase.from('escalas').select('dia_semana').eq('medico_id', est.id).eq('ativo', true)
    const diasComEscala = (escalas || []).map(e => e.dia_semana)
    const dias = []
    const hoje = new Date()
    for (let i = 1; i <= 90; i++) {
      const d = new Date(hoje)
      d.setDate(hoje.getDate() + i)
      if (diasComEscala.includes(d.getDay())) dias.push(d.toISOString().split('T')[0])
      if (dias.length >= 60) break
    }
    setDiasDisponiveis(dias)
    setLoadingDatas(false)
    setStep(2)
  }

  async function handleSelecionarData(data) {
    setDataSel(data)
    setHorarioSel('')
    setLoadingHorarios(true)
    const diaSemana = new Date(data + 'T12:00:00').getDay()
    const { data: escalas } = await supabase.from('escalas').select('*').eq('medico_id', estagiarioSel.id).eq('dia_semana', diaSemana).eq('ativo', true)
    let todosHorarios = []
    ;(escalas || []).forEach(e => { todosHorarios = [...todosHorarios, ...gerarHorarios(e.hora_inicio, e.hora_fim, e.intervalo_minutos)] })
    const { data: agendados } = await supabase.from('consultas').select('hora').eq('medico_id', estagiarioSel.id).eq('data', data).not('status', 'in', '("cancelada")')
    const ocupados = (agendados || []).map(a => a.hora.slice(0, 5))
    const disponiveis = [...new Set(todosHorarios.filter(h => !ocupados.includes(h)))]
    disponiveis.sort((a, b) => a.localeCompare(b))
    setHorariosDisponiveis(disponiveis)
    setLoadingHorarios(false)
    setStep(3)
  }

  async function handleConfirmar() {
    if (!estagiarioSel || !dataSel || !horarioSel || !paciente) return
    setSaving(true)
    await supabase.from('consultas').insert([{
      paciente_id: paciente.id,
      medico_id: estagiarioSel.id,
      data: dataSel,
      hora: horarioSel,
      tipo,
      status: 'aguardando',
    }])
    setSaving(false)
    setSucesso(true)
  }

  const stepLabels = ['Profissional', 'Data', 'Horário', 'Confirmar']

  if (sucesso) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, backgroundColor: '#F8FAFC' }}>
        <div style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p style={{ fontSize: 24, fontWeight: 900, color: '#0D1B2A', marginBottom: 8, textAlign: 'center' }}>Agendado com sucesso!</p>
        <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 6 }}>
          {new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p style={{ fontSize: 15, color: '#0047AB', fontWeight: 700, marginBottom: 6 }}>⏰ {horarioSel}</p>
        {/* CORRIGIDO: removido Dr(a). */}
        <p style={{ fontSize: 14, color: '#374151', fontWeight: 600, marginBottom: 4 }}>{estagiarioSel?.nome}</p>
        <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 32 }}>{estagiarioSel?.especialidade}</p>
        <div style={{ backgroundColor: '#FEF3C7', borderRadius: 14, padding: '12px 16px', marginBottom: 32, border: '1px solid #FDE68A', width: '100%' }}>
          <p style={{ fontSize: 13, color: '#92400E', textAlign: 'center' }}>⏳ Aguardando confirmação da clínica</p>
        </div>
        <button style={{ width: '100%', background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', border: 'none', borderRadius: 14, padding: '15px 32px', fontSize: 15, color: '#fff', fontWeight: 700, cursor: 'pointer', marginBottom: 10 }} onClick={() => navigate('/consultas')}>
          Ver minhas consultas
        </button>
        <button style={{ width: '100%', background: 'none', border: 'none', borderRadius: 14, padding: '12px', fontSize: 14, color: '#6B7280', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/')}>
          Voltar ao início
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={s.header}>
        <div style={s.headerCircle} />
        <button style={s.backBtn} onClick={() => {
          if (step === 1) { navigate(-1); return }
          if (step === 2) { setDataSel(null); setHorariosDisponiveis([]) }
          if (step === 3) { setHorarioSel(null) }
          if (step === 4) { setHorarioSel(null) }
          setStep(step - 1)
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p style={s.headerTitle}>Agendar Consulta</p>
        <p style={s.headerSub}>{stepLabels[step - 1]}</p>
        <div style={s.stepsRow}>
          {[1,2,3,4].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ ...s.stepDot, backgroundColor: n <= step ? '#fff' : 'rgba(255,255,255,0.3)' }} />
              {n < 4 && <div style={{ ...s.stepLine, backgroundColor: n < step ? '#fff' : 'rgba(255,255,255,0.25)' }} />}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* STEP 1 — Estagiário */}
        {step === 1 && (
          <div>
            <p style={s.sectionTitle}>Selecione um profissional</p>
            {estagiarios.length === 0 && (
              <p style={s.emptyText}>Nenhum profissional disponível no momento.</p>
            )}
            {estagiarios.map(m => (
              <button key={m.id} style={s.medicoCard} onClick={() => handleSelecionarEstagiario(m)}>
                <div style={s.medicoAvatar}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={s.medicoNome}>{m.nome}</p>
                  <p style={s.medicoEsp}>{m.especialidade || 'Estagiário'}</p>
                </div>
                {m.codigo && (
                  <div style={s.medicoEspTag}>
                    <p style={{ fontSize: 11, color: '#0047AB', fontWeight: 600 }}>{m.codigo}</p>
                  </div>
                )}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 8 }}><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            ))}
          </div>
        )}

        {/* STEP 2 — Data */}
        {step === 2 && (
          <div>
            <div style={s.resumoCard}>
              <div style={s.resumoAvatar}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A' }}>{estagiarioSel?.nome}</p>
                <p style={{ fontSize: 11, color: '#6B7280' }}>{estagiarioSel?.especialidade || 'Estagiário'}</p>
              </div>
            </div>
            <p style={s.sectionTitle}>Selecione a data</p>
            {loadingDatas && <p style={s.loadingText}>Carregando datas...</p>}
            {!loadingDatas && diasDisponiveis.length === 0 && <p style={s.emptyText}>Nenhuma data disponível para este profissional.</p>}
            {!loadingDatas && diasDisponiveis.length > 0 && (
              <CalendarioMes diasDisponiveis={diasDisponiveis} dataSel={dataSel} onSelect={handleSelecionarData} />
            )}
          </div>
        )}

        {/* STEP 3 — Horário */}
        {step === 3 && (
          <div>
            <div style={s.resumoCard}>
              <div style={s.resumoAvatar}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0D1B2A' }}>{estagiarioSel?.nome}</p>
                <p style={{ fontSize: 11, color: '#6B7280' }}>{new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button style={s.trocarBtn} onClick={() => setStep(2)}>Trocar data</button>
            </div>
            <p style={s.sectionTitle}>Selecione o horário</p>
            {loadingHorarios && <p style={s.loadingText}>Carregando horários...</p>}
            {!loadingHorarios && horariosDisponiveis.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: 32 }}>
                <p style={s.emptyText}>Nenhum horário disponível nessa data.</p>
                <button style={s.voltarBtn} onClick={() => setStep(2)}>Escolher outra data</button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {horariosDisponiveis.map(h => {
                const sel = horarioSel === h
                return (
                  <button key={h} style={{ ...s.horarioCard, ...(sel ? s.horarioCardSel : {}) }} onClick={() => { setHorarioSel(h); setStep(4) }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: sel ? '#fff' : '#0D1B2A' }}>{h}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 4 — Confirmação */}
        {step === 4 && (
          <div>
            <p style={s.sectionTitle}>Confirme o agendamento</p>
            <div style={s.confirmCard}>
              <div style={s.confirmRow}>
                <div style={s.confirmIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div>
                  <p style={s.confirmLabel}>Profissional</p>
                  <p style={s.confirmValue}>{estagiarioSel?.nome}</p>
                  <p style={s.confirmSub}>{estagiarioSel?.especialidade || 'Estagiário'}</p>
                </div>
              </div>
              <div style={s.confirmDivider} />
              <div style={s.confirmRow}>
                <div style={s.confirmIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <p style={s.confirmLabel}>Data</p>
                  <p style={s.confirmValue}>{new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div style={s.confirmDivider} />
              <div style={s.confirmRow}>
                <div style={s.confirmIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <p style={s.confirmLabel}>Horário</p>
                  <p style={s.confirmValue}>{horarioSel}</p>
                </div>
              </div>
              <div style={s.confirmDivider} />
              <div>
                <p style={s.confirmLabel}>Tipo de consulta</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
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
            <button style={s.voltarBtn} onClick={() => setStep(3)}>Voltar e escolher outro horário</button>
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
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 },
  stepsRow: { display: 'flex', alignItems: 'center' },
  stepDot: { width: 10, height: 10, borderRadius: 5, transition: 'background 0.3s' },
  stepLine: { width: 28, height: 2, borderRadius: 1, transition: 'background 0.3s' },
  sectionTitle: { fontSize: 17, fontWeight: 800, color: '#0D1B2A', marginBottom: 14 },
  loadingText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginTop: 32 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginTop: 32, marginBottom: 16 },
  medicoCard: { width: '100%', backgroundColor: '#fff', borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, border: '1.5px solid #F3F4F6', cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  medicoAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  medicoNome: { fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 4 },
  medicoEsp: { fontSize: 12, color: '#6B7280' },
  medicoEspTag: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: '4px 10px', flexShrink: 0 },
  resumoCard: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, border: '1px solid #DBEAFE' },
  resumoAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trocarBtn: { background: 'none', border: '1px solid #BFDBFE', borderRadius: 10, padding: '5px 12px', fontSize: 12, color: '#0047AB', fontWeight: 600, cursor: 'pointer', flexShrink: 0 },
  horarioCard: { backgroundColor: '#fff', borderRadius: 14, padding: '16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #F3F4F6', cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
  horarioCardSel: { background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', border: '1.5px solid #0047AB' },
  confirmCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 14, border: '1px solid #F3F4F6', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
  confirmRow: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  confirmIconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  confirmDivider: { height: 1, backgroundColor: '#F9FAFB', margin: '16px 0' },
  confirmLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 4 },
  confirmValue: { fontSize: 14, fontWeight: 700, color: '#0D1B2A' },
  confirmSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  tipoBtn: { padding: '9px 18px', borderRadius: 12, border: '1.5px solid #E5E7EB', fontSize: 13, fontWeight: 600, color: '#374151', backgroundColor: '#fff', cursor: 'pointer' },
  tipoBtnSel: { backgroundColor: '#0047AB', color: '#fff', border: '1.5px solid #0047AB' },
  avisoBox: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', border: '1px solid #FDE68A' },
  confirmarBtn: { width: '100%', background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', borderRadius: 16, padding: 16, fontSize: 16, fontWeight: 700, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,71,171,0.35)', marginBottom: 10 },
  voltarBtn: { width: '100%', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 600, color: '#6B7280', cursor: 'pointer' },
}