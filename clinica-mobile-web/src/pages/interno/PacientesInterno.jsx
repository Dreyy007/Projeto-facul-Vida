import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function fmtCpf(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function fmtTel(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2')
}

export default function PacientesInterno() {
  const { perfil: profile } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false) // 'novo' | 'detalhe'
  const [pacienteSel, setPacienteSel] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  const [form, setForm] = useState({ nome: '', cpf: '', email: '', telefone: '', data_nascimento: '' })

  useEffect(() => { fetchPacientes() }, [profile])

  async function fetchPacientes() {
    if (!profile) return
    setLoading(true)
    let ids = []
    if (profile.tipo === 'estagiario') {
      const { data: cons } = await supabase.from('consultas').select('paciente_id').eq('medico_id', profile.id)
      ids = [...new Set((cons || []).map(c => c.paciente_id))]
    }
    let q = supabase.from('pacientes').select('*').order('nome')
    if (profile.tipo === 'estagiario' && ids.length > 0) q = q.in('id', ids)
    else if (profile.tipo === 'estagiario' && ids.length === 0) { setPacientes([]); setLoading(false); return }
    const { data } = await q
    setPacientes(data || [])
    setLoading(false)
  }

  async function handleCadastrar(e) {
    e.preventDefault()
    setErro(''); setSucesso('')
    const cpfLimpo = form.cpf.replace(/\D/g, '')
    if (!form.nome || !cpfLimpo || !form.email) { setErro('Nome, CPF e e-mail são obrigatórios.'); return }
    if (cpfLimpo.length !== 11) { setErro('CPF inválido.'); return }
    setSaving(true)

    // Verifica se CPF já existe
    const { data: exist } = await supabase.from('pacientes').select('id, nome').eq('cpf', cpfLimpo).single()
    if (exist) { setErro(`CPF já cadastrado para: ${exist.nome}`); setSaving(false); return }

    const { error } = await supabase.from('pacientes').insert([{
      nome: form.nome,
      cpf: cpfLimpo,
      email: form.email,
      telefone: form.telefone.replace(/\D/g, '') || null,
      data_nascimento: form.data_nascimento || null,
      ativo: true,
    }])

    if (error) { setErro('Erro ao cadastrar paciente.'); setSaving(false); return }
    setSucesso('Paciente cadastrado com sucesso!')
    setForm({ nome: '', cpf: '', email: '', telefone: '', data_nascimento: '' })
    fetchPacientes()
    setSaving(false)
  }

  // Busca por CPF digitado — traz nome automaticamente
  async function buscarPorCpf(cpf) {
    const cpfLimpo = cpf.replace(/\D/g, '')
    if (cpfLimpo.length < 11) return
    const { data } = await supabase.from('pacientes').select('*').eq('cpf', cpfLimpo).single()
    if (data) setPacienteSel(data)
  }

  const lista = pacientes.filter(p =>
    !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.cpf?.includes(busca.replace(/\D/g, '')) ||
    p.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Pacientes</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{lista.length} encontrado(s)</p>
          </div>
          <button onClick={() => { setModal('novo'); setErro(''); setSucesso('') }}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0047AB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome, CPF ou e-mail..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && lista.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>👥</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Nenhum paciente</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Cadastre um novo paciente clicando em "+ Novo"</p>
          </div>
        )}
        {lista.map(p => (
          <button key={p.id} onClick={() => { setPacienteSel(p); setModal('detalhe') }}
            style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
              {p.nome?.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{p.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>{p.cpf ? p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'} · {p.email || '—'}</p>
            </div>
            <span style={{ background: p.ativo ? '#D1FAE5' : '#FEE2E2', color: p.ativo ? '#166534' : '#991B1B', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 50 }}>
              {p.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </button>
        ))}
        <div style={{ height: 24 }} />
      </div>

      {/* Modal Novo Paciente */}
      {modal === 'novo' && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>Novo Paciente</p>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>

            {sucesso && <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#166534' }}>✓ {sucesso}</p></div>}
            {erro && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}><p style={{ fontSize: 13, color: '#991B1B' }}>⚠ {erro}</p></div>}

            <form onSubmit={handleCadastrar}>
              {[
                { label: 'Nome completo *', key: 'nome', placeholder: 'Nome do paciente', type: 'text' },
                { label: 'E-mail *', key: 'email', placeholder: 'email@exemplo.com', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label style={st.label}>{f.label}</label>
                  <input style={st.input} type={f.type} placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
                </div>
              ))}

              <label style={st.label}>CPF *</label>
              <input style={st.input} placeholder="000.000.000-00" value={form.cpf}
                onChange={e => setForm(v => ({ ...v, cpf: fmtCpf(e.target.value) }))}
                onBlur={e => buscarPorCpf(e.target.value)} maxLength={14} />

              <label style={st.label}>Telefone</label>
              <input style={st.input} placeholder="(11) 99999-9999" value={form.telefone}
                onChange={e => setForm(v => ({ ...v, telefone: fmtTel(e.target.value) }))} maxLength={15} />

              <label style={st.label}>Data de nascimento</label>
              <input style={st.input} type="date" value={form.data_nascimento}
                onChange={e => setForm(v => ({ ...v, data_nascimento: e.target.value }))} />

              <button type="submit" disabled={saving}
                style={{ width: '100%', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', borderRadius: 14, padding: 16, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 8, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Cadastrando...' : 'Cadastrar Paciente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalhe Paciente */}
      {modal === 'detalhe' && pacienteSel && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>Dados do Paciente</p>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#0047AB' }}>
                {pacienteSel.nome?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A' }}>{pacienteSel.nome}</p>
                <span style={{ background: pacienteSel.ativo ? '#D1FAE5' : '#FEE2E2', color: pacienteSel.ativo ? '#166534' : '#991B1B', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 50 }}>
                  {pacienteSel.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
            {[
              { label: 'CPF', value: pacienteSel.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') },
              { label: 'E-mail', value: pacienteSel.email },
              { label: 'Telefone', value: pacienteSel.telefone },
              { label: 'Nascimento', value: pacienteSel.data_nascimento ? new Date(pacienteSel.data_nascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: 13, color: '#9CA3AF' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2A' }}>{item.value || '—'}</span>
              </div>
            ))}
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