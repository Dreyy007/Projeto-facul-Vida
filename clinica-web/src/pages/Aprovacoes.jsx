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
    let query = supabase
      .from('solicitacoes')
      .select('*, consulta:consultas(*, paciente:pacientes(id, nome), estagiario:profiles(id, nome, codigo)), sala_atual:salas!sala_atual_id(nome), sala_nova:salas!sala_nova_id(nome)')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })

    if (profile?.tipo === 'estagiario') {
      query = query.eq('consulta.medico_id', profile.id)
    }

    const { data } = await query
    setSolics((data || []).filter(s => s.consulta))
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
    // Novo agendamento: só precisa do estagiário. Outros: precisa dos dois.
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
            `📅 Seu reagendamento foi aprovado! Nova data: ${novaDataFmt} às ${fresh.nova_hora?.slice(0, 5)} com ${estagiarioNome}.`
          )
        }
      } else if (fresh.tipo === 'troca_sala') {
        await supabase.from('consultas').update({ sala_id: fresh.sala_nova_id, status: 'confirmada' }).eq('id', s.consulta_id)
      } else if (novoAgendamento) {
        const sala = await atribuirSalaDisponivel(s.consulta_id, data_consulta, s.consulta?.hora)
        // Se nenhuma sala disponível, ao menos confirma a consulta sem sala
        if (!sala) {
          await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', s.consulta_id)
        }

        if (paciente_id) {
          await enviarMensagemBot(paciente_id,
            `🎉 Sua consulta foi confirmada!\n📅 Data: ${dataFmt}\n⏰ Horário: ${hora_consulta}\n👤 Profissional: ${estagiarioNome}\n\nAguardamos você! Em caso de dúvidas, fale conosco por aqui.`
          )
        }
      }
    } else if (novoAgendamento && aprovado && !ambosAprovaram) {
      // um dos dois aprovou mas falta o outro — mantém aguardando
    }

    fetchSolics()
  }

  const canAct = (s) => {
    if (profile?.tipo === 'estagiario') return s.consulta?.estagiario?.id === profile.id && s.aprovado_medico === null
    if (['admin', 'coordenador', 'recepcionista'].includes(profile?.tipo)) {
      // Admin não aprova novo agendamento, só estagiário
      if (s.tipo === 'novo_agendamento') return false
      return s.aprovado_admin === null
    }
    return false
  }

  const tipoLabel = t => ({
    cancelamento: 'Cancelamento',
    reagendamento: 'Reagendamento',
    troca_sala: 'Troca de Sala',
    novo_agendamento: 'Novo Agendamento',
  }[t] || t)

  const tipoIcon = t => ({
    cancelamento: '❌',
    reagendamento: '📅',
    troca_sala: '🚪',
    novo_agendamento: '🗓️',
  }[t] || '📋')

  if (loading) return <div className="page-loading">Carregando...</div>

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
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>✅ Nenhuma solicitação pendente.</div>
        </div>
      ) : (
        solics.map(s => (
          <div key={s.id} className="card">
            <div style={{ padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: s.tipo === 'cancelamento' ? 'var(--dbg)' : s.tipo === 'novo_agendamento' ? 'var(--sbg)' : 'var(--wbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {tipoIcon(s.tipo)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{tipoLabel(s.tipo)}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Paciente: <strong>{s.consulta?.paciente?.nome}</strong> · Estagiário: {s.consulta?.estagiario?.nome}
                  {s.consulta?.estagiario?.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>{s.consulta.estagiario.codigo}</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                  {s.consulta?.data && `📅 ${new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR')} às ${s.consulta.hora?.slice(0, 5)}`}
                </div>
                {s.tipo === 'reagendamento' && s.nova_data && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Nova data: {new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às {s.nova_hora?.slice(0, 5)}</div>
                )}
                {s.tipo === 'troca_sala' && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    Sala atual: <strong>{s.sala_atual?.nome || '—'}</strong> → Nova sala: <strong>{s.sala_nova?.nome || '—'}</strong>
                  </div>
                )}
                {s.tipo === 'novo_agendamento' && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, fontWeight: 600 }}>
                    ✨ Ao aprovar, sala será atribuída automaticamente e paciente será notificado.
                  </div>
                )}
                {s.motivo && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>Motivo: {s.motivo}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: s.aprovado_medico === true ? 'var(--sbg)' : s.aprovado_medico === false ? 'var(--dbg)' : 'var(--wbg)', color: s.aprovado_medico === true ? 'var(--success)' : s.aprovado_medico === false ? 'var(--danger)' : 'var(--warn)', padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                    {s.aprovado_medico === true ? '✓ Estagiário aprovou' : s.aprovado_medico === false ? '✗ Estagiário recusou' : '⏳ Aguardando estagiário'}
                  </span>
                  {s.tipo !== 'novo_agendamento' && (
                    <span style={{ background: s.aprovado_admin === true ? 'var(--sbg)' : s.aprovado_admin === false ? 'var(--dbg)' : 'var(--wbg)', color: s.aprovado_admin === true ? 'var(--success)' : s.aprovado_admin === false ? 'var(--danger)' : 'var(--warn)', padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                      {s.aprovado_admin === true ? '✓ Admin aprovou' : s.aprovado_admin === false ? '✗ Admin recusou' : '⏳ Admin pendente'}
                    </span>
                  )}
                </div>
              </div>
              {canAct(s) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button className="btn-ok" style={{ padding: '9px 20px', fontSize: 13 }} onClick={() => handleAprovar(s, true)}>✓ Aprovar</button>
                  <button className="btn-no" style={{ padding: '9px 20px', fontSize: 13 }} onClick={() => handleAprovar(s, false)}>✗ Recusar</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}