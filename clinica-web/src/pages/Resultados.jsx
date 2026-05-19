import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

const categorias = ['Exame de Sangue', 'Psicologia', 'Cardiologia', 'Neuropsicologia', 'Imagem', 'Outro']

export default function Resultados() {
  const { profile } = useAuth()
  const [resultados, setResultados] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroCat, setFiltroCat] = useState('todos')
  const [form, setForm] = useState({ paciente_id: '', nome: '', categoria: 'Exame de Sangue', conteudo: '' })
  const [arquivo, setArquivo] = useState(null)
  const fileRef = useRef(null)

  // Busca por CPF no modal
  const [cpfBusca, setCpfBusca] = useState('')
  const [pacienteEncontrado, setPacienteEncontrado] = useState(null)
  const [resultadosCpf, setResultadosCpf] = useState([])
  const [cpfErro, setCpfErro] = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: res }, { data: pac }] = await Promise.all([
      (() => {
        const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
        let q = supabase.from('resultados').select('*, paciente:pacientes(nome), medico:profiles(nome)').order('criado_em', { ascending: false })
        if (!isAdmin) q = q.eq('medico_id', profile?.id)
        return q
      })(),
      (() => {
        const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
        if (isAdmin) return supabase.from('pacientes').select('id, nome, cpf').order('nome')
        return supabase.from('consultas').select('paciente:pacientes(id, nome, cpf)').eq('medico_id', profile?.id).not('paciente', 'is', null)
      })(),
    ])
    setResultados(res || [])
    setPacientes(pac || [])
    setLoading(false)
  }

  function handleCpfBusca(valor) {
    setCpfBusca(valor)
    setCpfErro('')
    setPacienteEncontrado(null)
    setResultadosCpf([])
    setForm(f => ({ ...f, paciente_id: '' }))

    const cpfLimpo = valor.replace(/\D/g, '')
    if (cpfLimpo.length < 3) return

    const encontrados = pacientes.filter(p => p.cpf?.replace(/\D/g, '').includes(cpfLimpo))
    if (encontrados.length > 0) {
      setResultadosCpf(encontrados)
    } else if (cpfLimpo.length >= 6) {
      setCpfErro('Nenhum paciente encontrado com este CPF.')
    }
  }

  function selecionarPaciente(p) {
    setPacienteEncontrado(p)
    setResultadosCpf([])
    setForm(f => ({ ...f, paciente_id: p.id }))
  }

  function abrirModal() {
    setCpfBusca('')
    setPacienteEncontrado(null)
    setResultadosCpf([])
    setCpfErro('')
    setForm({ paciente_id: '', nome: '', categoria: 'Exame de Sangue', conteudo: '' })
    setArquivo(null)
    setModal(true)
  }

  async function handleSalvar() {
    if (!form.paciente_id || !form.nome) return
    setSaving(true)
    let arquivo_url = null
    let arquivo_nome = null
    let arquivo_tipo = null

    if (arquivo) {
      const ext = arquivo.name.split('.').pop()
      const path = `${form.paciente_id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('resultados').upload(path, arquivo)
      if (upErr) { alert('Erro ao enviar arquivo: ' + upErr.message); setSaving(false); return }
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
      arquivo_url,
      arquivo_nome,
      arquivo_tipo,
    }])

    if (error) { alert('Erro: ' + error.message) }
    else {
      setModal(false)
      fetchAll()
    }
    setSaving(false)
  }

  async function handleExcluir(id) {
    if (!window.confirm('Excluir este resultado?')) return
    await supabase.from('resultados').delete().eq('id', id)
    fetchAll()
  }

  const filtered = resultados.filter(r => {
    const matchSearch = !search || r.nome.toLowerCase().includes(search.toLowerCase()) || r.paciente?.nome?.toLowerCase().includes(search.toLowerCase())
    const matchCat = filtroCat === 'todos' || r.categoria === filtroCat
    return matchSearch && matchCat
  })

  const catColor = { 'Exame de Sangue': 'tp', 'Psicologia': 'ta', 'Cardiologia': 'tr', 'Neuropsicologia': 'ta', 'Imagem': 'tg', 'Outro': 'tp' }

  if (loading) return <div className="page-loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Resultados</h1>
          <p className="page-sub">{resultados.length} resultado(s) cadastrado(s)</p>
        </div>
        <button className="btn-primary" onClick={abrirModal}>+ Novo resultado</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="search-input" placeholder="🔍 Buscar por paciente ou exame..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
          <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}>
            <option value="todos">Todas as categorias</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {(search || filtroCat !== 'todos') && (
            <button className="btn-outline" style={{ fontSize: 12, padding: '8px 12px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => { setSearch(''); setFiltroCat('todos') }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{filtered.length} resultado(s)</span>
        </div>
      </div>

      {/* Tabela */}
      <div className="card">
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Exame / Laudo</th>
                <th>Categoria</th>
                <th>Arquivo</th>
                <th>Observações</th>
                <th>Liberado por</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="td-user">
                      <div className="av">{r.paciente?.nome?.slice(0, 2).toUpperCase()}</div>
                      {r.paciente?.nome}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.nome}</td>
                  <td><span className={`tag ${catColor[r.categoria] || 'tp'}`}>{r.categoria}</span></td>
                  <td>
                    {r.arquivo_url
                      ? <a href={r.arquivo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--p)', fontWeight: 600, fontSize: 12 }}>📎 {r.arquivo_nome?.length > 20 ? r.arquivo_nome.slice(0, 20) + '...' : r.arquivo_nome}</a>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {r.conteudo
                      ? <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={r.conteudo}>{r.conteudo}</span>
                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.medico?.nome || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {new Date(r.criado_em).toLocaleDateString('pt-BR')}
                  </td>
                  <td>
                    <button onClick={() => handleExcluir(r.id)} className="btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}>Excluir</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Nenhum resultado encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <h2>Novo Resultado</h2>
            <div className="form-grid">

              {/* Busca por CPF */}
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>CPF do paciente *</label>
                <input
                  value={cpfBusca}
                  onChange={e => handleCpfBusca(e.target.value)}
                  placeholder="Digite o CPF para buscar o paciente..."
                  maxLength={14}
                />
                {resultadosCpf.length > 0 && !pacienteEncontrado && (
                  <div style={{ marginTop: 8, border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {resultadosCpf.map(p => (
                      <div key={p.id} onClick={() => selecionarPaciente(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: '#fff', transition: '.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--p)', flexShrink: 0 }}>
                          {p.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.nome}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>CPF: {p.cpf}</div>
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--p)', fontWeight: 600 }}>Selecionar →</div>
                      </div>
                    ))}
                  </div>
                )}
                {pacienteEncontrado && (
                  <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--sbg, #f0fdf4)', border: '1.5px solid var(--success, #16a34a)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: 'var(--p)' }}>
                      {pacienteEncontrado.nome.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{pacienteEncontrado.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--success, #16a34a)', fontWeight: 600 }}>✓ Paciente encontrado</div>
                    </div>
                    <button onClick={() => { setPacienteEncontrado(null); setForm(f => ({...f, paciente_id: ''})) }}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
                      Trocar
                    </button>
                  </div>
                )}
                {cpfErro && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>⚠ {cpfErro}</div>
                )}
              </div>

              <div className="fld">
                <label>Nome do exame / laudo *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Hemograma Completo" />
              </div>
              <div className="fld">
                <label>Categoria</label>
                <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Arquivo (PDF, imagem)</label>
                <input ref={fileRef} type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => setArquivo(e.target.files[0])} />
                <button className="btn-outline" style={{ textAlign: 'left' }} onClick={() => fileRef.current?.click()}>
                  {arquivo ? `📎 ${arquivo.name}` : '📎 Selecionar arquivo...'}
                </button>
              </div>
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Observações / texto (opcional)</label>
                <textarea rows={4} value={form.conteudo} onChange={e => setForm({ ...form, conteudo: e.target.value })} placeholder="Digite o laudo ou observações médicas aqui..." style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => { setModal(false); setArquivo(null) }}>Cancelar</button>
              <button className="btn-primary" onClick={handleSalvar} disabled={saving || !form.paciente_id || !form.nome}>
                {saving ? 'Salvando...' : 'Liberar resultado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}