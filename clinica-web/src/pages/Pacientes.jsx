import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Pacientes() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [medicos, setMedicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', cpf: '', telefone: '', data_nascimento: '', convenio: '', numero_convenio: '', medico_id: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    let query = supabase.from('pacientes').select('*, medico:profiles(nome)').order('nome')
    if (profile?.tipo === 'medico') query = query.eq('medico_id', profile.id)
    const { data } = await query
    const { data: meds } = await supabase.from('profiles').select('id, nome').eq('tipo', 'medico')
    setPacientes(data || [])
    setMedicos(meds || [])
    setLoading(false)
  }

  function exportarCSV() {
    const header = ['Nome', 'Email', 'CPF', 'Telefone', 'Profissional', 'Convênio', 'Nº Convênio', 'Status']
    const rows = filtered.map(p => [
      p.nome, p.email, p.cpf || '', p.telefone || '',
      p.medico?.nome || '', p.convenio || '', p.numero_convenio || '',
      p.ativo ? 'Ativo' : 'Inativo',
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pacientes-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('pacientes').insert([form])
    if (!error) { setModal(false); setForm({ nome:'',email:'',cpf:'',telefone:'',data_nascimento:'',convenio:'',numero_convenio:'',medico_id:'' }); fetchAll() }
    else alert('Erro: ' + error.message)
    setSaving(false)
  }

  const filtered = pacientes.filter(p => {
    const buscaCpf = busca.replace(/\D/g, '')
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
    const matchFiltro = filtro === 'todos' || (filtro === 'ativos' && p.ativo) || (filtro === 'inativos' && !p.ativo)
    return matchSearch && matchFiltro
  })

  if (loading) return <div className="page-loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Pacientes</h1>
          <p className="page-sub">{pacientes.length} pacientes cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-outline" onClick={exportarCSV}>Exportar CSV</button>
          <button className="btn-primary" onClick={() => setModal(true)}>+ Novo paciente</button>
        </div>
      </div>

      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="tabs" style={{ border: 'none', padding: 0 }}>
            {['todos', 'ativos', 'inativos'].map(f => (
              <div key={f} className={`tab${filtro === f ? ' on' : ''}`} onClick={() => setFiltro(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </div>
            ))}
          </div>
          <input className="search-input" placeholder="🔍 Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Profissional</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="td-user">
                      <div className="av">{p.nome.slice(0,2).toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.cpf || '—'}</td>
                  <td>{p.telefone || '—'}</td>
                  <td>{p.medico?.nome || '—'}</td>
                  <td><span className={p.ativo ? 'tag tg' : 'tag tr'}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                    <button onClick={() => navigate(`/pacientes/${p.id}`)} style={{ background: 'none', border: 'none', color: 'var(--p)', fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 0 }}>Ver ›</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Nenhum paciente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>Novo Paciente</h2>
            <div className="form-grid">
              <div className="fld"><label>Nome completo *</label><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome do paciente"/></div>
              <div className="fld"><label>E-mail *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemplo.com"/></div>
              <div className="fld"><label>CPF</label><input value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00"/></div>
              <div className="fld"><label>Telefone</label><input value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(11) 99999-9999"/></div>
              <div className="fld"><label>Data de nascimento</label><input type="date" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})}/></div>
              <div className="fld"><label>Profissional responsável</label>
                <select value={form.medico_id} onChange={e => setForm({...form, medico_id: e.target.value})}>
                  <option value="">Selecionar...</option>
                  {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="fld"><label>Convênio</label><input value={form.convenio} onChange={e => setForm({...form, convenio: e.target.value})} placeholder="Ex: Unimed"/></div>
              <div className="fld"><label>Nº do convênio</label><input value={form.numero_convenio} onChange={e => setForm({...form, numero_convenio: e.target.value})}/></div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.nome || !form.email}>
                {saving ? 'Salvando...' : 'Salvar paciente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}