import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const tipoConfig = {
  novo_agendamento: { label: 'Novo Agendamento', color: '#1d4ed8', bg: '#eff6ff' },
  cancelamento:     { label: 'Cancelamento',      color: '#dc2626', bg: '#fef2f2' },
  reagendamento:    { label: 'Reagendamento',      color: '#ca8a04', bg: '#fefce8' },
  troca_sala:       { label: 'Troca de Sala',      color: '#7c3aed', bg: '#faf5ff' },
}

export default function AprovacoesInterno() {
  const { perfil: profile } = useAuth()
  const [solics, setSolics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSolics() }, [profile])

  async function fetchSolics() {
    const { data } = await supabase
      .from('solicitacoes')
      .select('*, consulta:consultas(*, paciente:pacientes(id, nome), estagiario:profiles(id, nome, codigo))')
      .eq('status', 'pendente')
      .order('criado_em', { ascending: false })

    let lista = (data || []).filter(s => s.consulta)
    if (profile?.tipo === 'estagiario') {
      lista = lista.filter(s => s.consulta?.estagiario?.id === profile.id)
    }
    setSolics(lista)
    setLoading(false)
  }

  async function enviarMensagemBot(paciente_id, mensagem) {
    await supabase.from('mensagens').insert([{ paciente_id, remetente: 'clinica', conteudo: mensagem, tipo: 'bot', lida: false }])
  }

  async function atribuirSala(consulta_id, data, hora) {
    const { data: salaId } = await supabase.rpc('atribuir_sala_disponivel', { p_consulta_id: consulta_id, p_data: data, p_hora: hora })
    return salaId
  }

  async function handleAprovar(s, aprovado) {
    const update = {}
    if (profile?.tipo === 'estagiario') update.aprovado_medico = aprovado
    else update.aprovado_admin = aprovado

    const paciente_id = s.consulta?.paciente?.id
    const dataFmt = s.consulta?.data ? new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const hora = s.consulta?.hora?.slice(0, 5)
    const nome = s.consulta?.estagiario?.nome || 'estagiário'

    if (!aprovado) {
      update.status = 'recusada'
      await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      if (paciente_id) await enviarMensagemBot(paciente_id, `❌ Sua consulta do dia ${dataFmt} às ${hora} com ${nome} não pôde ser confirmada. Entre em contato para reagendar.`)
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)
    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()

    const novoAg = fresh?.tipo === 'novo_agendamento'
    const aprovado2 = novoAg ? fresh?.aprovado_medico === true : fresh?.aprovado_medico && fresh?.aprovado_admin

    if (aprovado2) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)
      if (novoAg) {
        await atribuirSala(s.consulta_id, s.consulta?.data, s.consulta?.hora)
        if (paciente_id) await enviarMensagemBot(paciente_id, `🎉 Sua consulta foi confirmada!\n📅 Data: ${dataFmt}\n⏰ Horário: ${hora}\n👤 Profissional: ${nome}\n\nAguardamos você!`)
      } else if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
        if (paciente_id) await enviarMensagemBot(paciente_id, `✅ Seu cancelamento do dia ${dataFmt} às ${hora} foi aprovado.`)
      } else if (fresh.tipo === 'reagendamento') {
        const novaData = fresh.nova_data ? new Date(fresh.nova_data + 'T12:00:00').toLocaleDateString('pt-BR') : ''
        await supabase.from('consultas').update({ data: fresh.nova_data, hora: fresh.nova_hora, status: 'confirmada' }).eq('id', s.consulta_id)
        if (paciente_id) await enviarMensagemBot(paciente_id, `📅 Reagendamento aprovado!\n📅 Nova data: ${novaData} às ${fresh.nova_hora?.slice(0, 5)}\n👤 Profissional: ${nome}`)
      }
    }
    fetchSolics()
  }

  const canAct = (s) => {
    if (profile?.tipo === 'estagiario') return s.consulta?.estagiario?.id === profile.id && s.aprovado_medico === null
    return s.tipo !== 'novo_agendamento' && s.aprovado_admin === null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Aprovações</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{solics.length} pendente(s)</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && solics.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 40 }}>✅</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Tudo em dia!</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhuma solicitação pendente.</p>
          </div>
        )}
        {solics.map(s => {
          const cfg = tipoConfig[s.tipo] || tipoConfig.novo_agendamento
          const dataFmt = s.consulta?.data ? new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 18, marginBottom: 12, border: '1px solid #F3F4F6', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{cfg.label}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 4 }}>{s.consulta?.paciente?.nome}</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>📅 {dataFmt} às {s.consulta?.hora?.slice(0, 5)}</p>
                {s.tipo === 'reagendamento' && s.nova_data && (
                  <p style={{ fontSize: 12, color: cfg.color, marginBottom: 10 }}>Nova data: {new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às {s.nova_hora?.slice(0, 5)}</p>
                )}
                {s.motivo && <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 }}>Motivo: {s.motivo}</p>}
                {s.tipo === 'novo_agendamento' && (
                  <p style={{ fontSize: 11, color: '#2563eb', marginBottom: 10 }}>✨ Ao aprovar, sala será atribuída automaticamente.</p>
                )}
                {canAct(s) && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAprovar(s, true)} style={{ flex: 1, background: '#D1FAE5', color: '#166534', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✓ Aprovar</button>
                    <button onClick={() => handleAprovar(s, false)} style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✗ Recusar</button>
                  </div>
                )}
                {!canAct(s) && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Aguardando outra aprovação</p>
                )}
              </div>
            </div>
          )
        })}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}