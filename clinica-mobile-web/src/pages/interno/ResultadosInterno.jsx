import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const fmtData = d => new Date(d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function ResultadosInterno() {
  const { perfil: profile } = useAuth()
  const [resultados, setResultados] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => { fetchResultados() }, [profile])

  async function fetchResultados() {
    if (!profile) return
    let q = supabase.from('resultados')
      .select('*, paciente:pacientes(nome), medico:profiles(nome)')
      .order('criado_em', { ascending: false })
    if (profile.tipo === 'estagiario') q = q.eq('medico_id', profile.id)
    const { data } = await q
    setResultados(data || [])
    setLoading(false)
  }

  const lista = resultados.filter(r =>
    !busca || r.paciente?.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Resultados</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{lista.length} registro(s)</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar paciente..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && lista.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhum resultado encontrado.</p>}
        {lista.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1px solid #F3F4F6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A' }}>{r.paciente?.nome}</p>
              <span style={{ background: '#EFF6FF', color: '#0047AB', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8 }}>{r.categoria || 'Resultado'}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{r.titulo}</p>
            {r.descricao && <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 6 }}>{r.descricao}</p>}
            <p style={{ fontSize: 11, color: '#D1D5DB' }}>{r.criado_em ? fmtData(r.criado_em) : ''}</p>
            {r.arquivo_url && (
              <a href={r.arquivo_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, background: '#EFF6FF', color: '#0047AB', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, textDecoration: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0047AB" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Ver arquivo
              </a>
            )}
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}