import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginM() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) { setError('E-mail ou senha inválidos.'); setLoading(false) }
    else navigate('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#1e0a4a', fontFamily: 'system-ui, sans-serif' }}>
      {/* LADO ESQUERDO - ilustração */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: 24 }}>
        <div style={{ position: 'relative', width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="80" fill="#2d1060" opacity="0.5"/>
            <circle cx="90" cy="90" r="62" fill="#3b0764" opacity="0.5"/>
            <circle cx="90" cy="90" r="46" fill="#4c1d95" opacity="0.7"/>
            <circle cx="30" cy="40" r="5" fill="#a855f7" opacity="0.5"/>
            <circle cx="150" cy="35" r="4" fill="#c084fc" opacity="0.6"/>
            <circle cx="155" cy="145" r="6" fill="#7c3aed" opacity="0.4"/>
            <circle cx="25" cy="140" r="4" fill="#a855f7" opacity="0.5"/>
            <circle cx="90" cy="90" r="80" fill="none" stroke="#7c3aed" strokeWidth="1" opacity="0.4"/>
            <path d="M90 118 C90 118 52 92 52 70 C52 57 63 49 74 49 C82 49 88 54 90 60 C92 54 98 49 106 49 C117 49 128 57 128 70 C128 92 90 118 90 118Z" fill="#a855f7"/>
            <path d="M62 90 L73 78 L81 93 L93 62 L102 86 L110 77 L118 90" stroke="#e9d5ff" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#e9d5ff', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Clínica Vida+</p>
          <p style={{ color: '#7c3aed', fontSize: 13, margin: 0 }}>Cuidando de quem importa</p>
        </div>
      </div>

      {/* LADO DIREITO - formulário */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.06)', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: '0 0 6px' }}>Bem-vindo</h1>
          <p style={{ color: '#6d28d9', fontSize: 14, margin: '0 0 28px' }}>Entre com suas credenciais</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@clinica.com" required
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 12, padding: '13px 16px', fontSize: 14, color: '#c4b5fd', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 12, padding: '13px 44px 13px 16px', fontSize: 14, color: '#c4b5fd', outline: 'none', fontFamily: 'inherit' }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6d28d9', padding: 0 }}>
                {showPass
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={loading}
              style={{ background: '#7c3aed', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1, fontFamily: 'inherit' }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}