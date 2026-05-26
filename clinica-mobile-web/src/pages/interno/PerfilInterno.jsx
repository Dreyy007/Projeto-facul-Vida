import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const tipoLabel = { estagiario: 'Estagiário', admin: 'Administrador', coordenador: 'Coordenador', recepcionista: 'Recepcionista' }

export default function PerfilInterno() {
  const { perfil: profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSair() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 }} />
        <div style={{ width: 72, height: 72, borderRadius: 36, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
          {profile?.nome?.slice(0, 2).toUpperCase()}
        </div>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{profile?.nome}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>{profile?.email}</p>
        {profile?.codigo && (
          <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
            {profile.codigo}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #F3F4F6', marginBottom: 16 }}>
          {[
            { label: 'Nome', value: profile?.nome },
            { label: 'E-mail', value: profile?.email },
            { label: 'Perfil', value: tipoLabel[profile?.tipo] || profile?.tipo },
            { label: 'Código', value: profile?.codigo || '—' },
            { label: 'Especialidade', value: profile?.especialidade || '—' },
            { label: 'CRP/CRM', value: profile?.crp_crm || '—' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2A' }}>{item.value}</span>
            </div>
          ))}
        </div>

        <button onClick={handleSair}
          style={{ width: '100%', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Sair da conta
        </button>
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}