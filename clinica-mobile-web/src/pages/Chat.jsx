import { useEffect, useState, useRef } from 'react'
import { LOGO_SRC } from '../lib/logoClinica'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
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

// ===================== CHAT PACIENTES =====================
function ChatPacientes({ profile }) {
  const [conversas, setConversas] = useState([])
  const [ativa, setAtiva] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [mobileAberto, setMobileAberto] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const ativaRef = useRef(null)

  useEffect(() => { ativaRef.current = ativa }, [ativa])

  useEffect(() => {
    fetchConversas()
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    const globalCh = supabase.channel('chat-pac-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, payload => {
        if (ativaRef.current?.id === payload.new.paciente_id) {
          setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
        if (payload.new.remetente === 'paciente') {
          tocarSomNotificacao()
          fetchConversas()
        }
      }).subscribe()
    return () => supabase.removeChannel(globalCh)
  }, [])

  useEffect(() => {
    if (!ativa) return
    fetchMensagens(ativa.id)
    marcarLidas(ativa.id)
  }, [ativa])

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
    setTexto('')
    setEnviando(true)
    tocarSomEnvio()
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
    if (file.type.startsWith('audio/')) { alert('Envio de áudio não permitido.'); return }
    setEnviando(true)
    const ext = file.name.split('.').pop()
    const path = `${ativa.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-anexos').upload(path, file)
    if (error) { alert('Erro ao enviar arquivo.'); setEnviando(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{ paciente_id: ativa.id, remetente: 'clinica', conteudo: file.name, anexo_url: urlData.publicUrl, anexo_tipo: file.type, anexo_nome: file.name, lida: true }])
    e.target.value = ''
    setEnviando(false)
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }
  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  function iniciais(nome) { if (!nome) return '?'; const p = nome.trim().split(' '); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase() }
  function corAvatar(nome) { const cores = ['#0047AB','#7C3AED','#059669','#DC2626','#D97706','#0891B2']; let h = 0; for (let c of (nome||'')) h += c.charCodeAt(0); return cores[h % cores.length] }

  function renderAnexo(m) {
    if (!m.anexo_url) return null
    if (m.anexo_tipo?.startsWith('image/')) return <a href={m.anexo_url} target="_blank" rel="noreferrer"><img src={m.anexo_url} alt={m.anexo_nome} className="msg-img" /></a>
    return <a href={m.anexo_url} target="_blank" rel="noreferrer" className="msg-doc"><span className="msg-doc-icon">📄</span><span className="msg-doc-nome">{m.anexo_nome}</span></a>
  }

  const conversasFiltradas = conversas.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()))
  const lastDateDisplay = { current: null }

  return (
    <div className="chat-page">
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Pacientes</h3>
          <span className="chat-count">{conversas.filter(c => c.unread > 0).length} não lidas</span>
        </div>
        <div className="chat-search-wrap">
          <input className="chat-search" placeholder="Buscar paciente..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {conversasFiltradas.length === 0 && <div className="empty" style={{ padding: 20 }}>Nenhuma conversa.</div>}
        {conversasFiltradas.map(c => (
          <div key={c.id} className={`chat-list-item${ativa?.id === c.id ? ' active' : ''}`}
            onClick={() => { setAtiva(c); fetchMensagens(c.id); marcarLidas(c.id); setMobileAberto(true) }}>
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
      </div>

      <div className={`chat-window${mobileAberto ? ' mobile-open' : ''}`}>
        {!ativa ? (
          <div className="chat-empty">
            <div style={{ fontSize: 48 }}>💬</div>
            <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 12 }}>Selecione uma conversa</div>
          </div>
        ) : (
          <>
            <div className="chat-win-header">
              <button className="btn-voltar-chat" onClick={() => setMobileAberto(false)}>←</button>
              <div className="chat-av-lg" style={{ background: '#0047AB', padding: 4 }}>
                <img src={LOGO_SRC} alt="Clínica Vida+" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              </div>
              <div>
                <div className="chat-win-nome">Clínica Vida+</div>
                <div className="chat-win-status">● {ativa.nome}</div>
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
                        <div className="msg-bubble">{renderAnexo(m)}{m.conteudo && <span>{m.conteudo}</span>}</div>
                        <div className="msg-time">{fmtHora(m.criado_em)}</div>
                      </div>
                      {isClinica && <div className="msg-av clinica-av"><img src={LOGO_SRC} alt="Clínica" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /></div>}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className="chat-input-bar">
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleAnexo} />
              <button className="btn-clip" onClick={() => fileRef.current?.click()} disabled={enviando}>📎</button>
              <textarea className="chat-textarea" placeholder="Digite sua mensagem..." value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={handleKey} rows={1} disabled={enviando} />
              <button className="btn-send" onClick={handleEnviar} disabled={!texto.trim() || enviando}>➤</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ===================== CHAT EQUIPE =====================
function ChatEquipe({ profile }) {
  const [conversas, setConversas] = useState([])
  const [ativa, setAtiva] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [mobileAberto, setMobileAberto] = useState(false)
  const [modalNovaConversa, setModalNovaConversa] = useState(false)
  const [modalNovoGrupo, setModalNovoGrupo] = useState(false)
  const [profissionais, setProfissionais] = useState([])
  const [buscaProf, setBuscaProf] = useState('')
  const [profSelecionado, setProfSelecionado] = useState(null)
  const [nomeGrupo, setNomeGrupo] = useState('')
  const [membrosGrupo, setMembrosGrupo] = useState([])
  const bottomRef = useRef(null)
  const ativaRef = useRef(null)

  useEffect(() => { ativaRef.current = ativa }, [ativa])

  useEffect(() => {
    fetchConversas()
    fetchProfissionais()
    const ch = supabase.channel('chat-equipe-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens_internas' }, payload => {
        if (ativaRef.current?.id === payload.new.conversa_id) {
          setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
        if (payload.new.remetente_id !== profile.id) {
          tocarSomNotificacao()
          fetchConversas()
        }
      }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => {
    if (!ativa) return
    fetchMensagens(ativa.id)
    marcarLidas(ativa.id)
  }, [ativa])

  async function fetchProfissionais() {
    const { data } = await supabase.from('profiles').select('id, nome, codigo, tipo').neq('id', profile.id).order('nome')
    setProfissionais(data || [])
  }

  async function fetchConversas() {
    const { data: participacoes } = await supabase
      .from('chat_participantes')
      .select('conversa_id, conversa:chat_conversas(id, tipo, nome, criado_em)')
      .eq('user_id', profile.id)

    if (!participacoes?.length) { setConversas([]); return }

    const conversasComInfo = await Promise.all(
      participacoes.map(async p => {
        const conv = p.conversa
        if (!conv) return null

        const { data: ultimaMsg } = await supabase
          .from('chat_mensagens_internas')
          .select('conteudo, criado_em, remetente_id')
          .eq('conversa_id', conv.id)
          .order('criado_em', { ascending: false })
          .limit(1)
          .single()

        const { data: participantes } = await supabase
          .from('chat_participantes')
          .select('user_id, perfil:profiles(id, nome, codigo)')
          .eq('conversa_id', conv.id)

        const outroParticipante = conv.tipo === 'individual'
          ? participantes?.find(p => p.user_id !== profile.id)?.perfil
          : null

        const { count: naoLidas } = await supabase
          .from('chat_mensagens_internas')
          .select('id', { count: 'exact' })
          .eq('conversa_id', conv.id)
          .not('lida_por', 'cs', `{${profile.id}}`)
          .neq('remetente_id', profile.id)

        return {
          ...conv,
          nomeExibido: conv.tipo === 'grupo' ? conv.nome : outroParticipante?.nome || 'Desconhecido',
          codigoExibido: conv.tipo === 'individual' ? outroParticipante?.codigo : null,
          ultimaMsg: ultimaMsg?.conteudo || '',
          ultimaHora: ultimaMsg?.criado_em || conv.criado_em,
          unread: naoLidas || 0,
          participantes: participantes?.map(p => p.perfil) || [],
          isGrupo: conv.tipo === 'grupo',
        }
      })
    )

    const validas = conversasComInfo.filter(Boolean).sort((a, b) => new Date(b.ultimaHora) - new Date(a.ultimaHora))
    setConversas(validas)
  }

  async function fetchMensagens(conversaId) {
    const { data } = await supabase
      .from('chat_mensagens_internas')
      .select('*, remetente:profiles(id, nome, codigo)')
      .eq('conversa_id', conversaId)
      .order('criado_em')
    setMensagens(data || [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function marcarLidas(conversaId) {
    const { data: msgs } = await supabase
      .from('chat_mensagens_internas')
      .select('id, lida_por')
      .eq('conversa_id', conversaId)
      .not('lida_por', 'cs', `{${profile.id}}`)
      .neq('remetente_id', profile.id)

    for (const m of (msgs || [])) {
      await supabase.from('chat_mensagens_internas')
        .update({ lida_por: [...(m.lida_por || []), profile.id] })
        .eq('id', m.id)
    }
    fetchConversas()
  }

  async function criarConversa1a1() {
    if (!profSelecionado) return
    const { data: existentes } = await supabase
      .from('chat_participantes')
      .select('conversa_id')
      .eq('user_id', profile.id)

    const idsConversas = existentes?.map(e => e.conversa_id) || []

    for (const cid of idsConversas) {
      const { data: conv } = await supabase.from('chat_conversas').select('tipo').eq('id', cid).single()
      if (conv?.tipo !== 'individual') continue
      const { data: parts } = await supabase.from('chat_participantes').select('user_id').eq('conversa_id', cid)
      const ids = parts?.map(p => p.user_id) || []
      if (ids.includes(profSelecionado.id) && ids.includes(profile.id)) {
        const conv = conversas.find(c => c.id === cid)
        if (conv) { setAtiva(conv); setMobileAberto(true) }
        setModalNovaConversa(false)
        return
      }
    }

    const { data: novaConv } = await supabase.from('chat_conversas').insert([{ tipo: 'individual', criado_por: profile.id }]).select().single()
    await supabase.from('chat_participantes').insert([
      { conversa_id: novaConv.id, user_id: profile.id },
      { conversa_id: novaConv.id, user_id: profSelecionado.id },
    ])
    setModalNovaConversa(false)
    setProfSelecionado(null)
    setBuscaProf('')
    await fetchConversas()
    const novaConvObj = { ...novaConv, nomeExibido: profSelecionado.nome, ultimaMsg: '', ultimaHora: novaConv.criado_em, unread: 0, isGrupo: false }
    setAtiva(novaConvObj)
    setMobileAberto(true)
  }

  async function criarGrupo() {
    if (!nomeGrupo.trim() || membrosGrupo.length === 0) return
    const { data: novaConv } = await supabase.from('chat_conversas').insert([{ tipo: 'grupo', nome: nomeGrupo.trim(), criado_por: profile.id }]).select().single()
    const participantesInsert = [
      { conversa_id: novaConv.id, user_id: profile.id },
      ...membrosGrupo.map(m => ({ conversa_id: novaConv.id, user_id: m.id }))
    ]
    await supabase.from('chat_participantes').insert(participantesInsert)
    setModalNovoGrupo(false)
    setNomeGrupo('')
    setMembrosGrupo([])
    fetchConversas()
  }

  async function handleEnviar() {
    if (!texto.trim() || !ativa || enviando) return
    const conteudo = texto.trim()
    setTexto('')
    setEnviando(true)
    tocarSomEnvio()
    const msgTemp = { id: 'temp-' + Date.now(), conversa_id: ativa.id, remetente_id: profile.id, conteudo, lida_por: [profile.id], criado_em: new Date().toISOString(), remetente: profile }
    setMensagens(prev => [...prev, msgTemp])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    const { data } = await supabase.from('chat_mensagens_internas').insert([{ conversa_id: ativa.id, remetente_id: profile.id, conteudo, lida_por: [profile.id] }]).select('*, remetente:profiles(id, nome, codigo)').single()
    if (data) setMensagens(prev => prev.map(m => m.id === msgTemp.id ? data : m))
    setEnviando(false)
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }
  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  function iniciais(nome) { if (!nome) return '?'; const p = nome.trim().split(' '); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].slice(0,2).toUpperCase() }
  function corAvatar(nome) { const cores = ['#0047AB','#7C3AED','#059669','#DC2626','#D97706','#0891B2']; let h = 0; for (let c of (nome||'')) h += c.charCodeAt(0); return cores[h % cores.length] }

  const conversasFiltradas = conversas.filter(c => {
    const q = busca.toLowerCase()
    return c.nomeExibido?.toLowerCase().includes(q) || c.codigoExibido?.toLowerCase().includes(q)
  })

  const profsFiltrados = profissionais.filter(p => {
    const q = buscaProf.toLowerCase()
    return p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q)
  })

  const lastDateDisplay = { current: null }

  const roleLabel = { admin: 'Admin', coordenador: 'Coord.', estagiario: 'Estag.', recepcionista: 'Recep.' }

  return (
    <div className="chat-page">
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Equipe</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setModalNovaConversa(true)} style={{ background: 'var(--p)', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Chat</button>
            <button onClick={() => setModalNovoGrupo(true)} style={{ background: 'var(--p3)', color: 'var(--p)', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Grupo</button>
          </div>
        </div>
        <div className="chat-search-wrap">
          <input className="chat-search" placeholder="Buscar por nome ou código..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        {conversasFiltradas.length === 0 && <div className="empty" style={{ padding: 20 }}>Nenhuma conversa. Clique em + Chat para começar!</div>}
        {conversasFiltradas.map(c => (
          <div key={c.id} className={`chat-list-item${ativa?.id === c.id ? ' active' : ''}`}
            onClick={() => { setAtiva(c); fetchMensagens(c.id); marcarLidas(c.id); setMobileAberto(true) }}>
            <div className="chat-av" style={{ background: c.isGrupo ? '#7C3AED' : corAvatar(c.nomeExibido), fontSize: c.isGrupo ? 18 : 13 }}>
              {c.isGrupo ? '👥' : iniciais(c.nomeExibido)}
            </div>
            <div className="chat-item-info">
              <div className="chat-item-top">
                <span className="chat-item-name">{c.nomeExibido}</span>
                <span className="chat-item-hora">{c.ultimaHora ? fmtHora(c.ultimaHora) : ''}</span>
              </div>
              <div className="chat-item-bottom">
                <span className="chat-item-sub">{c.ultimaMsg || (c.isGrupo ? `${c.participantes?.length} membros` : 'Nova conversa')}</span>
                {c.unread > 0 && <span className="unread">{c.unread}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`chat-window${mobileAberto ? ' mobile-open' : ''}`}>
        {!ativa ? (
          <div className="chat-empty">
            <div style={{ fontSize: 48 }}>👥</div>
            <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 12 }}>Selecione uma conversa ou crie uma nova</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="btn-primary" onClick={() => setModalNovaConversa(true)}>+ Nova conversa</button>
              <button className="btn-outline" onClick={() => setModalNovoGrupo(true)}>+ Novo grupo</button>
            </div>
          </div>
        ) : (
          <>
            <div className="chat-win-header">
              <button className="btn-voltar-chat" onClick={() => setMobileAberto(false)}>←</button>
              <div className="chat-av-lg" style={{ background: ativa.isGrupo ? '#7C3AED' : corAvatar(ativa.nomeExibido), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: ativa.isGrupo ? 20 : 13, color: '#fff', fontWeight: 700 }}>
                {ativa.isGrupo ? '👥' : iniciais(ativa.nomeExibido)}
              </div>
              <div>
                <div className="chat-win-nome">{ativa.nomeExibido}</div>
                <div className="chat-win-status">
                  {ativa.isGrupo ? `${ativa.participantes?.length} membros` : `● ${ativa.codigoExibido || 'Online'}`}
                </div>
              </div>
            </div>
            <div className="chat-messages">
              {mensagens.map(m => {
                const msgDate = fmtData(m.criado_em)
                const showDate = msgDate !== lastDateDisplay.current
                lastDateDisplay.current = msgDate
                const isMe = m.remetente_id === profile.id
                const nomeRem = m.remetente?.nome || 'Desconhecido'
                return (
                  <div key={m.id}>
                    {showDate && <div className="chat-date-divider"><span>{msgDate}</span></div>}
                    <div className={`msg-row ${isMe ? 'me' : 'them'}`}>
                      {!isMe && <div className="msg-av" style={{ background: corAvatar(nomeRem) }}>{iniciais(nomeRem)}</div>}
                      <div className="msg-col">
                        {!isMe && ativa.isGrupo && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, fontWeight: 600 }}>{nomeRem}</div>}
                        <div className="msg-bubble">{m.conteudo}</div>
                        <div className="msg-time">{fmtHora(m.criado_em)}</div>
                      </div>
                      {isMe && <div className="msg-av" style={{ background: corAvatar(profile.nome) }}>{iniciais(profile.nome)}</div>}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className="chat-input-bar">
              <textarea className="chat-textarea" placeholder="Digite sua mensagem..." value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={handleKey} rows={1} disabled={enviando} />
              <button className="btn-send" onClick={handleEnviar} disabled={!texto.trim() || enviando}>➤</button>
            </div>
          </>
        )}
      </div>

      {/* Modal nova conversa 1a1 */}
      {modalNovaConversa && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovaConversa(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2>Nova Conversa</h2>
            <div className="fld">
              <label>Buscar profissional</label>
              <input value={buscaProf} onChange={e => setBuscaProf(e.target.value)} placeholder="Nome, código ou função..." autoFocus />
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {profsFiltrados.map(p => (
                <div key={p.id} onClick={() => setProfSelecionado(profSelecionado?.id === p.id ? null : p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: profSelecionado?.id === p.id ? 'var(--p3)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
                  <div className="chat-av" style={{ background: corAvatar(p.nome), width: 36, height: 36, fontSize: 12 }}>{iniciais(p.nome)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.codigo ? `${p.codigo} · ` : ''}{roleLabel[p.tipo] || p.tipo}</div>
                  </div>
                  {profSelecionado?.id === p.id && <span style={{ color: 'var(--p)', fontWeight: 700 }}>✓</span>}
                </div>
              ))}
              {profsFiltrados.length === 0 && <div className="empty" style={{ padding: 16 }}>Nenhum profissional encontrado.</div>}
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => { setModalNovaConversa(false); setProfSelecionado(null); setBuscaProf('') }}>Cancelar</button>
              <button className="btn-primary" onClick={criarConversa1a1} disabled={!profSelecionado}>Iniciar conversa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo grupo */}
      {modalNovoGrupo && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalNovoGrupo(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2>Novo Grupo</h2>
            <div className="fld">
              <label>Nome do grupo *</label>
              <input value={nomeGrupo} onChange={e => setNomeGrupo(e.target.value)} placeholder="Ex: Equipe Psicologia, Geral..." />
            </div>
            <div className="fld" style={{ marginTop: 12 }}>
              <label>Adicionar membros</label>
              <input value={buscaProf} onChange={e => setBuscaProf(e.target.value)} placeholder="Buscar por nome ou código..." />
            </div>
            {membrosGrupo.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {membrosGrupo.map(m => (
                  <span key={m.id} style={{ background: 'var(--p3)', color: 'var(--p)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.nome}
                    <button onClick={() => setMembrosGrupo(prev => prev.filter(x => x.id !== m.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 700, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              {profsFiltrados.filter(p => !membrosGrupo.find(m => m.id === p.id)).map(p => (
                <div key={p.id} onClick={() => setMembrosGrupo(prev => [...prev, p])}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="chat-av" style={{ background: corAvatar(p.nome), width: 32, height: 32, fontSize: 11 }}>{iniciais(p.nome)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.codigo ? `${p.codigo} · ` : ''}{roleLabel[p.tipo] || p.tipo}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => { setModalNovoGrupo(false); setNomeGrupo(''); setMembrosGrupo([]); setBuscaProf('') }}>Cancelar</button>
              <button className="btn-primary" onClick={criarGrupo} disabled={!nomeGrupo.trim() || membrosGrupo.length === 0}>Criar grupo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== COMPONENTE PRINCIPAL =====================
export default function Chat() {
  const { profile } = useAuth()
  const [aba, setAba] = useState('pacientes')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)' }}>
      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0 }}>
        <button onClick={() => setAba('pacientes')} style={{ flex: 1, padding: '14px', fontSize: 13, fontWeight: aba === 'pacientes' ? 700 : 400, color: aba === 'pacientes' ? 'var(--p)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: aba === 'pacientes' ? '2px solid var(--p)' : '2px solid transparent', transition: '.15s' }}>
          💬 Pacientes
        </button>
        <button onClick={() => setAba('equipe')} style={{ flex: 1, padding: '14px', fontSize: 13, fontWeight: aba === 'equipe' ? 700 : 400, color: aba === 'equipe' ? 'var(--p)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: aba === 'equipe' ? '2px solid var(--p)' : '2px solid transparent', transition: '.15s' }}>
          👥 Equipe
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {aba === 'pacientes' ? <ChatPacientes profile={profile} /> : <ChatEquipe profile={profile} />}
      </div>
    </div>
  )
}