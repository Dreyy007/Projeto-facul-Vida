import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

const roleClass = { admin: 'role-adm', coordenador: 'role-coo', medico: 'role-med', recepcionista: 'role-rec' }
const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', medico: 'Médico / Psicólogo', recepcionista: 'Recepcionista' }

export default function Configuracoes() {
  const { profile } = useAuth()
  const { tema, setTema } = useTheme()
  const [aba, setAba] = useState('perfil')
  const [formPerfil, setFormPerfil] = useState({ nome: '', crp_crm: '', especialidade: '' })
  const [formSenha, setFormSenha] = useState({ nova: '', confirma: '' })
  const [tipos, setTipos] = useState([])
  const [novoTipo, setNovoTipo] = useState('')
  const [saving, setSaving] = useState(false)
  const [msgOk, setMsgOk] = useState('')
  const [msgErr, setMsgErr] = useState('')

  useEffect(() => {
    if (profile) {
      setFormPerfil({ nome: profile.nome || '', crp_crm: profile.crp_crm || '', especialidade: profile.especialidade || '' })
    }
  }, [profile])

  useEffect(() => {
    if (aba === 'consultas') fetchTipos()
  }, [aba])

  async function fetchTipos() {
    const { data } = await supabase.from('tipos_consulta').select('*').order('nome')
    if (data) setTipos(data)
    else setTipos([
      { id: 'default-1', nome: 'Psicoterapia' },
      { id: 'default-2', nome: 'Avaliação Psicológica' },
      { id: 'default-3', nome: 'Consulta Psiquiátrica' },
      { id: 'default-4', nome: 'Neuropsicologia' },
      { id: 'default-5', nome: 'Psicologia Infantil' },
    ])
  }

  function notify(ok, msg) {
    if (ok) { setMsgOk(msg); setTimeout(() => setMsgOk(''), 3000) }
    else { setMsgErr(msg); setTimeout(() => setMsgErr(''), 4000) }
  }

  async function salvarPerfil() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      nome: formPerfil.nome,
      crp_crm: formPerfil.crp_crm,
      especialidade: formPerfil.especialidade,
    }).eq('id', profile.id)
    notify(!error, error ? 'Erro ao salvar: ' + error.message : 'Perfil atualizado com sucesso!')
    setSaving(false)
  }

  async function salvarSenha() {
    if (formSenha.nova !== formSenha.confirma) { notify(false, 'As senhas não coincidem.'); return }
    if (formSenha.nova.length < 6) { notify(false, 'A nova senha precisa ter pelo menos 6 caracteres.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: formSenha.nova })
    if (!error) {
      setFormSenha({ nova: '', confirma: '' })
      notify(true, 'Senha alterada com sucesso!')
    } else {
      notify(false, 'Erro ao alterar senha: ' + error.message)
    }
    setSaving(false)
  }

  async function adicionarTipo() {
    const t = novoTipo.trim()
    if (!t) return
    if (tipos.some(x => x.nome.toLowerCase() === t.toLowerCase())) {
      notify(false, 'Tipo já existe.'); return
    }
    const { error } = await supabase.from('tipos_consulta').insert([{ nome: t }])
    if (!error) { setNovoTipo(''); fetchTipos(); notify(true, 'Tipo adicionado!') }
    else notify(false, 'Erro ao adicionar: ' + error.message)
  }

  async function removerTipo(id) {
    const { error } = await supabase.from('tipos_consulta').delete().eq('id', id)
    if (!error) { fetchTipos(); notify(true, 'Tipo removido.') }
    else notify(false, 'Erro ao remover: ' + error.message)
  }

  const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <p className="page-sub">Gerencie seu perfil e as configurações da clínica</p>
        </div>
      </div>

      {msgOk && (
        <div style={{ background: 'var(--sbg)', color: 'var(--success)', padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
          ✅ {msgOk}
        </div>
      )}
      {msgErr && (
        <div style={{ background: 'var(--dbg)', color: 'var(--danger)', padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>
          ❌ {msgErr}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Menu lateral */}
        <div className="card" style={{ padding: '8px 0' }}>
          {[
            ['perfil', '👤 Meu perfil'],
            ['senha', '🔒 Alterar senha'],
            ['aparencia', '🎨 Aparência'],
            ...(isAdmin ? [['clinica', '🏥 Dados da clínica'], ['consultas', '📋 Tipos de consulta']] : []),
          ].map(([k, l]) => (
            <div
              key={k}
              onClick={() => setAba(k)}
              style={{
                padding: '11px 18px',
                fontSize: 13,
                fontWeight: aba === k ? 700 : 400,
                color: aba === k ? 'var(--p)' : 'var(--text)',
                background: aba === k ? 'var(--p3)' : 'transparent',
                cursor: 'pointer',
                borderLeft: aba === k ? '3px solid var(--p)' : '3px solid transparent',
                transition: '.15s',
              }}
            >{l}</div>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="card" style={{ padding: 28 }}>

          {/* Perfil */}
          {aba === 'perfil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Meu Perfil</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Suas informações exibidas no sistema</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--p3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'var(--p)' }}>
                  {profile?.nome?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{profile?.nome}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{profile?.email}</div>
                  {/* CORRIGIDO: era className={objeto} — agora é string */}
                  <span className={roleClass[profile?.tipo] || 'tag'}>
                    {roleLabel[profile?.tipo]}
                  </span>
                </div>
              </div>
              <div className="form-grid">
                <div className="fld"><label>Nome completo *</label><input value={formPerfil.nome} onChange={e => setFormPerfil(p => ({ ...p, nome: e.target.value }))} /></div>
                <div className="fld"><label>E-mail (não editável)</label><input value={profile?.email || ''} disabled style={{ opacity: .6 }} /></div>
                {profile?.tipo === 'medico' && (
                  <>
                    <div className="fld"><label>CRP / CRM</label><input value={formPerfil.crp_crm} onChange={e => setFormPerfil(p => ({ ...p, crp_crm: e.target.value }))} placeholder="Ex: 06/12345" /></div>
                    <div className="fld"><label>Especialidade</label><input value={formPerfil.especialidade} onChange={e => setFormPerfil(p => ({ ...p, especialidade: e.target.value }))} placeholder="Ex: Psicólogo Clínico" /></div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={salvarPerfil} disabled={saving || !formPerfil.nome}>
                  {saving ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </div>
            </div>
          )}

          {/* Senha */}
          {aba === 'senha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Alterar Senha</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Sua nova senha precisa ter pelo menos 6 caracteres</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
                <div className="fld"><label>Nova senha *</label><input type="password" value={formSenha.nova} onChange={e => setFormSenha(p => ({ ...p, nova: e.target.value }))} placeholder="••••••••" /></div>
                <div className="fld"><label>Confirmar nova senha *</label><input type="password" value={formSenha.confirma} onChange={e => setFormSenha(p => ({ ...p, confirma: e.target.value }))} placeholder="••••••••" /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={salvarSenha} disabled={saving || !formSenha.nova || !formSenha.confirma}>
                  {saving ? 'Alterando...' : 'Alterar senha'}
                </button>
              </div>
            </div>
          )}

          {/* Dados da clínica */}
          {aba === 'clinica' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Dados da Clínica</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Informações gerais exibidas no sistema</p>
              </div>
              <div className="form-grid">
                <div className="fld"><label>Nome da clínica</label><input defaultValue="Clínica Vida+" /></div>
                <div className="fld"><label>CNPJ</label><input placeholder="00.000.000/0001-00" /></div>
                <div className="fld"><label>Telefone</label><input placeholder="(11) 3333-3333" /></div>
                <div className="fld"><label>E-mail de contato</label><input type="email" placeholder="contato@clinicavidamais.com.br" /></div>
                <div className="fld" style={{ gridColumn: '1/-1' }}><label>Endereço</label><input placeholder="Rua, número, bairro, cidade – UF" /></div>
              </div>
              <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--warn)' }}>
                ⚠️ Para salvar esses dados, adicione a tabela <strong>config_clinica</strong> no Supabase (veja o schema abaixo).
              </div>
            </div>
          )}

          {/* Aparência */}
          {aba === 'aparencia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Aparência</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Escolha o tema do painel interno</p>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { key: 'claro', label: 'Claro', icon: (active) => (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill={active ? '#0047AB' : 'none'} stroke="#0047AB" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="4"/>
                      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  )},
                  { key: 'escuro', label: 'Escuro', icon: (active) => (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill={active ? '#0047AB' : 'none'} stroke="#0047AB" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                    </svg>
                  )},
                  { key: 'sistema', label: 'Sistema', icon: (active) => (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9"/>
                      <line x1="12" y1="3" x2="12" y2="21"/>
                      <path d="M12 3a9 9 0 010 18" fill={active ? '#0047AB' : 'none'}/>
                    </svg>
                  )},
                ].map(op => {
                  const active = tema === op.key
                  return (
                    <button key={op.key} onClick={() => setTema(op.key)} style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                      padding: '24px 16px', borderRadius: 16, cursor: 'pointer', transition: 'all .15s',
                      border: active ? '2px solid var(--p)' : '1.5px dashed var(--border)',
                      backgroundColor: active ? 'var(--p3)' : 'transparent',
                      maxWidth: 140,
                    }}>
                      {op.icon(active)}
                      <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--p)' : 'var(--muted)' }}>{op.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tipos de consulta — agora salva no banco */}
          {aba === 'consultas' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Tipos de Consulta</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Gerencie os tipos disponíveis ao agendar</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tipos.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}>
                    <span>{t.nome}</span>
                    <button
                      onClick={() => removerTipo(t.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >Remover</button>
                  </div>
                ))}
                {tipos.length === 0 && <div className="empty">Nenhum tipo cadastrado.</div>}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={novoTipo}
                  onChange={e => setNovoTipo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && adicionarTipo()}
                  placeholder="Novo tipo de consulta..."
                  style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
                />
                <button className="btn-primary" onClick={adicionarTipo} disabled={!novoTipo.trim()}>Adicionar</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}