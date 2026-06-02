import { useEffect, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Pages.css'

const roleClass = { admin: 'role-adm', coordenador: 'role-coo', estagiario: 'role-med', recepcionista: 'role-rec' }
const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', estagiario: 'Estagiário', recepcionista: 'Recepcionista' }
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function Configuracoes() {
  const { profile } = useAuth()
  const toast = useToast()
  const { tema, setTema } = useTheme()
  const [aba, setAba] = useState('perfil')
  const [formPerfil, setFormPerfil] = useState({ nome: '', crp_crm: '', especialidade: '' })
  const [formSenha, setFormSenha] = useState({ nova: '', confirma: '' })
  const [tipos, setTipos] = useState([])
  const [novoTipo, setNovoTipo] = useState('')
  const [salas, setSalas] = useState([])
  const [novaSala, setNovaSala] = useState({ nome: '', descricao: '' })
  // Escalas
  const [estagiarios, setEstagiarios] = useState([])
  const [estSelecionado, setEstSelecionado] = useState(null)
  const [escalas, setEscalas] = useState([])
  const [modalEscala, setModalEscala] = useState(null) // null | 'novo' | escala existente
  const [formEscala, setFormEscala] = useState({ dia_semana: 1, hora_inicio: '08:00', hora_fim: '18:00', intervalo_minutos: 50, ativo: true })
  const [buscaEst, setBuscaEst] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) setFormPerfil({ nome: profile.nome || '', crp_crm: profile.crp_crm || '', especialidade: profile.especialidade || '' })
  }, [profile])

  useEffect(() => {
    if (aba === 'consultas') fetchTipos()
    if (aba === 'salas') fetchSalas()
    if (aba === 'escalas') fetchEstagiarios()
    if (aba === 'minha_escala' && profile?.tipo === 'estagiario') fetchEscalas(profile.id)
  }, [aba])

  useEffect(() => {
    if (estSelecionado) fetchEscalas(estSelecionado.id)
  }, [estSelecionado])

  async function fetchTipos() {
    const { data } = await supabase.from('tipos_consulta').select('*').order('nome')
    setTipos(data || [])
  }

  async function fetchSalas() {
    const { data } = await supabase.from('salas').select('*').order('nome')
    setSalas(data || [])
  }

  async function fetchEstagiarios() {
    const { data } = await supabase.from('profiles').select('id, nome, codigo, especialidade, ativo').eq('tipo', 'estagiario').order('codigo')
    setEstagiarios(data || [])
    if (data && data.length > 0 && !estSelecionado) setEstSelecionado(data[0])
  }

  async function fetchEscalas(medicoId) {
    const { data } = await supabase.from('escalas').select('*').eq('medico_id', medicoId).order('dia_semana')
    setEscalas(data || [])
  }

  function notify(ok, msg) {
    if (ok) toast.success(msg)
    else toast.error(msg)
  }

  async function salvarPerfil() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ nome: formPerfil.nome, crp_crm: formPerfil.crp_crm, especialidade: formPerfil.especialidade }).eq('id', profile.id)
    notify(!error, error ? 'Erro ao salvar: ' + error.message : 'Perfil atualizado com sucesso!')
    setSaving(false)
  }

  async function salvarSenha() {
    if (formSenha.nova !== formSenha.confirma) { notify(false, 'As senhas não coincidem.'); return }
    if (formSenha.nova.length < 6) { notify(false, 'Mínimo 6 caracteres.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: formSenha.nova })
    if (!error) { setFormSenha({ nova: '', confirma: '' }); notify(true, 'Senha alterada!') }
    else notify(false, 'Erro: ' + error.message)
    setSaving(false)
  }

  async function adicionarTipo() {
    const t = novoTipo.trim()
    if (!t || tipos.some(x => x.nome.toLowerCase() === t.toLowerCase())) { notify(false, 'Tipo já existe ou inválido.'); return }
    const { error } = await supabase.from('tipos_consulta').insert([{ nome: t }])
    if (!error) { setNovoTipo(''); fetchTipos(); notify(true, 'Tipo adicionado!') }
    else notify(false, 'Erro: ' + error.message)
  }

  async function removerTipo(id) {
    const { error } = await supabase.from('tipos_consulta').delete().eq('id', id)
    if (!error) { fetchTipos(); notify(true, 'Tipo removido.') }
    else notify(false, 'Erro: ' + error.message)
  }

  async function adicionarSala() {
    const nome = novaSala.nome.trim()
    if (!nome || salas.some(s => s.nome.toLowerCase() === nome.toLowerCase())) { notify(false, 'Nome inválido ou já existe.'); return }
    const { error } = await supabase.from('salas').insert([{ nome, descricao: novaSala.descricao || null, ativa: true }])
    if (!error) { setNovaSala({ nome: '', descricao: '' }); fetchSalas(); notify(true, 'Sala adicionada!') }
    else notify(false, 'Erro: ' + error.message)
  }

  async function toggleSala(id, ativa) {
    await supabase.from('salas').update({ ativa: !ativa }).eq('id', id)
    fetchSalas()
  }

  async function removerSala(id) {
    const { data: cons } = await supabase.from('consultas').select('id').eq('sala_id', id).not('status', 'in', '("cancelada","realizada")').limit(1)
    if (cons?.length > 0) { notify(false, 'Sala tem consultas ativas. Desative primeiro.'); return }
    const { error } = await supabase.from('salas').delete().eq('id', id)
    if (!error) { fetchSalas(); notify(true, 'Sala removida.') }
    else notify(false, 'Erro: ' + error.message)
  }

  // Escalas
  function abrirNovaEscala() {
    setFormEscala({ dia_semana: 1, hora_inicio: '08:00', hora_fim: '18:00', intervalo_minutos: 50, ativo: true })
    setModalEscala('novo')
  }

  function abrirEditarEscala(e) {
    setFormEscala({
      dia_semana: e.dia_semana,
      hora_inicio: e.hora_inicio?.slice(0, 5),
      hora_fim: e.hora_fim?.slice(0, 5),
      intervalo_minutos: e.intervalo_minutos,
      ativo: e.ativo,
    })
    setModalEscala(e)
  }

  async function salvarEscala() {
    if (!estSelecionado) return
    setSaving(true)
    const payload = {
      medico_id: estSelecionado.id,
      dia_semana: Number(formEscala.dia_semana),
      hora_inicio: formEscala.hora_inicio,
      hora_fim: formEscala.hora_fim,
      intervalo_minutos: Number(formEscala.intervalo_minutos),
      ativo: formEscala.ativo,
    }

    if (modalEscala === 'novo') {
      // Verifica se já existe escala para esse dia
      const jaExiste = escalas.find(e => e.dia_semana === payload.dia_semana)
      if (jaExiste) { notify(false, `Já existe escala para ${DIAS[payload.dia_semana]}. Edite a existente.`); setSaving(false); return }
      const { error } = await supabase.from('escalas').insert([payload])
      if (!error) { notify(true, 'Escala adicionada!'); setModalEscala(null); fetchEscalas(estSelecionado.id) }
      else notify(false, 'Erro: ' + error.message)
    } else {
      const { error } = await supabase.from('escalas').update(payload).eq('id', modalEscala.id)
      if (!error) { notify(true, 'Escala atualizada!'); setModalEscala(null); fetchEscalas(estSelecionado.id) }
      else notify(false, 'Erro: ' + error.message)
    }
    setSaving(false)
  }

  async function toggleEscala(id, ativo) {
    await supabase.from('escalas').update({ ativo: !ativo }).eq('id', id)
    fetchEscalas(estSelecionado.id)
    notify(true, ativo ? 'Escala desativada.' : 'Escala ativada.')
  }

  async function removerEscala(id) {
    await supabase.from('escalas').delete().eq('id', id)
    fetchEscalas(estSelecionado.id)
    notify(true, 'Escala removida.')
  }

  // Calcula quantos horários gera por dia
  function calcHorarios(inicio, fim, intervalo) {
    const [hI, mI] = (inicio || '08:00').split(':').map(Number)
    const [hF, mF] = (fim || '18:00').split(':').map(Number)
    const totalMin = (hF * 60 + mF) - (hI * 60 + mI)
    if (totalMin <= 0 || intervalo <= 0) return 0
    return Math.floor(totalMin / intervalo)
  }

  const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
  const temEspecialidade = ['estagiario', 'medico', 'coordenador'].includes(profile?.tipo)

  const menuItens = [
    ['perfil', '👤 Meu perfil'],
    ['senha', '🔒 Alterar senha'],
    ['aparencia', '🎨 Aparência'],
    ...(profile?.tipo === 'estagiario' ? [['minha_escala', '📅 Minha Escala']] : []),
    ...(isAdmin ? [
      ['clinica', '🏥 Dados da clínica'],
      ['consultas', '📋 Tipos de consulta'],
      ['salas', '🚪 Salas'],
      ['escalas', '📅 Escalas'],
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
                  {profile?.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>{profile.codigo}</span>}
                </div>
              </div>
              <div className="form-grid">
                <div className="fld"><label>Nome completo *</label><input value={formPerfil.nome} onChange={e => setFormPerfil(p => ({ ...p, nome: e.target.value }))} /></div>
                <div className="fld"><label>E-mail (não editável)</label><input value={profile?.email || ''} disabled style={{ opacity: .6 }} /></div>
                {temEspecialidade && (<>
                  <div className="fld"><label>CRP / CRM</label><input value={formPerfil.crp_crm} onChange={e => setFormPerfil(p => ({ ...p, crp_crm: e.target.value }))} placeholder="Ex: CRP 06/12345" /></div>
                  <div className="fld"><label>Especialidade</label><input value={formPerfil.especialidade} onChange={e => setFormPerfil(p => ({ ...p, especialidade: e.target.value }))} placeholder="Ex: Psicologia Infantil" /></div>
                </>)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={salvarPerfil} disabled={saving || !formPerfil.nome}>{saving ? 'Salvando...' : 'Salvar perfil'}</button>
              </div>
            </div>
          )}

          {/* Senha */}
          {aba === 'senha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Alterar Senha</h3><p style={{ fontSize: 13, color: 'var(--muted)' }}>Mínimo 6 caracteres</p></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 380 }}>
                <div className="fld"><label>Nova senha *</label><input type="password" value={formSenha.nova} onChange={e => setFormSenha(p => ({ ...p, nova: e.target.value }))} placeholder="••••••••" /></div>
                <div className="fld"><label>Confirmar *</label><input type="password" value={formSenha.confirma} onChange={e => setFormSenha(p => ({ ...p, confirma: e.target.value }))} placeholder="••••••••" /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn-primary" onClick={salvarSenha} disabled={saving || !formSenha.nova || !formSenha.confirma}>{saving ? 'Alterando...' : 'Alterar senha'}</button>
              </div>
            </div>
          )}

          {/* Aparência */}
          {aba === 'aparencia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div><h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Aparência</h3><p style={{ fontSize: 13, color: 'var(--muted)' }}>Escolha o tema</p></div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[{ key: 'claro', label: 'Claro', icon: '☀️' }, { key: 'escuro', label: 'Escuro', icon: '🌙' }, { key: 'sistema', label: 'Sistema', icon: '💻' }].map(op => {
                  const active = tema === op.key
                  return (
                    <button key={op.key} onClick={() => setTema(op.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 16px', borderRadius: 16, cursor: 'pointer', transition: 'all .15s', border: active ? '2px solid var(--p)' : '1.5px dashed var(--border)', backgroundColor: active ? 'var(--p3)' : 'transparent', maxWidth: 140 }}>
                      <span style={{ fontSize: 28 }}>{op.icon}</span>
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
              <div><h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Dados da Clínica</h3></div>
              <div className="form-grid">
                <div className="fld"><label>Nome da clínica</label><input defaultValue="Clínica Vida+" /></div>
                <div className="fld"><label>CNPJ</label><input placeholder="00.000.000/0001-00" /></div>
                <div className="fld"><label>Telefone</label><input placeholder="(11) 3333-3333" /></div>
                <div className="fld"><label>E-mail</label><input type="email" placeholder="contato@clinicavida.com.br" /></div>
                <div className="fld" style={{ gridColumn: '1/-1' }}><label>Endereço</label><input placeholder="Rua, número, bairro, cidade" /></div>
              </div>
              <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--warn)' }}>⚠️ Salvamento em desenvolvimento.</div>
            </div>
          )}

          {/* Tipos de consulta */}
          {aba === 'consultas' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Tipos de Consulta</h3><p style={{ fontSize: 13, color: 'var(--muted)' }}>Gerencie os tipos disponíveis</p></div>
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
                <input value={novoTipo} onChange={e => setNovoTipo(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionarTipo()} placeholder="Novo tipo..." style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
                <button className="btn-primary" onClick={adicionarTipo} disabled={!novoTipo.trim()}>Adicionar</button>
              </div>
            </div>
          )}

          {/* Salas */}
          {aba === 'salas' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div><h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Gerenciar Salas</h3><p style={{ fontSize: 13, color: 'var(--muted)' }}>Ative, desative ou crie salas</p></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {salas.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, background: s.ativa ? '#fff' : 'var(--bg)', opacity: s.ativa ? 1 : 0.6 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: s.ativa ? 'var(--p3)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={s.ativa ? 'var(--p)' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{s.nome}</div>
                      {s.descricao && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.descricao}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.ativa ? 'var(--sbg)' : 'var(--dbg)', color: s.ativa ? 'var(--success)' : 'var(--danger)' }}>{s.ativa ? 'Ativa' : 'Inativa'}</span>
                    <button onClick={() => toggleSala(s.id, s.ativa)} className={s.ativa ? 'btn-outline' : 'btn-ok'} style={{ padding: '4px 12px', fontSize: 12 }}>{s.ativa ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => removerSala(s.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '4px 8px' }}>Remover</button>
                  </div>
                ))}
                {salas.length === 0 && <div className="empty">Nenhuma sala.</div>}
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px 18px', border: '1.5px dashed var(--border)' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>➕ Nova sala</p>
                <div className="form-grid">
                  <div className="fld"><label>Nome *</label><input value={novaSala.nome} onChange={e => setNovaSala(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Sala 11" /></div>
                  <div className="fld"><label>Descrição</label><input value={novaSala.descricao} onChange={e => setNovaSala(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Atendimento infantil" /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn-primary" onClick={adicionarSala} disabled={!novaSala.nome.trim()}>Adicionar sala</button></div>
              </div>
              <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warn)' }}>⚠️ Salas inativas não aparecem no agendamento. Salas com consultas ativas não podem ser removidas.</div>
            </div>
          )}

          {/* Escalas */}
          {aba === 'escalas' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Escalas de Atendimento</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Defina os dias e horários de atendimento de cada estagiário</p>
              </div>

              {/* Busca de estagiário */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  value={buscaEst}
                  onChange={ev => setBuscaEst(ev.target.value)}
                  placeholder="🔍 Buscar por nome ou código (ex: EST01)"
                  style={{ flex: 1, padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
                />
                {buscaEst && <button onClick={() => setBuscaEst('')} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>}
              </div>

              {/* Seletor de estagiário */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {estagiarios
                  .filter(e => {
                    const q = buscaEst.toLowerCase()
                    return !q || e.nome?.toLowerCase().includes(q) || e.codigo?.toLowerCase().includes(q)
                  })
                  .map(e => (
                    <button key={e.id} onClick={() => setEstSelecionado(e)} style={{
                      padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: '.15s',
                      border: e.ativo ? 'none' : '1px dashed var(--border)',
                      background: estSelecionado?.id === e.id ? 'var(--p)' : e.ativo ? 'var(--p3)' : 'var(--bg)',
                      color: estSelecionado?.id === e.id ? '#fff' : e.ativo ? 'var(--p)' : 'var(--muted)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {e.codigo && <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.8 }}>{e.codigo}</span>}
                      {e.nome}
                      {!e.ativo && <span style={{ fontSize: 9, opacity: 0.6 }}>(inativo)</span>}
                    </button>
                  ))
                }
                {estagiarios.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum estagiário cadastrado.</p>}
              </div>

              {estSelecionado && (
                <>
                  {/* Info do estagiário selecionado */}
                  <div style={{ background: 'var(--p3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--p)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>
                      {estSelecionado.nome?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--p)' }}>{estSelecionado.nome}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{estSelecionado.especialidade || 'Estagiário'} · {estSelecionado.codigo}</div>
                    </div>
                    <button className="btn-primary" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }} onClick={abrirNovaEscala}>+ Novo horário</button>
                  </div>

                  {/* Grade visual dos dias */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                    {[0,1,2,3,4,5,6].map(dia => {
                      const escDia = escalas.filter(e => e.dia_semana === dia)
                      const temEscala = escDia.length > 0
                      return (
                        <div key={dia} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <div style={{ padding: '6px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, background: temEscala ? 'var(--p)' : 'var(--bg)', color: temEscala ? '#fff' : 'var(--muted)' }}>
                            {DIAS_CURTO[dia]}
                          </div>
                          <div style={{ padding: 6, minHeight: 52, background: '#fff' }}>
                            {escDia.length === 0 && <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Livre</p>}
                            {escDia.map(e => (
                              <div key={e.id} onClick={() => abrirEditarEscala(e)} style={{ background: e.ativo ? 'var(--p3)' : 'var(--bg)', borderRadius: 6, padding: '4px 6px', marginBottom: 4, cursor: 'pointer', opacity: e.ativo ? 1 : 0.5 }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--p)', margin: 0 }}>{e.hora_inicio?.slice(0,5)}–{e.hora_fim?.slice(0,5)}</p>
                                <p style={{ fontSize: 9, color: 'var(--muted)', margin: 0 }}>{calcHorarios(e.hora_inicio?.slice(0,5), e.hora_fim?.slice(0,5), e.intervalo_minutos)} slots</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Lista detalhada */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {escalas.length === 0 && <div className="empty">Nenhuma escala cadastrada para este estagiário.</div>}
                    {escalas.map(e => (
                      <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 10, background: e.ativo ? '#fff' : 'var(--bg)', opacity: e.ativo ? 1 : 0.6 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: e.ativo ? 'var(--p3)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: e.ativo ? 'var(--p)' : 'var(--muted)' }}>{DIAS_CURTO[e.dia_semana]}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{DIAS[e.dia_semana]}</div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {e.hora_inicio?.slice(0,5)} – {e.hora_fim?.slice(0,5)} · {e.intervalo_minutos} min · {calcHorarios(e.hora_inicio?.slice(0,5), e.hora_fim?.slice(0,5), e.intervalo_minutos)} horários
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: e.ativo ? 'var(--sbg)' : 'var(--dbg)', color: e.ativo ? 'var(--success)' : 'var(--danger)' }}>{e.ativo ? 'Ativo' : 'Inativo'}</span>
                        <button className="btn-outline" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => abrirEditarEscala(e)}>Editar</button>
                        <button onClick={() => toggleEscala(e.id, e.ativo)} className={e.ativo ? 'btn-outline' : 'btn-ok'} style={{ padding: '4px 10px', fontSize: 12 }}>{e.ativo ? 'Desativar' : 'Ativar'}</button>
                        <button onClick={() => removerEscala(e.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Remover</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Minha Escala — só para estagiário */}
          {aba === 'minha_escala' && profile?.tipo === 'estagiario' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ fontFamily: 'Playfair Display,serif', fontSize: 18, marginBottom: 4 }}>Minha Escala</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Seus dias e horários configurados pelo administrador</p>
              </div>
              <div style={{ background: 'var(--p3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--p)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>
                  {profile?.nome?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--p)' }}>{profile?.nome}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{profile?.especialidade || 'Estagiário'} · {profile?.codigo}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {[0,1,2,3,4,5,6].map(dia => {
                  const escDia = escalas.filter(e => e.dia_semana === dia)
                  const temEscala = escDia.length > 0
                  return (
                    <div key={dia} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{ padding: '6px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, background: temEscala ? 'var(--p)' : 'var(--bg)', color: temEscala ? '#fff' : 'var(--muted)' }}>{DIAS_CURTO[dia]}</div>
                      <div style={{ padding: 6, minHeight: 52, background: '#fff' }}>
                        {escDia.length === 0 && <p style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>Livre</p>}
                        {escDia.map(e => (
                          <div key={e.id} style={{ background: e.ativo ? 'var(--p3)' : 'var(--bg)', borderRadius: 6, padding: '4px 6px', marginBottom: 4, opacity: e.ativo ? 1 : 0.5 }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--p)', margin: 0 }}>{e.hora_inicio?.slice(0,5)}–{e.hora_fim?.slice(0,5)}</p>
                            <p style={{ fontSize: 9, color: 'var(--muted)', margin: 0 }}>{calcHorarios(e.hora_inicio?.slice(0,5), e.hora_fim?.slice(0,5), e.intervalo_minutos)} slots</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {escalas.length === 0 && <div className="empty">Nenhuma escala configurada. Solicite ao administrador.</div>}
                {escalas.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 10, background: e.ativo ? '#fff' : 'var(--bg)', opacity: e.ativo ? 1 : 0.6 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: e.ativo ? 'var(--p3)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: e.ativo ? 'var(--p)' : 'var(--muted)' }}>{DIAS_CURTO[e.dia_semana]}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{DIAS[e.dia_semana]}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{e.hora_inicio?.slice(0,5)} – {e.hora_fim?.slice(0,5)} · {e.intervalo_minutos} min · {calcHorarios(e.hora_inicio?.slice(0,5), e.hora_fim?.slice(0,5), e.intervalo_minutos)} horários disponíveis</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: e.ativo ? 'var(--sbg)' : 'var(--dbg)', color: e.ativo ? 'var(--success)' : 'var(--danger)' }}>{e.ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--wbg)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warn)' }}>
                ℹ️ Para alterar sua escala, solicite ao administrador ou coordenador.
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal escala */}
      {modalEscala !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalEscala(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <h2>{modalEscala === 'novo' ? 'Novo Horário' : 'Editar Horário'}</h2>
            {estSelecionado && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Estagiário: <strong>{estSelecionado.nome}</strong></p>}
            <div className="form-grid">
              <div className="fld" style={{ gridColumn: '1/-1' }}>
                <label>Dia da semana *</label>
                <select value={formEscala.dia_semana} onChange={e => setFormEscala(p => ({ ...p, dia_semana: Number(e.target.value) }))}>
                  {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Hora início *</label>
                <input type="time" value={formEscala.hora_inicio} onChange={e => setFormEscala(p => ({ ...p, hora_inicio: e.target.value }))} />
              </div>
              <div className="fld">
                <label>Hora fim *</label>
                <input type="time" value={formEscala.hora_fim} onChange={e => setFormEscala(p => ({ ...p, hora_fim: e.target.value }))} />
              </div>
              <div className="fld">
                <label>Intervalo (minutos) *</label>
                <select value={formEscala.intervalo_minutos} onChange={e => setFormEscala(p => ({ ...p, intervalo_minutos: Number(e.target.value) }))}>
                  {[30, 45, 50, 60, 90].map(v => <option key={v} value={v}>{v} min</option>)}
                </select>
              </div>
              <div className="fld">
                <label>Status</label>
                <select value={formEscala.ativo ? 'true' : 'false'} onChange={e => setFormEscala(p => ({ ...p, ativo: e.target.value === 'true' }))}>
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>
            </div>

            {/* Preview de horários */}
            {formEscala.hora_inicio && formEscala.hora_fim && (
              <div style={{ background: 'var(--p3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--p)', marginBottom: 16 }}>
                📊 Gera <strong>{calcHorarios(formEscala.hora_inicio, formEscala.hora_fim, formEscala.intervalo_minutos)} horários</strong> disponíveis neste dia
              </div>
            )}

            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModalEscala(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEscala} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}