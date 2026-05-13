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
    const { error } = await signUp({
      nome: cNome, cpf: cCpf, data_nascimento: cNasc,
      email: cEmail, telefone: cTel, senha: cSenha,
    })
    if (error) {
      setErro(error.message?.includes('already registered') ? 'E-mail já cadastrado.' : 'Erro ao criar conta. Tente novamente.')
    } else {
      setSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      setAba('login'); setEmail(cEmail)
    }
    setLoading(false)
  }

  return (
    <div style={s.container}>
      <div style={s.top}>
        <div style={s.logoCircle}><span style={s.logoText}>V+</span></div>
        <p style={s.brand}>Clínica Vida+</p>
        <p style={s.sub}>Portal do Paciente</p>
      </div>

      <div style={s.card}>
        <div style={s.abas}>
          {['login', 'cadastro'].map(a => (
            <button key={a} style={{ ...s.aba, ...(aba === a ? s.abaOn : {}) }}
              onClick={() => { setAba(a); setErro(''); setSucesso('') }}>
              {a === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        {sucesso && <div style={s.sucessoBox}><p style={{ fontSize: 13, color: '#166534' }}>✅ {sucesso}</p></div>}
        {erro && <p style={s.erroText}>{erro}</p>}

        {aba === 'login' ? (
          <form onSubmit={handleLogin}>
            <label style={s.label}>E-mail</label>
            <input style={s.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoCapitalize="none" />
            <label style={s.label}>Senha</label>
            <input style={s.input} type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? <span style={s.spinner} /> : <span style={s.btnText}>Entrar</span>}
            </button>
            <p style={s.info}>Não tem conta? <button type="button" style={s.linkBtn} onClick={() => setAba('cadastro')}>Cadastre-se</button></p>
          </form>
        ) : (
          <form onSubmit={handleCadastro}>
            <label style={s.label}>Nome completo</label>
            <input style={s.input} value={cNome} onChange={e => setCNome(e.target.value)} placeholder="Seu nome completo" />
            <label style={s.label}>CPF</label>
            <input style={s.input} value={cCpf} onChange={e => setCCpf(fmtCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
            <label style={s.label}>Data de nascimento</label>
            <input style={s.input} type="date" value={cNasc} onChange={e => setCNasc(e.target.value)} />
            <label style={s.label}>E-mail</label>
            <input style={s.input} type="email" value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="seu@email.com" autoCapitalize="none" />
            <label style={s.label}>Telefone</label>
            <input style={s.input} value={cTel} onChange={e => setCTel(fmtTel(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} />
            <label style={s.label}>Senha</label>
            <input style={s.input} type="password" value={cSenha} onChange={e => setCSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            <label style={s.label}>Confirmar senha</label>
            <input style={s.input} type="password" value={cSenha2} onChange={e => setCSenha2(e.target.value)} placeholder="Repita a senha" />
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? <span style={s.spinner} /> : <span style={s.btnText}>Criar conta</span>}
            </button>
            <p style={s.info}>Já tem conta? <button type="button" style={s.linkBtn} onClick={() => setAba('login')}>Entrar</button></p>
          </form>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', backgroundColor: '#0047AB', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, overflowY: 'auto' },
  top: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 },
  logoCircle: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 28, fontWeight: 900, color: '#fff' },
  brand: { fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 4 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  abas: { display: 'flex', marginBottom: 20, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 },
  aba: { flex: 1, padding: '9px 0', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#6B7280', background: 'none', cursor: 'pointer' },
  abaOn: { backgroundColor: '#fff', color: '#0047AB', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: { width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#0D1B2A', marginBottom: 14, outline: 'none', fontFamily: 'inherit' },
  btn: { width: '100%', backgroundColor: '#0047AB', borderRadius: 12, padding: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 700 },
  spinner: { width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  erroText: { color: '#991B1B', fontSize: 13, marginBottom: 12, backgroundColor: '#FEE2E2', padding: '8px 12px', borderRadius: 10 },
  sucessoBox: { backgroundColor: '#D1FAE5', padding: '10px 12px', borderRadius: 10, marginBottom: 12 },
  info: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 14 },
  linkBtn: { background: 'none', border: 'none', color: '#0047AB', fontWeight: 700, fontSize: 12, cursor: 'pointer' },
}