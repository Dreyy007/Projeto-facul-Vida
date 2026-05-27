import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

const cargoLabel = { estagiario: 'Estagiário', admin: 'Administrador', coordenador: 'Coordenador', recepcionista: 'Recepcionista', supervisor: 'Supervisor' }
const cargoColor = { estagiario: '#1d4ed8', admin: '#92400E', coordenador: '#166534', recepcionista: '#6d28d9', supervisor: '#c2410c' }
const cargoBg = { estagiario: '#EFF6FF', admin: '#FEF3C7', coordenador: '#F0FDF4', recepcionista: '#F5F3FF', supervisor: '#FFF7ED' }

export default function PerfilInterno() {
  const { perfil: profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState({ atual: '', nova: '', confirmar: '' })
  const [showSenhas, setShowSenhas] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [msgSenha, setMsgSenha] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  async function handleSair() {
    await signOut()
    navigate('/login')
  }

  async function handleAlterarSenha(e) {
    e.preventDefault()
    setErroSenha(''); setMsgSenha('')
    if (senha.nova.length < 6) { setErroSenha('Senha deve ter pelo menos 6 caracteres.'); return }
    if (senha.nova !== senha.confirmar) { setErroSenha('As senhas não coincidem.'); return }
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: senha.nova })
    if (error) setErroSenha('Erro ao alterar senha.')
    else { setMsgSenha('Senha alterada com sucesso!'); setSenha({ atual: '', nova: '', confirmar: '' }) }
    setSalvandoSenha(false)
  }

  const tc = cargoColor[profile?.tipo] || '#374151'
  const bg = cargoBg[profile?.tipo] || '#F3F4F6'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0047AB, #1d6fef)', paddingTop: 52, paddingBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60 }} />
        <div style={{ width: 76, height: 76, borderRadius: 38, background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 14 }}>
          {profile?.nome?.slice(0, 2).toUpperCase()}
        </div>
        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{profile?.nome}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 }}>{profile?.email}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: bg, color: tc, fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
            {cargoLabel[profile?.tipo] || profile?.tipo}
          </span>
          {profile?.codigo && (
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
              {profile.codigo}
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Dados */}
        <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #F3F4F6', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Meus Dados</p>
          </div>
          {[
            { label: 'Nome', value: profile?.nome },
            { label: 'E-mail', value: profile?.email },
            { label: 'Cargo', value: cargoLabel[profile?.tipo] || profile?.tipo },
            { label: 'Código', value: profile?.codigo || '—' },
            { label: 'Especialidade', value: profile?.especialidade || '—' },
            { label: 'CRP/CRM', value: profile?.crp_crm || '—' },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2A', textAlign: 'right', maxWidth: '60%' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Alterar senha */}
        <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', border: '1px solid #F3F4F6', marginBottom: 16 }}>
          <button onClick={() => setShowSenhas(v => !v)}
            style={{ width: '100%', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1B2A' }}>🔒 Alterar senha</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" style={{ transform: showSenhas ? 'rotate(180deg)' : 'none', transition: '0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          {showSenhas && (
            <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F3F4F6' }}>
              {msgSenha && <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '8px 12px', marginTop: 12, marginBottom: 8 }}><p style={{ fontSize: 13, color: '#166534', margin: 0 }}>✓ {msgSenha}</p></div>}
              {erroSenha && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '8px 12px', marginTop: 12, marginBottom: 8 }}><p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>⚠ {erroSenha}</p></div>}
              <form onSubmit={handleAlterarSenha}>
                {[
                  { label: 'Nova senha', key: 'nova', placeholder: 'Mínimo 6 caracteres' },
                  { label: 'Confirmar senha', key: 'confirmar', placeholder: 'Repita a nova senha' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={st.label}>{f.label}</label>
                    <input style={st.input} type="password" placeholder={f.placeholder} value={senha[f.key]}
                      onChange={e => setSenha(v => ({ ...v, [f.key]: e.target.value }))} />
                  </div>
                ))}
                <button type="submit" disabled={salvandoSenha}
                  style={{ width: '100%', background: '#0047AB', borderRadius: 12, padding: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff', marginTop: 12, opacity: salvandoSenha ? 0.7 : 1 }}>
                  {salvandoSenha ? 'Salvando...' : 'Alterar senha'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Sair */}
        <button onClick={handleSair}
          style={{ width: '100%', background: '#FEE2E2', color: '#991B1B', border: 'none', borderRadius: 14, padding: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair da conta
        </button>
        <div style={{ height: 24 }} />
      </div>
    </div>
  )
}

const st = {
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { width: '100%', boxSizing: 'border-box', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#0D1B2A', outline: 'none', fontFamily: 'inherit' },
}