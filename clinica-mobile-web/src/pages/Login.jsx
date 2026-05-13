import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [aba, setAba] = useState('login')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cNome, setCNome] = useState('')
  const [cCpf, setCCpf] = useState('')
  const [cNasc, setCNasc] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cTel, setCTel] = useState('')
  const [cSenha, setCSenha] = useState('')
  const [cSenha2, setCSenha2] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [showSenha, setShowSenha] = useState(false)

  function fmtCpf(v) {
    return v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }

  function fmtTel(v) {
    return v.replace(/\D/g, '').slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{4})$/, '$1-$2')
  }

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return }
    setLoading(true); setErro('')
    const { error } = await signIn(email, senha)
    if (error) setErro('E-mail ou senha inválidos.')
    setLoading(false)
  }

  async function handleCadastro(e) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!cNome || !cCpf || !cNasc || !cEmail || !cTel || !cSenha) { setErro('Preencha todos os campos.'); return }
    if (cSenha !== cSenha2) { setErro('As senhas não coincidem.'); return }
    if (cSenha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    const { error } = await signUp({ nome: cNome, cpf: cCpf, data_nascimento: cNasc, email: cEmail, telefone: cTel, senha: cSenha })
    if (error) {
      setErro(error.message?.includes('already registered') ? 'E-mail já cadastrado.' : 'Erro ao criar conta. Tente novamente.')
    } else {
      setSucesso('Conta criada com sucesso!')
      setAba('login'); setEmail(cEmail)
    }
    setLoading(false)
  }

  return (
    <div style={s.container}>
      {/* Background circles */}
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
        <p style={s.cardTitle}>{aba === 'login' ? 'Bem-vindo(a) de volta! 👋' : 'Criar sua conta'}</p>
        <p style={s.cardSub}>{aba === 'login' ? 'Faça login para continuar' : 'Preencha seus dados abaixo'}</p>

        {/* Tabs */}
        <div style={s.abas}>
          {['login', 'cadastro'].map(a => (
            <button key={a} style={{ ...s.aba, ...(aba === a ? s.abaOn : {}) }}
              onClick={() => { setAba(a); setErro(''); setSucesso('') }}>
              {a === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        {sucesso && (
          <div style={s.sucessoBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            <p style={{ fontSize: 13, color: '#166534', marginLeft: 8 }}>{sucesso}</p>
          </div>
        )}
        {erro && (
          <div style={s.erroBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={{ fontSize: 13, color: '#991B1B', marginLeft: 8 }}>{erro}</p>
          </div>
        )}

        {aba === 'login' ? (
          <form onSubmit={handleLogin}>
            <label style={s.label}>E-mail</label>
            <div style={s.inputWrap}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <input style={s.inputInner} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoCapitalize="none" />
            </div>
            <label style={s.label}>Senha</label>
            <div style={s.inputWrap}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              <input style={s.inputInner} type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowSenha(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', fontSize: 12 }}>
                {showSenha ? 'ocultar' : 'ver'}
              </button>
            </div>
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? <span style={s.spinner} /> : 'Entrar'}
            </button>
            <p style={s.switchText}>Não tem conta? <button type="button" style={s.linkBtn} onClick={() => setAba('cadastro')}>Cadastre-se</button></p>
          </form>
        ) : (
          <form onSubmit={handleCadastro}>
            {[
              { label: 'Nome completo', value: cNome, set: setCNome, placeholder: 'Seu nome completo', type: 'text' },
              { label: 'CPF', value: cCpf, set: v => setCCpf(fmtCpf(v)), placeholder: '000.000.000-00', type: 'text', maxLength: 14 },
              { label: 'E-mail', value: cEmail, set: setCEmail, placeholder: 'seu@email.com', type: 'email' },
              { label: 'Telefone', value: cTel, set: v => setCTel(fmtTel(v)), placeholder: '(11) 99999-9999', type: 'text', maxLength: 15 },
            ].map(f => (
              <div key={f.label}>
                <label style={s.label}>{f.label}</label>
                <div style={s.inputWrap}>
                  <input style={{ ...s.inputInner, paddingLeft: 0 }} type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} maxLength={f.maxLength} autoCapitalize="none" />
                </div>
              </div>
            ))}
            <label style={s.label}>Data de nascimento</label>
            <div style={s.inputWrap}>
              <input style={{ ...s.inputInner, paddingLeft: 0 }} type="date" value={cNasc} onChange={e => setCNasc(e.target.value)} />
            </div>
            <label style={s.label}>Senha</label>
            <div style={s.inputWrap}>
              <input style={{ ...s.inputInner, paddingLeft: 0 }} type="password" value={cSenha} onChange={e => setCSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <label style={s.label}>Confirmar senha</label>
            <div style={s.inputWrap}>
              <input style={{ ...s.inputInner, paddingLeft: 0 }} type="password" value={cSenha2} onChange={e => setCSenha2(e.target.value)} placeholder="Repita a senha" />
            </div>
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? <span style={s.spinner} /> : 'Criar conta'}
            </button>
            <p style={s.switchText}>Já tem conta? <button type="button" style={s.linkBtn} onClick={() => setAba('login')}>Entrar</button></p>
          </form>
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
  card: { width: '100%', maxWidth: 390, backgroundColor: '#fff', borderRadius: '28px 28px 0 0', padding: '28px 24px 8px', flex: 1, zIndex: 1 },
  cardTitle: { fontSize: 22, fontWeight: 800, color: '#0D1B2A', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  abas: { display: 'flex', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4, marginBottom: 20 },
  aba: { flex: 1, padding: '10px 0', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 600, color: '#6B7280', background: 'none', cursor: 'pointer', transition: 'all 0.2s' },
  abaOn: { backgroundColor: '#fff', color: '#0047AB', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 2 },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: '0 14px', marginBottom: 14, height: 52, backgroundColor: '#FAFAFA', transition: 'border 0.2s' },
  inputInner: { flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0D1B2A', backgroundColor: 'transparent', fontFamily: 'inherit' },
  btn: { width: '100%', background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 6, marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#fff', boxShadow: '0 4px 16px rgba(0,71,171,0.35)' },
  spinner: { width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  erroBox: { display: 'flex', alignItems: 'center', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: 12, marginBottom: 14, border: '1px solid #FECACA' },
  sucessoBox: { display: 'flex', alignItems: 'center', backgroundColor: '#F0FDF4', padding: '10px 14px', borderRadius: 12, marginBottom: 14, border: '1px solid #BBF7D0' },
  switchText: { textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 14, marginBottom: 8 },
  linkBtn: { background: 'none', border: 'none', color: '#0047AB', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
}