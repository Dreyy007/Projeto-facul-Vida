import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function fmtCpf(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

const categorias = ['Psicologia', 'Avaliação Psicológica', 'Neuropsicologia', 'Laudo', 'Relatório', 'Outro']

export default function ResultadosInterno() {
  const { perfil: profile } = useAuth()
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [busca, setBusca] = useState('')
  const [saving, setSaving] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  // Busca paciente por CPF
  const [cpfBusca, setCpfBusca] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [buscandoCpf, setBuscandoCpf] = useState(false)
  const [eroCpf, setErroCpf] = useState('')

  const [form, setForm] = useState({ titulo: '', categoria: 'Psicologia', descricao: '', arquivo_url: '' })

  useEffect(() => { fetchResultados() }, [profile])

  async function fetchResultados() {
    if (!profile) return
    let q = supabase.from('resultados')
      .select('*, paciente:pacientes(nome, cpf), medico:profiles(nome)')
      .order('criado_em', { ascending: false })
    if (profile.tipo === 'estagiario') q = q.eq('medico_id', profile.id)
    const { data } = await q
    setResultados(data || [])
    setLoading(false)
  }

  async function buscarPacientePorCpf() {
    const cpfLimpo = cpfBusca.replace(/\D/g, '')
    if (cpfLimpo.length !== 11) { setErroCpf('CPF deve ter 11 dígitos.'); return }
    setBuscandoCpf(true); setErroCpf(''); setPacienteEncontrado(null)
    const { data } = await supabase.from('pacientes').select('*').eq('cpf', cpfLimpo).single()
    if (data) {
      setPacienteEncontrado(data)
      setErroCpf('')
    } else {
      setErroCpf('Paciente não encontrado com este CPF.')
    }
    setBuscandoCpf(false)
  }

  async function handleLancar(e) {
    e.preventDefault()
    if (!pacienteEncontrado) { setErro('Busque o paciente pelo CPF primeiro.'); return }
    if (!form.titulo) { setErro('Informe o título do resultado.'); return }
    setSaving(true); setErro('')

    const { error } = await supabase.from('resultados').insert([{
      paciente_id: pacienteEncontrado.id,
      medico_id: profile.id,
      titulo: form.titulo,
      categoria: form.categoria,
      descricao: form.descricao || null,
      arquivo_url: form.arquivo_url || null,
    }])

    if (error) { setErro('Erro ao lançar resultado. Verifique os dados.'); setSaving(false); return }

    setSucesso(`Resultado lançado para ${pacienteEncontrado.nome}!`)
    setForm({ titulo: '', categoria: 'Psicologia', descricao: '', arquivo_url: '' })
    setCpfBusca(''); setPacienteEncontrado(null)
    fetchResultados()
    setSaving(false)
  }

  const lista = resultados.filter(r =>
    !busca || r.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    r.titulo?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Resultados</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{lista.length} registro(s)</p>
          </div>
          <button onClick={() => { setModal(true); setErro(''); setSucesso('') }}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0047AB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Lançar
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por paciente ou título..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && lista.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>📋</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Nenhum resultado</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Clique em "+ Lançar" para adicionar</p>
          </div>
        )}
        {lista.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid #F3F4F6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', flex: 1 }}>{r.titulo}</p>
              <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8, marginLeft: 8, flexShrink: 0 }}>{r.categoria}</span>
            </div>
            <p style={{ fontSize: 13, color: '#0047AB', fontWeight: 600, marginBottom: 4 }}>{r.paciente?.nome}</p>
            {r.descricao && <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{r.descricao}</p>}
            <p style={{ fontSize: 11, color: '#D1D5DB' }}>{r.criado_em ? fmtData(r.criado_em) : ''}</p>
            {r.arquivo_url && (
              <a href={r.arquivo_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: '#EFF6FF', color: '#0047AB', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Ver arquivo
              </a>
            )}
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>

      {/* Modal Lançar Resultado */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>Lançar Resultado</p>
              <button onClick={() => { setModal(false); setPacienteEncontrado(null); setCpfBusca(''); setErroCpf('') }}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>

            {sucesso && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#166534' }}>✓ {sucesso}</p></div>}
            {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#991B1B' }}>⚠ {erro}</p></div>}

            {/* Busca por CPF */}
            <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Buscar paciente pelo CPF</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={cpfBusca} onChange={e => { setCpfBusca(fmtCpf(e.target.value)); setPacienteEncontrado(null) }}
                placeholder="000.000.000-00" maxLength={14}
                style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={buscarPacientePorCpf} disabled={buscandoCpf}
                style={{ background: '#0047AB', border: 'none', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                {buscandoCpf ? '...' : 'Buscar'}
              </button>
            </div>

            {eroCpf && <p style={{ fontSize: 12, color: '#991B1B', marginBottom: 12 }}>{eroCpf}</p>}

            {/* Paciente encontrado */}
            {pacienteEncontrado && (
              <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 20, background: '#0047AB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {pacienteEncontrado.nome?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#0047AB' }}>✓ {pacienteEncontrado.nome}</p>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>{cpfBusca}</p>
                </div>
              </div>
            )}

            {/* Formulário */}
            <form onSubmit={handleLancar}>
              <label style={st.label}>Título do resultado *</label>
              <input style={st.input} placeholder="Ex: Laudo de Avaliação Psicológica" value={form.titulo}
                onChange={e => setForm(v => ({ ...v, titulo: e.target.value }))} required />

              <label style={st.label}>Categoria</label>
              <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.categoria}
                onChange={e => setForm(v => ({ ...v, categoria: e.target.value }))}>
                {categorias.map(c => <option key={c}>{c}</option>)}
              </select>

              <label style={st.label}>Descrição / Observações</label>
              <textarea style={{ ...st.input, height: 80, resize: 'none' }} placeholder="Descreva o resultado, conclusões ou observações..."
                value={form.descricao} onChange={e => setForm(v => ({ ...v, descricao: e.target.value }))} />

              <label style={st.label}>Link do arquivo (opcional)</label>
              <input style={st.input} placeholder="https://drive.google.com/..." value={form.arquivo_url}
                onChange={e => setForm(v => ({ ...v, arquivo_url: e.target.value }))} type="url" />

              <button type="submit" disabled={saving || !pacienteEncontrado}
                style={{ width: '100%', background: pacienteEncontrado ? 'linear-gradient(135deg, #0047AB, #1d6fef)' : '#E5E7EB', borderRadius: 14, padding: 16, border: 'none', cursor: pacienteEncontrado ? 'pointer' : 'default', fontSize: 16, fontWeight: 700, color: pacienteEncontrado ? '#fff' : '#9CA3AF', marginTop: 16, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : 'Lançar Resultado'}
              </button>
            </form>
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