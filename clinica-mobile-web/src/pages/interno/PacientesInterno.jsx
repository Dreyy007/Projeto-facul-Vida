// PacientesInterno.jsx
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function PacientesInterno() {
  const { perfil: profile } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchPacientes() }, [profile])

  async function fetchPacientes() {
    if (!profile) return
    let ids = []
    if (profile.tipo === 'estagiario') {
      const { data: cons } = await supabase.from('consultas').select('paciente_id').eq('medico_id', profile.id)
      ids = [...new Set((cons || []).map(c => c.paciente_id))]
      if (ids.length === 0) { setPacientes([]); setLoading(false); return }
    }
    let q = supabase.from('pacientes').select('*').order('nome')
    if (ids.length > 0) q = q.in('id', ids)
    const { data } = await q
    setPacientes(data || [])
    setLoading(false)
  }

  const lista = pacientes.filter(p =>
    !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()) || p.cpf?.includes(busca)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 }} />
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Meus Pacientes</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>{lista.length} cadastrado(s)</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome ou CPF..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 12, border: 'none', fontSize: 13, outline: 'none' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>}
        {!loading && lista.length === 0 && <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhum paciente encontrado.</p>}
        {lista.map(p => (
          <div key={p.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #F3F4F6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#0047AB', flexShrink: 0 }}>
              {p.nome?.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', marginBottom: 2 }}>{p.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>{p.cpf ? p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'}</p>
            </div>
            <span style={{ background: p.ativo ? '#D1FAE5' : '#FEE2E2', color: p.ativo ? '#166534' : '#991B1B', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 50 }}>
              {p.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}