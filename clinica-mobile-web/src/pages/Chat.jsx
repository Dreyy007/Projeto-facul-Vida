import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const BLUE = '#0047AB'
const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

const BOT_STEPS = [
  { key: 'intro',   msg: (p)        => `Olá, ${p.nome?.split(' ')[0]}! 👋 Seja bem-vindo(a) ao chat da **Clínica Vida+**.\n\nAntes de começar, vou confirmar seus dados rapidinho, tudo bem?` },
  { key: 'cpf',     msg: ()         => `Qual é o seu **CPF**? (somente números)` },
  { key: 'nasc',    msg: ()         => `Qual é a sua **data de nascimento**? (DD/MM/AAAA)` },
  { key: 'tel',     msg: ()         => `Qual é o seu **telefone** de contato?` },
  { key: 'confirm', msg: (p, dados) => `Perfeito! Confirmei seus dados:\n\n👤 ${p.nome}\n📋 CPF: ${dados.cpf}\n🎂 Nascimento: ${dados.nasc}\n📱 Telefone: ${dados.tel}\n\nAgora pode digitar sua mensagem — nossa equipe responderá em breve! 😊` },
]

export default function Chat() {
  const { paciente } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [botMsgs, setBotMsgs] = useState([])
  const [botStep, setBotStep] = useState(0)
  const [botDados, setBotDados] = useState({})
  const [botPronto, setBotPronto] = useState(false)
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [showAnexo, setShowAnexo] = useState(false)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)

  useEffect(() => {
    if (!paciente) return
    checkBotStatus()
  }, [paciente])

  async function checkBotStatus() {
    const { data } = await supabase.from('mensagens').select('id').eq('paciente_id', paciente.id).limit(1)
    if (data && data.length > 0) {
      setBotPronto(true)
      fetchMensagens()
    } else {
      startBot()
    }
  }

  function startBot() {
    setTimeout(() => {
      addBotMsg(BOT_STEPS[0].msg(paciente))
      setTimeout(() => { addBotMsg(BOT_STEPS[1].msg()); setBotStep(1) }, 1200)
    }, 600)
  }

  function addBotMsg(texto) {
    setBotMsgs(prev => [...prev, { id: Date.now() + Math.random(), remetente: 'bot', conteudo: texto, criado_em: new Date().toISOString() }])
    scrollDown()
  }

  function addUserBotMsg(texto) {
    setBotMsgs(prev => [...prev, { id: Date.now() + Math.random(), remetente: 'paciente', conteudo: texto, criado_em: new Date().toISOString() }])
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
      await supabase.from('pacientes').update({
        cpf: dados.cpf?.replace(/\D/g, ''),
        data_nascimento: parseDateBR(dados.nasc),
        telefone: dados.tel,
      }).eq('id', paciente.id)
      setTimeout(() => {
        addBotMsg(BOT_STEPS[4].msg(paciente, dados))
        setBotStep(4)
        setBotPronto(true)
        fetchMensagens()
      }, 800)
    }
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
    const channel = supabase
      .channel('chat-' + paciente.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensagens',
        filter: `paciente_id=eq.${paciente.id}`
      }, payload => {
        setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        scrollDown()
        if (payload.new.remetente === 'clinica') supabase.from('mensagens').update({ lida: true }).eq('id', payload.new.id)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [paciente, botPronto])

  const scrollDown = (instant = false) =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: instant ? 'instant' : 'smooth' }), 100)

  async function handleEnviar(e) {
    e?.preventDefault()
    const msg = texto.trim()
    if (!msg) return
    if (!botPronto && botStep >= 1 && botStep <= 3) {
      setTexto('')
      await handleBotResposta(msg)
      return
    }
    if (!botPronto || sending) return
    setTexto('')
    setSending(true)
    await supabase.from('mensagens').insert([{ paciente_id: paciente.id, remetente: 'paciente', conteudo: msg, lida: false }])
    setSending(false)
  }

  async function uploadAnexo(file) {
    if (!botPronto) return
    setSending(true); setShowAnexo(false)
    const ext = file.name.split('.').pop()
    const path = `${paciente.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-anexos').upload(path, file, { contentType: file.type })
    if (error) { alert('Erro ao enviar arquivo.'); setSending(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id, remetente: 'paciente', conteudo: '',
      anexo_url: urlData.publicUrl, anexo_tipo: file.type, anexo_nome: file.name, lida: false,
    }])
    setSending(false)
  }

  function renderConteudo(texto, isMe) {
    const parts = texto.split(/\*\*(.*?)\*\*/g)
    return parts.map((p, i) =>
      i % 2 === 1
        ? <strong key={i} style={{ color: isMe ? '#fff' : '#0D1B2A' }}>{p}</strong>
        : <span key={i}>{p}</span>
    )
  }

  const todasMsgs = [...botMsgs, ...(botPronto ? mensagens : [])]
  let lastDate = null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#EEF2FF' }}>
      <div style={s.header}>
        <div style={s.headerBubble} />
        <div style={s.clinicAvatar}><span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>V+</span></div>
        <div style={{ flex: 1 }}>
          <p style={s.headerNome}>Clínica Vida+</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={s.onlineDot} />
            <span style={s.headerStatus}>Equipe disponível agora</span>
          </div>
        </div>
        <button style={s.headerAction}><span style={{ fontSize: 18 }}>📞</span></button>
      </div>

      <div ref={scrollRef} style={s.messages}>
        {todasMsgs.map(m => {
          const msgDate = fmtData(m.criado_em)
          const showDate = msgDate !== lastDate
          lastDate = msgDate
          const isMe = m.remetente === 'paciente'
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

        {(sending || (!botPronto && botStep === 0)) && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <div style={s.msgAvatar}><span style={{ fontSize: 8, fontWeight: 800, color: '#fff' }}>V+</span></div>
            <div style={{ ...s.bubbleThem, padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#aaa', display: 'inline-block', animation: `pulse 1.2s ${d}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>

      {showAnexo && botPronto && (
        <div style={s.anexoMenu}>
          <button style={s.anexoOpt} onClick={() => imageRef.current?.click()}>
            <div style={s.anexoIconBox}><span style={{ fontSize: 26 }}>🖼️</span></div>
            <span style={s.anexoLabel}>Foto</span>
          </button>
          <button style={s.anexoOpt} onClick={() => fileRef.current?.click()}>
            <div style={s.anexoIconBox}><span style={{ fontSize: 26 }}>📄</span></div>
            <span style={s.anexoLabel}>Documento</span>
          </button>
        </div>
      )}

      <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadAnexo(e.target.files[0])} />
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadAnexo(e.target.files[0])} />

      <div style={s.inputBar}>
        {botPronto && (
          <button style={s.clipBtn} onClick={() => setShowAnexo(v => !v)}>
            <span style={{ fontSize: 22 }}>📎</span>
          </button>
        )}
        <textarea
          style={s.input}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
          placeholder={botPronto ? 'Escreva sua mensagem...' : 'Digite sua resposta...'}
          rows={1}
          maxLength={500}
          disabled={!botPronto && botStep === 0}
        />
        <button
          style={{ ...s.sendBtn, ...(!texto.trim() || sending ? s.sendBtnDisabled : {}) }}
          onClick={handleEnviar}
          disabled={!texto.trim() || sending}
        >
          <span style={s.sendIcon}>➤</span>
        </button>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.2}50%{opacity:1}}`}</style>
    </div>
  )
}

const s = {
  header: { position: 'relative', backgroundColor: BLUE, padding: '48px 20px 14px', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden', flexShrink: 0 },
  headerBubble: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#1a6fdf', top: -70, right: -40, opacity: 0.45 },
  clinicAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.35)', flexShrink: 0 },
  headerNome: { fontSize: 16, fontWeight: 700, color: '#fff' },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80', display: 'inline-block' },
  headerStatus: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  headerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  messages: { flex: 1, overflowY: 'auto', padding: 16 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble: { borderRadius: 18, padding: 12 },
  bubbleMe: { backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderRadius: 18, padding: 12 },
  bubbleText: { fontSize: 14, color: '#0D1B2A', lineHeight: '20px' },
  bubbleTextMe: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#9CA3AF', marginTop: 5, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.55)' },
  dateRow: { display: 'flex', justifyContent: 'center', margin: '8px 0' },
  dateText: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#E0E7FF', padding: '4px 12px', borderRadius: 50 },
  msgImg: { width: 200, height: 160, borderRadius: 10, objectFit: 'cover', marginBottom: 4, display: 'block' },
  docRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, textDecoration: 'none' },
  docIconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  anexoMenu: { backgroundColor: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', padding: 16, gap: 24, flexShrink: 0 },
  anexoOpt: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer' },
  anexoIconBox: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  anexoLabel: { fontSize: 12, color: '#374151', fontWeight: 500 },
  inputBar: { display: 'flex', alignItems: 'flex-end', padding: 12, backgroundColor: '#fff', borderTop: '1px solid #E5E7EB', gap: 10, flexShrink: 0 },
  clipBtn: { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' },
  input: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 22, padding: '10px 16px', fontSize: 14, color: '#0D1B2A', maxHeight: 100, border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
  sendIcon: { color: '#fff', fontSize: 16 },
}