import { useEffect, useState, useRef } from 'react'
import { LOGO_SRC } from '../lib/logoClinica'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Pages.css'
import './Chat.css'

function tocarSomNotificacao() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const tocar = (freq, inicio, duracao, volume = 0.3) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + inicio)
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + inicio + 0.01)
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + inicio + duracao)
      osc.start(ctx.currentTime + inicio)
      osc.stop(ctx.currentTime + inicio + duracao + 0.05)
    }
    tocar(880, 0, 0.12, 0.25)
    tocar(1100, 0.14, 0.18, 0.2)
  } catch (e) {}
}

function tocarSomEnvio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 600
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.15)
  } catch (e) {}
}

const RESPOSTAS_RAPIDAS = [
  '✅ Sua consulta está confirmada!',
  '⏰ Lembrete: você tem consulta amanhã.',
  '📋 Por favor, traga seus documentos de identificação.',
  '🔄 Precisamos reagendar. Qual horário é melhor para você?',
  '❌ Infelizmente precisamos cancelar esta consulta.',
  '📞 Por favor, entre em contato pelo telefone da clínica.',
  '🏥 Bem-vindo(a) à Clínica Vida+! Como podemos ajudar?',
]

const ROLE_LABEL = { admin: 'Administrador', coordenador: 'Coordenador', estagiario: 'Estagiário', recepcionista: 'Recepcionista' }
const ROLE_COLOR = { admin: '#0047AB', coordenador: '#7c3aed', estagiario: '#059669', recepcionista: '#d97706' }

export default function Chat() {
  const { profile } = useAuth()
  const toast = useToast()

  // ── Aba: 'pacientes' | 'equipe'
  const [aba, setAba] = useState('pacientes')

  // ── Chat Pacientes
  const [conversas, setConversas] = useState([])
  const [ativa, setAtiva] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [showRapidas, setShowRapidas] = useState(false)
  const [pacienteInfo, setPacienteInfo] = useState(null)

  // ── Chat Equipe (interno)
  const [equipe, setEquipe] = useState([])          // lista de funcionários
  const [funcAtivo, setFuncAtivo] = useState(null)  // funcionário selecionado
  const [msgsInternas, setMsgsInternas] = useState([])
  const [textoInterno, setTextoInterno] = useState('')
  const [enviandoInt, setEnviandoInt] = useState(false)
  const [buscaEquipe, setBuscaEquipe] = useState('')
  const [unreadInterno, setUnreadInterno] = useState({}) // { userId: count }

  const bottomRef = useRef(null)
  const bottomIntRef = useRef(null)
  const fileRef = useRef(null)
  const ativaRef = useRef(null)
  const funcAtivoRef = useRef(null)

  useEffect(() => { ativaRef.current = ativa }, [ativa])
  useEffect(() => { funcAtivoRef.current = funcAtivo }, [funcAtivo])

  // ── Init
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    fetchConversas()
    fetchEquipe()
    fetchUnreadInterno()

    // Realtime pacientes
    const globalCh = supabase.channel('chat-global-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, payload => {
        if (ativaRef.current?.id === payload.new.paciente_id) {
          setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
        if (payload.new.remetente === 'paciente') {
          tocarSomNotificacao()
          notificarBrowser('Nova mensagem de paciente', payload.new.conteudo || '📎 Anexo')
          fetchConversas()
        }
      }).subscribe()

    // Realtime chat interno
    const internoCh = supabase.channel('chat-interno-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_interno' }, payload => {
        const msg = payload.new
        // Se for para mim
        if (msg.destinatario_id === profile?.id) {
          if (funcAtivoRef.current?.id === msg.remetente_id) {
            setMsgsInternas(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
            setTimeout(() => bottomIntRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
            supabase.from('chat_interno').update({ lida: true }).eq('id', msg.id)
          } else {
            tocarSomNotificacao()
            setUnreadInterno(prev => ({ ...prev, [msg.remetente_id]: (prev[msg.remetente_id] || 0) + 1 }))
            notificarBrowser('Mensagem da equipe', msg.conteudo || '')
          }
          fetchUnreadInterno()
        }
        // Se eu enviei e está na conversa ativa
        if (msg.remetente_id === profile?.id && funcAtivoRef.current?.id === msg.destinatario_id) {
          setMsgsInternas(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
          setTimeout(() => bottomIntRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      }).subscribe()

    return () => { supabase.removeChannel(globalCh); supabase.removeChannel(internoCh) }
  }, [profile?.id])

  useEffect(() => {
    if (!ativa) return
    fetchMensagens(ativa.id)
    marcarLidas(ativa.id)
    fetchPacienteInfo(ativa.id)
  }, [ativa])

  useEffect(() => {
    if (!funcAtivo) return
    fetchMsgsInternas(funcAtivo.id)
    marcarLindasInternas(funcAtivo.id)
  }, [funcAtivo])

  // ── Funções pacientes
  async function fetchPacienteInfo(pacienteId) {
    const { data } = await supabase.from('consultas')
      .select('data, hora, tipo, status, sala:salas(nome), estagiario:profiles(nome)')
      .eq('paciente_id', pacienteId)
      .not('status', 'in', '("cancelada","realizada")')
      .order('data').limit(1).maybeSingle()
    setPacienteInfo(data || null)
  }

  function notificarBrowser(titulo, msg) {
    if (Notification.permission === 'granted') {
      new Notification(`💬 ${titulo}`, { body: msg, icon: '/favicon.ico' })
    }
  }

  async function fetchConversas() {
    const { data: msgs } = await supabase.from('mensagens')
      .select('paciente_id, paciente:pacientes(id, nome), lida, remetente, conteudo, anexo_tipo, criado_em')
      .order('criado_em', { ascending: false })
    const map = {}
    msgs?.forEach(m => {
      const pid = m.paciente_id
      if (!map[pid]) {
        map[pid] = { ...m.paciente, unread: 0, ultima_msg: m.conteudo || (m.anexo_tipo?.startsWith('image/') ? '🖼️ Imagem' : '📄 Arquivo'), ultima_hora: m.criado_em }
      }
      if (!m.lida && m.remetente === 'paciente') map[pid].unread++
    })
    setConversas(Object.values(map))
  }

  async function fetchMensagens(pacienteId) {
    const { data } = await supabase.from('mensagens').select('*').eq('paciente_id', pacienteId).order('criado_em')
    setMensagens(data || [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function marcarLidas(pacienteId) {
    await supabase.from('mensagens').update({ lida: true }).eq('paciente_id', pacienteId).eq('remetente', 'paciente')
    fetchConversas()
  }

  async function handleEnviar() {
    if (!texto.trim() || !ativa || enviando) return
    const conteudo = texto.trim()
    setTexto(''); setEnviando(true); tocarSomEnvio()
    const msgTemp = { id: 'temp-' + Date.now(), paciente_id: ativa.id, remetente: 'clinica', conteudo, lida: true, criado_em: new Date().toISOString() }
    setMensagens(prev => [...prev, msgTemp])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    const { data } = await supabase.from('mensagens').insert([{ paciente_id: ativa.id, remetente: 'clinica', conteudo, lida: true }]).select().single()
    if (data) setMensagens(prev => prev.map(m => m.id === msgTemp.id ? data : m))
    setEnviando(false)
  }

  async function handleAnexo(e) {
    const file = e.target.files[0]
    if (!file || !ativa) return
    if (file.type.startsWith('audio/')) { toast.error('Envio de áudio não permitido.'); return }
    setEnviando(true)
    const ext = file.name.split('.').pop()
    const path = `${ativa.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-anexos').upload(path, file)
    if (error) { toast.error('Erro ao enviar arquivo.'); setEnviando(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{ paciente_id: ativa.id, remetente: 'clinica', conteudo: file.name, anexo_url: urlData.publicUrl, anexo_tipo: file.type, anexo_nome: file.name, lida: true }])
    e.target.value = ''; setEnviando(false)
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }

  // ── Funções equipe (interno)
  async function fetchEquipe() {
    const { data } = await supabase.from('profiles').select('id, nome, tipo, codigo').neq('id', profile?.id).order('nome')
    setEquipe(data || [])
  }

  async function fetchUnreadInterno() {
    if (!profile?.id) return
    const { data } = await supabase.from('chat_interno')
      .select('remetente_id').eq('destinatario_id', profile.id).eq('lida', false)
    const counts = {}
    data?.forEach(m => { counts[m.remetente_id] = (counts[m.remetente_id] || 0) + 1 })
    setUnreadInterno(counts)
  }

  async function fetchMsgsInternas(outroId) {
    const { data } = await supabase.from('chat_interno')
      .select('*')
      .or(`and(remetente_id.eq.${profile?.id},destinatario_id.eq.${outroId}),and(remetente_id.eq.${outroId},destinatario_id.eq.${profile?.id})`)
      .order('criado_em')
    setMsgsInternas(data || [])
    setTimeout(() => bottomIntRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function marcarLindasInternas(outroId) {
    await supabase.from('chat_interno').update({ lida: true }).eq('remetente_id', outroId).eq('destinatario_id', profile?.id).eq('lida', false)
    setUnreadInterno(prev => { const n = { ...prev }; delete n[outroId]; return n })
  }

  async function handleEnviarInterno() {
    if (!textoInterno.trim() || !funcAtivo || enviandoInt) return
    const conteudo = textoInterno.trim()
    setTextoInterno(''); setEnviandoInt(true); tocarSomEnvio()
    await supabase.from('chat_interno').insert([{ remetente_id: profile.id, destinatario_id: funcAtivo.id, conteudo }])
    setEnviandoInt(false)
  }

  function handleKeyInterno(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviarInterno() } }

  // ── Helpers visuais
  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

  function iniciais(nome) {
    if (!nome) return '?'
    const p = nome.trim().split(' ')
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase()
  }

  function corAvatar(nome) {
    const cores = ['#0047AB', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2']
    let hash = 0
    for (let c of (nome || '')) hash += c.charCodeAt(0)
    return cores[hash % cores.length]
  }

  function renderAnexo(m) {
    if (!m.anexo_url) return null
    if (m.anexo_tipo?.startsWith('image/')) {
      return <a href={m.anexo_url} target="_blank" rel="noreferrer"><img src={m.anexo_url} alt={m.anexo_nome} className="msg-img" /></a>
    }
    return <a href={m.anexo_url} target="_blank" rel="noreferrer" className="msg-doc"><span className="msg-doc-icon">📄</span><span className="msg-doc-nome">{m.anexo_nome}</span></a>
  }

  const conversasFiltradas = conversas
    .filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (b.unread || 0) - (a.unread || 0) || new Date(b.ultima_hora || 0) - new Date(a.ultima_hora || 0))

  const equipeFiltrada = equipe.filter(f => f.nome?.toLowerCase().includes(buscaEquipe.toLowerCase()))
  const totalUnreadInt = Object.values(unreadInterno).reduce((s, v) => s + v, 0)
  const lastDateDisplay = { current: null }
  const lastDateDisplayInt = { current: null }

  return (
    <div className="chat-page">
      {/* ── Sidebar esquerda ── */}
      <div className="chat-list">

        {/* Abas Pacientes / Equipe */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {[
            { key: 'pacientes', label: '🧑‍⚕️ Pacientes', badge: conversas.filter(c => c.unread > 0).length },
            { key: 'equipe',    label: '👥 Equipe',     badge: totalUnreadInt },
          ].map(tab => (
            <button key={tab.key} onClick={() => { setAba(tab.key); setAtiva(null); setFuncAtivo(null) }}
              style={{ flex: 1, padding: '12px 8px', fontSize: 12, fontWeight: aba === tab.key ? 700 : 500, cursor: 'pointer', border: 'none', background: 'none', color: aba === tab.key ? 'var(--p)' : 'var(--muted)', borderBottom: aba === tab.key ? '2px solid var(--p)' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
              {tab.label}
              {tab.badge > 0 && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10 }}>{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Lista de conversas — Pacientes */}
        {aba === 'pacientes' && (
          <>
            <div className="chat-search-wrap">
              <input className="chat-search" placeholder="Buscar paciente..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {conversasFiltradas.length === 0 && <div className="empty" style={{ padding: 20 }}>Nenhuma conversa.</div>}
            {conversasFiltradas.map(c => (
              <div key={c.id} className={`chat-list-item${ativa?.id === c.id ? ' active' : ''}`}
                onClick={() => { setAtiva(c); fetchMensagens(c.id); marcarLidas(c.id) }}>
                <div className="chat-av" style={{ background: corAvatar(c.nome) }}>{iniciais(c.nome)}</div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">{c.nome}</span>
                    <span className="chat-item-hora">{c.ultima_hora ? fmtHora(c.ultima_hora) : ''}</span>
                  </div>
                  <div className="chat-item-bottom">
                    <span className="chat-item-sub">{c.ultima_msg}</span>
                    {c.unread > 0 && <span className="unread">{c.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Lista de funcionários — Equipe */}
        {aba === 'equipe' && (
          <>
            <div className="chat-search-wrap">
              <input className="chat-search" placeholder="Buscar funcionário..." value={buscaEquipe} onChange={e => setBuscaEquipe(e.target.value)} />
            </div>
            {equipeFiltrada.length === 0 && <div className="empty" style={{ padding: 20 }}>Nenhum funcionário.</div>}
            {equipeFiltrada.map(f => {
              const unread = unreadInterno[f.id] || 0
              return (
                <div key={f.id} className={`chat-list-item${funcAtivo?.id === f.id ? ' active' : ''}`}
                  onClick={() => { setFuncAtivo(f); fetchMsgsInternas(f.id); marcarLindasInternas(f.id) }}>
                  <div className="chat-av" style={{ background: ROLE_COLOR[f.tipo] || '#64748b' }}>{iniciais(f.nome)}</div>
                  <div className="chat-item-info">
                    <div className="chat-item-top">
                      <span className="chat-item-name">{f.nome}</span>
                      {unread > 0 && <span className="unread">{unread}</span>}
                    </div>
                    <div className="chat-item-bottom">
                      <span className="chat-item-sub" style={{ color: ROLE_COLOR[f.tipo], fontWeight: 600, fontSize: 11 }}>
                        {ROLE_LABEL[f.tipo] || f.tipo}{f.codigo ? ` · ${f.codigo}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* ── Janela direita ── */}
      <div className="chat-window">

        {/* ── CHAT PACIENTES ── */}
        {aba === 'pacientes' && (
          !ativa ? (
            <div className="chat-empty">
              <div style={{ fontSize: 48 }}>🧑‍⚕️</div>
              <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 12 }}>Selecione um paciente para enviar mensagem</div>
            </div>
          ) : (
            <>
              <div className="chat-win-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                  <div className="chat-av-lg" style={{ background: corAvatar(ativa.nome) }}>{iniciais(ativa.nome)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="chat-win-nome" style={{ fontSize: 16 }}>{ativa.nome}</div>
                    <div className="chat-win-status" style={{ fontSize: 12 }}>
                      {pacienteInfo
                        ? `📅 Próxima: ${new Date(pacienteInfo.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${pacienteInfo.hora?.slice(0, 5)} — ${pacienteInfo.tipo} · ${pacienteInfo.sala?.nome || '—'}`
                        : '● Nenhuma consulta pendente'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="chat-messages">
                {mensagens.map(m => {
                  const msgDate = fmtData(m.criado_em)
                  const showDate = msgDate !== lastDateDisplay.current
                  lastDateDisplay.current = msgDate
                  const isClinica = m.remetente === 'clinica'
                  return (
                    <div key={m.id}>
                      {showDate && <div className="chat-date-divider"><span>{msgDate}</span></div>}
                      <div className={`msg-row ${isClinica ? 'me' : 'them'}`}>
                        {!isClinica && <div className="msg-av" style={{ background: corAvatar(ativa.nome) }}>{iniciais(ativa.nome)}</div>}
                        <div className="msg-col">
                          <div className="msg-bubble">
                            {renderAnexo(m)}
                            {m.conteudo && <span>{m.conteudo}</span>}
                          </div>
                          <div className="msg-time">{fmtHora(m.criado_em)}</div>
                        </div>
                        {isClinica && <div className="msg-av clinica-av"><img src={LOGO_SRC} alt="Clínica" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /></div>}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {showRapidas && (
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', background: 'var(--bg)' }}>
                  {RESPOSTAS_RAPIDAS.map((r, i) => (
                    <button key={i} type="button" onClick={() => { setTexto(r); setShowRapidas(false) }}
                      style={{ padding: '5px 11px', fontSize: 12, borderRadius: 16, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <div className="chat-input-bar">
                <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleAnexo} />
                <button className="btn-clip" onClick={() => fileRef.current?.click()} disabled={enviando} title="Anexar">📎</button>
                <button className="btn-clip" onClick={() => setShowRapidas(r => !r)} title="Respostas rápidas" style={{ fontSize: 16 }}>⚡</button>
                <textarea className="chat-textarea" placeholder="Digite sua mensagem ou use ⚡ para respostas rápidas..." value={texto}
                  onChange={e => setTexto(e.target.value)} onKeyDown={handleKey} rows={1} disabled={enviando} />
                <button className="btn-send" onClick={handleEnviar} disabled={!texto.trim() || enviando}>➤</button>
              </div>
            </>
          )
        )}

        {/* ── CHAT EQUIPE (INTERNO) ── */}
        {aba === 'equipe' && (
          !funcAtivo ? (
            <div className="chat-empty">
              <div style={{ fontSize: 48 }}>👥</div>
              <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 12 }}>Selecione um colega para conversar</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Chat interno entre funcionários da clínica</div>
            </div>
          ) : (
            <>
              <div className="chat-win-header" style={{ padding: '14px 18px' }}>
                <div className="chat-av-lg" style={{ background: ROLE_COLOR[funcAtivo.tipo] || '#64748b' }}>
                  {iniciais(funcAtivo.nome)}
                </div>
                <div>
                  <div className="chat-win-nome">{funcAtivo.nome}</div>
                  <div className="chat-win-status" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: ROLE_COLOR[funcAtivo.tipo], color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
                      {ROLE_LABEL[funcAtivo.tipo] || funcAtivo.tipo}
                    </span>
                    {funcAtivo.codigo && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{funcAtivo.codigo}</span>}
                  </div>
                </div>
              </div>

              <div className="chat-messages">
                {msgsInternas.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                    Nenhuma mensagem ainda. Diga olá!
                  </div>
                )}
                {msgsInternas.map(m => {
                  const msgDate = fmtData(m.criado_em)
                  const showDate = msgDate !== lastDateDisplayInt.current
                  lastDateDisplayInt.current = msgDate
                  const isMe = m.remetente_id === profile?.id
                  return (
                    <div key={m.id}>
                      {showDate && <div className="chat-date-divider"><span>{msgDate}</span></div>}
                      <div className={`msg-row ${isMe ? 'me' : 'them'}`}>
                        {!isMe && (
                          <div className="msg-av" style={{ background: ROLE_COLOR[funcAtivo.tipo] || '#64748b' }}>
                            {iniciais(funcAtivo.nome)}
                          </div>
                        )}
                        <div className="msg-col">
                          <div className="msg-bubble"><span>{m.conteudo}</span></div>
                          <div className="msg-time">{fmtHora(m.criado_em)}{isMe && <span style={{ marginLeft: 4 }}>{m.lida ? ' ✓✓' : ' ✓'}</span>}</div>
                        </div>
                        {isMe && (
                          <div className="msg-av clinica-av" style={{ background: ROLE_COLOR[profile?.tipo] || '#0047AB', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>
                            {iniciais(profile?.nome)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomIntRef} />
              </div>

              <div className="chat-input-bar">
                <textarea className="chat-textarea" placeholder={`Mensagem para ${funcAtivo.nome.split(' ')[0]}...`}
                  value={textoInterno} onChange={e => setTextoInterno(e.target.value)} onKeyDown={handleKeyInterno} rows={1} disabled={enviandoInt} />
                <button className="btn-send" onClick={handleEnviarInterno} disabled={!textoInterno.trim() || enviandoInt}>➤</button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
