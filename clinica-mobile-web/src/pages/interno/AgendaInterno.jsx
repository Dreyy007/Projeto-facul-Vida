import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af', cancelamento_pendente: '#991B1B', reagendamento_pendente: '#92400E' }
const statusBg    = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE', cancelamento_pendente: '#FEE2E2', reagendamento_pendente: '#FEF3C7' }
const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }

function fmtCpf(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function AgendaInterno() {
  const { perfil: profile } = useAuth()
  const isAdmin = ['admin', 'coordenador', 'supervisor'].includes(profile?.tipo)

  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoje')
  const [dataCustom, setDataCustom] = useState('')

  // Modal novo agendamento
  const [modal, setModal] = useState(false)
  const [step, setStep] = useState(1) // 1=buscar paciente, 2=dados consulta
  const [saving, setSaving] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  // Busca paciente
  const [cpfBusca, setCpfBusca] = useState('')
  const [nomeBusca, setNomeBusca] = useState('')
  const [pacientes, setPacientes] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [pacienteSel, setPacienteSel] = useState(null)

  // Dados da consulta
  const [estagiarios, setEstagiarios] = useState([])
  const [form, setForm] = useState({ estagiario_id: '', data: '', hora: '', tipo: 'Consulta' })

  useEffect(() => { fetchConsultas() }, [profile, filtro, dataCustom])
  useEffect(() => { if (modal) fetchEstagiarios() }, [modal])

  async function fetchConsultas() {
    if (!profile) return
    setLoading(true)
    const hoje = new Date().toISOString().split('T')[0]
    let q = supabase.from('consultas')
      .select('*, paciente:pacientes(nome), sala:salas(nome)')
      .order('data').order('hora')

    if (!isAdmin) q = q.eq('medico_id', profile.id)
    if (filtro === 'hoje') q = q.eq('data', hoje)
    else if (filtro === 'semana') {
      const agora = new Date()
      const ds = agora.getDay() === 0 ? 6 : agora.getDay() - 1
      const ini = new Date(agora); ini.setDate(agora.getDate() - ds)
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      q = q.gte('data', ini.toISOString().split('T')[0]).lte('data', fim.toISOString().split('T')[0])
    } else if (filtro === 'data' && dataCustom) {
      q = q.eq('data', dataCustom)
    }

    const { data } = await q
    setConsultas(data || [])
    setLoading(false)
  }

  async function fetchEstagiarios() {
    const { data } = await supabase.from('profiles').select('id, nome, codigo').eq('tipo', 'estagiario').order('nome')
    setEstagiarios(data || [])
    // Se estagiário logado, já pré-seleciona ele mesmo
    if (!isAdmin && profile) setForm(f => ({ ...f, estagiario_id: profile.id }))
  }

  async function buscarPaciente() {
    setBuscando(true); setPacientes([])
    const cpfLimpo = cpfBusca.replace(/\D/g, '')

    let q = supabase.from('pacientes').select('id, nome, cpf, email').order('nome')
    if (cpfLimpo.length >= 3) q = q.ilike('cpf', `%${cpfLimpo}%`)
    else if (nomeBusca.length >= 2) q = q.ilike('nome', `%${nomeBusca}%`)

    const { data } = await q.limit(10)
    setPacientes(data || [])
    setBuscando(false)
  }

  async function handleAgendar(e) {
    e.preventDefault()
    if (!pacienteSel) { setErro('Selecione um paciente.'); return }
    if (!form.data || !form.hora) { setErro('Informe data e horário.'); return }
    if (!form.estagiario_id) { setErro('Selecione o estagiário.'); return }
    setSaving(true); setErro('')

    const { data: novaConsulta, error } = await supabase
      .from('consultas')
      .insert([{
        paciente_id: pacienteSel.id,
        medico_id: form.estagiario_id,
        data: form.data,
        hora: form.hora,
        tipo: form.tipo,
        status: 'confirmada', // agendamento presencial confirma direto
      }])
      .select()
      .single()

    if (error) { setErro('Erro ao agendar. Verifique os dados.'); setSaving(false); return }

    setSucesso(`Consulta agendada para ${pacienteSel.nome}!`)
    setForm({ estagiario_id: !isAdmin ? profile.id : '', data: '', hora: '', tipo: 'Consulta' })
    setPacienteSel(null); setCpfBusca(''); setNomeBusca(''); setPacientes([])
    setStep(1)
    fetchConsultas()
    setSaving(false)
  }

  async function marcarRealizada(id) {
    await supabase.from('consultas').update({ status: 'realizada' }).eq('id', id)
    fetchConsultas()
  }

  async function confirmar(id) {
    await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', id)
    fetchConsultas()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Agenda</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{consultas.length} consulta(s)</p>
          </div>
          <button onClick={() => { setModal(true); setErro(''); setSucesso(''); setStep(1) }}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0047AB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agendar
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          {[['hoje','Hoje'],['semana','Semana'],['todos','Todas'],['data','Data']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filtro === v ? '#fff' : 'rgba(255,255,255,0.15)', color: filtro === v ? '#0047AB' : '#fff', fontSize: 12, fontWeight: filtro === v ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {l}
            </button>
          ))}
        </div>
        {filtro === 'data' && (
          <input type="date" value={dataCustom} onChange={e => setDataCustom(e.target.value)}
            style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
        )}
      </div>

      {/* Lista consultas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && consultas.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>📅</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Nenhuma consulta</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>Clique em "+ Agendar" para criar</p>
          </div>
        )}
        {consultas.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, border: '1px solid #F3F4F6', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#0D1B2A', marginBottom: 3 }}>{c.paciente?.nome}</p>
                <p style={{ fontSize: 12, color: '#0047AB', fontWeight: 600 }}>
                  {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} · {c.hora?.slice(0, 5)}
                </p>
              </div>
              <span style={{ background: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 50 }}>
                {statusLabel[c.status] || c.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              {c.sala?.nome && <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8 }}>🚪 {c.sala.nome}</span>}
              <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 11, padding: '3px 8px', borderRadius: 8 }}>{c.tipo}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {c.status === 'aguardando' && (
                <button onClick={() => confirmar(c.id)} style={{ flex: 1, background: '#D1FAE5', color: '#166534', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Confirmar</button>
              )}
              {c.status === 'confirmada' && (
                <button onClick={() => marcarRealizada(c.id)} style={{ flex: 1, background: '#DBEAFE', color: '#1e40af', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Realizada</button>
              )}
            </div>
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>

      {/* Modal Novo Agendamento */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>

            {/* Header modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>
                {step === 1 ? 'Buscar Paciente' : 'Dados da Consulta'}
              </p>
              <button onClick={() => { setModal(false); setStep(1); setPacienteSel(null); setCpfBusca(''); setNomeBusca(''); setPacientes([]) }}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Steps indicator */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[1, 2].map(s => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? '#0047AB' : '#E5E7EB' }} />
              ))}
            </div>

            {sucesso && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#166534' }}>✓ {sucesso}</p></div>}
            {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#991B1B' }}>⚠ {erro}</p></div>}

            {/* STEP 1 — Buscar paciente */}
            {step === 1 && (
              <div>
                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Busque o paciente por CPF ou nome</p>

                <label style={st.label}>CPF</label>
                <input style={st.input} placeholder="000.000.000-00" maxLength={14}
                  value={cpfBusca} onChange={e => { setCpfBusca(fmtCpf(e.target.value)); setNomeBusca('') }} />

                <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, margin: '8px 0' }}>ou</p>

                <label style={st.label}>Nome</label>
                <input style={st.input} placeholder="Digite o nome do paciente"
                  value={nomeBusca} onChange={e => { setNomeBusca(e.target.value); setCpfBusca('') }} />

                <button onClick={buscarPaciente} disabled={buscando || (!cpfBusca && !nomeBusca)}
                  style={{ width: '100%', background: '#0047AB', borderRadius: 12, padding: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 8, opacity: (!cpfBusca && !nomeBusca) ? 0.5 : 1 }}>
                  {buscando ? 'Buscando...' : '🔍 Buscar'}
                </button>

                {/* Resultados */}
                {pacientes.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 8 }}>{pacientes.length} resultado(s)</p>
                    {pacientes.map(p => (
                      <button key={p.id} onClick={() => { setPacienteSel(p); setStep(2); setErro('') }}
                        style={{ width: '100%', background: pacienteSel?.id === p.id ? '#EFF6FF' : '#F8FAFC', border: `1.5px solid ${pacienteSel?.id === p.id ? '#BFDBFE' : '#E5E7EB'}`, borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 20, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
                          {p.nome?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{p.nome}</p>
                          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{p.cpf ? p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    ))}
                  </div>
                )}

                {pacientes.length === 0 && (cpfBusca || nomeBusca) && !buscando && (
                  <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 16, fontSize: 13 }}>
                    Nenhum paciente encontrado. <br />
                    <button onClick={() => { }} style={{ color: '#0047AB', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>Cadastrar novo paciente →</button>
                  </p>
                )}
              </div>
            )}

            {/* STEP 2 — Dados da consulta */}
            {step === 2 && pacienteSel && (
              <form onSubmit={handleAgendar}>
                {/* Paciente selecionado */}
                <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '12px 14px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: '#0047AB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {pacienteSel.nome?.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#0047AB' }}>{pacienteSel.nome}</p>
                    <p style={{ fontSize: 12, color: '#6B7280' }}>{pacienteSel.cpf ? pacienteSel.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</p>
                  </div>
                  <button type="button" onClick={() => { setStep(1); setPacienteSel(null) }}
                    style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 12 }}>Trocar</button>
                </div>

                {/* Estagiário — só admin pode escolher */}
                {isAdmin && (
                  <>
                    <label style={st.label}>Estagiário</label>
                    <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.estagiario_id}
                      onChange={e => setForm(f => ({ ...f, estagiario_id: e.target.value }))} required>
                      <option value="">Selecione...</option>
                      {estagiarios.map(e => (
                        <option key={e.id} value={e.id}>{e.codigo ? `${e.codigo} — ` : ''}{e.nome}</option>
                      ))}
                    </select>
                  </>
                )}

                {/* Se estagiário logado, mostra quem vai atender */}
                {!isAdmin && (
                  <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    <span style={{ fontSize: 13, color: '#374151' }}>Estagiário: <strong>{profile?.nome}</strong></span>
                    {profile?.codigo && <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>{profile.codigo}</span>}
                  </div>
                )}

                <label style={st.label}>Tipo de consulta</label>
                <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {['Consulta', 'Retorno', 'Avaliação', 'Psicoterapia', 'Neuropsicologia'].map(t => <option key={t}>{t}</option>)}
                </select>

                <label style={st.label}>Data *</label>
                <input style={st.input} type="date" value={form.data}
                  onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />

                <label style={st.label}>Horário *</label>
                <input style={st.input} type="time" value={form.hora}
                  onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} required />

                <button type="submit" disabled={saving}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', borderRadius: 14, padding: 16, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 16, opacity: saving ? 0.7 : 1, boxShadow: '0 4px 16px rgba(0,71,171,0.3)' }}>
                  {saving ? 'Agendando...' : '✓ Confirmar Agendamento'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const st = {
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { width: '100%', boxSizing: 'border-box', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#0D1B2A', outline: 'none', fontFamily: 'inherit' },
}