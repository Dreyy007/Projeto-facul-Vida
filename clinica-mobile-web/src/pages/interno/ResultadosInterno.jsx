import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const categorias = ['Exame de Sangue', 'Psicologia', 'Cardiologia', 'Neuropsicologia', 'Imagem', 'Outro']
const catColor = { 'Exame de Sangue': '#1d4ed8', 'Psicologia': '#7c3aed', 'Cardiologia': '#dc2626', 'Neuropsicologia': '#0891b2', 'Imagem': '#059669', 'Outro': '#92400e' }
const catBg = { 'Exame de Sangue': '#eff6ff', 'Psicologia': '#f5f3ff', 'Cardiologia': '#fef2f2', 'Neuropsicologia': '#ecfeff', 'Imagem': '#f0fdf4', 'Outro': '#fef3c7' }

function fmtCpf(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function ResultadosInterno() {
  const { perfil: profile } = useAuth()
  const isAdmin = ['admin', 'coordenador', 'supervisor'].includes(profile?.tipo)
  const [resultados, setResultados] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const fileRef = useRef(null)
  const [arquivo, setArquivo] = useState(null)
  const [form, setForm] = useState({ paciente_id: '', nome: '', categoria: 'Exame de Sangue', conteudo: '' })

  // Busca CPF
  const [cpfBusca, setCpfBusca] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [resultadosCpf, setResultadosCpf] = useState([])
  const [cpfErro, setCpfErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => { fetchAll() }, [profile])

  async function fetchAll() {
    if (!profile) return
    setLoading(true)
    const [{ data: res }, { data: pac }] = await Promise.all([
      (() => {
        let q = supabase.from('resultados')
          .select('*, paciente:pacientes(nome, cpf), medico:profiles(nome)')
          .order('criado_em', { ascending: false })
        if (!isAdmin) q = q.eq('medico_id', profile.id)
        return q
      })(),
      (() => {
        if (isAdmin) return supabase.from('pacientes').select('id, nome, cpf').order('nome')
        return supabase.from('consultas').select('paciente:pacientes(id, nome, cpf)').eq('medico_id', profile.id)
      })(),
    ])
    setResultados(res || [])
    const pacNorm = isAdmin
      ? (pac || [])
      : [...new Map((pac || []).filter(p => p.paciente).map(p => [p.paciente.id, p.paciente])).values()]
    setPacientes(pacNorm)
    setLoading(false)
  }

  function handleCpfBusca(valor) {
    setCpfBusca(fmtCpf(valor))
    setCpfErro(''); setPacienteEncontrado(null); setResultadosCpf([])
    setForm(f => ({ ...f, paciente_id: '' }))
    const cpfLimpo = valor.replace(/\D/g, '')
    if (cpfLimpo.length < 3) return
    const encontrados = pacientes.filter(p => p.cpf?.replace(/\D/g, '').includes(cpfLimpo))
    if (encontrados.length > 0) setResultadosCpf(encontrados)
    else if (cpfLimpo.length >= 6) setCpfErro('Nenhum paciente encontrado com este CPF.')
  }

  function selecionarPaciente(p) {
    setPacienteEncontrado(p)
    setResultadosCpf([])
    setForm(f => ({ ...f, paciente_id: p.id }))
  }

  function abrirModal() {
    setCpfBusca(''); setPacienteEncontrado(null); setResultadosCpf([]); setCpfErro('')
    setForm({ paciente_id: '', nome: '', categoria: 'Exame de Sangue', conteudo: '' })
    setArquivo(null); setSucesso(''); setModal(true)
  }

  async function handleSalvar() {
    if (!form.paciente_id || !form.nome) return
    setSaving(true)
    let arquivo_url = null, arquivo_nome = null, arquivo_tipo = null

    if (arquivo) {
      const ext = arquivo.name.split('.').pop()
      const path = `${form.paciente_id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('resultados').upload(path, arquivo)
      if (upErr) { alert('Erro ao enviar arquivo.'); setSaving(false); return }
      const { data: urlData } = supabase.storage.from('resultados').getPublicUrl(path)
      arquivo_url = urlData.publicUrl
      arquivo_nome = arquivo.name
      arquivo_tipo = arquivo.type
    }

    const { error } = await supabase.from('resultados').insert([{
      paciente_id: form.paciente_id,
      medico_id: profile.id,
      nome: form.nome,
      categoria: form.categoria,
      conteudo: form.conteudo || null,
      arquivo_url, arquivo_nome, arquivo_tipo,
    }])

    if (error) { alert('Erro: ' + error.message) }
    else {
      setSucesso(`Resultado "${form.nome}" liberado para ${pacienteEncontrado?.nome}!`)
      setModal(false)
      fetchAll()
    }
    setSaving(false)
  }

  async function handleExcluir(id, nome) {
    if (!window.confirm(`Excluir resultado "${nome}"?`)) return
    await supabase.from('resultados').delete().eq('id', id)
    fetchAll()
  }

  const lista = resultados.filter(r =>
    !busca || r.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    r.paciente?.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Resultados</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{lista.length} resultado(s)</p>
          </div>
          <button onClick={abrirModal}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0047AB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por paciente ou exame..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      {sucesso && (
        <div style={{ margin: '12px 16px 0', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 14px' }}>
          <p style={{ fontSize: 13, color: '#166534' }}>✓ {sucesso}</p>
        </div>
      )}

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && lista.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>📋</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Nenhum resultado</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Clique em "+ Novo" para adicionar</p>
          </div>
        )}
        {lista.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid #F3F4F6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{r.nome}</p>
                <p style={{ fontSize: 13, color: '#0047AB', fontWeight: 600 }}>{r.paciente?.nome}</p>
              </div>
              <span style={{ background: catBg[r.categoria] || '#F3F4F6', color: catColor[r.categoria] || '#374151', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, marginLeft: 8, flexShrink: 0 }}>
                {r.categoria}
              </span>
            </div>
            {r.conteudo && <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{r.conteudo}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p style={{ fontSize: 11, color: '#D1D5DB' }}>Por {r.medico?.nome} · {new Date(r.criado_em).toLocaleDateString('pt-BR')}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {r.arquivo_url && (
                  <a href={r.arquivo_url} target="_blank" rel="noreferrer"
                    style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Arquivo
                  </a>
                )}
                {(isAdmin || r.medico_id === profile?.id) && (
                  <button onClick={() => handleExcluir(r.id, r.nome)}
                    style={{ background: '#FEF2F2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Excluir
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>

      {/* Modal Novo Resultado */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>Novo Resultado</p>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Busca CPF */}
            <label style={st.label}>CPF do paciente *</label>
            <input style={st.input} placeholder="Digite o CPF para buscar..." value={cpfBusca}
              onChange={e => handleCpfBusca(e.target.value)} maxLength={14} />

            {resultadosCpf.length > 0 && !pacienteEncontrado && (
              <div style={{ marginTop: 8, border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                {resultadosCpf.map(p => (
                  <button key={p.id} onClick={() => selecionarPaciente(p)}
                    style={{ width: '100%', background: '#fff', border: 'none', borderBottom: '1px solid #F3F4F6', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 18, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
                      {p.nome?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>{p.nome}</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>CPF: {p.cpf}</p>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#0047AB', fontWeight: 600 }}>Selecionar →</span>
                  </button>
                ))}
              </div>
            )}

            {pacienteEncontrado && (
              <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 19, background: '#0047AB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {pacienteEncontrado.nome?.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>{pacienteEncontrado.nome}</p>
                  <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, margin: 0 }}>✓ Paciente encontrado</p>
                </div>
                <button onClick={() => { setPacienteEncontrado(null); setForm(f => ({ ...f, paciente_id: '' })) }}
                  style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 12 }}>Trocar</button>
              </div>
            )}

            {cpfErro && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>⚠ {cpfErro}</p>}

            <label style={st.label}>Nome do exame / laudo *</label>
            <input style={st.input} placeholder="Ex: Hemograma Completo" value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />

            <label style={st.label}>Categoria</label>
            <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>

            <label style={st.label}>Arquivo (PDF, imagem)</label>
            <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }}
              onChange={e => setArquivo(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              style={{ ...st.input, background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: '1.5px dashed #D1D5DB' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontSize: 13, color: arquivo ? '#0047AB' : '#9CA3AF' }}>
                {arquivo ? `📎 ${arquivo.name}` : 'Selecionar arquivo...'}
              </span>
            </button>

            <label style={st.label}>Observações / laudo (opcional)</label>
            <textarea style={{ ...st.input, height: 100, resize: 'none' }}
              placeholder="Digite o laudo ou observações aqui..."
              value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} />

            <button onClick={handleSalvar} disabled={saving || !form.paciente_id || !form.nome}
              style={{ width: '100%', background: form.paciente_id && form.nome ? 'linear-gradient(135deg, #0047AB, #1d6fef)' : '#E5E7EB', borderRadius: 14, padding: 16, border: 'none', cursor: form.paciente_id && form.nome ? 'pointer' : 'default', fontSize: 16, fontWeight: 700, color: form.paciente_id && form.nome ? '#fff' : '#9CA3AF', marginTop: 16, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Liberar resultado'}
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