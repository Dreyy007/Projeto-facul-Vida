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
      .select('*, consulta:consultas(*, paciente:pacientes(nome), estagiario:profiles(id, nome, codigo)), sala_atual:salas!sala_atual_id(nome), sala_nova:salas!sala_nova_id(nome)')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })
    setSolics(data || [])
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
    const isAdmin = ['admin', 'coordenador'].includes(profile?.tipo)
    if (!isMedico && !isAdmin) return alert('Sem permissão.')

    const update = {}
    if (isMedico) update.aprovado_medico = aprovado
    if (isAdmin) update.aprovado_admin = aprovado

    if (!aprovado) {
      update.status = 'recusada'
      await supabase.from('consultas').update({ status: 'aguardando' }).eq('id', s.consulta_id)
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)

    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()
    if (fresh?.aprovado_medico && fresh?.aprovado_admin) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)
      if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      } else if (fresh.tipo === 'reagendamento') {
        await supabase.from('consultas').update({ data: fresh.nova_data, hora: fresh.nova_hora, status: 'aguardando' }).eq('id', s.consulta_id)
      } else if (fresh.tipo === 'troca_sala') {
        await supabase.from('consultas').update({ sala_id: fresh.sala_nova_id, status: 'confirmada' }).eq('id', s.consulta_id)
      }
    }
    fetchSolics()
  }

  const canAct = (s) => {
    if (profile?.tipo === 'estagiario') return s.consulta?.estagiario?.id === profile.id && s.aprovado_medico === null
    if (['admin', 'coordenador'].includes(profile?.tipo)) return s.aprovado_admin === null
    return false
  }

  const tipoLabel = t => ({ cancelamento: 'Cancelamento', reagendamento: 'Reagendamento', troca_sala: 'Troca de Sala' }[t] || t)
  const tipoIcon = t => ({ cancelamento: '❌', reagendamento: '📅', troca_sala: '🚪' }[t] || '📋')

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
              <div style={{ width: 44, height: 44, borderRadius: 11, background: s.tipo === 'cancelamento' ? 'var(--dbg)' : 'var(--wbg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {tipoIcon(s.tipo)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{tipoLabel(s.tipo)} solicitado</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  Paciente: <strong>{s.consulta?.paciente?.nome}</strong> · Estagiário: {s.consulta?.estagiario?.nome}
                  {s.consulta?.estagiario?.codigo && <span style={{ background: 'var(--p3)', color: 'var(--p)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>{s.consulta.estagiario.codigo}</span>}
                </div>
                {s.tipo === 'reagendamento' && s.nova_data && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>Nova data: {new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às {s.nova_hora?.slice(0, 5)}</div>
                )}
                {s.tipo === 'troca_sala' && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    Sala atual: <strong>{s.sala_atual?.nome || '—'}</strong> → Nova sala: <strong>{s.sala_nova?.nome || '—'}</strong>
                  </div>
                )}
                {s.motivo && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>Motivo: {s.motivo}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: s.aprovado_medico === true ? 'var(--sbg)' : s.aprovado_medico === false ? 'var(--dbg)' : 'var(--wbg)', color: s.aprovado_medico === true ? 'var(--success)' : s.aprovado_medico === false ? 'var(--danger)' : 'var(--warn)', padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                    {s.aprovado_medico === true ? '✓ Estagiário aprovou' : s.aprovado_medico === false ? '✗ Estagiário recusou' : '⏳ Estagiário pendente'}
                  </span>
                  <span style={{ background: s.aprovado_admin === true ? 'var(--sbg)' : s.aprovado_admin === false ? 'var(--dbg)' : 'var(--wbg)', color: s.aprovado_admin === true ? 'var(--success)' : s.aprovado_admin === false ? 'var(--danger)' : 'var(--warn)', padding: '3px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700 }}>
                    {s.aprovado_admin === true ? '✓ Admin aprovou' : s.aprovado_admin === false ? '✗ Admin recusou' : '⏳ Admin pendente'}
                  </span>
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