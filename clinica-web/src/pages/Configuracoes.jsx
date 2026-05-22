import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

const roleClass = { admin: 'role-adm', coordenador: 'role-coo', estagiario: 'role-med', recepcionista: 'role-rec' }
const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', estagiario: 'Estagiário', recepcionista: 'Recepcionista' }

export default function Configuracoes() {
  const { profile } = useAuth()
  const { tema, setTema } = useTheme()
  const [aba, setAba] = useState('perfil')
  const [formPerfil, setFormPerfil] = useState({ nome: '', crp_crm: '', especialidade: '' })
  const [formSenha, setFormSenha] = useState({ nova: '', confirma: '' })
  const [tipos, setTipos] = useState([])
  const [novoTipo, setNovoTipo] = useState('')
  const [salas, setSalas] = useState([])
  const [novaSala, setNovaSala] = useState({ nome: '', descricao: '' })
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
    if (aba === 'salas') fetchSalas()
  }, [aba])

  async function fetchTipos() {
    const { data } = await supabase.from('tipos_consulta').select('*').order('nome')
    setTipos(data || [])
  }

  async function fetchSalas() {
    const { data } = await supabase.from('salas').select('*').order('nome')
    setSalas(data || [])
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
    if (!error) { setFormSenha({ nova: '', confirma: '' }); notify(true, 'Senha alterada com sucesso!') }
    else notify(false, 'Erro ao alterar senha: ' + error.message)
    setSaving(false)
  }

  async function adicionarTipo() {
    const t = novoTipo.trim()
    if (!t) return
    if (tipos.some(x => x.nome.toLowerCase() === t.toLowerCase())) { notify(false, 'Tipo já existe.'); return }
    const { error } = await supabase.from('tipos_consulta').insert([{ nome: t }])
    if (!error) { setNovoTipo(''); fetchTipos(); notify(true, 'Tipo adicionado!') }
    else notify(false, 'Erro ao adicionar: ' + error.message)
  }

  async function removerTipo(id) {
    const { error } = await supabase.from('tipos_consulta').delete().eq('id', id)
    if (!error) { fetchTipos(); notify(true, 'Tipo removido.') }
    else notify(false, 'Erro ao remover: ' + error.message)
  }

  async function adicionarSala() {
    const nome = novaSala.nome.trim()
    if (!nome) return
    if (salas.some(s => s.nome.toLowerCase() === nome.toLowerCase())) { notify(false, 'Sala já existe.'); return }
    const { error } = await supabase.from('salas').insert([{ nome, descricao: novaSala.descricao || null, ativa: true }])
    if (!error) { setNovaSala({ nome: '', descricao: '' }); fetchSalas(); notify(true, 'Sala adicionada!') }
    else notify(false, 'Erro ao adicionar sala: ' + error.message)
  }

  async function toggleSala(id, ativa) {
    const { error } = await supabase.from('salas').update({ ativa: !ativa }).eq('id', id)
    if (!error) fetchSalas()
    else notify(false, 'Erro ao atualizar sala.')
  }

  async function removerSala(id) {
    // Verifica se tem consultas ativas vinculadas
    const { data: cons } = await supabase.from('consultas').select('id').eq('sala_id', id).not('status', 'in', '("cancelada","realizada")').limit(1)
    if (cons && cons.length > 0) { notify(false, 'Esta sala tem consultas ativas. Desative-a em vez de remover.'); return }
    const { error } = await supabase.from('salas').delete().eq('id', id)
    if (!error) { fetchSalas(); notify(true, 'Sala removida.') }
    else notify(false, 'Erro ao remover sala: ' + error.message)
  }

  const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
  const temEspecialidade = ['estagiario', 'medico', 'coordenador'].includes(profile?.tipo)

  const menuItens = [
    ['perfil', '👤 Meu perfil'],
    ['senha', '🔒 Alterar senha'],
    ['aparencia', '🎨 Aparência'],
    ...(isAdmin ? [
      ['clinica', '🏥 Dados da clínica'],
      ['consultas', '📋 Tipos de consulta'],
      ['salas', '🚪 Salas'],
    ] : []),
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <p className="page-sub">Gerencie seu perfil e as configurações da clínica</p>
        </div>
      </div>

      {msgOk && <div style={{ background: 'var(--sbg)', color: 'var(--success)', padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>✅ {msgOk}</div>}
      {msgErr && <div style={{ background: 'var(--dbg)', color: 'var(--danger)', padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>❌ {msgErr}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Menu lateral */}
        <div className="card" style={{ padding: '8px 0' }}>
          {menuItens.map(([k, l]) => (
            <div key={k} onClick={() => setAba(k)} style={{
              padding: '11px 18px', fontSize: 13,
              fontWeight: aba === k ? 700 : 400,
              color: aba === k ? 'var(--p)' : 'var(--text)',
              background: aba === k ? 'var(--p3)' : 'transparent',
              cursor: 'pointer',
              borderLeft: aba === k ? '3px solid var(--p)' : '3px solid transparent',
              transition: '.15s',
            }}>{l}</div>
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
                  <span className={roleClass[profile?.tipo] || 'tag'}>{roleLabel[profile?.tipo] || profile?.tipo}</span>
                  {profile?.codigo && (
                    <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>{profile.codigo}</span>
                  )}
                </div>
              </div>
              <div className="form-grid">
                <div className="fld"><label>Nome completo *</label>
                  <input value={formPerfil.nome} onChange={e => setFormPerfil(p => ({ ...p, nome: e.target.value }))} />
                </div>
                <div className="fld"><label>E-mail (não editável)</label>
                  <input value={profile?.email || ''} disabled style={{ opacity: .6 }} />
                </div>
                {temEspecialidade && (
                  <>
                    <div className="fld"><label>CRP / CRM</label>
                      <input value={formPerfil.crp_crm} onChange={e => setFormPerfil(p => ({ ...p, crp_crm: e.target.value }))} placeholder="Ex: CRP 06/12345" />
                    </div>
                    <div className="fld"><label>Especialidade</label>
                      <input value={formPerfil.especialidade} onChange={e => setFormPerfil(p => ({ ...p, especialidade: e.target.value }))} placeholder="Ex: Psicologia Infantil" />
                    </div>
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
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Mínimo 6 caracteres</p>
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

          {/* Aparência */}
          {aba === 'aparencia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Aparência</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Escolha o tema do painel interno</p>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { key: 'claro', label: 'Claro' },
                  { key: 'escuro', label: 'Escuro' },
                  { key: 'sistema', label: 'Sistema' },
                ].map(op => {
                  const active = tema === op.key
                  return (
                    <button key={op.key} onClick={() => setTema(op.key)} style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                      padding: '24px 16px', borderRadius: 16, cursor: 'pointer', transition: 'all .15s',
                      border: active ? '2px solid var(--p)' : '1.5px dashed var(--border)',
                      backgroundColor: active ? 'var(--p3)' : 'transparent', maxWidth: 140,
                    }}>
                      <span style={{ fontSize: 28 }}>{op.key === 'claro' ? '☀️' : op.key === 'escuro' ? '🌙' : '💻'}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--p)' : 'var(--muted)' }}>{op.label}</span>
                    </button>
                  )
                })}
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
                <div className="fld"><label>E-mail de contato</label><input type="email" placeholder="contato@clinicavida.com.br" /></div>
                <div className="fld" style={{ gridColumn: '1/-1' }}><label>Endereço</label><input placeholder="Rua, número, bairro, cidade – UF" /></div>
              </div>
              <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--warn)' }}>
                ⚠️ Funcionalidade de salvar dados da clínica em desenvolvimento.
              </div>
            </div>
          )}

          {/* Tipos de consulta */}
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
                    <button onClick={() => removerTipo(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Remover</button>
                  </div>
                ))}
                {tipos.length === 0 && <div className="empty">Nenhum tipo cadastrado.</div>}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={novoTipo} onChange={e => setNovoTipo(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarTipo()} placeholder="Novo tipo de consulta..."
                  style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
                <button className="btn-primary" onClick={adicionarTipo} disabled={!novoTipo.trim()}>Adicionar</button>
              </div>
            </div>
          )}

          {/* Salas */}
          {aba === 'salas' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Gerenciar Salas</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Ative, desative ou crie novas salas de atendimento</p>
              </div>

              {/* Lista de salas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {salas.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    border: '1px solid var(--border)', borderRadius: 10, fontSize: 13,
                    background: s.ativa ? '#fff' : 'var(--bg)',
                    opacity: s.ativa ? 1 : 0.6,
                  }}>
                    {/* Ícone sala */}
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: s.ativa ? 'var(--p3)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ativa ? 'var(--p)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{s.nome}</div>
                      {s.descricao && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.descricao}</div>}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: s.ativa ? 'var(--sbg)' : 'var(--dbg)',
                      color: s.ativa ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {s.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                    <button
                      onClick={() => toggleSala(s.id, s.ativa)}
                      className={s.ativa ? 'btn-outline' : 'btn-ok'}
                      style={{ padding: '4px 12px', fontSize: 12 }}>
                      {s.ativa ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      onClick={() => removerSala(s.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 8px' }}>
                      Remover
                    </button>
                  </div>
                ))}
                {salas.length === 0 && <div className="empty">Nenhuma sala cadastrada.</div>}
              </div>

              {/* Adicionar nova sala */}
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px 18px', border: '1.5px dashed var(--border)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>➕ Nova sala</p>
                <div className="form-grid">
                  <div className="fld"><label>Nome da sala *</label>
                    <input value={novaSala.nome} onChange={e => setNovaSala(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Sala 11" />
                  </div>
                  <div className="fld"><label>Descrição (opcional)</label>
                    <input value={novaSala.descricao} onChange={e => setNovaSala(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Sala de atendimento infantil" />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-primary" onClick={adicionarSala} disabled={!novaSala.nome.trim()}>Adicionar sala</button>
                </div>
              </div>

              <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warn)' }}>
                ⚠️ Salas inativas não aparecem nas opções de agendamento. Salas com consultas ativas não podem ser removidas.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}