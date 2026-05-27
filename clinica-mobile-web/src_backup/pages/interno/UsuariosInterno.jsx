import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function validarSenha(senha) {
  const erros = []
  if (senha.length < 8) erros.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(senha)) erros.push('1 letra maiúscula')
  if (!/[0-9]/.test(senha)) erros.push('1 número')
  if (!/[^A-Za-z0-9]/.test(senha)) erros.push('1 caractere especial (!@#$...)')
  return erros
}

const especialidadesPorTipo = {
  estagiario: ['Psicologia Clínica', 'Psicologia Infantil', 'Neuropsicologia', 'Psicologia Organizacional', 'Avaliação Psicológica', 'TCC'],
  coordenador: ['Coordenação Clínica', 'Supervisão de Estágio'],
  admin: ['Administração', 'Gestão Clínica'],
  recepcionista: ['Atendimento ao Paciente', 'Recepção e Agendamento'],
}

const tipoLabel = { estagiario: 'Estagiário', admin: 'Admin', coordenador: 'Coordenador', recepcionista: 'Recepcionista', supervisor: 'Supervisor' }
const tipoColor = { estagiario: { bg: '#EFF6FF', color: '#1d4ed8' }, admin: { bg: '#FEF3C7', color: '#92400E' }, coordenador: { bg: '#F0FDF4', color: '#166534' }, recepcionista: { bg: '#F5F3FF', color: '#6d28d9' }, supervisor: { bg: '#FFF7ED', color: '#c2410c' } }

export default function UsuariosInterno() {
  const { perfil: profile } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [codigoCriado, setCodigoCriado] = useState(null)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [senhaErros, setSenhaErros] = useState([])
  const [form, setForm] = useState({ nome: '', email: '', senha: '', tipo: 'estagiario', crp_crm: '', especialidade: '' })

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function gerarProximoCodigo() {
    const { data } = await supabase.from('profiles').select('codigo').eq('tipo', 'estagiario').not('codigo', 'is', null).order('codigo', { ascending: false }).limit(1)
    if (!data || data.length === 0) return 'EST01'
    const ultimo = data[0].codigo || 'EST00'
    const num = parseInt(ultimo.replace('EST', '')) + 1
    return 'EST' + String(num).padStart(2, '0')
  }

  async function handleSave() {
    const erros = validarSenha(form.senha)
    if (erros.length > 0) { setSenhaErros(erros); return }
    setSaving(true); setSenhaErros([])

    let codigo = null
    if (form.tipo === 'estagiario') codigo = await gerarProximoCodigo()

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ email: form.email, senha: form.senha, nome: form.nome, tipo: form.tipo, crp_crm: form.crp_crm || null, especialidade: form.especialidade || null, codigo }),
    })
    const json = await res.json()

    if (json.error) { alert('Erro: ' + json.error); setSaving(false); return }

    setCodigoCriado(form.tipo === 'estagiario' ? codigo : null)
    setForm({ nome: '', email: '', senha: '', tipo: 'estagiario', crp_crm: '', especialidade: '' })
    fetchUsuarios()
    setSaving(false)
  }

  async function toggleAtivo(id, ativo) {
    await supabase.from('profiles').update({ ativo: !ativo }).eq('id', id)
    fetchUsuarios()
  }

  const lista = usuarios.filter(u =>
    !busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    u.email?.toLowerCase().includes(busca.toLowerCase()) ||
    u.codigo?.toLowerCase().includes(busca.toLowerCase())
  )

  const sugestoes = especialidadesPorTipo[form.tipo] || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Usuários</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{lista.length} cadastrado(s)</p>
          </div>
          <button onClick={() => { setModal(true); setCodigoCriado(null); setSenhaErros([]) }}
            style={{ background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#0047AB', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome, e-mail ou código..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {lista.map(u => {
          const tc = tipoColor[u.tipo] || { bg: '#F3F4F6', color: '#6B7280' }
          return (
            <div key={u.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: u.ativo ? 1 : 0.6 }}>
              <div style={{ width: 46, height: 46, borderRadius: 23, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
                {u.nome?.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>{u.nome}</p>
                  {u.codigo && <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>{u.codigo}</span>}
                </div>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                <span style={{ background: tc.bg, color: tc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{tipoLabel[u.tipo] || u.tipo}</span>
              </div>
              <button onClick={() => toggleAtivo(u.id, u.ativo)}
                style={{ background: u.ativo ? '#D1FAE5' : '#FEE2E2', color: u.ativo ? '#166534' : '#991B1B', border: 'none', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                {u.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          )
        })}
        <div style={{ height: 24 }} />
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '24px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>Novo Usuário</p>
              <button onClick={() => setModal(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>

            {codigoCriado && (
              <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#166534', margin: 0 }}>✓ Usuário criado com sucesso!</p>
                <p style={{ fontSize: 13, color: '#166534', margin: '4px 0 0' }}>Código gerado: <strong>{codigoCriado}</strong></p>
              </div>
            )}

            <label style={st.label}>Tipo de acesso</label>
            <select style={{ ...st.input, backgroundColor: '#fff' }} value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value, especialidade: '' }))}>
              <option value="estagiario">Estagiário</option>
              <option value="recepcionista">Recepcionista</option>
              <option value="coordenador">Coordenador</option>
              <option value="admin">Administrador</option>
            </select>

            <label style={st.label}>Nome completo *</label>
            <input style={st.input} placeholder="Nome do usuário" value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />

            <label style={st.label}>E-mail *</label>
            <input style={st.input} type="email" placeholder="email@clinicavida.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoCapitalize="none" />

            <label style={st.label}>Senha *</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...st.input, paddingRight: 60 }} type={showSenha ? 'text' : 'password'}
                placeholder="Mín. 8 chars, maiúscula, número, especial" value={form.senha}
                onChange={e => { setForm(f => ({ ...f, senha: e.target.value })); setSenhaErros([]) }} />
              <button type="button" onClick={() => setShowSenha(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#0047AB', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {showSenha ? 'ocultar' : 'ver'}
              </button>
            </div>
            {senhaErros.length > 0 && (
              <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '8px 12px', marginTop: 6 }}>
                {senhaErros.map((e, i) => <p key={i} style={{ fontSize: 12, color: '#dc2626', margin: '2px 0' }}>• {e}</p>)}
              </div>
            )}

            <label style={st.label}>Especialidade</label>
            <input style={st.input} placeholder="Ex: Psicologia Clínica" value={form.especialidade}
              onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))} list="sugestoes-esp" />
            <datalist id="sugestoes-esp">
              {sugestoes.map(s => <option key={s} value={s} />)}
            </datalist>

            <label style={st.label}>CRP / CRM</label>
            <input style={st.input} placeholder="Ex: CRP 06/12345" value={form.crp_crm}
              onChange={e => setForm(f => ({ ...f, crp_crm: e.target.value }))} />

            <button onClick={handleSave} disabled={saving || !form.nome || !form.email || !form.senha}
              style={{ width: '100%', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', borderRadius: 14, padding: 16, border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 16, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Criando...' : 'Criar Usuário'}
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