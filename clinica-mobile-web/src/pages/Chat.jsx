import { useEffect, useState, useRef, useCallback } from 'react'
import { LOGO_SRC } from '../lib/logoClinica'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

const INATIVIDADE_AVISO_MS   = 90  * 60 * 1000
const INATIVIDADE_ENCERRA_MS = 120 * 60 * 1000

// Tipo fixo para identificar conclusão do bot — não depende de texto
const TIPO_BOT_CONCLUIDO = 'bot_concluido'

const soDigitos = v => (v || '').replace(/\D/g, '')

function comparaNasc(digitado, cadastrado) {
  if (!digitado || !cadastrado) return false
  const d = soDigitos(digitado)
  if (d.length !== 8) return false
  const dia = d.slice(0, 2), mes = d.slice(2, 4), ano = d.slice(4, 8)
  return cadastrado.slice(0, 10) === `${ano}-${mes}-${dia}`
}

function parseDateBR(str) {
  const p = soDigitos(str)
  if (p?.length === 8) return `${p.slice(4)}-${p.slice(2, 4)}-${p.slice(0, 2)}`
  return null
}

function perguntaStep(step) {
  if (step === 1) return 'Qual é o seu **CPF**?\n\nDigite somente os números, sem pontos ou traços.\nExemplo: 12345678900'
  if (step === 2) return 'Qual é a sua **data de nascimento**?\n\nDigite no formato DD/MM/AAAA.\nExemplo: 15/03/1990'
  if (step === 3) return 'Qual é o seu **telefone** de contato?\n\nDigite somente os números, com DDD, sem espaços ou traços.\nExemplo: 11999998888'
  return ''
}

// CORRIGIDO: usa tipo fixo em vez de texto — robusto a mudanças de conteúdo
function botFoiConcluido(msgs) {
  return msgs.some(m => m.tipo === TIPO_BOT_CONCLUIDO)
}

export default function Chat() {
  const { paciente } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [botMsgs, setBotMsgs] = useState([])
  const [botStep, setBotStep] = useState(0)
  const [botDados, setBotDados] = useState({})
  const [botPronto, setBotPronto] = useState(false)
  const [conversa, setConversa] = useState(null)
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [showAnexo, setShowAnexo] = useState(false)
  const scrollRef = useRef(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)
  const iniciouBot = useRef(false)
  const montado = useRef(true) // CORRIGIDO: controle de componente desmontado
  const avisandoRef = useRef(false) // CORRIGIDO: proteção race condition aviso

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false }
  }, [])

  useEffect(() => {
    if (!paciente) return
    checkStatus()
  }, [paciente])

  const scrollDown = useCallback((instant = false) =>
    setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: instant ? 'instant' : 'smooth' }), 100)
  , [])

  async function checkStatus() {
    if (iniciouBot.current) return
    iniciouBot.current = true

    // Timeout de segurança — se Supabase demorar mais de 8s, reinicia
    let timedOut = false
    const safetyTimer = setTimeout(() => {
      if (!montado.current) return
      timedOut = true
      iniciouBot.current = false
      startBot()
    }, 8000)

    const { data: msgs } = await supabase
      .from('mensagens')
      .select('*')
      .eq('paciente_id', paciente.id)
      .order('criado_em')

    clearTimeout(safetyTimer)
    if (timedOut || !montado.current) return

    if (!montado.current) return

    // Sem histórico — inicia bot do zero
    if (!msgs || msgs.length === 0) {
      startBot()
      return
    }

    // Bot já concluído
    if (botFoiConcluido(msgs)) {
      const ultima = msgs[msgs.length - 1]
      const tempoUltima = Date.now() - new Date(ultima.criado_em).getTime()

      if (ultima.tipo === 'encerramento') {
        setBotPronto(false)
        setConversa({ encerrada: true })
        setMensagens(msgs)
        scrollDown(true)
        return
      }

      setBotPronto(true)
      setMensagens(msgs)
      scrollDown(true)
      await supabase.from('mensagens').update({ lida: true })
        .eq('paciente_id', paciente.id)
        .eq('remetente', 'clinica')
        .eq('lida', false)

      if (tempoUltima >= INATIVIDADE_ENCERRA_MS) {
        await encerrarConversa()
      } else if (tempoUltima >= INATIVIDADE_AVISO_MS) {
        await verificarEMandarAviso()
      }
      return
    }

    // Bot incompleto — apaga TODAS as mensagens (bot + normais) e reinicia limpo
    await supabase.from('mensagens')
      .delete()
      .eq('paciente_id', paciente.id)

    if (!montado.current) return
    setBotMsgs([])
    setMensagens([])
    setBotStep(0)
    setBotDados({})
    setBotPronto(false)
    startBot()
  }

  async function verificarEMandarAviso() {
    // CORRIGIDO: proteção de race condition com ref
    if (avisandoRef.current) return
    avisandoRef.current = true

    const { data } = await supabase.from('mensagens').select('id')
      .eq('paciente_id', paciente.id)
      .eq('tipo', 'aviso_inatividade')
      .order('criado_em', { ascending: false })
      .limit(1)

    if (!data || data.length === 0) {
      await supabase.from('mensagens').insert([{
        paciente_id: paciente.id, remetente: 'clinica',
        conteudo: '⚠️ Olá! Notamos que você está inativo(a) há algum tempo. Sua conversa será encerrada em **30 minutos** caso não haja interação. Se precisar de ajuda, é só responder!',
        tipo: 'aviso_inatividade', lida: false,
      }])
    }
    avisandoRef.current = false
  }

  async function encerrarConversa() {
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id, remetente: 'clinica',
      conteudo: '🔒 Esta conversa foi **encerrada automaticamente** por inatividade. Quando quiser retomar, é só enviar uma mensagem e iniciaremos um novo atendimento!',
      tipo: 'encerramento', lida: false,
    }])
    if (!montado.current) return
    setConversa({ encerrada: true })
    setBotPronto(false)
  }

  function startBot() {
    if (!montado.current) return
    const primeiroNome = paciente.nome?.split(' ')[0] || 'paciente'

    // CORRIGIDO: verifica montado antes de cada setState em setTimeout
    const t1 = setTimeout(() => {
      if (!montado.current) return
      addBotMsg(`Olá, ${primeiroNome}! 👋 Seja bem-vindo(a) ao chat da **Clínica Vida+**.\n\nAntes de começar, vou confirmar seus dados rapidinho, tudo bem?`)

      const t2 = setTimeout(() => {
        if (!montado.current) return
        addBotMsg(perguntaStep(1))
        setBotStep(1)
      }, 1200)

      return () => clearTimeout(t2)
    }, 600)

    return () => clearTimeout(t1)
  }

  // CORRIGIDO: sequência garantida com contador para evitar ordem instável
  const botSeq = useRef(0)
  function addBotMsg(t) {
    botSeq.current += 1
    const seq = botSeq.current
    setBotMsgs(prev => [...prev, {
      id: `bot-${seq}-${Date.now()}`,
      remetente: 'clinica',
      conteudo: t,
      tipo: 'bot',
      criado_em: new Date().toISOString(),
      _seq: seq,
    }])
    scrollDown()
  }

  function addUserBotMsg(t) {
    botSeq.current += 1
    const seq = botSeq.current
    setBotMsgs(prev => [...prev, {
      id: `bot-user-${seq}-${Date.now()}`,
      remetente: 'paciente',
      conteudo: t,
      tipo: 'bot',
      criado_em: new Date().toISOString(),
      _seq: seq,
    }])
    scrollDown()
  }

  async function handleBotResposta(resposta) {
    addUserBotMsg(resposta)

    if (botStep === 1) {
      const cpfLimpo = soDigitos(resposta)
      const { data: pacCadastrado } = await supabase
        .from('pacientes').select('id, nome, cpf, data_nascimento, telefone')
        .eq('id', paciente.id).single()

      if (!montado.current) return
      const dados = { ...botDados, cpf: resposta, pacCadastrado }

      if (pacCadastrado && soDigitos(pacCadastrado.cpf) && soDigitos(pacCadastrado.cpf) !== cpfLimpo) {
        setBotDados(dados)
        setTimeout(() => {
          if (!montado.current) return
          addBotMsg('⚠️ O CPF informado não confere com o cadastrado em nosso sistema.\n\nPor favor, verifique o número ou entre em contato com a clínica.')
          setTimeout(() => { if (montado.current) addBotMsg(perguntaStep(1)) }, 1200)
        }, 800)
        return
      }
      setBotDados(dados)
      setTimeout(() => {
        if (!montado.current) return
        addBotMsg(perguntaStep(2)); setBotStep(2)
      }, 800)

    } else if (botStep === 2) {
      const { pacCadastrado } = botDados
      const dados = { ...botDados, nasc: resposta }

      if (pacCadastrado?.data_nascimento && !comparaNasc(resposta, pacCadastrado.data_nascimento)) {
        setBotDados(dados)
        setTimeout(() => {
          if (!montado.current) return
          addBotMsg('⚠️ A data de nascimento informada não confere com nosso cadastro.\n\nPor favor, verifique ou entre em contato com a clínica.')
          setTimeout(() => { if (montado.current) addBotMsg(perguntaStep(2)) }, 1200)
        }, 800)
        return
      }
      setBotDados(dados)
      setTimeout(() => {
        if (!montado.current) return
        addBotMsg(perguntaStep(3)); setBotStep(3)
      }, 800)

    } else if (botStep === 3) {
      const { pacCadastrado } = botDados
      const dados = { ...botDados, tel: resposta }

      const telDigitado = soDigitos(resposta)
      const telCadastrado = soDigitos(pacCadastrado?.telefone)
      if (telCadastrado && telDigitado && telCadastrado !== telDigitado) {
        setBotDados(dados)
        setTimeout(() => {
          if (!montado.current) return
          addBotMsg('⚠️ O telefone informado não confere com nosso cadastro.\n\nPor favor, verifique ou entre em contato com a clínica.')
          setTimeout(() => { if (montado.current) addBotMsg(perguntaStep(3)) }, 1200)
        }, 800)
        return
      }
      setBotDados(dados)

      await supabase.from('pacientes').update({
        cpf: soDigitos(botDados.cpf),
        data_nascimento: parseDateBR(botDados.nasc),
        telefone: soDigitos(resposta),
      }).eq('id', paciente.id)

      if (!montado.current) return

      const primeiroNome = paciente.nome?.split(' ')[0] || 'paciente'
      const msgFinal = `Perfeito! Confirmei seus dados:\n\n👤 ${paciente.nome}\n📋 CPF: ${botDados.cpf}\n🎂 Nascimento: ${botDados.nasc}\n📱 Telefone: ${resposta}\n\nAgora pode digitar sua mensagem — nossa equipe responderá em breve! 😊`

      // CORRIGIDO: tipo bot_concluido na msg final para detecção robusta
      await supabase.from('mensagens').insert([
        { paciente_id: paciente.id, remetente: 'clinica', conteudo: `Olá, ${primeiroNome}! 👋 Seja bem-vindo(a) ao chat da **Clínica Vida+**.\n\nAntes de começar, vou confirmar seus dados rapidinho, tudo bem?`, tipo: 'bot', lida: true },
        { paciente_id: paciente.id, remetente: 'clinica', conteudo: perguntaStep(1), tipo: 'bot', lida: true },
        { paciente_id: paciente.id, remetente: 'paciente', conteudo: botDados.cpf, tipo: 'bot', lida: true },
        { paciente_id: paciente.id, remetente: 'clinica', conteudo: perguntaStep(2), tipo: 'bot', lida: true },
        { paciente_id: paciente.id, remetente: 'paciente', conteudo: botDados.nasc, tipo: 'bot', lida: true },
        { paciente_id: paciente.id, remetente: 'clinica', conteudo: perguntaStep(3), tipo: 'bot', lida: true },
        { paciente_id: paciente.id, remetente: 'paciente', conteudo: resposta, tipo: 'bot', lida: true },
        // CORRIGIDO: tipo = bot_concluido marca o fluxo como finalizado
        { paciente_id: paciente.id, remetente: 'clinica', conteudo: msgFinal, tipo: TIPO_BOT_CONCLUIDO, lida: true },
      ])

      if (!montado.current) return

      setTimeout(() => {
        if (!montado.current) return
        addBotMsg(msgFinal)
        setBotStep(4)
        setBotPronto(true)
        // CORRIGIDO: limpa botMsgs antes de buscar do banco para evitar duplicatas
        setBotMsgs([])
        fetchMensagens()
      }, 800)
    }
  }

  async function reiniciarConversa() {
    // CORRIGIDO: limpa estado antes de buscar
    setConversa(null)
    setBotMsgs([])
    setMensagens([])
    setBotStep(0)
    setBotDados({})
    setBotPronto(false)

    await supabase.from('mensagens')
      .delete()
      .eq('paciente_id', paciente.id)
      .in('tipo', ['encerramento', 'aviso_inatividade'])

    if (!montado.current) return

    const { data: msgs } = await supabase
      .from('mensagens').select('*')
      .eq('paciente_id', paciente.id).order('criado_em')

    if (!montado.current) return

    if (botFoiConcluido(msgs || [])) {
      setBotPronto(true)
      setMensagens(msgs || [])
      scrollDown(true)
    } else {
      iniciouBot.current = true
      startBot()
    }
  }

  async function fetchMensagens() {
    if (!paciente || !montado.current) return
    const { data } = await supabase.from('mensagens').select('*')
      .eq('paciente_id', paciente.id).order('criado_em')
    if (!montado.current) return
    setMensagens(data || [])
    scrollDown(true)
    await supabase.from('mensagens').update({ lida: true })
      .eq('paciente_id', paciente.id).eq('remetente', 'clinica').eq('lida', false)
  }

  useEffect(() => {
    if (!paciente || !botPronto) return
    const channel = supabase.channel('chat-' + paciente.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensagens',
        filter: `paciente_id=eq.${paciente.id}`,
      }, payload => {
        if (!montado.current) return
        setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        scrollDown()
        if (payload.new.remetente === 'clinica') {
          supabase.from('mensagens').update({ lida: true }).eq('id', payload.new.id)
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [paciente, botPronto])

  async function handleEnviar(e) {
    e?.preventDefault()
    const msg = texto.trim()
    if (!msg) return

    // CORRIGIDO: salva a mensagem antes de reiniciar a conversa
    if (conversa?.encerrada) {
      setTexto('')
      await reiniciarConversa()
      return
    }

    if (!botPronto && botStep >= 1 && botStep <= 3) {
      setTexto('')
      await handleBotResposta(msg)
      return
    }

    if (!botPronto || sending) return
    setTexto('')
    setSending(true)
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id, remetente: 'paciente', conteudo: msg, lida: false,
    }])
    if (montado.current) setSending(false)
  }

  async function uploadAnexo(file) {
    if (!botPronto) return
    setSending(true); setShowAnexo(false)
    const ext = file.name.split('.').pop()
    const path = `${paciente.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-anexos').upload(path, file, { contentType: file.type })
    if (error) { alert('Erro ao enviar arquivo.'); if (montado.current) setSending(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{
      paciente_id: paciente.id, remetente: 'paciente', conteudo: '',
      anexo_url: urlData.publicUrl, anexo_tipo: file.type, anexo_nome: file.name, lida: false,
    }])
    if (montado.current) setSending(false)
  }

  function renderConteudo(txt, isMe) {
    const parts = txt.split(/\*\*(.*?)\*\*/g)
    return parts.map((p, i) => i % 2 === 1
      ? <strong key={i} style={{ color: isMe ? '#fff' : '#0D1B2A' }}>{p}</strong>
      : <span key={i}>{p}</span>
    )
  }

  // CORRIGIDO: sort por _seq para botMsgs (ordem garantida), por criado_em para msgs do banco
  const todasMsgs = (botPronto || conversa?.encerrada)
    ? mensagens
    : [...mensagens, ...botMsgs].sort((a, b) => {
        if (a._seq !== undefined && b._seq !== undefined) return a._seq - b._seq
        if (a._seq !== undefined) return 1
        if (b._seq !== undefined) return -1
        return new Date(a.criado_em) - new Date(b.criado_em)
      })

  let lastDate = null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F0F4FF' }}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerBubble} />
        <div style={s.clinicAvatar}><img src={LOGO_SRC} alt='logo' style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /></div>
        <div style={{ flex: 1 }}>
          <p style={s.headerNome}>Clínica Vida+</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={s.onlineDot} />
            <span style={s.headerStatus}>Equipe disponível agora</span>
          </div>
        </div>
        <a href="tel:+551133333333" style={s.headerAction}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.86-.86a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
          </svg>
        </a>
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
                {!isMe && <div style={s.msgAvatar}><img src={LOGO_SRC} alt='logo' style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /></div>}
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

        {(paciente && !botPronto && botStep === 0 && !conversa?.encerrada) && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <div style={s.msgAvatar}><img src={LOGO_SRC} alt='logo' style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /></div>
            <div style={{ ...s.bubbleThem, padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#CBD5E1', display: 'inline-block', animation: `pulse 1.2s ${d}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {conversa?.encerrada && (
          <div style={s.encerramentoBanner}>
            <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 12 }}>
              Esta conversa foi encerrada. Envie uma mensagem para iniciar um novo atendimento.
            </p>
            <button style={s.novaConversaBtn} onClick={reiniciarConversa}>Iniciar nova conversa</button>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
        )}
        <textarea
          style={{ ...s.input, ...(conversa?.encerrada ? { color: '#9CA3AF' } : {}) }}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
          placeholder={
            conversa?.encerrada ? 'Envie uma mensagem para reiniciar...'
            : botPronto ? 'Escreva sua mensagem...'
            : 'Digite sua resposta...'
          }
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