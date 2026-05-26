// PacientesInterno.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export function PacientesInterno() {
  const { perfil } = useAuth()
  const [pacientes, setPacientes] = useState([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [selecionado, setSelecionado] = useState(null)

  useEffect(() => { fetchPacientes() }, [])

  async function fetchPacientes() {
    const { data } = await supabase.from('pacientes').select('*').eq('ativo', true).order('nome')
    setPacientes(data || [])
    setLoading(false)
  }

  const fmtCpf = cpf => cpf ? cpf.replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '—'
  const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  const filtrados = pacientes.filter(p => {
    const q = busca.toLowerCase()
    return p.nome?.toLowerCase().includes(q) || p.cpf?.replace(/\D/g,'').includes(busca.replace(/\D/g,'')) || p.email?.toLowerCase().includes(q)
  })

  if (selecionado) return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '52px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => setSelecionado(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>
          {selecionado.nome?.slice(0,2).toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>{selecionado.nome}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Detalhes do paciente</p>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {[
          ['CPF', fmtCpf(selecionado.cpf)],
          ['E-mail', selecionado.email || '—'],
          ['Telefone', selecionado.telefone || '—'],
          ['Data de nascimento', fmtData(selecionado.data_nascimento)],
          ['Convênio', selecionado.convenio || '—'],
          ['Nº convênio', selecionado.numero_convenio || '—'],
        ].map(([label, valor]) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: '1px solid #F3F4F6' }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', fontWeight: 600 }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#0D1B2A', margin: 0 }}>{valor}</p>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '52px 20px 16px' }}>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 12px' }}>Pacientes</p>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍 Buscar por nome, CPF ou e-mail..."
          style={{ width: '100%', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Carregando...</p>
        : filtrados.length === 0 ? <p style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nenhum paciente encontrado.</p>
        : filtrados.map(p => (
          <div key={p.id} onClick={() => setSelecionado(p)}
            style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: '#fff', alignItems: 'center' }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0047AB', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {p.nome?.slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A', margin: '0 0 2px' }}>{p.nome}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>CPF: {fmtCpf(p.cpf)}</p>
            </div>
            <span style={{ fontSize: 18, color: '#D1D5DB' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PacientesInterno