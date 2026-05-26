import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const tipoConfig = {
  novo_agendamento: { label: 'Novo Agendamento', emoji: '📋', color: '#2563eb', bg: '#eff6ff' },
  cancelamento:     { label: 'Cancelamento',      emoji: '❌', color: '#dc2626', bg: '#fef2f2' },
  reagendamento:    { label: 'Reagendamento',      emoji: '📅', color: '#ca8a04', bg: '#fefce8' },
  troca_sala:       { label: 'Troca de Sala',      emoji: '🚪', color: '#7c3aed', bg: '#faf5ff' },
}

export default function AprovacoesInterno() {
  const { perfil } = useAuth()
  const [aba, setAba] = useState('pendentes')
  const [solics, setSolics] = useState([])
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(null)
  const canalRef = useRef(null)

  useEffect(() => {
    fetchPendentes()
    canalRef.current = supabase.channel('aprov-interno-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes' }, fetchPendentes)
      .subscribe()
    return () => { if (canalRef.current) supabase.removeChannel(canalRef.current) }
  }, [])

  useEffect(() => { if (aba === 'historico') fetchHistorico() }, [aba])

  const selectQ = `*, consulta:consultas(*, paciente:pacientes(id, nome, cpf, telefone), estagiario:profiles(id, nome, codigo)), sala_atual:salas!sala_atual_id(nome), sala_nova:salas!sala_nova_id(nome)`

  async function fetchPendentes() {
    const { data } = await supabase.from('solicitacoes').select(selectQ).eq('status', 'pendente').order('criado_em', { ascending: false })
    let lista = (data || []).filter(s => s.consulta)
    if (perfil?.tipo === 'estagiario') lista = lista.filter(s => s.consulta?.estagiario?.id === perfil.id)
    setSolics(lista)
    setLoading(false)
  }

  async function fetchHistorico() {
    const { data } = await supabase.from('solicitacoes').select(selectQ).in('status', ['aprovada', 'recusada']).order('criado_em', { ascending: false }).limit(50)
    let lista = (data || []).filter(s => s.consulta)
    if (perfil?.tipo === 'estagiario') lista = lista.filter(s => s.consulta?.estagiario?.id === perfil.id)
    setHistorico(lista)
  }

  async function enviarBot(paciente_id, msg) {
    await supabase.from('mensagens').insert([{ paciente_id, remetente: 'clinica', conteudo: msg, tipo: 'bot', lida: false }])
  }

  async function handleAprovar(s, aprovado) {
    setSalvando(s.id)
    const isEst = perfil?.tipo === 'estagiario'
    const isAdmin = ['admin', 'coordenador', 'recepcionista'].includes(perfil?.tipo)

    const update = {}
    if (isEst) update.aprovado_medico = aprovado
    if (isAdmin) update.aprovado_admin = aprovado

    const pac_id = s.consulta?.paciente?.id
    const dataFmt = s.consulta?.data ? new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const hora = s.consulta?.hora?.slice(0, 5)
    const estNome = s.consulta?.estagiario?.nome || 'estagiário'
    const cod = s.consulta?.estagiario?.codigo ? ` (${s.consulta.estagiario.codigo})` : ''

    if (!aprovado) {
      update.status = 'recusada'
      await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
      if (pac_id) await enviarBot(pac_id, `❌ Sua consulta do dia ${dataFmt} às ${hora} com ${estNome}${cod} não pôde ser confirmada.\n\nEntre em contato conosco para reagendar.`)
    }

    await supabase.from('solicitacoes').update(update).eq('id', s.id)
    const { data: fresh } = await supabase.from('solicitacoes').select('*').eq('id', s.id).single()

    const novoAg = fresh?.tipo === 'novo_agendamento'
    const aprovados = novoAg ? fresh?.aprovado_medico === true : fresh?.aprovado_medico === true && fresh?.aprovado_admin === true

    if (aprovados) {
      await supabase.from('solicitacoes').update({ status: 'aprovada' }).eq('id', s.id)
      if (fresh.tipo === 'cancelamento') {
        await supabase.from('consultas').update({ status: 'cancelada' }).eq('id', s.consulta_id)
        if (pac_id) await enviarBot(pac_id, `✅ Seu cancelamento do dia ${dataFmt} às ${hora} foi aprovado.`)
      } else if (fresh.tipo === 'reagendamento') {
        await supabase.from('consultas').update({ data: fresh.nova_data, hora: fresh.nova_hora, status: 'confirmada' }).eq('id', s.consulta_id)
        if (pac_id) await enviarBot(pac_id, `📅 Reagendamento aprovado!\n\n📅 Nova data: ${new Date(fresh.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às ${fresh.nova_hora?.slice(0,5)}\n👤 ${estNome}${cod}`)
      } else if (fresh.tipo === 'troca_sala') {
        await supabase.from('consultas').update({ sala_id: fresh.sala_nova_id, status: 'confirmada' }).eq('id', s.consulta_id)
      } else if (novoAg) {
        await supabase.rpc('atribuir_sala_disponivel', { p_consulta_id: s.consulta_id, p_data: s.consulta?.data, p_hora: s.consulta?.hora })
        const { data: ca } = await supabase.from('consultas').select('sala:salas(nome)').eq('id', s.consulta_id).single()
        if (pac_id) await enviarBot(pac_id, `🎉 Sua consulta foi confirmada!\n\n📅 ${dataFmt} às ${hora}\n👤 ${estNome}${cod}${ca?.sala?.nome ? `\n🚪 Sala: ${ca.sala.nome}` : ''}\n\nAguardamos você! 😊`)
      }
    }

    window.dispatchEvent(new Event('refresh-badges'))
    fetchPendentes()
    setSalvando(null)
  }

  const canAct = (s) => {
    if (perfil?.tipo === 'estagiario') return s.consulta?.estagiario?.id === perfil.id && s.aprovado_medico === null
    if (['admin', 'coordenador', 'recepcionista'].includes(perfil?.tipo)) {
      if (s.tipo === 'novo_agendamento') return false
      return s.aprovado_admin === null
    }
    return false
  }

  function renderCard(s, pendente) {
    const cfg = tipoConfig[s.tipo] || tipoConfig.novo_agendamento
    const dataFmt = s.consulta?.data ? new Date(s.consulta.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
    const hora = s.consulta?.hora?.slice(0, 5)
    const pac = s.consulta?.paciente
    const est = s.consulta?.estagiario

    return (
      <div key={s.id} style={{ background: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderLeft: `4px solid ${cfg.color}` }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cfg.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: 0 }}>{cfg.label}</p>
              <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                {pendente ? 'Aguardando' : s.status === 'aprovada' ? '✓ Aprovada' : '✗ Recusada'}
                {!pendente && s.criado_em ? ` · ${new Date(s.criado_em).toLocaleDateString('pt-BR')}` : ''}
              </p>
            </div>
          </div>

          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2A', margin: '0 0 4px' }}>{pac?.nome}</p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              {dataFmt} às {hora}
              {est?.nome && ` · ${est.nome}`}
              {est?.codigo && ` (${est.codigo})`}
            </p>
            {s.tipo === 'reagendamento' && s.nova_data && (
              <p style={{ fontSize: 12, color: cfg.color, margin: '4px 0 0', fontWeight: 600 }}>
                → {new Date(s.nova_data + 'T12:00:00').toLocaleDateString('pt-BR')} às {s.nova_hora?.slice(0,5)}
              </p>
            )}
            {s.tipo === 'troca_sala' && (
              <p style={{ fontSize: 12, color: cfg.color, margin: '4px 0 0', fontWeight: 600 }}>
                {s.sala_atual?.nome || '—'} → {s.sala_nova?.nome || '—'}
              </p>
            )}
            {s.motivo && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0', fontStyle: 'italic' }}>Motivo: {s.motivo}</p>}
          </div>

          {/* Status badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: pendente && canAct(s) ? 12 : 0 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: s.aprovado_medico === true ? '#dcfce7' : s.aprovado_medico === false ? '#fef2f2' : '#f1f5f9', color: s.aprovado_medico === true ? '#166534' : s.aprovado_medico === false ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
              {s.aprovado_medico === true ? '✓ Est. aprovou' : s.aprovado_medico === false ? '✗ Est. recusou' : '⏳ Est. pendente'}
            </span>
            {s.tipo !== 'novo_agendamento' && (
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: s.aprovado_admin === true ? '#dcfce7' : s.aprovado_admin === false ? '#fef2f2' : '#f1f5f9', color: s.aprovado_admin === true ? '#166534' : s.aprovado_admin === false ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
                {s.aprovado_admin === true ? '✓ Admin aprovou' : s.aprovado_admin === false ? '✗ Admin recusou' : '⏳ Admin pendente'}
              </span>
            )}
          </div>

          {pendente && canAct(s) && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={salvando === s.id} onClick={() => handleAprovar(s, true)}
                style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: salvando === s.id ? 0.7 : 1 }}>
                ✓ Aprovar
              </button>
              <button disabled={salvando === s.id} onClick={() => handleAprovar(s, false)}
                style={{ flex: 1, background: '#F8FAFC', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, fontSize: 13, cursor: 'pointer' }}>
                ✗ Recusar
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', padding: '52px 20px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 }} />
        <p style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 4 }}>Aprovações</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>{solics.length} pendente(s)</p>
        <div style={{ display: 'flex', gap: 4 }}>
          {[['pendentes', '⏳ Pendentes'], ['historico', '📋 Histórico']].map(([k, l]) => (
            <button key={k} onClick={() => setAba(k)} style={{ flex: 1, padding: '10px 0', textAlign: 'center', borderRadius: '12px 12px 0 0', border: 'none', background: aba === k ? '#F8FAFC' : 'rgba(255,255,255,0.1)', color: aba === k ? '#0047AB' : 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {aba === 'pendentes' && (
          loading ? <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>
          : solics.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
              <p style={{ fontSize: 15, color: '#6B7280', fontWeight: 600 }}>Nenhuma pendente!</p>
            </div>
          ) : solics.map(s => renderCard(s, true))
        )}
        {aba === 'historico' && (
          historico.length === 0
            ? <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhum histórico ainda.</p>
            : historico.map(s => renderCard(s, false))
        )}
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}