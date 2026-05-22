import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Pages.css'

export default function Aprovacoes() {
  const { profile } = useAuth()
  const [solics, setSolics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSolics() }, [])

  async function fetchSolics() {
    const { data } = await supabase
      .from('solicitacoes')
      .select('*, consulta:consultas(*, paciente:pacientes(id, nome), estagiario:profiles(id, nome, codigo)), sala_atual:salas!sala_atual_id(nome), sala_nova:salas!sala_nova_id(nome)')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })

    let lista = (data || []).filter(s => s.consulta)
    if (profile?.tipo === 'estagiario') {
      lista = lista.filter(s => s.consulta?.estagiario?.id === profile.id)
    }
    setSolics(lista)
    setLoading(false)
  }

  async function atribuirSalaDisponivel(consulta_id, data, hora) {
    const { data: salaId, error } = await supabase.rpc('atribuir_sala_disponivel', {
      p_consulta_id: consulta_id,
      p_data: data,
      p_hora: hora,
    })
    if (error) console.error('Erro ao atribuir sala:', error)
    return salaId ? { id: salaId } : null
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
    const isMedico = profile?.tipo === 'estagiario'
    const isAdmin = ['admin', 'coordenador', 'recepcionista'].includes(profile?.tipo)
    if (!isMedico && !isAdmin) return alert('Sem permissão.')

    const update = {}
    if (isMedico) update.aprovado_medico = aprovado
    if (isAdmin) update.aprovado_admin = aprovado

    const paciente_id = s.consulta?.paciente?.id
    const data_consulta = s.consulta?.data
    const hora_consulta = s.consulta?.hora?.slice(0, 5)
    const dataFmt = data_consulta ? new Date(data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const estagiarioNome = s.consulta?.estagiario?.nome || 'estagiário'

    if (!aprovado) {
      update.status = 'recusada'
      await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      if (paciente_id) {
        await enviarMensagemBot(paciente_id,
          `❌ Infelizmente sua consulta do dia ${dataFmt} às ${hora_consulta} com ${estagiarioNome} não pôde ser confirmada. Entre em contato conosco para reagendar.`
        )
      }
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)
    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()

    const novoAgendamento = fresh?.tipo === 'novo_agendamento'
    const ambosAprovaram = novoAgendamento
      ? fresh?.aprovado_medico === true
      : fresh?.aprovado_medico && fresh?.aprovado_admin

    if (ambosAprovaram) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)

      if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
        if (paciente_id) {
          await enviarMensagemBot(paciente_id,
            `✅ Seu cancelamento de consulta do dia ${dataFmt} às ${hora_consulta} foi aprovado.`
          )
        }
      } else if (fresh.tipo === 'reagendamento') {
        await supabase.from('consultas').update({ data: fresh.nova_data, hora: fresh.nova_hora, status: 'confirmada' }).eq('id', s.consulta_id)
        if (paciente_id) {
          const novaDataFmt = new Date(fresh.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')
          await enviarMensagemBot(paciente_id,
            `📅 Reagendamento aprovado!\n📅 Nova data: ${novaDataFmt} às ${fresh.nova_hora?.slice(0, 5)}\n👤 Profissional: ${estagiarioNome}\n\nAté lá!`
          )
        }
      } else if (fresh.tipo === 'troca_sala') {
        await supabase.from('consultas').update({ sala_id: fresh.sala_nova_id, status: 'confirmada' }).eq('id', s.consulta_id)
      } else if (novoAgendamento) {
        const sala = await atribuirSalaDisponivel(s.consulta_id, data_consulta, s.consulta?.hora)
        if (!sala) await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', s.consulta_id)
        if (paciente_id) {
          const salaInfo = sala ? `\n🚪 Sala: aguarde confirmação` : ''
          await enviarMensagemBot(paciente_id,
            `🎉 Sua consulta foi confirmada!\n📅 Data: ${dataFmt}\n⏰ Horário: ${hora_consulta}\n👤 Profissional: ${estagiarioNome}${salaInfo}\n\nAguardamos você! Em caso de dúvidas, fale conosco por aqui.`
          )
        }
      }
    }

    fetchSolics()
  }

  const canAct = (s) => {
    if (profile?.tipo === 'estagiario') return s.consulta?.estagiario?.id === profile.id && s.aprovado_medico === null
    if (['admin', 'coordenador', 'recepcionista'].includes(profile?.tipo)) {
      if (s.tipo === 'novo_agendamento') return false
      return s.aprovado_admin === null
    }
    return false
  }

  const tipoConfig = {
    novo_agendamento: { label: 'Novo Agendamento', icon: 'ti-calendar-plus', color: '#2563eb', bg: '#eff6ff', badgeBg: '#eff6ff', badgeColor: '#1d4ed8' },
    cancelamento:     { label: 'Cancelamento',      icon: 'ti-calendar-x',    color: '#dc2626', bg: '#fef2f2', badgeBg: '#fef2f2', badgeColor: '#b91c1c' },
    reagendamento:    { label: 'Reagendamento',      icon: 'ti-calendar-event',color: '#ca8a04', bg: '#fefce8', badgeBg: '#fefce8', badgeColor: '#a16207' },
    troca_sala:       { label: 'Troca de Sala',      icon: 'ti-door',          color: '#7c3aed', bg: '#faf5ff', badgeBg: '#faf5ff', badgeColor: '#6d28d9' },
  }

  if (loading) return (
    <div className="page">
      <div className="page-header"><div><h1>Aprovações</h1></div></div>
      {[1,2,3].map(i => (
        <div key={i} className="card" style={{ padding: 20, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 12, animation: 'skpulse 1.5s ease-in-out infinite' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-background-secondary)' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 14, background: 'var(--color-background-secondary)', borderRadius: 6, width: '40%' }} />
              <div style={{ height: 12, background: 'var(--color-background-secondary)', borderRadius: 6, width: '65%' }} />
              <div style={{ height: 60, background: 'var(--color-background-secondary)', borderRadius: 8 }} />
            </div>
          </div>
        </div>
      ))}
      <style>{`@keyframes skpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Aprovações</h1>
          <p className="page-sub">{solics.length} solicitação(ões) pendente(s)</p>
        </div>
      </div>

      {solics.length === 0 ? (
        <div className="card">
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            Nenhuma solicitação pendente.
          </div>
        </div>
      ) : (
        solics.map(s => {
          const cfg = tipoConfig[s.tipo] || tipoConfig.novo_agendamento
          const data_consulta = s.consulta?.data
          const hora_consulta = s.consulta?.hora?.slice(0, 5)
          const dataFmt = data_consulta ? new Date(data_consulta + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

          return (
            <div key={s.id} style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderLeft: `3px solid ${cfg.color}`,
              borderRadius: 'var(--border-radius-lg)',
              marginBottom: 12,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>

                {/* Ícone */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${cfg.icon}`} style={{ fontSize: 18, color: cfg.color }} aria-hidden="true" />
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{cfg.label}</p>
                    <span style={{ background: cfg.badgeBg, color: cfg.badgeColor, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>Aguardando</span>
                  </div>

                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
                    Paciente: <strong style={{ color: 'var(--color-text-primary)' }}>{s.consulta?.paciente?.nome}</strong>
                    {' · '}Estagiário: {s.consulta?.estagiario?.nome}
                    {s.consulta?.estagiario?.codigo && (
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, marginLeft: 6 }}>
                        {s.consulta.estagiario.codigo}
                      </span>
                    )}
                  </p>

                  {/* Info card */}
                  <div style={{ background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px', display: 'grid', gridTemplateColumns: s.tipo === 'reagendamento' ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                    {s.tipo === 'reagendamento' ? (
                      <>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Data atual</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{dataFmt} às {hora_consulta}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Nova data</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: cfg.color, margin: 0 }}>
                            {s.nova_data ? new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} às {s.nova_hora?.slice(0, 5) || '—'}
                          </p>
                        </div>
                      </>
                    ) : s.tipo === 'troca_sala' ? (
                      <>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Data</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{dataFmt}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Sala atual</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{s.sala_atual?.nome || '—'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Nova sala</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: cfg.color, margin: 0 }}>{s.sala_nova?.nome || '—'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Data</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{dataFmt}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Horário</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{hora_consulta}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', margin: '0 0 2px' }}>Tipo</p>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{s.consulta?.tipo || '—'}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {s.tipo === 'novo_agendamento' && (
                    <p style={{ fontSize: 11, color: '#2563eb', margin: '0 0 8px' }}>✨ Ao aprovar, sala será atribuída automaticamente e paciente será notificado.</p>
                  )}
                  {s.motivo && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 8px', fontStyle: 'italic' }}>Motivo: {s.motivo}</p>
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

                {/* Botões */}
                {canAct(s) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button
                      style={{ padding: '9px 16px', borderRadius: 'var(--border-radius-md)', border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => handleAprovar(s, true)}>
                      <i className="ti ti-check" aria-hidden="true" /> Aprovar
                    </button>
                    <button
                      style={{ padding: '9px 16px', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={() => handleAprovar(s, false)}>
                      <i className="ti ti-x" aria-hidden="true" /> Recusar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}