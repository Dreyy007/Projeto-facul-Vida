import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function AgendaInterno() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const [consultas, setConsultas] = useState([])
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('dia')

  useEffect(() => { fetchConsultas() }, [data, filtro])

  async function fetchConsultas() {
    setLoading(true)
    let q = supabase.from('consultas')
      .select('*, paciente:pacientes(nome, cpf), estagiario:profiles(nome, codigo), sala:salas(nome)')
      .order('data').order('hora')

    if (filtro === 'dia') q = q.eq('data', data)
    else if (filtro === 'semana') {
      const d = new Date(data + 'T12:00:00')
      const ds = d.getDay() === 0 ? 6 : d.getDay() - 1
      const ini = new Date(d); ini.setDate(d.getDate() - ds)
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      q = q.gte('data', ini.toISOString().split('T')[0]).lte('data', fim.toISOString().split('T')[0])
    }
    if (perfil?.tipo === 'estagiario') q = q.eq('medico_id', perfil.id)

    const { data: rows } = await q
    setConsultas(rows || [])
    setLoading(false)
  }

  async function confirmar(id) {
    await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', id)
    fetchConsultas()
  }

  async function marcarRealizada(id) {
    await supabase.from('consultas').update({ status: 'realizada' }).eq('id', id)
    fetchConsultas()
  }

  const navData = d => { const dt = new Date(data + 'T12:00:00'); dt.setDate(dt.getDate() + d); setData(dt.toISOString().split('T')[0]) }
  const tagColor = s => ({ confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af' }[s] || '#374151')
  const tagBg = s => ({ confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE' }[s] || '#F3F4F6')
  const tagLabel = s => ({ confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }[s] || s)
  const canApprove = ['admin', 'coordenador'].includes(perfil?.tipo)
  const dataLabel = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB 0%, #1d6fef 100%)', padding: '52px 20px 16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 }} />
        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>Agenda</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 14 }}>{consultas.length} consulta(s) · {filtro === 'semana' ? 'Semana' : dataLabel}</p>

        {/* Filtro */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[['dia', 'Dia'], ['semana', 'Semana'], ['todas', 'Todas']].map(([k, l]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: filtro === k ? '#fff' : 'rgba(255,255,255,0.15)', color: filtro === k ? '#0047AB' : '#fff' }}>{l}</button>
          ))}
        </div>

        {filtro !== 'todas' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => navData(-1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, cursor: 'pointer' }}>←</button>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 13, textAlign: 'center', background: 'rgba(255,255,255,0.15)', color: '#fff' }} />
            <button onClick={() => navData(1)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#fff', fontSize: 13, cursor: 'pointer' }}>→</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>
        : consultas.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
            <p style={{ fontSize: 15, color: '#6B7280', fontWeight: 600 }}>Nenhuma consulta.</p>
            <button onClick={() => navigate('/interno/agenda/nova')} style={{ marginTop: 16, background: '#0047AB', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Agendar</button>
          </div>
        ) : (
          consultas.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  {filtro !== 'dia' && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 2px' }}>{new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
                  <p style={{ fontSize: 18, fontWeight: 900, color: '#0047AB', margin: 0 }}>{c.hora?.slice(0,5)}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: tagBg(c.status), color: tagColor(c.status) }}>{tagLabel(c.status)}</span>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#0D1B2A', margin: '0 0 4px' }}>{c.paciente?.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 8px' }}>
                {c.tipo}
                {c.estagiario?.nome && ` · ${c.estagiario.nome}`}
                {c.estagiario?.codigo && ` (${c.estagiario.codigo})`}
                {c.sala?.nome && ` · ${c.sala.nome}`}
              </p>
              {canApprove && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {c.status === 'aguardando' && (
                    <button onClick={() => confirmar(c.id)} style={{ flex: 1, background: '#D1FAE5', color: '#166534', border: 'none', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Confirmar</button>
                  )}
                  {c.status === 'confirmada' && (
                    <button onClick={() => marcarRealizada(c.id)} style={{ flex: 1, background: '#DBEAFE', color: '#1e40af', border: 'none', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓ Realizada</button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}