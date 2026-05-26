import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DIAS_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function EscalaInterno() {
  const { perfil } = useAuth()
  const [escalas, setEscalas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchEscalas() }, [])

  async function fetchEscalas() {
    const { data } = await supabase.from('escalas').select('*').eq('medico_id', perfil.id).order('dia_semana')
    setEscalas(data || [])
    setLoading(false)
  }

  function calcSlots(ini, fim, intervalo) {
    const [hI, mI] = (ini || '08:00').split(':').map(Number)
    const [hF, mF] = (fim || '18:00').split(':').map(Number)
    const total = (hF * 60 + mF) - (hI * 60 + mI)
    return total > 0 && intervalo > 0 ? Math.floor(total / intervalo) : 0
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '52px 20px 20px' }}>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>Minha Escala</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>{perfil?.nome} · {perfil?.codigo}</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Grade visual */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 20 }}>
          {[0,1,2,3,4,5,6].map(dia => {
            const esc = escalas.filter(e => e.dia_semana === dia)
            const tem = esc.length > 0
            return (
              <div key={dia} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                <div style={{ padding: '4px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, background: tem ? '#0047AB' : '#F3F4F6', color: tem ? '#fff' : '#9CA3AF' }}>{DIAS_CURTO[dia]}</div>
                <div style={{ padding: 4, background: '#fff', minHeight: 40 }}>
                  {esc.length === 0 && <p style={{ fontSize: 9, color: '#D1D5DB', textAlign: 'center', margin: '6px 0' }}>—</p>}
                  {esc.map(e => (
                    <div key={e.id} style={{ background: e.ativo ? '#EFF6FF' : '#F9FAFB', borderRadius: 4, padding: '2px 4px', marginBottom: 2, opacity: e.ativo ? 1 : 0.5 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#0047AB', margin: 0 }}>{e.hora_inicio?.slice(0,5)}</p>
                      <p style={{ fontSize: 8, color: '#6B7280', margin: 0 }}>{e.hora_fim?.slice(0,5)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Lista */}
        {loading ? <p style={{ textAlign: 'center', color: '#9CA3AF' }}>Carregando...</p>
        : escalas.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 20 }}>
            <p style={{ fontSize: 28, marginBottom: 8 }}>📭</p>
            <p style={{ fontSize: 14, color: '#6B7280' }}>Nenhuma escala configurada.</p>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Solicite ao administrador.</p>
          </div>
        ) : escalas.map(e => (
          <div key={e.id} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', marginBottom: 10, border: '1px solid #F3F4F6', opacity: e.ativo ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#0D1B2A', margin: 0 }}>{DIAS[e.dia_semana]}</p>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: e.ativo ? '#D1FAE5' : '#FEE2E2', color: e.ativo ? '#166534' : '#991B1B' }}>{e.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              ⏰ {e.hora_inicio?.slice(0,5)} – {e.hora_fim?.slice(0,5)} · {e.intervalo_minutos} min · <strong style={{ color: '#0047AB' }}>{calcSlots(e.hora_inicio?.slice(0,5), e.hora_fim?.slice(0,5), e.intervalo_minutos)} horários</strong>
            </p>
          </div>
        ))}
        <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '12px 16px', marginTop: 8, border: '1px solid #FDE68A' }}>
          <p style={{ fontSize: 12, color: '#92400E', margin: 0 }}>ℹ️ Para alterar sua escala, solicite ao administrador ou coordenador.</p>
        </div>
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}