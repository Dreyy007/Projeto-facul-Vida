import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function ResultadosInterno() {
  const { perfil } = useAuth()
  const [resultados, setResultados] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({ paciente_id: '', nome: '', categoria: 'Laudo', conteudo: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchResultados(); fetchPacientes() }, [])

  async function fetchResultados() {
    let q = supabase.from('resultados').select('*, paciente:pacientes(nome), medico:profiles(nome, codigo)').order('criado_em', { ascending: false })
    if (perfil?.tipo === 'estagiario') q = q.eq('medico_id', perfil.id)
    const { data } = await q
    setResultados(data || [])
    setLoading(false)
  }

  async function fetchPacientes() {
    const { data } = await supabase.from('pacientes').select('id, nome').eq('ativo', true).order('nome')
    setPacientes(data || [])
  }

  async function handleSalvar() {
    if (!form.paciente_id || !form.nome) return
    setSaving(true)
    const { error } = await supabase.from('resultados').insert([{
      paciente_id: form.paciente_id,
      medico_id: perfil.id,
      nome: form.nome,
      categoria: form.categoria,
      conteudo: form.conteudo || null,
    }])
    if (!error) {
      setModal(false)
      setForm({ paciente_id: '', nome: '', categoria: 'Laudo', conteudo: '' })
      fetchResultados()
    } else alert('Erro: ' + error.message)
    setSaving(false)
  }

  const fmtData = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  const filtrados = resultados.filter(r => {
    const q = busca.toLowerCase()
    return !q || r.paciente?.nome?.toLowerCase().includes(q) || r.nome?.toLowerCase().includes(q)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '52px 20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>Resultados</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{filtrados.length} registro(s)</p>
          </div>
          <button onClick={() => setModal(true)}
            style={{ background: '#fff', color: '#0047AB', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Novo
          </button>
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>
        : filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>📄</p>
            <p style={{ fontSize: 14, color: '#6B7280' }}>Nenhum resultado.</p>
          </div>
        ) : filtrados.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: '1px solid #F3F4F6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>{r.nome}</p>
              <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{r.categoria}</span>
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 4px' }}>👤 {r.paciente?.nome}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{fmtData(r.criado_em)}{r.medico?.nome ? ` · ${r.medico.nome}` : ''}</p>
            {r.arquivo_url && (
              <a href={r.arquivo_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: '#EFF6FF', color: '#0047AB', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                📎 Ver arquivo
              </a>
            )}
          </div>
        ))}
        <div style={{ height: 32 }} />
      </div>

      {/* Modal novo resultado */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', padding: '16px 20px 32px', width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: 40, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 20px' }} />
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A', marginBottom: 20 }}>Novo Resultado</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>Paciente *</p>
                <select value={form.paciente_id} onChange={e => setForm(p => ({ ...p, paciente_id: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
                  <option value="">Selecionar...</option>
                  {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>Nome do resultado *</p>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Avaliação Psicológica"
                  style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>Categoria</p>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                  style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}>
                  {['Laudo', 'Exame', 'Relatório', 'Prescrição', 'Outros'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>Observações</p>
                <textarea value={form.conteudo} onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))} placeholder="Observações opcionais..."
                  rows={3} style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, border: '1.5px solid #E5E7EB', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 600, color: '#6B7280', background: '#fff', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSalvar} disabled={saving || !form.paciente_id || !form.nome}
                style={{ flex: 1, background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}