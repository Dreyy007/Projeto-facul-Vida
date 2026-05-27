import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [sessionOk, setSessionOk] = useState(false)

  useEffect(() => {
    // O Supabase processa o token da URL automaticamente via onAuthStateChange
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionOk(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionOk(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (!senha || !senha2) { setErro('Preencha os dois campos.'); return }
    if (senha !== senha2) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro('Erro ao redefinir senha. O link pode ter expirado.')
    } else {
      setSucesso(true)
      setTimeout(() => navigate('/'), 3000)
    }
    setLoading(false)
  }

  return (
    <div style={s.container}>
      <div style={s.bgCircle1} />
      <div style={s.bgCircle2} />

      {/* Logo */}
      <div style={s.logoArea}>
        <div style={s.logoCircle}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <p style={s.brand}>Clínica Vida+</p>
        <p style={s.sub}>Cuidado completo para sua saúde</p>
      </div>

      {/* Card */}
      <div style={s.card}>
        {sucesso ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <p style={s.cardTitle}>Senha redefinida!</p>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: '22px' }}>
              Sua senha foi atualizada com sucesso. Você será redirecionado para o login em instantes.
            </p>
            <button onClick={() => navigate('/')} style={s.btn}>
              Ir para o login
            </button>
          </div>
        ) : (
          <>
            <p style={s.cardTitle}>Redefinir senha 🔐</p>
            <p style={s.cardSub}>Digite sua nova senha abaixo</p>

            {!sessionOk && (
              <div style={s.avisoBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style={{ fontSize: 13, color: '#92400E', marginLeft: 8 }}>
                  Link inválido ou expirado. Solicite um novo no app.
                </p>
              </div>
            )}

            {erro && (
              <div style={s.erroBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p style={{ fontSize: 13, color: '#991B1B', marginLeft: 8 }}>{erro}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label style={s.label}>Nova senha</label>
              <div style={s.inputWrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  style={s.inputInner}
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button type="button" onClick={() => setShowSenha(v => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', fontSize: 12 }}>
                  {showSenha ? 'ocultar' : 'ver'}
                </button>
              </div>

              <label style={s.label}>Confirmar nova senha</label>
              <div style={s.inputWrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
                <input
                  style={s.inputInner}
                  type={showSenha ? 'text' : 'password'}
                  value={senha2}
                  onChange={e => setSenha2(e.target.value)}
                  placeholder="Repita a senha"
                />
              </div>

              <button
                style={{ ...s.btn, opacity: (loading || !sessionOk) ? 0.6 : 1 }}
                type="submit"
                disabled={loading || !sessionOk}
              >
                {loading ? <span style={s.spinner} /> : 'Salvar nova senha'}
              </button>
            </form>

            <button type="button" onClick={() => navigate('/')}
              style={{ ...s.linkBtn, display: 'block', textAlign: 'center', width: '100%', marginTop: 16, fontSize: 13 }}>
              Voltar para o login
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', backgroundColor: '#0047AB', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 40px', overflowY: 'auto', position: 'relative' },
  bgCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -80 },
  bgCircle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', top: 100, left: -60 },
  logoArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 70, paddingBottom: 32, zIndex: 1 },
  logoCircle: { width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 400 },
  card: { width: '100%', maxWidth: 390, backgroundColor: '#fff', borderRadius: '28px 28px 0 0', padding: '28px 24px 32px', flex: 1, zIndex: 1 },
  cardTitle: { fontSize: 22, fontWeight: 800, color: '#0D1B2A', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 2 },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '0 14px', marginBottom: 14, height: 52, backgroundColor: '#FAFAFA' },
  inputInner: { flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0D1B2A', backgroundColor: 'transparent', fontFamily: 'inherit' },
  btn: { width: '100%', background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 6, marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#fff', boxShadow: '0 4px 16px rgba(0,71,171,0.35)' },
  spinner: { width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  erroBox: { display: 'flex', alignItems: 'center', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: 12, marginBottom: 14, border: '1px solid #FECACA' },
  avisoBox: { display: 'flex', alignItems: 'center', backgroundColor: '#FFFBEB', padding: '10px 14px', borderRadius: 12, marginBottom: 14, border: '1px solid #FDE68A' },
  linkBtn: { background: 'none', border: 'none', color: '#0047AB', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
}