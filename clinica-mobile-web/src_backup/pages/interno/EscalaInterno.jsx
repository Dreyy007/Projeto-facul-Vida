import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function calcHorarios(inicio, fim, intervalo) {
  const [hI, mI] = (inicio || '08:00').split(':').map(Number)
  const [hF, mF] = (fim || '18:00').split(':').map(Number)
  const totalMin = (hF * 60 + mF) - (hI * 60 + mI)
  if (totalMin <= 0 || intervalo <= 0) return 0
  return Math.floor(totalMin / intervalo)
}

export default function EscalaInterno() {
  const { perfil: profile } = useAuth()
  const isAdmin = ['admin', 'coordenador', 'supervisor'].includes(profile?.tipo)

  const [estagiarios, setEstagiarios] = useState([])
  const [estSel, setEstSel] = useState(null)
  const [busca, setBusca] = useState('')
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(null) // null | 'novo' | escala obj
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00', intervalo_minutos: 50 })

  useEffect(() => {
    if (isAdmin) fetchEstagiarios()
    else { setEstSel(profile); fetchEscalas(profile?.id) }
  }, [profile])

  async function fetchEstagiarios() {
    const { data } = await supabase.from('profiles').select('id, nome, codigo, especialidade')
      .in('tipo', ['estagiario', 'coordenador']).order('nome')
    setEstagiarios(data || [])
  }

  async function fetchEscalas(medicoId) {
    if (!medicoId) return
    setLoading(true)
    const { data } = await supabase.from('escalas').select('*').eq('medico_id', medicoId).order('dia_semana')
    setEscalas(data || [])
    setLoading(false)
  }

  function selecionarEst(est) {
    setEstSel(est)
    fetchEscalas(est.id)
  }

  function abrirNova() {
    setForm({ dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00', intervalo_minutos: 50 })
    setModal('novo')
  }

  function abrirEditar(e) {
    setForm({ dia_semana: e.dia_semana, hora_inicio: e.hora_inicio?.slice(0, 5), hora_fim: e.hora_fim?.slice(0, 5), intervalo_minutos: e.intervalo_minutos })
    setModal(e)
  }

  async function salvar() {
    if (!estSel) return
    setSaving(true)
    const payload = { medico_id: estSel.id, dia_semana: Number(form.dia_semana), hora_inicio: form.hora_inicio, hora_fim: form.hora_fim, intervalo_minutos: Number(form.intervalo_minutos), ativo: true }

    if (modal === 'novo') {
      const jaExiste = escalas.find(e => e.dia_semana === payload.dia_semana)
      if (jaExiste) { setMsg(`Já existe escala para ${DIAS[payload.dia_semana]}. Edite a existente.`); setSaving(false); return }
      const { error } = await supabase.from('escalas').insert([payload])
      if (!error) { setMsg('Escala adicionada!'); setModal(null); fetchEscalas(estSel.id) }
      else setMsg('Erro: ' + error.message)
    } else {
      const { error } = await supabase.from('escalas').update(payload).eq('id', modal.id)
      if (!error) { setMsg('Escala atualizada!'); setModal(null); fetchEscalas(estSel.id) }
      else setMsg('Erro: ' + error.message)
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleEscala(e) {
    await supabase.from('escalas').update({ ativo: !e.ativo }).eq('id', e.id)
    fetchEscalas(estSel.id)
  }

  async function remover(id) {
    if (!window.confirm('Remover esta escala?')) return
    await supabase.from('escalas').delete().eq('id', id)
    fetchEscalas(estSel.id)
  }

  const estFiltrados = estagiarios.filter(e => !busca || e.nome?.toLowerCase().includes(busca.toLowerCase()) || e.codigo?.toLowerCase().includes(busca.toLowerCase()))

  // Se admin e não selecionou estagiário — mostra lista
  if (isAdmin && !estSel) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Escalas</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>Selecione um estagiário</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou código..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {estFiltrados.map(e => (
          <button key={e.id} onClick={() => selecionarEst(e)}
            style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
              {e.nome?.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{e.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>{e.especialidade || 'Estagiário'}</p>
            </div>
            {e.codigo && <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{e.codigo}</span>}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
      </div>
    </div>
  )

  // Tela de escalas do estagiário selecionado
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        {isAdmin && (
          <button onClick={() => { setEstSel(null); setEscalas([]) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Voltar</span>
          </button>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{estSel?.nome}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {estSel?.codigo && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{estSel.codigo}</span>}
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{escalas.length} horário(s)</span>
            </div>
          </div>
          <button onClick={abrirNova}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0047AB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo
          </button>
        </div>
      </div>

      {msg && <div style={{ margin: '12px 16px 0', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 14px' }}><p style={{ fontSize: 13, color: '#166534' }}>{msg}</p></div>}

      {/* Grade semanal visual */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {DIAS_CURTO.map((d, i) => {
            const temEscala = escalas.find(e => e.dia_semana === i)
            return (
              <div key={i} style={{ background: temEscala ? (temEscala.ativo ? '#0047AB' : '#9CA3AF') : '#F3F4F6', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: temEscala ? '#fff' : '#9CA3AF', margin: 0 }}>{d}</p>
                {temEscala && <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', margin: '2px 0 0' }}>{temEscala.hora_inicio?.slice(0, 5)}</p>}
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 20 }}>Carregando...</p>}
        {!loading && escalas.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>📅</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Nenhuma escala</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Clique em "+ Novo" para adicionar</p>
          </div>
        )}
        {escalas.map(e => {
          const slots = calcHorarios(e.hora_inicio, e.hora_fim, e.intervalo_minutos)
          return (
            <div key={e.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, borderLeft: `3px solid ${e.ativo ? '#0047AB' : '#D1D5DB'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: e.ativo ? '#EFF6FF' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: e.ativo ? '#0047AB' : '#9CA3AF', margin: 0 }}>{DIAS_CURTO[e.dia_semana]}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>{DIAS[e.dia_semana]}</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{e.hora_inicio?.slice(0, 5)} — {e.hora_fim?.slice(0, 5)} · {e.intervalo_minutos} min · {slots} slot{slots !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <span style={{ background: e.ativo ? '#D1FAE5' : '#FEE2E2', color: e.ativo ? '#166534' : '#991B1B', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
                  {e.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => abrirEditar(e)} style={{ flex: 1, background: '#EFF6FF', color: '#0047AB', border: 'none', borderRadius: 10, padding: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                <button onClick={() => toggleEscala(e)} style={{ flex: 1, background: e.ativo ? '#FEF3C7' : '#F0FDF4', color: e.ativo ? '#92400E' : '#166534', border: 'none', borderRadius: 10, padding: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {e.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => remover(e.id)} style={{ background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remover</button>
              </div>
            </div>
          )
        })}
        <div style={{ height: 24 }} />
      </div>

      {/* Modal escala */}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>{modal === 'novo' ? 'Nova Escala' : 'Editar Escala'}</p>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>

            <label style={st.label}>Dia da semana</label>
            <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.dia_semana}
              onChange={e => setForm(f => ({ ...f, dia_semana: Number(e.target.value) }))}>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={st.label}>Início</label>
                <input style={st.input} type="time" value={form.hora_inicio}
                  onChange={e => setForm(f => ({ ...f, hora_inicio: e.target.value }))} />
              </div>
              <div>
                <label style={st.label}>Fim</label>
                <input style={st.input} type="time" value={form.hora_fim}
                  onChange={e => setForm(f => ({ ...f, hora_fim: e.target.value }))} />
              </div>
            </div>

            <label style={st.label}>Intervalo (minutos)</label>
            <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.intervalo_minutos}
              onChange={e => setForm(f => ({ ...f, intervalo_minutos: Number(e.target.value) }))}>
              {[30, 45, 50, 60, 90].map(v => <option key={v} value={v}>{v} min</option>)}
            </select>

            <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '10px 14px', marginTop: 14 }}>
              <p style={{ fontSize: 13, color: '#0047AB', fontWeight: 600, margin: 0 }}>
                📊 {calcHorarios(form.hora_inicio, form.hora_fim, form.intervalo_minutos)} horários gerados por dia
              </p>
            </div>

            <button onClick={salvar} disabled={saving}
              style={{ width: '100%', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', borderRadius: 14, padding: 16, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 16, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar escala'}
            </button>
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