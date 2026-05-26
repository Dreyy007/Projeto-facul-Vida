import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })

export default function ChatInterno() {
  const { perfil: profile } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => { fetchPacientes() }, [profile])

  useEffect(() => {
    if (!selecionado) return
    fetchMensagens(selecionado.id)
    const sub = supabase.channel('chat-interno-' + selecionado.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `paciente_id=eq.${selecionado.id}` },
        () => fetchMensagens(selecionado.id))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [selecionado])

  async function fetchPacientes() {
    // Busca pacientes que têm mensagens
    const { data } = await supabase.from('mensagens')
      .select('paciente_id, paciente:pacientes(id, nome)')
      .order('criado_em', { ascending: false })

    const uniq = {}
    ;(data || []).forEach(m => { if (m.paciente && !uniq[m.paciente_id]) uniq[m.paciente_id] = m.paciente })
    setPacientes(Object.values(uniq))
    setLoading(false)
  }

  async function fetchMensagens(pacienteId) {
    const { data } = await supabase.from('mensagens').select('*')
      .eq('paciente_id', pacienteId).order('criado_em')
    setMensagens(data || [])
    // Marca como lidas
    await supabase.from('mensagens').update({ lida: true })
      .eq('paciente_id', pacienteId).eq('remetente', 'paciente').eq('lida', false)
  }

  async function handleEnviar(e) {
    e?.preventDefault()
    if (!texto.trim() || !selecionado) return
    setSending(true)
    await supabase.from('mensagens').insert([{
      paciente_id: selecionado.id,
      remetente: 'clinica',
      conteudo: texto.trim(),
      lida: false,
    }])
    setTexto('')
    setSending(false)
    fetchMensagens(selecionado.id)
  }

  if (selecionado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F0F4FF' }}>
        <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '48px 16px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelecionado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 19, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {selecionado.nome?.slice(0, 2).toUpperCase()}
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{selecionado.nome}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {mensagens.filter(m => m.tipo !== 'bot' || m.remetente === 'clinica').map(m => {
            const isMe = m.remetente === 'clinica'
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: 8, gap: 8, alignItems: 'flex-end' }}>
                {!isMe && (
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
                    {selecionado.nome?.slice(0, 1)}
                  </div>
                )}
                <div style={{ maxWidth: '78%', background: isMe ? 'linear-gradient(135deg, #0047AB, #1d6fef)' : '#fff', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  {!!m.conteudo && <p style={{ fontSize: 14, color: isMe ? '#fff' : '#0D1B2A', whiteSpace: 'pre-line', lineHeight: '20px' }}>{m.conteudo}</p>}
                  <p style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.55)' : '#9CA3AF', marginTop: 4, textAlign: 'right' }}>{fmtHora(m.criado_em)}</p>
                </div>
              </div>
            )
          })}
          <div style={{ height: 8 }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', backgroundColor: '#fff', borderTop: '1px solid #F3F4F6', gap: 10 }}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
            placeholder="Escreva uma mensagem..."
            rows={1}
            style={{ flex: 1, backgroundColor: '#F1F5F9', borderRadius: 22, padding: '10px 16px', fontSize: 14, color: '#0D1B2A', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
          />
          <button onClick={handleEnviar} disabled={!texto.trim() || sending}
            style={{ width: 44, height: 44, borderRadius: 22, background: texto.trim() ? 'linear-gradient(135deg, #0047AB, #1d6fef)' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{ transform: 'rotate(45deg)', marginLeft: 2 }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Chat</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Mensagens dos pacientes</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && pacientes.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhuma mensagem ainda.</p>}
        {pacientes.map(p => (
          <button key={p.id} onClick={() => setSelecionado(p)}
            style={{ width: '100%', background: '#fff', border: 'none', borderBottom: '1px solid #F3F4F6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
              {p.nome?.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{p.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>Toque para ver mensagens</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
      </div>
    </div>
  )
}