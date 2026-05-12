import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'
import './Chat.css'

export default function Chat() {
  const { profile } = useAuth()
  const [conversas, setConversas] = useState([])
  const [ativa, setAtiva] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    fetchConversas()
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    if (!ativa) return
    fetchMensagens(ativa.id)
    marcarLidas(ativa.id)

    const channel = supabase
      .channel('chat-' + ativa.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: `paciente_id=eq.${ativa.id}`
      }, payload => {
        setMensagens(prev => [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        if (payload.new.remetente === 'paciente') {
          notificarBrowser(ativa.nome, payload.new.conteudo || '📎 Anexo')
          fetchConversas()
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [ativa])

  function notificarBrowser(nome, mensagem) {
    if (document.visibilityState === 'visible') return
    if (Notification.permission === 'granted') {
      new Notification(`💬 ${nome}`, { body: mensagem, icon: '/favicon.ico' })
    }
  }

  async function fetchConversas() {
    const { data } = await supabase
      .from('mensagens')
      .select('paciente_id, paciente:pacientes(id, nome), lida, remetente')
      .order('criado_em', { ascending: false })

    const map = {}
    data?.forEach(m => {
      const pid = m.paciente_id
      if (!map[pid]) map[pid] = { ...m.paciente, unread: 0 }
      if (!m.lida && m.remetente === 'paciente') map[pid].unread++
    })
    setConversas(Object.values(map))
  }

  async function fetchMensagens(pacienteId) {
    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em')
    setMensagens(data || [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function marcarLidas(pacienteId) {
    await supabase.from('mensagens').update({ lida: true }).eq('paciente_id', pacienteId).eq('remetente', 'paciente')
    fetchConversas()
  }

  async function handleEnviar() {
    if (!texto.trim() || !ativa || enviando) return
    setEnviando(true)
    await supabase.from('mensagens').insert([{
      paciente_id: ativa.id,
      remetente: 'clinica',
      conteudo: texto.trim(),
      lida: true,
    }])
    setTexto('')
    setEnviando(false)
  }

  async function handleAnexo(e) {
    const file = e.target.files[0]
    if (!file || !ativa) return

    // Bloqueia áudio
    if (file.type.startsWith('audio/')) {
      alert('Envio de áudio não é permitido.')
      return
    }

    setEnviando(true)
    const ext = file.name.split('.').pop()
    const path = `${ativa.id}/${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('chat-anexos').upload(path, file)
    if (error) { alert('Erro ao enviar arquivo.'); setEnviando(false); return }

    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)

    await supabase.from('mensagens').insert([{
      paciente_id: ativa.id,
      remetente: 'clinica',
      conteudo: '',
      anexo_url: urlData.publicUrl,
      anexo_tipo: file.type,
      anexo_nome: file.name,
      lida: true,
    }])

    e.target.value = ''
    setEnviando(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() }
  }

  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

  function renderAnexo(m) {
    if (!m.anexo_url) return null
    const tipo = m.anexo_tipo || ''

    if (tipo.startsWith('image/')) {
      return (
        <a href={m.anexo_url} target="_blank" rel="noreferrer">
          <img src={m.anexo_url} alt={m.anexo_nome} className="msg-img" />
        </a>
      )
    }

    return (
      <a href={m.anexo_url} target="_blank" rel="noreferrer" className="msg-doc">
        <span className="msg-doc-icon">📄</span>
        <span className="msg-doc-nome">{m.anexo_nome}</span>
      </a>
    )
  }

  let lastDate = null

  return (
    <div className="chat-page">
      <div className="chat-list">
        <div className="chat-list-header">
          <h3>Conversas</h3>
          <span className="chat-count">{conversas.filter(c => c.unread > 0).length} não lidas</span>
        </div>
        {conversas.length === 0 && <div className="empty" style={{ padding: 20 }}>Nenhuma conversa ainda.</div>}
        {conversas.map(c => (
          <div key={c.id} className={`chat-list-item${ativa?.id === c.id ? ' active' : ''}`} onClick={() => { setAtiva(c); fetchMensagens(c.id); marcarLidas(c.id) }}>
            <div className="chat-av">{c.nome?.slice(0, 2).toUpperCase()}</div>
            <div className="chat-item-info">
              <div className="chat-item-name">{c.nome}</div>
              <div className="chat-item-sub">Paciente</div>
            </div>
            {c.unread > 0 && <span className="unread">{c.unread}</span>}
          </div>
        ))}
      </div>

      <div className="chat-window">
        {!ativa ? (
          <div className="chat-empty">
            <div style={{ fontSize: 40 }}>💬</div>
            <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 12 }}>Selecione uma conversa para começar</div>
          </div>
        ) : (
          <>
            <div className="chat-win-header">
              <div className="chat-av">{ativa.nome?.slice(0, 2).toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ativa.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--success)' }}>● Paciente</div>
              </div>
            </div>

            <div className="chat-messages">
              {mensagens.map(m => {
                const msgDate = fmtData(m.criado_em)
                const showDate = msgDate !== lastDate
                lastDate = msgDate

                return (
                  <div key={m.id}>
                    {showDate && (
                      <div className="chat-date-divider"><span>{msgDate}</span></div>
                    )}
                    <div className={`msg-row ${m.remetente === 'clinica' ? 'me' : 'them'}`}>
                      <div className="msg-bubble">
                        {renderAnexo(m)}
                        {m.conteudo && <span>{m.conteudo}</span>}
                      </div>
                      <div className="msg-time">
                        {m.remetente === 'clinica' ? 'Clínica' : ativa.nome} · {fmtHora(m.criado_em)}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-bar">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleAnexo}
              />
              <button className="btn-clip" onClick={() => fileRef.current?.click()} title="Anexar arquivo" disabled={enviando}>
                📎
              </button>
              <textarea
                className="chat-textarea"
                placeholder="Digite uma mensagem... (Enter para enviar)"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                disabled={enviando}
              />
              <button className="btn-primary" onClick={handleEnviar} disabled={!texto.trim() || enviando}>
                {enviando ? '...' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}