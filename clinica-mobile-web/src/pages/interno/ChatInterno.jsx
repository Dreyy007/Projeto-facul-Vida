import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtDataCurta = d => {
  const hoje = new Date().toDateString()
  const data = new Date(d)
  if (data.toDateString() === hoje) return fmtHora(d)
  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

export default function ChatInterno() {
  const { perfil: profile } = useAuth()
  const [conversas, setConversas] = useState([])
  const [ativa, setAtiva] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [busca, setBusca] = useState('')
  const scrollRef = useRef(null)
  const ativaRef = useRef(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)
  const [showAnexo, setShowAnexo] = useState(false)

  useEffect(() => {
    fetchConversas()
    const channel = supabase.channel('chat-interno-all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, payload => {
        if (ativaRef.current?.id === payload.new.paciente_id) {
          setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          scrollDown()
          if (payload.new.remetente === 'paciente') marcarLidas(payload.new.paciente_id)
        } else {
          setConversas(prev => prev.map(c => c.id === payload.new.paciente_id
            ? { ...c, ultima: payload.new, unread: payload.new.remetente === 'paciente' ? (c.unread || 0) + 1 : c.unread }
            : c
          ))
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { ativaRef.current = ativa }, [ativa])

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }), 100)

  async function fetchConversas() {
    const { data } = await supabase
      .from('mensagens')
      .select('paciente_id, paciente:pacientes(id, nome), lida, remetente, conteudo, anexo_tipo, criado_em')
      .order('criado_em', { ascending: false })

    const map = {}
    ;(data || []).forEach(m => {
      const pid = m.paciente_id
      if (!map[pid]) map[pid] = { ...m.paciente, ultima: m, unread: 0 }
      if (!m.lida && m.remetente === 'paciente') map[pid].unread++
    })
    setConversas(Object.values(map))
  }

  async function fetchMensagens(pacienteId) {
    const { data } = await supabase.from('mensagens').select('*')
      .eq('paciente_id', pacienteId).order('criado_em')
    setMensagens(data || [])
    scrollDown()
    marcarLidas(pacienteId)
  }

  async function marcarLidas(pacienteId) {
    await supabase.from('mensagens').update({ lida: true })
      .eq('paciente_id', pacienteId).eq('remetente', 'paciente')
    setConversas(prev => prev.map(c => c.id === pacienteId ? { ...c, unread: 0 } : c))
  }

  function abrirConversa(conv) {
    setAtiva(conv)
    fetchMensagens(conv.id)
    setShowAnexo(false)
  }

  async function handleEnviar(e) {
    e?.preventDefault()
    if (!texto.trim() || !ativa) return
    setSending(true)
    await supabase.from('mensagens').insert([{
      paciente_id: ativa.id,
      remetente: 'clinica',
      conteudo: texto.trim(),
      lida: false,
    }])
    setTexto('')
    setSending(false)
  }

  async function uploadAnexo(file) {
    if (!ativa) return
    setSending(true); setShowAnexo(false)
    const ext = file.name.split('.').pop()
    const path = `${ativa.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-anexos').upload(path, file, { contentType: file.type })
    if (error) { alert('Erro ao enviar.'); setSending(false); return }
    const { data: urlData } = supabase.storage.from('chat-anexos').getPublicUrl(path)
    await supabase.from('mensagens').insert([{
      paciente_id: ativa.id,
      remetente: 'clinica',
      conteudo: '',
      anexo_url: urlData.publicUrl,
      anexo_tipo: file.type,
      anexo_nome: file.name,
      lida: false,
    }])
    setSending(false)
  }

  function renderConteudo(txt, isMe) {
    if (!txt) return null
    const parts = txt.split(/\*\*(.*?)\*\*/g)
    return parts.map((p, i) => i % 2 === 1
      ? <strong key={i} style={{ color: isMe ? '#fff' : '#0D1B2A' }}>{p}</strong>
      : <span key={i}>{p}</span>
    )
  }

  const conversasFiltradas = conversas.filter(c =>
    !busca || c.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  const totalUnread = conversas.reduce((acc, c) => acc + (c.unread || 0), 0)

  // Tela de conversa
  if (ativa) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F0F4FF' }}>
      {/* Header conversa */}
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '48px 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => { setAtiva(null); setMensagens([]); fetchConversas() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
          {ativa.nome?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>{ativa.nome}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Paciente</p>
        </div>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {mensagens.map(m => {
          const isMe = m.remetente === 'clinica'
          const isSystem = m.tipo === 'aviso_inatividade' || m.tipo === 'encerramento'

          if (isSystem) return (
            <div key={m.id} style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 12, padding: '8px 14px', margin: '6px 0', border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: 12, color: '#6B7280', textAlign: 'center' }}>{m.conteudo}</p>
            </div>
          )

          // Mensagem bot rica
          const isNotifBot = (m.tipo === 'bot' || m.tipo === 'bot_concluido') && m.remetente === 'clinica'
          if (isNotifBot) {
            const color = m.conteudo?.includes('🎉') || m.conteudo?.includes('confirmada') ? '#166534'
              : m.conteudo?.includes('❌') || m.conteudo?.includes('cancelada') ? '#dc2626'
              : m.conteudo?.includes('📅') ? '#ca8a04' : '#1d4ed8'
            const bg = m.conteudo?.includes('🎉') || m.conteudo?.includes('confirmada') ? '#f0fdf4'
              : m.conteudo?.includes('❌') || m.conteudo?.includes('cancelada') ? '#fef2f2'
              : m.conteudo?.includes('📅') ? '#fefce8' : '#eff6ff'
            return (
              <div key={m.id} style={{ display: 'flex', marginBottom: 8, gap: 8, alignItems: 'flex-end' }}>
                <div style={{ width: 28, height: 28, borderRadius: 14, background: '#0047AB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                </div>
                <div style={{ maxWidth: '80%', background: '#fff', border: `0.5px solid ${color}30`, borderRadius: '4px 16px 16px 16px', borderLeft: `3px solid ${color}`, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingBottom: 6, borderBottom: '0.5px solid #F3F4F6' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color, margin: 0 }}>Clínica Vida+</p>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9CA3AF' }}>{fmtHora(m.criado_em)}</span>
                  </div>
                  <p style={{ fontSize: 13, color: '#0D1B2A', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{renderConteudo(m.conteudo, false)}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 8, gap: 8, alignItems: 'flex-end' }}>
              {!isMe && (
                <div style={{ width: 28, height: 28, borderRadius: 14, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
                  {ativa.nome?.slice(0, 1)}
                </div>
              )}
              <div style={{ maxWidth: '78%', background: isMe ? 'linear-gradient(135deg, #0047AB, #1d6fef)' : '#fff', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                {m.anexo_url && m.anexo_tipo?.startsWith('image/') && (
                  <img src={m.anexo_url} alt="anexo" style={{ width: 180, height: 140, borderRadius: 10, objectFit: 'cover', marginBottom: 4, display: 'block' }} />
                )}
                {m.anexo_url && !m.anexo_tipo?.startsWith('image/') && (
                  <a href={m.anexo_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>📄</span>
                    <span style={{ fontSize: 13, color: isMe ? '#fff' : '#0D1B2A', fontWeight: 500 }}>{m.anexo_nome}</span>
                  </a>
                )}
                {!!m.conteudo && <p style={{ fontSize: 14, color: isMe ? '#fff' : '#0D1B2A', whiteSpace: 'pre-line', lineHeight: '20px', margin: 0 }}>{renderConteudo(m.conteudo, isMe)}</p>}
                <p style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.55)' : '#9CA3AF', marginTop: 4, textAlign: 'right', margin: '4px 0 0' }}>{fmtHora(m.criado_em)}{isMe && ' ✓✓'}</p>
              </div>
            </div>
          )
        })}
        <div style={{ height: 8 }} />
      </div>

      {/* Área de envio */}
      {showAnexo && (
        <div style={{ backgroundColor: '#fff', borderTop: '1px solid #E5E7EB', display: 'flex', padding: '12px 20px', gap: 16 }}>
          <button onClick={() => imageRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EFF6FF', border: '1.5px dashed #93C5FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <span style={{ fontSize: 11, color: '#0047AB', fontWeight: 600 }}>Foto</span>
          </button>
          <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EFF6FF', border: '1.5px dashed #93C5FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <span style={{ fontSize: 11, color: '#0047AB', fontWeight: 600 }}>Arquivo</span>
          </button>
        </div>
      )}

      <input ref={imageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadAnexo(e.target.files[0])} />
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadAnexo(e.target.files[0])} />

      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', backgroundColor: '#fff', borderTop: '1px solid #F3F4F6', gap: 10 }}>
        <button onClick={() => setShowAnexo(v => !v)} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <textarea value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
          placeholder="Escreva uma mensagem..." rows={1} maxLength={500}
          style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 22, padding: '10px 16px', fontSize: 14, color: '#0D1B2A', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
        <button onClick={handleEnviar} disabled={!texto.trim() || sending}
          style={{ width: 44, height: 44, borderRadius: 22, background: texto.trim() ? 'linear-gradient(135deg, #0047AB, #1d6fef)' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ transform: 'rotate(45deg)', marginLeft: 2 }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )

  // Lista de conversas
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Chat</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{totalUnread > 0 ? `${totalUnread} não lida(s)` : 'Todas lidas'}</p>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar paciente..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversasFiltradas.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhuma conversa.</p>
        )}
        {conversasFiltradas.map(c => {
          const ultima = c.ultima
          const previa = ultima?.anexo_tipo?.startsWith('image/') ? '📷 Imagem'
            : ultima?.anexo_url ? '📎 Arquivo'
            : ultima?.conteudo?.slice(0, 40) || '...'

          return (
            <button key={c.id} onClick={() => abrirConversa(c)}
              style={{ width: '100%', background: '#fff', border: 'none', borderBottom: '1px solid #F3F4F6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#0047AB' }}>
                  {c.nome?.slice(0, 2).toUpperCase()}
                </div>
                {c.unread > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 50, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
                    {c.unread > 9 ? '9+' : c.unread}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <p style={{ fontSize: 14, fontWeight: c.unread > 0 ? 700 : 500, color: '#0D1B2A', margin: 0 }}>{c.nome}</p>
                  {ultima && <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, marginLeft: 8 }}>{fmtDataCurta(ultima.criado_em)}</span>}
                </div>
                <p style={{ fontSize: 13, color: c.unread > 0 ? '#0047AB' : '#9CA3AF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.unread > 0 ? 600 : 400 }}>
                  {ultima?.remetente === 'clinica' ? 'Você: ' : ''}{previa}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}