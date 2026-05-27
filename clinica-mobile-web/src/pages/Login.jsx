import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginJ() {
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c1a3a', fontFamily: 'system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* ONDAS */}
      <svg style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} width="100%" height="160" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path d="M0,80 C240,30 480,130 720,80 C960,30 1200,100 1440,60 L1440,160 L0,160 Z" fill="#1e3a8a" opacity="0.5"/>
        <path d="M0,100 C300,50 600,130 900,90 C1100,65 1300,110 1440,85 L1440,160 L0,160 Z" fill="#1d4ed8" opacity="0.3"/>
      </svg>
      {/* ELEMENTOS DECORATIVOS */}
      <svg style={{ position: 'absolute', top: 20, right: 60 }} width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="50" r="35" fill="#1e3a8a" opacity="0.5"/>
        <circle cx="70" cy="50" r="24" fill="#2563eb" opacity="0.4"/>
        <line x1="70" y1="15" x2="70" y2="85" stroke="#60a5fa" strokeWidth="2" opacity="0.7"/>
        <line x1="35" y1="50" x2="105" y2="50" stroke="#60a5fa" strokeWidth="2" opacity="0.7"/>
        <circle cx="70" cy="50" r="6" fill="#93c5fd"/>
        <circle cx="20" cy="100" r="10" fill="#1e3a8a" opacity="0.4"/>
        <circle cx="110" cy="110" r="15" fill="#1e3a8a" opacity="0.3"/>
        <circle cx="120" cy="85" r="6" fill="#3b82f6" opacity="0.5"/>
      </svg>
      <div style={{ position: 'absolute', top: 30, left: 40 }}>
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" fill="#1e3a8a" opacity="0.3"/>
          <circle cx="30" cy="30" r="15" fill="#2563eb" opacity="0.2"/>
        </svg>
      </div>

      {/* CARD */}
      <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '2.5rem', width: '100%', maxWidth: 360, zIndex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </div>
          <div>
            <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Clínica Vida+</p>
            <p style={{ color: '#60a5fa', fontSize: 12, margin: 0 }}>Painel interno</p>
          </div>
        </div>

        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Bem-vindo</h1>
        <p style={{ color: '#475569', fontSize: 13, margin: '0 0 24px' }}>Entre com suas credenciais</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="seu@clinica.com" required
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 16px', fontSize: 14, color: '#94a3b8', outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 44px 13px 16px', fontSize: 14, color: '#94a3b8', outline: 'none', fontFamily: 'inherit' }}
            />
            <button type="button" onClick={() => setShowPass(p => !p)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 0 }}>
              {showPass
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              }
            </button>
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ background: '#2563eb', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? 'Entrando...' : 'Entrar'}
            {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>}
          </button>
        </form>
      </div>
    </div>
  )
}