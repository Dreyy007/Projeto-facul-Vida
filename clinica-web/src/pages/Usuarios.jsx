import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

function validarSenha(senha) {
  const erros = []
  if (senha.length < 8) erros.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(senha)) erros.push('1 letra maiúscula')
  if (!/[0-9]/.test(senha)) erros.push('1 número')
  if (!/[^A-Za-z0-9]/.test(senha)) erros.push('1 caractere especial (!@#$...)')
  return erros
}

export default function Usuarios() {
  const { profile } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [codigoCriado, setCodigoCriado] = useState(null)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', tipo: 'recepcionista', crp_crm: '', especialidade: '' })
  const [senhaErros, setSenhaErros] = useState([])
  const [showSenha, setShowSenha] = useState(false)
  const [saving, setSaving] = useState(false)

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
    if (!['admin', 'coordenador'].includes(profile?.tipo)) return alert('Sem permissão.')

    const erros = validarSenha(form.senha)
    if (erros.length > 0) { setSenhaErros(erros); return }

    setSaving(true)

    const { data: { session } } = await supabase.auth.getSession()

    // Gera código se for estagiário
    let codigo = null
    if (form.tipo === 'estagiario') {
      codigo = await gerarProximoCodigo()
    }

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-usuario`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: form.email,
        senha: form.senha,
        nome: form.nome,
        tipo: form.tipo,
        crp_crm: form.crp_crm || null,
        especialidade: form.especialidade || null,
        codigo,
        senha_provisoria: true, // flag para forçar troca no primeiro login
      }),
    })

    const json = await res.json()
    if (!res.ok || json.error) {
      alert('Erro: ' + (json.error || 'Falha ao criar usuário'))
    } else {
      setCodigoCriado(form.tipo === 'estagiario' ? codigo : null)
      setModal(false)
      setForm({ nome: '', email: '', senha: '', tipo: 'recepcionista', crp_crm: '', especialidade: '' })
      setSenhaErros([])
      fetchUsuarios()
    }
    setSaving(false)
  }

  async function toggleAtivo(id, ativo) {
    await supabase.from('profiles').update({ ativo: !ativo }).eq('id', id)
    fetchUsuarios()
  }

  const roleClass = { admin: 'role-adm', coordenador: 'role-coo', estagiario: 'role-med', recepcionista: 'role-rec' }
  const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', estagiario: 'Estagiário', recepcionista: 'Recepcionista' }
  const avColor = { admin: { bg: 'var(--dbg)', c: 'var(--danger)' }, coordenador: { bg: 'var(--wbg)', c: 'var(--warn)' }, estagiario: { bg: 'var(--sbg)', c: 'var(--success)' }, recepcionista: { bg: 'var(--p3)', c: 'var(--p)' } }

  if (!['admin', 'coordenador'].includes(profile?.tipo)) {
    return <div className="page"><div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>🚫 Acesso restrito.</div></div>
  }

  if (loading) return <div className="page-loading">Carregando...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Usuários internos</h1>
          <p className="page-sub">{usuarios.length} usuários cadastrados</p>
        </div>
        <button className="btn-primary" onClick={() => { setModal(true); setCodigoCriado(null) }}>+ Novo usuário</button>
      </div>

      {/* Banner com código do estagiário criado */}
      {codigoCriado && (
        <div style={{ background: 'var(--sbg)', border: '1px solid var(--success)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 28 }}>✅</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>Estagiário criado com sucesso!</div>
            <div style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>
              Código de acesso: <strong style={{ fontSize: 16, color: 'var(--p)', letterSpacing: 2 }}>{codigoCriado}</strong> — passe este código para o estagiário.
            </div>
          </div>
          <button onClick={() => setCodigoCriado(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Código</th><th>CRP/CRM</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const av = avColor[u.tipo] || avColor.recepcionista
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="td-user">
                        <div className="av" style={{ background: av.bg, color: av.c }}>{u.nome?.slice(0,2).toUpperCase()}</div>
                        {u.nome}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={roleClass[u.tipo] || 'tag'}>{roleLabel[u.tipo] || u.tipo}</span></td>
                    <td>
                      {u.codigo
                        ? <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, letterSpacing: 1 }}>{u.codigo}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td>{u.crp_crm || '—'}</td>
                    <td><span className={u.ativo ? 'tag tg' : 'tag tr'}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      {u.id !== profile?.id && (
                        <button className={u.ativo ? 'btn-outline' : 'btn-ok'} style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => toggleAtivo(u.id, u.ativo)}>
                          {u.ativo ? 'Desativar' : 'Reativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Permissões por perfil</h3></div>
        <div className="card-body">
          <table className="tbl">
            <thead><tr><th>Ação</th><th>Recepção</th><th>Estagiário</th><th>Coordenador</th><th>Admin</th></tr></thead>
            <tbody>
              <tr><td>Criar paciente</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
              <tr><td>Agendar consulta</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
              <tr><td>Ver agenda do dia</td><td>✅</td><td>✅ (só seus)</td><td>✅</td><td>✅</td></tr>
              <tr><td>Cancelar / Reagendar</td><td>⏳ Solicita</td><td>⏳ Solicita</td><td>✅ Aprova</td><td>✅ Direto</td></tr>
              <tr><td>Trocar sala</td><td>⏳ Solicita</td><td>⏳ Solicita</td><td>✅ Aprova</td><td>✅ Direto</td></tr>
              <tr><td>Ver todos os pacientes</td><td>✅</td><td>Só os seus</td><td>✅</td><td>✅</td></tr>
              <tr><td>Criar usuário interno</td><td>❌</td><td>❌</td><td>✅</td><td>✅</td></tr>
              <tr><td>Aprovar solicitações</td><td>❌</td><td>❌</td><td>✅</td><td>✅</td></tr>
              <tr><td>Acessar relatórios</td><td>❌</td><td>❌</td><td>✅</td><td>✅</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>Novo Usuário Interno</h2>
            <div className="form-grid">
              <div className="fld"><label>Nome completo *</label><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome"/></div>
              <div className="fld"><label>E-mail *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@clinica.com"/></div>
              <div className="fld">
                <label>Senha provisória *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSenha ? 'text' : 'password'}
                    value={form.senha}
                    onChange={e => { setForm({...form, senha: e.target.value}); setSenhaErros(validarSenha(e.target.value)) }}
                    placeholder="Mín. 8 car., 1 maiúscula, 1 número, 1 especial"
                    style={{ paddingRight: 60 }}
                  />
                  <button type="button" onClick={() => setShowSenha(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                    {showSenha ? 'ocultar' : 'ver'}
                  </button>
                </div>
                {/* Indicador de força da senha */}
                {form.senha && (
                  <div style={{ marginTop: 6 }}>
                    {senhaErros.length === 0
                      ? <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✅ Senha forte</div>
                      : <div style={{ fontSize: 11, color: 'var(--danger)' }}>Faltam: {senhaErros.join(' · ')}</div>
                    }
                  </div>
                )}
              </div>
              <div className="fld"><label>Perfil *</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value, crp_crm: '', especialidade: ''})}>
                  <option value="recepcionista">Recepcionista</option>
                  <option value="estagiario">Estagiário</option>
                  <option value="coordenador">Coordenador</option>
                  {profile?.tipo === 'admin' && <option value="admin">Administrador</option>}
                </select>
              </div>
              {form.tipo === 'estagiario' && (
                <div className="fld" style={{ gridColumn: '1/-1' }}>
                  <div style={{ background: 'var(--p3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--p)', fontWeight: 500 }}>
                    🏷️ Um código EST será gerado automaticamente e exibido após a criação.
                  </div>
                </div>
              )}
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => { setModal(false); setSenhaErros([]) }}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave}
                disabled={saving || !form.nome || !form.email || !form.senha || senhaErros.length > 0}>
                {saving ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}