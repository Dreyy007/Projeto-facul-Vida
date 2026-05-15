import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Login.css'

export default function Login() {
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
    if (error) {
      setError('E-mail ou senha inválidos.')
      setLoading(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="32" height="32" viewBox="0 0 52 52" fill="none">
              <path d="M26 7C17.16 7 10 14.16 10 23C10 28.2 12.4 32.8 16.2 35.8V43H35.8V35.8C39.6 32.8 42 28.2 42 23C42 14.16 34.84 7 26 7Z" fill="white"/>
              <path d="M15 25 Q19.5 20 24 25 Q28.5 30 33 25" fill="none" stroke="#0047AB" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M16 29 Q20 25 24 29 Q28 33 33 29" fill="none" stroke="#0047AB" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
            </svg>
          </div>
          <div>
            <div className="login-brand-name">Clínica Vida+</div>
            <div className="login-brand-sub">Painel Interno</div>
          </div>
        </div>
        <div className="login-tagline">
          <h1>Bem-vindo de volta</h1>
          <p>Acesse o painel de gestão da clínica</p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <h2>Entrar</h2>
          <p className="login-sub">Use suas credenciais da clínica</p>

          <form onSubmit={handleSubmit}>
            <div className="fld">
              <label>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@clinica.com"
                required
              />
            </div>
            <div className="fld">
              <label>Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn-login" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}