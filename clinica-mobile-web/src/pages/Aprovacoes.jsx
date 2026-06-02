import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './Pages.css'

export default function Aprovacoes() {
  const { profile } = useAuth()
  const toast = useToast()
  const [aba, setAba] = useState('pendentes')
  const [solics, setSolics] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingH, setLoadingH] = useState(false)
  const [novaSolic, setNovaSolic] = useState(null)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const canalRef = useRef(null)

  useEffect(() => {
    fetchSolics()
    iniciarRealtime()
    return () => { if (canalRef.current) supabase.removeChannel(canalRef.current) }
  }, [])

  useEffect(() => {
    if (aba === 'historico') fetchHistorico()
  }, [aba])

  function iniciarRealtime() {
    canalRef.current = supabase
      .channel('aprovacoes-realtime-' + Date.now())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitacoes' }, payload => {
        fetchSolics()
        setNovaSolic(payload.new)
        setTimeout(() => setNovaSolic(null), 5000)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitacoes' }, () => {
        fetchSolics()
        if (aba === 'historico') fetchHistorico()
      })
      .subscribe()
  }

  const selectQuery = `
    *,
    consulta:consultas(*,
      paciente:pacientes(id, nome, cpf, telefone, convenio),
      estagiario:profiles(id, nome, codigo, especialidade)
    ),
    sala_atual:salas!sala_atual_id(nome),
    sala_nova:salas!sala_nova_id(nome)
  `

  async function fetchSolics() {
    const { data } = await supabase
      .from('solicitacoes')
      .select(selectQuery)
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })

    let lista = (data || []).filter(s => s.consulta)
    if (profile?.tipo === 'estagiario') {
      lista = lista.filter(s => s.consulta?.estagiario?.id === profile.id)
    }
    setSolics(lista)
    setLoading(false)
  }

  async function fetchHistorico() {
    setLoadingH(true)
    const { data } = await supabase
      .from('solicitacoes')
      .select(selectQuery)
      .in('status', ['aprovada', 'recusada'])
      .order('criado_em', { ascending: false })
      .limit(100)

    let lista = (data || []).filter(s => s.consulta)
    if (profile?.tipo === 'estagiario') {
      lista = lista.filter(s => s.consulta?.estagiario?.id === profile.id)
    }
    setHistorico(lista)
    setLoadingH(false)
  }

  async function atribuirSalaDisponivel(consulta_id, data, hora) {
    const { data: salaId, error } = await supabase.rpc('atribuir_sala_disponivel', {
      p_consulta_id: consulta_id,
      p_data: data,
      p_hora: hora,
    })
    if (error) console.error('Erro ao atribuir sala:', error)
    return salaId || null
  }

  async function enviarMensagemBot(paciente_id, mensagem) {
    await supabase.from('mensagens').insert([{
      paciente_id,
      remetente: 'clinica',
      conteudo: mensagem,
      tipo: 'bot',
      lida: false,
    }])
  }

  async function handleAprovar(s, aprovado) {
    const isEstagiario = profile?.tipo === 'estagiario'
    const isAdmin = ['admin', 'coordenador', 'recepcionista'].includes(profile?.tipo)
    if (!isEstagiario && !isAdmin) { toast.error('Sem permissão.'); return }

    const update = {}
    if (isEstagiario) update.aprovado_medico = aprovado
    if (isAdmin) update.aprovado_admin = aprovado

    const paciente_id = s.consulta?.paciente?.id
    const data_consulta = s.consulta?.data
    const hora_consulta = s.consulta?.hora?.slice(0, 5)
    const dataFmt = data_consulta ? new Date(data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const estagiarioNome = s.consulta?.estagiario?.nome || 'estagiário'
    const codigo = s.consulta?.estagiario?.codigo ? ` (${s.consulta.estagiario.codigo})` : ''

    if (!aprovado) {
      update.status = 'recusada'
      await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      if (paciente_id) {
        await enviarMensagemBot(paciente_id,
          `❌ Infelizmente sua consulta do dia ${dataFmt} às ${hora_consulta} com ${estagiarioNome}${codigo} não pôde ser confirmada.\n\nEntre em contato conosco para reagendar.`
        )
      }
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)
    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()

    const novoAgendamento = fresh?.tipo === 'novo_agendamento'
    const ambosAprovaram = novoAgendamento
      ? fresh?.aprovado_medico === true
      : fresh?.aprovado_medico === true && fresh?.aprovado_admin === true

    if (ambosAprovaram) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)

      if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
        if (paciente_id) {
          await enviarMensagemBot(paciente_id,
            `✅ Seu cancelamento de consulta do dia ${dataFmt} às ${hora_consulta} foi aprovado.\n\nSe desejar, pode agendar uma nova consulta pelo app.`
          )
        }

      } else if (fresh.tipo === 'reagendamento') {
        const novaDataFmt = new Date(fresh.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')
        await supabase.from('consultas').update({
          data: fresh.nova_data,
          hora: fresh.nova_hora,
          status: 'confirmada'
        }).eq('id', s.consulta_id)
        if (paciente_id) {
          await enviarMensagemBot(paciente_id,
            `📅 Reagendamento aprovado!\n\n📅 Nova data: ${novaDataFmt} às ${fresh.nova_hora?.slice(0, 5)}\n👤 Profissional: ${estagiarioNome}${codigo}\n\nAté lá! 😊`
          )
        }

      } else if (fresh.tipo === 'troca_sala') {
        await supabase.from('consultas').update({ sala_id: fresh.sala_nova_id, status: 'confirmada' }).eq('id', s.consulta_id)

      } else if (novoAgendamento) {
        const salaId = await atribuirSalaDisponivel(s.consulta_id, data_consulta, s.consulta?.hora)
        const { data: consultaAtualizada } = await supabase.from('consultas').select('sala:salas(nome)').eq('id', s.consulta_id).single()
        const salaNome = consultaAtualizada?.sala?.nome

        if (paciente_id) {
          await enviarMensagemBot(paciente_id,
            `🎉 Sua consulta foi confirmada!\n\n📅 ${dataFmt} às ${hora_consulta}\n👤 ${estagiarioNome}${codigo}${salaNome ? `\n🚪 Sala: ${salaNome}` : ''}\n\nAguardamos você! Qualquer dúvida fale aqui. 😊`
          )
        }
      }
    }

    fetchSolics()
    window.dispatchEvent(new Event('refresh-badges'))
  }

  const canAct = (s) => {
    if (profile?.tipo === 'estagiario') {
      return s.consulta?.estagiario?.id === profile.id && s.aprovado_medico === null
    }
    if (['admin', 'coordenador', 'recepcionista'].includes(profile?.tipo)) {
      if (s.tipo === 'novo_agendamento') return false
      return s.aprovado_admin === null
    }
    return false
  }

  const tipoConfig = {
    novo_agendamento: { label: 'Novo Agendamento', emoji: '📋', color: '#2563eb', bg: '#eff6ff', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
    cancelamento:     { label: 'Cancelamento',      emoji: '❌', color: '#dc2626', bg: '#fef2f2', badgeBg: '#fee2e2', badgeColor: '#b91c1c' },
    reagendamento:    { label: 'Reagendamento',      emoji: '📅', color: '#ca8a04', bg: '#fefce8', badgeBg: '#fef9c3', badgeColor: '#a16207' },
    troca_sala:       { label: 'Troca de Sala',      emoji: '🚪', color: '#7c3aed', bg: '#faf5ff', badgeBg: '#ede9fe', badgeColor: '#6d28d9' },
  }

  function fmtCpf(cpf) {
    if (!cpf) return ''
    const d = cpf.replace(/\D/g, '')
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  function renderCard(s, isPendente) {
    const cfg = tipoConfig[s.tipo] || tipoConfig.novo_agendamento
    const data_consulta = s.consulta?.data
    const hora_consulta = s.consulta?.hora?.slice(0, 5)
    const dataFmt = data_consulta ? new Date(data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
    const pac = s.consulta?.paciente
    const est = s.consulta?.estagiario

    return (
      <div key={s.id} style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>

          {/* Ícone tipo */}
          <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            {cfg.emoji}
          </div>

          {/* Conteúdo */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{cfg.label}</p>
              <span style={{ background: cfg.badgeBg, color: cfg.badgeColor, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>
                {isPendente ? 'Aguardando' : s.status === 'aprovada' ? '✓ Aprovada' : '✗ Recusada'}
              </span>
              {!isPendente && s.criado_em && (
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                  {new Date(s.criado_em).toLocaleDateString('pt-BR')} {new Date(s.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Paciente + Estagiário */}
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px' }}>
              Paciente: <strong style={{ color: 'var(--text)' }}>{pac?.nome}</strong>
              {pac?.cpf && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 6 }}>CPF: {fmtCpf(pac.cpf)}</span>}
              {' · '}Estagiário: {est?.nome}
              {est?.codigo && (
                <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                  {est.codigo}
                </span>
              )}
            </p>

            {/* Info card */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
              {s.tipo === 'reagendamento' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Data atual</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{dataFmt} às {hora_consulta}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Nova data solicitada</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, margin: 0 }}>
                      {s.nova_data ? new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} às {s.nova_hora?.slice(0, 5) || '—'}
                    </p>
                  </div>
                </div>
              ) : s.tipo === 'troca_sala' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Data</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{dataFmt}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Sala atual</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{s.sala_atual?.nome || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Nova sala</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: cfg.color, margin: 0 }}>{s.sala_nova?.nome || '—'}</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Data</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{dataFmt}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Horário</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{hora_consulta}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Tipo</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{s.consulta?.tipo || '—'}</p>
                  </div>
                </div>
              )}

              {/* Convênio e telefone se novo agendamento */}
              {s.tipo === 'novo_agendamento' && (pac?.convenio || pac?.telefone) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid #E5E7EB' }}>
                  {pac?.telefone && (
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Telefone</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{pac.telefone}</p>
                    </div>
                  )}
                  {pac?.convenio && (
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>Convênio</p>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', margin: 0 }}>{pac.convenio}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {s.tipo === 'novo_agendamento' && isPendente && (
              <p style={{ fontSize: 11, color: '#2563eb', margin: '0 0 8px' }}>
                ✨ Ao aprovar, sala será atribuída automaticamente e paciente será notificado no chat.
              </p>
            )}

            {s.motivo && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: '0 0 8px', fontStyle: 'italic' }}>
                Motivo: {s.motivo}
              </p>
            )}

            {/* Status badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                background: s.aprovado_medico === true ? '#dcfce7' : s.aprovado_medico === false ? '#fef2f2' : '#f1f5f9',
                color: s.aprovado_medico === true ? '#166534' : s.aprovado_medico === false ? '#b91c1c' : '#64748b',
              }}>
                {s.aprovado_medico === true ? '✓ Estagiário aprovou' : s.aprovado_medico === false ? '✗ Estagiário recusou' : '⏳ Estagiário pendente'}
              </span>
              {s.tipo !== 'novo_agendamento' && (
                <span style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500,
                  background: s.aprovado_admin === true ? '#dcfce7' : s.aprovado_admin === false ? '#fef2f2' : '#f1f5f9',
                  color: s.aprovado_admin === true ? '#166534' : s.aprovado_admin === false ? '#b91c1c' : '#64748b',
                }}>
                  {s.aprovado_admin === true ? '✓ Admin aprovou' : s.aprovado_admin === false ? '✗ Admin recusou' : '⏳ Admin pendente'}
                </span>
              )}
            </div>
          </div>

          {/* Botões Aprovar/Recusar — só na aba pendentes */}
          {isPendente && canAct(s) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={() => handleAprovar(s, true)}>
                ✓ Aprovar
              </button>
              <button
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#f8fafc', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                onClick={() => handleAprovar(s, false)}>
                ✗ Recusar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const historicoFiltrado = historico.filter(s => {
    const matchTipo = !filtroTipo || s.tipo === filtroTipo
    const matchStatus = !filtroStatus || s.status === filtroStatus
    const matchBusca = !busca ||
      s.consulta?.paciente?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.consulta?.estagiario?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      s.consulta?.estagiario?.codigo?.toLowerCase().includes(busca.toLowerCase())
    return matchTipo && matchStatus && matchBusca
  })

  const skeletons = [1,2,3].map(i => (
    <div key={i} className="card" style={{ padding: 20, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, animation: 'skpulse 1.5s ease-in-out infinite' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f8fafc' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 14, background: '#f8fafc', borderRadius: 6, width: '40%' }} />
          <div style={{ height: 12, background: '#f8fafc', borderRadius: 6, width: '65%' }} />
          <div style={{ height: 60, background: '#f8fafc', borderRadius: 8 }} />
        </div>
      </div>
    </div>
  ))

  if (loading) return (
    <div className="page">
      <div className="page-header"><div><h1>Aprovações</h1></div></div>
      {skeletons}
      <style>{`@keyframes skpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Aprovações</h1>
          <p className="page-sub">{aba === 'pendentes' ? `${solics.length} solicitação(ões) pendente(s)` : `${historicoFiltrado.length} no histórico`}</p>
        </div>
      </div>

      {/* Banner de nova solicitação em tempo real */}
      {novaSolic && (
        <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, animation: 'slideIn 0.3s ease' }}>
          <span style={{ fontSize: 24 }}>🔔</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Nova solicitação recebida!</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
              {tipoConfig[novaSolic.tipo]?.label || 'Solicitação'} — aguardando aprovação
            </p>
          </div>
          <button onClick={() => setNovaSolic(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)' }}>
        {[['pendentes', '⏳ Pendentes', solics.length], ['historico', '📋 Histórico', null]].map(([k, l, count]) => (
          <button key={k} onClick={() => setAba(k)} style={{
            padding: '10px 20px', fontSize: 13, fontWeight: aba === k ? 700 : 500, cursor: 'pointer',
            border: 'none', background: 'none', color: aba === k ? 'var(--p)' : 'var(--muted)',
            borderBottom: aba === k ? '2px solid var(--p)' : '2px solid transparent',
            marginBottom: -2, transition: '.15s', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {l}
            {count !== null && count > 0 && (
              <span style={{ background: 'var(--p)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 10 }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Aba Pendentes */}
      {aba === 'pendentes' && (
        <>
          {solics.length === 0 ? (
            <div className="card">
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                Nenhuma solicitação pendente.
              </div>
            </div>
          ) : (
            solics.map(s => renderCard(s, true))
          )}
        </>
      )}

      {/* Aba Histórico */}
      {aba === 'historico' && (
        <>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              placeholder="🔍 Buscar paciente, estagiário ou código..."
              value={busca} onChange={e => setBusca(e.target.value)}
              style={{ flex: 1, minWidth: 220, padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
            />
            <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
              style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff' }}>
              <option value="">Todos os tipos</option>
              <option value="novo_agendamento">Novo Agendamento</option>
              <option value="cancelamento">Cancelamento</option>
              <option value="reagendamento">Reagendamento</option>
              <option value="troca_sala">Troca de Sala</option>
            </select>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
              style={{ padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: '#fff' }}>
              <option value="">Aprovadas e Recusadas</option>
              <option value="aprovada">Aprovadas</option>
              <option value="recusada">Recusadas</option>
            </select>
            {(busca || filtroTipo || filtroStatus) && (
              <button className="btn-outline" style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => { setBusca(''); setFiltroTipo(''); setFiltroStatus('') }}>
                ✕ Limpar
              </button>
            )}
          </div>

          {loadingH ? skeletons : historicoFiltrado.length === 0 ? (
            <div className="card">
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                Nenhum registro encontrado.
              </div>
            </div>
          ) : (
            historicoFiltrado.map(s => renderCard(s, false))
          )}
        </>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes skpulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </div>
  )
}