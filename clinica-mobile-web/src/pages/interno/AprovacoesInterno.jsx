import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const tipoConfig = {
  novo_agendamento: { label: 'Novo Agendamento', color: '#1d4ed8', bg: '#eff6ff' },
  cancelamento:     { label: 'Cancelamento',      color: '#dc2626', bg: '#fef2f2' },
  reagendamento:    { label: 'Reagendamento',      color: '#ca8a04', bg: '#fefce8' },
  troca_sala:       { label: 'Troca de Sala',      color: '#7c3aed', bg: '#faf5ff' },
}

const selectQuery = `*, consulta:consultas(*, paciente:pacientes(id, nome), estagiario:profiles(id, nome, codigo), sala:salas(nome))`

export default function AprovacoesInterno() {
  const { perfil: profile } = useAuth()
  const isEstagiario = profile?.tipo === 'estagiario'
  const isAdmin = ['admin', 'coordenador', 'recepcionista'].includes(profile?.tipo)

  const [solics, setSolics] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [aba, setAba] = useState('pendentes') // 'pendentes' | 'historico'

  useEffect(() => {
    fetchSolics()
    const sub = supabase.channel('aprovacoes-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchSolics)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [profile])

  async function fetchSolics() {
    const { data } = await supabase.from('solicitacoes').select(selectQuery)
      .eq('status', 'pendente').order('criado_em', { ascending: false })
    let lista = (data || []).filter(s => s.consulta)
    if (isEstagiario) lista = lista.filter(s => s.consulta?.estagiario?.id === profile.id)
    setSolics(lista)
    setLoading(false)
  }

  async function fetchHistorico() {
    const { data } = await supabase.from('solicitacoes').select(selectQuery)
      .in('status', ['aprovada', 'recusada']).order('criado_em', { ascending: false }).limit(50)
    let lista = (data || []).filter(s => s.consulta)
    if (isEstagiario) lista = lista.filter(s => s.consulta?.estagiario?.id === profile.id)
    setHistorico(lista)
  }

  async function enviarBot(paciente_id, mensagem) {
    await supabase.from('mensagens').insert([{ paciente_id, remetente: 'clinica', conteudo: mensagem, tipo: 'bot', lida: false }])
  }

  async function atribuirSala(consulta_id, data, hora) {
    await supabase.rpc('atribuir_sala_disponivel', { p_consulta_id: consulta_id, p_data: data, p_hora: hora })
  }

  async function handleAprovar(s, aprovado) {
    const update = {}
    if (isEstagiario) update.aprovado_medico = aprovado
    if (isAdmin) update.aprovado_admin = aprovado

    const pid = s.consulta?.paciente?.id
    const dataFmt = s.consulta?.data ? new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const hora = s.consulta?.hora?.slice(0, 5)
    const estNome = s.consulta?.estagiario?.nome || 'estagiário'
    const codigo = s.consulta?.estagiario?.codigo ? ` (${s.consulta.estagiario.codigo})` : ''

    if (!aprovado) {
      update.status = 'recusada'
      await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      if (pid) await enviarBot(pid, `❌ Infelizmente sua consulta do dia ${dataFmt} às ${hora} com ${estNome}${codigo} não pôde ser confirmada.\n\nEntre em contato para reagendar.`)
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)
    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()

    const novoAg = fresh?.tipo === 'novo_agendamento'
    const aprovados = novoAg ? fresh?.aprovado_medico === true : fresh?.aprovado_medico === true && fresh?.aprovado_admin === true

    if (aprovados) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)
      if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
        if (pid) await enviarBot(pid, `✅ Seu cancelamento de consulta do dia ${dataFmt} às ${hora} foi aprovado.\n\nSe desejar, agende uma nova consulta pelo app.`)
      } else if (fresh.tipo === 'reagendamento') {
        const novaFmt = new Date(fresh.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')
        await supabase.from('consultas').update({ data: fresh.nova_data, hora: fresh.nova_hora, status: 'confirmada' }).eq('id', s.consulta_id)
        if (pid) await enviarBot(pid, `📅 Reagendamento aprovado!\n\n📅 Nova data: ${novaFmt} às ${fresh.nova_hora?.slice(0, 5)}\n👤 Profissional: ${estNome}${codigo}\n\nAté lá! 😊`)
      } else if (fresh.tipo === 'troca_sala') {
        await supabase.from('consultas').update({ sala_id: fresh.sala_nova_id, status: 'confirmada' }).eq('id', s.consulta_id)
      } else if (novoAg) {
        await atribuirSala(s.consulta_id, s.consulta?.data, s.consulta?.hora)
        const { data: cons } = await supabase.from('consultas').select('sala:salas(nome)').eq('id', s.consulta_id).single()
        const salaNome = cons?.sala?.nome
        if (pid) await enviarBot(pid, `🎉 Sua consulta foi confirmada!\n\n📅 ${dataFmt} às ${hora}\n👤 ${estNome}${codigo}${salaNome ? `\n🚪 Sala: ${salaNome}` : ''}\n\nAguardamos você! 😊`)
      }
    }
    fetchSolics()
  }

  function canAct(s) {
    if (isEstagiario) return s.consulta?.estagiario?.id === profile.id && s.aprovado_medico === null
    if (isAdmin) {
      if (s.tipo === 'novo_agendamento') return false
      return s.aprovado_admin === null
    }
    return false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Aprovações</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{solics.length} pendente(s)</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['pendentes','Pendentes'],['historico','Histórico']].map(([v,l]) => (
            <button key={v} onClick={() => { setAba(v); if (v === 'historico') fetchHistorico() }}
              style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: aba === v ? '#fff' : 'rgba(255,255,255,0.15)', color: aba === v ? '#0047AB' : '#fff', fontSize: 12, fontWeight: aba === v ? 700 : 400, cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}

        {aba === 'pendentes' && !loading && solics.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <p style={{ fontSize: 40 }}>✅</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0D1B2A', marginBottom: 6 }}>Tudo em dia!</p>
            <p style={{ fontSize: 13, color: '#9CA3AF' }}>Nenhuma solicitação pendente.</p>
          </div>
        )}

        {aba === 'pendentes' && solics.map(s => <CardAprovacao key={s.id} s={s} canAct={canAct(s)} onAprovar={handleAprovar} isHistorico={false} />)}
        {aba === 'historico' && historico.map(s => <CardAprovacao key={s.id} s={s} canAct={false} onAprovar={handleAprovar} isHistorico={true} />)}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}

function CardAprovacao({ s, canAct, onAprovar, isHistorico }) {
  const cfg = tipoConfig[s.tipo] || tipoConfig.novo_agendamento
  const dataFmt = s.consulta?.data ? new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
  const [loading, setLoading] = useState(false)

  async function act(aprovado) {
    setLoading(true)
    await onAprovar(s, aprovado)
    setLoading(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 18, marginBottom: 12, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderLeft: `3px solid ${cfg.color}` }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{cfg.label}</span>
          {isHistorico && (
            <span style={{ background: s.status === 'aprovada' ? '#D1FAE5' : '#FEE2E2', color: s.status === 'aprovada' ? '#166534' : '#991B1B', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, marginLeft: 'auto' }}>
              {s.status === 'aprovada' ? '✓ Aprovada' : '✗ Recusada'}
            </span>
          )}
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2A', marginBottom: 4 }}>{s.consulta?.paciente?.nome}</p>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>📅 {dataFmt} às {s.consulta?.hora?.slice(0, 5)}</p>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>👤 {s.consulta?.estagiario?.nome} {s.consulta?.estagiario?.codigo ? `(${s.consulta.estagiario.codigo})` : ''}</p>
        {s.consulta?.sala?.nome && <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>🚪 {s.consulta.sala.nome}</p>}

        {s.tipo === 'reagendamento' && s.nova_data && (
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>📅 Nova data: {new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às {s.nova_hora?.slice(0, 5)}</p>
          </div>
        )}
        {s.motivo && <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 8 }}>Motivo: {s.motivo}</p>}
        {s.tipo === 'novo_agendamento' && !isHistorico && <p style={{ fontSize: 11, color: '#0047AB', marginBottom: 10 }}>✨ Ao aprovar, sala será atribuída automaticamente.</p>}

        {/* Badges de quem aprovou */}
        {!isHistorico && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.aprovado_medico === true ? '#D1FAE5' : s.aprovado_medico === false ? '#FEE2E2' : '#F3F4F6', color: s.aprovado_medico === true ? '#166534' : s.aprovado_medico === false ? '#991B1B' : '#9CA3AF' }}>
              Estagiário: {s.aprovado_medico === true ? '✓' : s.aprovado_medico === false ? '✗' : 'Pendente'}
            </span>
            {s.tipo !== 'novo_agendamento' && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.aprovado_admin === true ? '#D1FAE5' : s.aprovado_admin === false ? '#FEE2E2' : '#F3F4F6', color: s.aprovado_admin === true ? '#166534' : s.aprovado_admin === false ? '#991B1B' : '#9CA3AF' }}>
                Admin: {s.aprovado_admin === true ? '✓' : s.aprovado_admin === false ? '✗' : 'Pendente'}
              </span>
            )}
          </div>
        )}

        {canAct && !loading && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => act(true)} style={{ flex: 1, background: '#D1FAE5', color: '#166534', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✓ Aprovar</button>
            <button onClick={() => act(false)} style={{ flex: 1, background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 12, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✗ Recusar</button>
          </div>
        )}
        {canAct && loading && <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Processando...</p>}
        {!canAct && !isHistorico && <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>Aguardando outra aprovação</p>}
      </div>
    </div>
  )
}