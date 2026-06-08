import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useDebounce } from '../hooks/useDebounce'
import './Pages.css'

export default function Pacientes() {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [pacientes, setPacientes] = useState([])
  const [medicos, setMedicos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const searchDebounced = useDebounce(search, 280)
  const [filtro, setFiltro] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    data_nascimento: '',
    convenio: '',
    numero_convenio: '',
    medico_id: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    let query = supabase.from('pacientes').select('*, medico:profiles(nome)').order('nome')
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
    const payload = {
      ...form,
      medico_id: form.medico_id || null,
      data_nascimento: form.data_nascimento || null,
    }
    const { error } = await supabase.from('pacientes').insert([payload])
    if (!error) {
      setModal(false)
      setForm({ nome: '', email: '', cpf: '', telefone: '', data_nascimento: '', convenio: '', numero_convenio: '', medico_id: '' })
      fetchAll()
    } else {
      toast.error('Erro: ' + error.message)
    }
    setSaving(false)
  }

  const filtered = pacientes.filter(p => {
    const buscaCpf = searchDebounced.replace(/\D/g, '')
    const matchSearch =
      !searchDebounced ||
      p.nome?.toLowerCase().includes(searchDebounced.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchDebounced.toLowerCase()) ||
      (buscaCpf.length >= 3 && p.cpf?.replace(/\D/g, '').includes(buscaCpf))
    const matchFiltro =
      filtro === 'todos' ||
      (filtro === 'ativos' && p.ativo) ||
      (filtro === 'inativos' && !p.ativo)
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

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="chip-row" style={{ flex: 1 }}>
          {['todos','ativos','inativos'].map(f => (
            <button key={f} className={`chip${filtro === f ? ' chip-active' : ''}`} onClick={() => setFiltro(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <input className="search-input" placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
      </div>

      {/* Lista de pacientes */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty">
            <span style={{ fontSize: 36 }}>👥</span>
            <span style={{ fontWeight: 600 }}>{search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}</span>
            <span style={{ fontSize: 12 }}>{search ? `Sem resultados para "${search}"` : 'Cadastre o primeiro paciente'}</span>
            {!search && <button className="btn-primary" style={{ marginTop: 4 }} onClick={() => setModal(true)}>+ Novo paciente</button>}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <button key={p.id} onClick={() => navigate(`/pacientes/${p.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', width: '100%', textAlign: 'left', fontFamily: 'inherit', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'border-color .15s' }}
              onTouchStart={e => e.currentTarget.style.borderColor = 'var(--p)'}
              onTouchEnd={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {/* Avatar */}
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: p.ativo ? 'var(--p3)' : 'var(--bg)', border: `2px solid ${p.ativo ? 'var(--p)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: p.ativo ? 'var(--p)' : 'var(--muted)', flexShrink: 0 }}>
                {p.nome.slice(0,2).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 2 }}>{p.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {p.email && <span>{p.email}</span>}
                  {p.telefone && <span>{p.telefone}</span>}
                </div>
                {p.medico?.nome && <div style={{ fontSize: 11, color: 'var(--p)', marginTop: 3, fontWeight: 600 }}>👤 {p.medico.nome}</div>}
              </div>

              {/* Status + seta */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span className={p.ativo ? 'tag tg' : 'tag tr'} style={{ fontSize: 10 }}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
                <span style={{ color: 'var(--muted)', fontSize: 16 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>Novo Paciente</h2>
            <div className="form-grid">
              <div className="fld">
                <label>Nome completo *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do paciente" />
              </div>
              <div className="fld">
                <label>E-mail *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
              <div className="fld">
                <label>CPF</label>
                <input value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              <div className="fld">
                <label>Telefone</label>
                <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div className="fld">
                <label>Data de nascimento</label>
                <input type="date" value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: e.target.value })} />
              </div>
              <div className="fld">
                <label>Profissional responsável</label>
                <select value={form.medico_id} onChange={e => setForm({ ...form, medico_id: e.target.value })}>
                  <option value="">Selecionar...</option>
                  {medicos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Convênio</label>
                <input value={form.convenio} onChange={e => setForm({ ...form, convenio: e.target.value })} placeholder="Ex: Unimed" />
              </div>
              <div className="fld">
                <label>Nº do convênio</label>
                <input value={form.numero_convenio} onChange={e => setForm({ ...form, numero_convenio: e.target.value })} />
              </div>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !form.nome || !form.email}
              >
                {saving ? <><span className="spinner"/>Salvando...</> : 'Salvar paciente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}