import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const statusColor = { confirmada: '#166534', aguardando: '#92400E', cancelada: '#991B1B', realizada: '#1e40af', cancelamento_pendente: '#991B1B', reagendamento_pendente: '#92400E' }
const statusBg    = { confirmada: '#D1FAE5', aguardando: '#FEF3C7', cancelada: '#FEE2E2', realizada: '#DBEAFE', cancelamento_pendente: '#FEE2E2', reagendamento_pendente: '#FEF3C7' }
const statusLabel = { confirmada: 'Confirmada', aguardando: 'Aguardando', cancelada: 'Cancelada', realizada: 'Realizada', cancelamento_pendente: 'Cancel. pend.', reagendamento_pendente: 'Reagend. pend.' }

export default function AgendaInterno() {
  const { perfil: profile } = useAuth()
  const [consultas, setConsultas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('hoje')
  const [dataCustom, setDataCustom] = useState('')

  useEffect(() => { fetchConsultas() }, [profile])

  async function fetchConsultas() {
    if (!profile) return
    let q = supabase.from('consultas')
      .select('*, paciente:pacientes(nome, cpf), sala:salas(nome)')
      .order('data').order('hora')
    if (profile.tipo === 'estagiario') q = q.eq('medico_id', profile.id)
    const { data } = await q
    setConsultas(data || [])
    setLoading(false)
  }

  async function marcarRealizada(id) {
    await supabase.from('consultas').update({ status: 'realizada' }).eq('id', id)
    fetchConsultas()
  }

  async function confirmar(id) {
    await supabase.from('consultas').update({ status: 'confirmada' }).eq('id', id)
    fetchConsultas()
  }

  function filtrar(lista) {
    const hoje = new Date().toISOString().split('T')[0]
    const agora = new Date()
    if (filtro === 'hoje') return lista.filter(c => c.data === hoje)
    if (filtro === 'semana') {
      const ds = agora.getDay() === 0 ? 6 : agora.getDay() - 1
      const ini = new Date(agora); ini.setDate(agora.getDate() - ds)
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6)
      return lista.filter(c => c.data >= ini.toISOString().split('T')[0] && c.data <= fim.toISOString().split('T')[0])
    }
    if (filtro === 'data' && dataCustom) return lista.filter(c => c.data === dataCustom)
    return lista
  }

  const lista = filtrar(consultas)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Minha Agenda</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{lista.length} consulta(s)</p>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto' }}>
          {[['hoje','Hoje'],['semana','Semana'],['todos','Todas'],['data','Data']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: filtro === v ? '#fff' : 'rgba(255,255,255,0.15)', color: filtro === v ? '#0047AB' : '#fff', fontSize: 12, fontWeight: filtro === v ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {l}
            </button>
          ))}
        </div>
        {filtro === 'data' && (
          <input type="date" value={dataCustom} onChange={e => setDataCustom(e.target.value)}
            style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, border: 'none', fontSize: 13, width: '100%', boxSizing: 'border-box' }} />
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && lista.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhuma consulta neste período.</p>}
        {lista.map(c => (
          <div key={c.id} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12, border: '1px solid #F3F4F6', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#0D1B2A', marginBottom: 3 }}>{c.paciente?.nome}</p>
                <p style={{ fontSize: 12, color: '#0047AB', fontWeight: 600 }}>
                  {new Date(c.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} · {c.hora?.slice(0, 5)}
                </p>
              </div>
              <span style={{ background: statusBg[c.status] || '#F3F4F6', color: statusColor[c.status] || '#374151', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 50 }}>
                {statusLabel[c.status] || c.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {c.sala?.nome && <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8 }}>🚪 {c.sala.nome}</span>}
              <span style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 11, padding: '3px 8px', borderRadius: 8 }}>{c.tipo}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {c.status === 'aguardando' && (
                <button onClick={() => confirmar(c.id)} style={{ flex: 1, background: '#D1FAE5', color: '#166534', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Confirmar</button>
              )}
              {c.status === 'confirmada' && (
                <button onClick={() => marcarRealizada(c.id)} style={{ flex: 1, background: '#DBEAFE', color: '#1e40af', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✓ Realizada</button>
              )}
            </div>
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}