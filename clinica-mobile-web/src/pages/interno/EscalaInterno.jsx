import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function EscalaInterno() {
  const { perfil: profile } = useAuth()
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEscalas() }, [profile])

  async function fetchEscalas() {
    if (!profile) return
    const { data } = await supabase.from('escalas')
      .select('*')
      .eq('medico_id', profile.id)
      .order('dia_semana')
    setEscalas(data || [])
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Minha Escala</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Horários de atendimento</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && escalas.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhuma escala cadastrada.</p>}
        {escalas.map(e => (
          <div key={e.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14, border: '1px solid #F3F4F6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', borderLeft: e.ativo ? '3px solid #0047AB' : '3px solid #D1D5DB' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: e.ativo ? '#EFF6FF' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: e.ativo ? '#0047AB' : '#9CA3AF' }}>{DIAS[e.dia_semana]}</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{e.hora_inicio?.slice(0, 5)} — {e.hora_fim?.slice(0, 5)}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>Intervalo: {e.intervalo_minutos} min</p>
            </div>
            <span style={{ background: e.ativo ? '#D1FAE5' : '#FEE2E2', color: e.ativo ? '#166534' : '#991B1B', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 50 }}>
              {e.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}