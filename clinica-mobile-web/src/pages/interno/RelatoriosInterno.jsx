import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function RelatoriosInterno() {
  const [estagiarios, setEstagiarios] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCons, setLoadingCons] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { fetchEstagiarios() }, [])

  async function fetchEstagiarios() {
    const { data } = await supabase.from('profiles')
      .select('id, nome, codigo, especialidade, tipo')
      .in('tipo', ['estagiario', 'coordenador'])
      .order('nome')
    setEstagiarios(data || [])
    setLoading(false)
  }

  async function fetchConsultas(estId) {
    setLoadingCons(true)
    const hoje = new Date().toISOString().split('T')[0]
    let q = supabase.from('consultas')
      .select('*, paciente:pacientes(nome, cpf)')
      .eq('medico_id', estId)
      .order('data', { ascending: false })

    if (filtro === 'hoje') q = q.eq('data', hoje)
    else if (filtro === 'mes') q = q.gte('data', hoje.slice(0, 7) + '-01')

    const { data } = await q
    setConsultas(data || [])
    setLoadingCons(false)
  }

  function handleSelecionarEst(est) {
    setSelecionado(est)
    fetchConsultas(est.id)
  }

  const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }
  const statusBg    = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }
  const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel.', reagendamento_pendente: 'Reagend.' }

  const lista = estagiarios.filter(e =>
    !busca || e.nome?.toLowerCase().includes(busca.toLowerCase()) || e.codigo?.toLowerCase().includes(busca.toLowerCase())
  )

  if (selecionado) {
    const total = consultas.length
    const realizadas = consultas.filter(c => c.status === 'realizada').length
    const confirmadas = consultas.filter(c => c.status === 'confirmada').length
    const canceladas = consultas.filter(c => c.status === 'cancelada').length

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
        <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
          <button onClick={() => { setSelecionado(null); setConsultas([]) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>Voltar</span>
          </button>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{selecionado.nome}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            {selecionado.codigo && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{selecionado.codigo}</span>}
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{selecionado.especialidade || 'Estagiário'}</span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[['todos','Todos'],['mes','Este mês'],['hoje','Hoje']].map(([v,l]) => (
              <button key={v} onClick={() => { setFiltro(v); fetchConsultas(selecionado.id) }}
                style={{ padding: '5px 12px', borderRadius: 20, border: 'none', background: filtro === v ? '#fff' : 'rgba(255,255,255,0.15)', color: filtro === v ? '#0047AB' : '#fff', fontSize: 12, fontWeight: filtro === v ? 700 : 400, cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Total', value: total, bg: '#EFF6FF', color: '#0047AB' },
              { label: 'Realizadas', value: realizadas, bg: '#D1FAE5', color: '#166534' },
              { label: 'Confirmadas', value: confirmadas, bg: '#DBEAFE', color: '#1e40af' },
              { label: 'Canceladas', value: canceladas, bg: '#FEE2E2', color: '#991B1B' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: s.color, opacity: 0.7 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {loadingCons && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 30 }}>Carregando...</p>}
          {!loadingCons && consultas.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 30 }}>Nenhuma consulta encontrada.</p>}

          {consultas.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #F3F4F6' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{c.paciente?.nome}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                  {c.data ? new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} · {c.hora?.slice(0, 5)} · {c.tipo}
                </p>
              </div>
              <span style={{ background: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 50, flexShrink: 0 }}>
                {statusLabel[c.status] || c.status}
              </span>
            </div>
          ))}
          <div style={{ height: 24 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Relatórios</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>Selecione um estagiário</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou código..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {lista.map(e => (
          <button key={e.id} onClick={() => handleSelecionarEst(e)}
            style={{ width: '100%', background: '#fff', border: 'none', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 46, height: 46, borderRadius: 23, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
              {e.nome?.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{e.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>{e.especialidade || 'Estagiário'}</p>
            </div>
            {e.codigo && <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{e.codigo}</span>}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}