import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const BLUE = '#0047AB'
const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

const INATIVIDADE_AVISO_MS  = 90  * 60 * 1000  // 1h30
const INATIVIDADE_ENCERRA_MS = 120 * 60 * 1000  // 2h

const BOT_STEPS = [
  { key: 'intro',   msg: p        => `Olá, ${p.nome?.split(' ')[0]}! 👋 Seja bem-vindo(a) ao chat da **Clínica Vida+**.\n\nAntes de começar, vou confirmar seus dados rapidinho, tudo bem?` },
  { key: 'cpf',     msg: ()      => `Qual é o seu **CPF**? (somente números)` },
  { key: 'nasc',    msg: ()      => `Qual é a sua **data de nascimento**? (DD/MM/AAAA)` },
  { key: 'tel',     msg: ()      => `Qual é o seu **telefone** de contato?` },
  { key: 'confirm', msg: (p, d) => `Perfeito! Confirmei seus dados:\n\n👤 ${p.nome}\n📋 CPF: ${d.cpf}\n🎂 Nascimento: ${d.nasc}\n📱 Telefone: ${d.tel}\n\nAgora pode digitar sua mensagem — nossa equipe responderá em breve! 😊` },
]

export default function Chat() {
  const { paciente } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [botMsgs, setBotMsgs] = useState([])
  const [botStep, setBotStep] = useState(0)
  const [botDados, setBotDados] = useState({})
  const [botPronto, setBotPronto] = useState(false)
  const [conversa, setConversa] = useState(null) // { id, encerrada }
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [showAnexo, setShowAnexo] = useState(false)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)
  const iniciouBot = useRef(false)

  useEffect(() => {
    if (!paciente) return
    checkStatus()
  }, [paciente])

  async function checkStatus() {
    // Busca última mensagem do paciente
    const { data: msgs } = await supabase
      .from('mensagens')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('criado_em', { ascending: false })
      .limit(1)

    if (!msgs || msgs.length === 0) {
      // Nunca conversou — inicia bot (uma única vez)
      if (!iniciouBot.current) {
        iniciouBot.current = true
        startBot()
      }
      return
    }

    // Verifica se bot já foi iniciado mas não concluído (paciente saiu no meio)
    const { data: botMsgsDb } = await supabase
      .from('mensagens')
      .select('*')
      .eq('paciente_id', paciente.id)
      .eq('tipo', 'bot')
      .order('criado_em')
    
    const botConcluido = botMsgsDb?.some(m => m.remetente === 'clinica' && m.conteudo?.includes('Agora pode digitar'))
    
    if (botMsgsDb && botMsgsDb.length > 0 && !botConcluido) {
      // Bot iniciado mas não concluído — retoma de onde parou
      const respostas = botMsgsDb.filter(m => m.remetente === 'paciente')
      const step = respostas.length + 1
      const dados = {}
      if (respostas[0]) dados.cpf = respostas[0].conteudo
      if (respostas[1]) dados.nasc = respostas[1].conteudo
      if (respostas[2]) dados.tel = respostas[2].conteudo
      setBotDados(dados)
      setBotStep(step)
      setMensagens(botMsgsDb)
      scrollDown(true)
      // Manda próxima pergunta do bot
      if (!iniciouBot.current) {
        iniciouBot.current = true
        setTimeout(() => { addBotMsg(BOT_STEPS[step].msg()); }, 800)
      }
      return
    }

    const ultima = msgs[0]
    const agora = Date.now()
    const tempoUltima = agora - new Date(ultima.criado_em).getTime()

    // Verifica se já foi encerrada
    if (ultima.tipo === 'encerramento') {
      setBotPronto(false)
      setConversa({ encerrada: true })
      fetchMensagens()
      return
    }

    // Já tem histórico — carrega normalmente
    setBotPronto(true)
    fetchMensagens()

    // Verifica inatividade
    if (tempoUltima >= INATIVIDADE_ENCERRA_MS) {
      // Já passou 2h — encerra agora
      await encerrarConversa()
    } else if (tempoUltima >= INATIVIDADE_AVISO_MS) {
      // Passou 1h30 — manda aviso se ainda não mandou
      await verificarEMandarAviso()
    }
  }

  async function verificarEMandarAviso() {
    // Checa se já existe mensagem de aviso recente
    const { data } = await supabase
      .from('mensagens')
      .select('id')
      .eq('paciente_id', paciente.id)
      .eq('tipo', 'aviso_inatividade')
      .order('criado_em', { ascending: false })
      .limit(1)

    if (data && data.length > 0) return // já avisou

    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id,
      remetente: 'clinica',
      conteudo: '⚠️ Olá! Notamos que você está inativo(a) há algum tempo. Sua conversa será encerrada em **30 minutos** caso não haja interação. Se precisar de ajuda, é só responder!',
      tipo: 'aviso_inatividade',
      lida: false,
    }])
  }

  async function encerrarConversa() {
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id,
      remetente: 'clinica',
      conteudo: '🔒 Esta conversa foi **encerrada automaticamente** por inatividade. Quando quiser retomar, é só enviar uma mensagem e iniciaremos um novo atendimento!',
      tipo: 'encerramento',
      lida: false,
    }])
    setConversa({ encerrada: true })
    setBotPronto(false)
  }

  function startBot() {
    setTimeout(() => {
      addBotMsg(BOT_STEPS[0].msg(paciente))
      setTimeout(() => { addBotMsg(BOT_STEPS[1].msg()); setBotStep(1) }, 1200)
    }, 600)
  }

  async function addBotMsg(t) {
    // Salva no banco E no state
    const msg = { paciente_id: paciente.id, remetente: 'clinica', conteudo: t, tipo: 'bot', lida: true }
    const { data } = await supabase.from('mensagens').insert([msg]).select().single()
    if (data) setMensagens(prev => [...prev, data])
    else setBotMsgs(prev => [...prev, { id: Date.now() + Math.random(), remetente: 'clinica', conteudo: t, criado_em: new Date().toISOString() }])
    scrollDown()
  }
  async function addUserBotMsg(t) {
    // Salva no banco E no state
    const msg = { paciente_id: paciente.id, remetente: 'paciente', conteudo: t, tipo: 'bot', lida: true }
    const { data } = await supabase.from('mensagens').insert([msg]).select().single()
    if (data) setMensagens(prev => [...prev, data])
    else setBotMsgs(prev => [...prev, { id: Date.now() + Math.random(), remetente: 'paciente', conteudo: t, criado_em: new Date().toISOString() }])
    scrollDown()
  }

  async function handleBotResposta(resposta) {
    addUserBotMsg(resposta)
    if (botStep === 1) {
      const dados = { ...botDados, cpf: resposta }
      setBotDados(dados)
      setTimeout(() => { addBotMsg(BOT_STEPS[2].msg()); setBotStep(2) }, 800)
    } else if (botStep === 2) {
      const dados = { ...botDados, nasc: resposta }
      setBotDados(dados)
      setTimeout(() => { addBotMsg(BOT_STEPS[3].msg()); setBotStep(3) }, 800)
    } else if (botStep === 3) {
      const dados = { ...botDados, tel: resposta }
      setBotDados(dados)
      await supabase.from('pacientes').update({ cpf: dados.cpf?.replace(/\D/g, ''), data_nascimento: parseDateBR(dados.nasc), telefone: dados.tel }).eq('id', paciente.id)
      setTimeout(() => {
        addBotMsg(BOT_STEPS[4].msg(paciente, dados))
        setBotStep(4); setBotPronto(true); fetchMensagens()
      }, 800)
    }
  }

  // Reinicia conversa após encerramento
  async function reiniciarConversa() {
    setConversa(null)
    setBotMsgs([])
    setBotStep(0)
    setBotDados({})
    setBotPronto(false)
    iniciouBot.current = true
    // Histórico mantido — só reinicia o fluxo do bot
    startBot()
  }

  function parseDateBR(str) {
    const p = str?.replace(/\D/g, '')
    if (p?.length === 8) return `${p.slice(4)}-${p.slice(2, 4)}-${p.slice(0, 2)}`
    return null
  }

  async function fetchMensagens() {
    if (!paciente) return
    const { data } = await supabase.from('mensagens').select('*').eq('paciente_id', paciente.id).order('criado_em')
    setMensagens(data || [])
    scrollDown(true)
    await supabase.from('mensagens').update({ lida: true }).eq('paciente_id', paciente.id).eq('remetente', 'clinica').eq('lida', false)
  }

  useEffect(() => {
    if (!paciente || !botPronto) return
    const channel = supabase.channel('chat-' + paciente.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `paciente_id=eq.${paciente.id}` }, payload => {
        setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        scrollDown()
        if (payload.new.remetente === 'clinica') supabase.from('mensagens').update({ lida: true }).eq('id', payload.new.id)
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [paciente, botPronto])

  const scrollDown = (instant = false) =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: instant ? 'instant' : 'smooth' }), 100)

  async function handleEnviar(e) {
    e?.preventDefault()
    const msg = texto.trim()
    if (!msg) return

    // Se conversa encerrada — reinicia
    if (conversa?.encerrada) {
      await reiniciarConversa()
      return
    }

    if (!botPronto && botStep >= 1 && botStep <= 3) { setTexto(''); await handleBotResposta(msg); return }
    if (!botPronto || sending) return
    setTexto(''); setSending(true)
    await supabase.from('mensagens').insert([{ paciente_id: paciente.id, remetente: 'paciente', conteudo: msg, lida: false }])
    setSending(false)

    // Após enviar — cancela aviso de inatividade se existir (deleta ou ignora, a lógica continua pelo tempo)
  }

  async function uploadAnexo(file) {
    if (!botPronto) return
    setSending(true); setShowAnexo(false)
    const ext = file.name.split('.').pop()
    const path = `${paciente.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-anexos').upload(path, file, { contentType: file.type })
    if (error) { alert('Erro ao enviar arquivo.'); setSending(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{ paciente_id: paciente.id, remetente: 'paciente', conteudo: '', anexo_url: urlData.publicUrl, anexo_tipo: file.type, anexo_nome: file.name, lida: false }])
    setSending(false)
  }

  function renderConteudo(texto, isMe) {
    const parts = texto.split(/\*\*(.*?)\*\*/g)
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i} style={{ color: isMe ? '#fff' : '#0D1B2A' }}>{p}</strong> : <span key={i}>{p}</span>)
  }

  const todasMsgs = botPronto || conversa?.encerrada ? mensagens : [...botMsgs, ...mensagens]
  let lastDate = null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F0F4FF' }}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerBubble} />
        <div style={s.clinicAvatar}><span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>V+</span></div>
        <div style={{ flex: 1 }}>
          <p style={s.headerNome}>Clínica Vida+</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={s.onlineDot} />
            <span style={s.headerStatus}>Equipe disponível agora</span>
          </div>
        </div>
        <button style={s.headerAction}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
        </button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} style={s.messages}>
        {todasMsgs.map(m => {
          const msgDate = fmtData(m.criado_em)
          const showDate = msgDate !== lastDate
          lastDate = msgDate
          const isMe = m.remetente === 'paciente'
          const isSystem = m.tipo === 'aviso_inatividade' || m.tipo === 'encerramento'

          if (isSystem) {
            return (
              <div key={m.id} style={s.systemMsg}>
                <p style={{ fontSize: 12, color: m.tipo === 'encerramento' ? '#991B1B' : '#92400E', textAlign: 'center', lineHeight: '18px' }}>
                  {renderConteudo(m.conteudo, false)}
                </p>
              </div>
            )
          }

          return (
            <div key={m.id}>
              {showDate && <div style={s.dateRow}><span style={s.dateText}>{msgDate}</span></div>}
              <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
                {!isMe && <div style={s.msgAvatar}><span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>V+</span></div>}
                <div style={{ ...s.bubble, ...(isMe ? s.bubbleMe : s.bubbleThem), maxWidth: '78%' }}>
                  {m.anexo_url && m.anexo_tipo?.startsWith('image/') && <img src={m.anexo_url} alt="anexo" style={s.msgImg} />}
                  {m.anexo_url && !m.anexo_tipo?.startsWith('image/') && (
                    <a href={m.anexo_url} target="_blank" rel="noreferrer" style={s.docRow}>
                      <div style={s.docIconBox}><span style={{ fontSize: 20 }}>📄</span></div>
                      <span style={{ fontSize: 13, color: isMe ? '#fff' : '#0D1B2A', fontWeight: 500 }}>{m.anexo_nome}</span>
                    </a>
                  )}
                  {!!m.conteudo && (
                    <p style={{ ...s.bubbleText, ...(isMe ? s.bubbleTextMe : {}), whiteSpace: 'pre-line' }}>
                      {renderConteudo(m.conteudo, isMe)}
                    </p>
                  )}
                  <p style={{ ...s.bubbleTime, ...(isMe ? s.bubbleTimeMe : {}) }}>
                    {fmtHora(m.criado_em)}{isMe && ' ✓✓'}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        {(sending || (!botPronto && botStep === 0 && !conversa?.encerrada)) && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <div style={s.msgAvatar}><span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>V+</span></div>
            <div style={{ ...s.bubbleThem, padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#CBD5E1', display: 'inline-block', animation: `pulse 1.2s ${d}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Banner conversa encerrada */}
        {conversa?.encerrada && (
          <div style={s.encerramentoBanner}>
            <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 12 }}>
              Esta conversa foi encerrada. Envie uma mensagem para iniciar um novo atendimento.
            </p>
            <button style={s.novaConversaBtn} onClick={reiniciarConversa}>
              Iniciar nova conversa
            </button>
          </div>
        )}

        <div style={{ height: 16 }} />
      </div>

      {showAnexo && botPronto && (
        <div style={s.anexoMenu}>
          <button style={s.anexoOpt} onClick={() => imageRef.current?.click()}>
            <div style={s.anexoIconBox}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span style={s.anexoLabel}>Foto</span>
          </button>
          <button style={s.anexoOpt} onClick={() => fileRef.current?.click()}>
            <div style={s.anexoIconBox}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <span style={s.anexoLabel}>Documento</span>
          </button>
        </div>
      )}

      <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadAnexo(e.target.files[0])} />
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadAnexo(e.target.files[0])} />

      <div style={s.inputBar}>
        {botPronto && !conversa?.encerrada && (
          <button style={s.clipBtn} onClick={() => setShowAnexo(v => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
        )}
        <textarea
          style={{ ...s.input, ...(conversa?.encerrada ? { color: '#9CA3AF' } : {}) }}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
          placeholder={conversa?.encerrada ? 'Envie uma mensagem para reiniciar...' : botPronto ? 'Escreva sua mensagem...' : 'Digite sua resposta...'}
          rows={1}
          maxLength={500}
          disabled={!botPronto && botStep === 0 && !conversa?.encerrada}
        />
        <button
          style={{ ...s.sendBtn, ...(!texto.trim() || sending ? s.sendBtnDisabled : {}) }}
          onClick={handleEnviar}
          disabled={!texto.trim() || sending}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(45deg)', marginLeft: 2 }}>
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

const s = {
  header: { position: 'relative', background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', padding: '48px 20px 14px', display: 'flex', alignItems: 'center', gap: 14, overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 20px rgba(0,71,171,0.2)' },
  headerBubble: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -50 },
  clinicAvatar: { width: 46, height: 46, borderRadius: 23, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 },
  headerNome: { fontSize: 16, fontWeight: 700, color: '#fff' },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80', display: 'inline-block' },
  headerStatus: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  headerAction: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 },
  messages: { flex: 1, overflowY: 'auto', padding: '12px 14px' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { borderRadius: 18, padding: '10px 14px' },
  bubbleMe: { background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 18, padding: '10px 14px' },
  bubbleText: { fontSize: 14, color: '#0D1B2A', lineHeight: '20px' },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 5, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },
  dateRow: { display: 'flex', justifyContent: 'center', margin: '10px 0' },
  dateText: { fontSize: 11, color: '#6B7280', backgroundColor: 'rgba(255,255,255,0.8)', padding: '4px 14px', borderRadius: 50, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  systemMsg: { backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 14, padding: '10px 16px', margin: '8px 0', border: '1px solid #E5E7EB' },
  encerramentoBanner: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', margin: '8px 0' },
  novaConversaBtn: { background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 13, color: '#fff', fontWeight: 700, cursor: 'pointer' },
  msgImg: { width: 200, height: 160, borderRadius: 12, objectFit: 'cover', marginBottom: 4, display: 'block' },
  docRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, textDecoration: 'none' },
  docIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  anexoMenu: { backgroundColor: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', padding: '16px 24px', gap: 20, flexShrink: 0 },
  anexoOpt: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer' },
  anexoIconBox: { width: 70, height: 70, borderRadius: 20, backgroundColor: '#EEF6FF', border: '1.5px dashed #93C5FD', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  anexoLabel: { fontSize: 12, color: '#0047AB', fontWeight: 600 },
  inputBar: { display: 'flex', alignItems: 'center', padding: '10px 12px', backgroundColor: '#fff', borderTop: '1px solid #F3F4F6', gap: 10, flexShrink: 0 },
  clipBtn: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 },
  input: { flex: 1, backgroundColor: '#F1F5F9', borderRadius: 22, padding: '10px 16px', fontSize: 14, color: '#0D1B2A', maxHeight: 100, border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,71,171,0.3)' },
  sendBtnDisabled: { background: '#E5E7EB', boxShadow: 'none' },
}