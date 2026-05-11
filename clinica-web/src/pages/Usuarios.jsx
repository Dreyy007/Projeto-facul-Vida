import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Usuarios() {
  const { profile } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', tipo: 'recepcionista', crp_crm: '', especialidade: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchUsuarios() }, [])

  async function fetchUsuarios() {
    const { data } = await supabase.from('profiles').select('*').order('nome')
    setUsuarios(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!['admin', 'coordenador'].includes(profile?.tipo)) return alert('Sem permissão.')
    setSaving(true)

    // Chama a Edge Function (usa service_role no servidor, seguro)
    const { data: { session } } = await supabase.auth.getSession()
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
        crp_crm: form.crp_crm,
        especialidade: form.especialidade,
      }),
    })

    const json = await res.json()
    if (!res.ok || json.error) {
      alert('Erro: ' + (json.error || 'Falha ao criar usuário'))
    } else {
      setModal(false)
      setForm({ nome: '', email: '', senha: '', tipo: 'recepcionista', crp_crm: '', especialidade: '' })
      fetchUsuarios()
    }
    setSaving(false)
  }

  async function toggleAtivo(id, ativo) {
    await supabase.from('profiles').update({ ativo: !ativo }).eq('id', id)
    fetchUsuarios()
  }

  const roleClass = { admin: 'role-adm', coordenador: 'role-coo', medico: 'role-med', recepcionista: 'role-rec' }
  const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', medico: 'Médico', recepcionista: 'Recepcionista' }

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
        <button className="btn-primary" onClick={() => setModal(true)}>+ Novo usuário</button>
      </div>

      <div className="card">
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>CRP/CRM</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="td-user">
                      <div className="av" style={{ background: u.tipo === 'admin' ? 'var(--dbg)' : u.tipo === 'medico' ? 'var(--sbg)' : u.tipo === 'coordenador' ? 'var(--wbg)' : 'var(--p3)', color: u.tipo === 'admin' ? 'var(--danger)' : u.tipo === 'medico' ? 'var(--success)' : u.tipo === 'coordenador' ? 'var(--warn)' : 'var(--p)' }}>
                        {u.nome?.slice(0,2).toUpperCase()}
                      </div>
                      {u.nome}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td><span className={roleClass[u.tipo]}>{roleLabel[u.tipo]}</span></td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Permissões por perfil</h3></div>
        <div className="card-body">
          <table className="tbl">
            <thead><tr><th>Ação</th><th>Recepção</th><th>Médico</th><th>Coordenador</th><th>Admin</th></tr></thead>
            <tbody>
              <tr><td>Criar paciente</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
              <tr><td>Agendar consulta</td><td>✅</td><td>✅</td><td>✅</td><td>✅</td></tr>
              <tr><td>Ver agenda do dia</td><td>✅</td><td>✅ (só seus)</td><td>✅</td><td>✅</td></tr>
              <tr><td>Cancelar / Reagendar</td><td>⏳ Solicita</td><td>⏳ Aprova 50%</td><td>⏳ Aprova 50%</td><td>✅ Direto</td></tr>
              <tr><td>Ver todos os pacientes</td><td>✅</td><td>Só os seus</td><td>✅</td><td>✅</td></tr>
              <tr><td>Criar usuário interno</td><td>❌</td><td>❌</td><td>✅</td><td>✅</td></tr>
              <tr><td>Aprovar solicitações</td><td>❌</td><td>✅ (próprios)</td><td>✅</td><td>✅</td></tr>
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
              <div className="fld"><label>Senha provisória *</label><input type="password" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} placeholder="Mín. 6 caracteres"/></div>
              <div className="fld"><label>Perfil *</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  <option value="recepcionista">Recepcionista</option>
                  <option value="medico">Médico / Psicólogo</option>
                  <option value="coordenador">Coordenador</option>
                  {profile?.tipo === 'admin' && <option value="admin">Administrador</option>}
                </select>
              </div>
              {form.tipo === 'medico' && (
                <>
                  <div className="fld"><label>CRP / CRM</label><input value={form.crp_crm} onChange={e => setForm({...form, crp_crm: e.target.value})} placeholder="Ex: 06/12345"/></div>
                  <div className="fld"><label>Especialidade</label><input value={form.especialidade} onChange={e => setForm({...form, especialidade: e.target.value})} placeholder="Ex: Psicólogo Clínico"/></div>
                </>
              )}
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.nome || !form.email || !form.senha}>
                {saving ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
