import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { LOGO_SRC } from '../../lib/logoClinica'

function tocarSom(tipo) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = tipo === 'recv' ? 880 : 600
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.2)
  } catch (e) {}
}

export default function ChatInterno() {
  const { perfil } = useAuth()
  const [conversas, setConversas] = useState([])
  const [ativa, setAtiva] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const bottomRef = useRef(null)
  const ativaRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { ativaRef.current = ativa }, [ativa])

  useEffect(() => {
    fetchConversas()
    const ch = supabase.channel('chat-interno-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens' }, payload => {
        if (payload.new.remetente !== 'paciente') return
        tocarSom('recv')
        fetchConversas()
        if (ativaRef.current?.id === payload.new.paciente_id) {
          setMensagens(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
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
      if (!map[pid]) map[pid] = { ...m.paciente, unread: 0, ultima_msg: m.conteudo || (m.anexo_tipo?.startsWith('image/') ? '🖼️ Imagem' : '📄 Arquivo'), ultima_hora: m.criado_em }
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
    tocarSom('send')
    const msgTemp = { id: 'tmp-' + Date.now(), paciente_id: ativa.id, remetente: 'clinica', conteudo, lida: true, criado_em: new Date().toISOString() }
    setMensagens(prev => [...prev, msgTemp])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    const { data } = await supabase.from('mensagens').insert([{ paciente_id: ativa.id, remetente: 'clinica', conteudo, lida: true }]).select().single()
    if (data) setMensagens(prev => prev.map(m => m.id === msgTemp.id ? data : m))
    setEnviando(false)
  }

  async function handleAnexo(e) {
    const file = e.target.files[0]
    if (!file || !ativa) return
    if (file.type.startsWith('audio/')) { alert('Áudio não permitido.'); return }
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

  const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
  function iniciais(nome) { if (!nome) return '?'; const p = nome.trim().split(' '); return (p.length >= 2 ? p[0][0] + p[p.length-1][0] : p[0].slice(0,2)).toUpperCase() }
  function corAvatar(nome) { const cores = ['#0047AB','#7C3AED','#059669','#DC2626','#D97706']; let h = 0; for (let c of (nome||'')) h += c.charCodeAt(0); return cores[h % cores.length] }

  const conversasFiltradas = conversas.filter(c => c.nome?.toLowerCase().includes(busca.toLowerCase()))
  const lastDate = { current: null }

  if (ativa) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F0F4FF' }}>
      {/* Header conversa */}
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '48px 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setAtiva(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: corAvatar(ativa.nome), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13 }}>{iniciais(ativa.nome)}</div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{ativa.nome}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Paciente</p>
        </div>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 80px' }}>
        {mensagens.map(m => {
          const msgDate = fmtData(m.criado_em)
          const showDate = msgDate !== lastDate.current
          lastDate.current = msgDate
          const isClinica = m.remetente === 'clinica'
          return (
            <div key={m.id}>
              {showDate && <div style={{ textAlign: 'center', margin: '10px 0' }}><span style={{ background: '#E5E7EB', color: '#6B7280', fontSize: 11, padding: '3px 10px', borderRadius: 20 }}>{msgDate}</span></div>}
              <div style={{ display: 'flex', justifyContent: isClinica ? 'flex-end' : 'flex-start', marginBottom: 6, gap: 8, alignItems: 'flex-end' }}>
                {!isClinica && <div style={{ width: 28, height: 28, borderRadius: '50%', background: corAvatar(ativa.nome), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{iniciais(ativa.nome)}</div>}
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ background: isClinica ? 'linear-gradient(135deg, #0047AB, #1a6fdf)' : '#fff', color: isClinica ? '#fff' : '#0D1B2A', borderRadius: isClinica ? '16px 4px 16px 16px' : '4px 16px 16px 16px', padding: '10px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                    {m.anexo_url && m.anexo_tipo?.startsWith('image/') && <a href={m.anexo_url} target="_blank" rel="noreferrer"><img src={m.anexo_url} alt={m.anexo_nome} style={{ maxWidth: 200, borderRadius: 8, marginBottom: 4 }} /></a>}
                    {m.conteudo && <p style={{ fontSize: 14, margin: 0, lineHeight: 1.4 }}>{m.conteudo}</p>}
                  </div>
                  <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 4px 0', textAlign: isClinica ? 'right' : 'left' }}>{fmtHora(m.criado_em)}</p>
                </div>
                {isClinica && <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, overflow: 'hidden' }}><img src={LOGO_SRC} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #E5E7EB', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleAnexo} />
        <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>📎</button>
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEnviar()}
          placeholder="Digite sua mensagem..." disabled={enviando}
          style={{ flex: 1, background: '#F1F5F9', border: 'none', borderRadius: 22, padding: '10px 16px', fontSize: 14, outline: 'none' }} />
        <button onClick={handleEnviar} disabled={!texto.trim() || enviando}
          style={{ width: 44, height: 44, borderRadius: '50%', background: texto.trim() ? 'linear-gradient(135deg, #0047AB, #1a6fdf)' : '#E5E7EB', border: 'none', color: '#fff', fontSize: 18, cursor: texto.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ➤
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '52px 20px 16px' }}>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>Chat</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar paciente..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversasFiltradas.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 14 }}>Nenhuma conversa.</p>}
        {conversasFiltradas.map(c => (
          <div key={c.id} onClick={() => { setAtiva(c); fetchMensagens(c.id); marcarLidas(c.id) }}
            style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: '#fff' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: corAvatar(c.nome), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{iniciais(c.nome)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A' }}>{c.nome}</span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{c.ultima_hora ? fmtHora(c.ultima_hora) : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{c.ultima_msg}</span>
                {c.unread > 0 && <span style={{ background: '#0047AB', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 50, padding: '2px 6px', minWidth: 18, textAlign: 'center' }}>{c.unread}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}