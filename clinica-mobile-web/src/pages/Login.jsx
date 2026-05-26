import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

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
  const [modoInterno, setModoInterno] = useState(false)
  const [emailInt, setEmailInt] = useState('')
  const [senhaInt, setSenhaInt] = useState('')
  const [loadingInt, setLoadingInt] = useState(false)
  const [erroInt, setErroInt] = useState('')
  const [esqueci, setEsqueci] = useState(false)
  const [esqueciEmail, setEsqueciEmail] = useState('')
  const [esqueciOk, setEsqueciOk] = useState(false)
  const [esqueciLoading, setEsqueciLoading] = useState(false)

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

  async function handleEsqueci(e) {
    e.preventDefault()
    if (!esqueciEmail) { setErro('Informe seu e-mail.'); return }
    setEsqueciLoading(true); setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(esqueciEmail, {
      redirectTo: 'https://clinica-vida-mobile.vercel.app/redefinir-senha'
    })
    setEsqueciLoading(false)
    if (error) setErro('Erro ao enviar e-mail. Verifique o endereço informado.')
    else setEsqueciOk(true)
  }

  async function handleLoginInterno(e) {
    e.preventDefault()
    if (!emailInt || !senhaInt) { setErroInt('Preencha e-mail e senha.'); return }
    setLoadingInt(true); setErroInt('')
    const { error } = await signIn(emailInt, senhaInt)
    if (error) setErroInt('E-mail ou senha inválidos.')
    setLoadingInt(false)
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

  // ===== TELA INTERNA =====
  if (modoInterno) return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0D1B2A', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Elementos decorativos */}
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, background: 'rgba(0,71,171,0.15)', top: -100, right: -80 }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, background: 'rgba(0,71,171,0.1)', bottom: 100, left: -60 }} />

      {/* Header */}
      <div style={{ paddingTop: 56, paddingLeft: 24, paddingRight: 24, paddingBottom: 32, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 8px 24px rgba(0,71,171,0.4)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Acesso Interno</p>
        <p style={{ fontSize: 14, color: '#60a5fa' }}>Clínica Vida+ · Equipe</p>
      </div>

      {/* Card */}
      <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '28px 28px 0 0', padding: '28px 24px 40px', zIndex: 1 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#0D1B2A', marginBottom: 4 }}>Entrar como equipe</p>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Use o e-mail cadastrado pela clínica</p>

        {erroInt && (
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: 12, marginBottom: 16, border: '1px solid #FECACA' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{ fontSize: 13, color: '#991B1B', marginLeft: 8 }}>{erroInt}</p>
          </div>
        )}

        <form onSubmit={handleLoginInterno}>
          <label style={s.label}>E-mail da clínica</label>
          <div style={{ ...s.inputWrap, borderColor: '#dbeafe', backgroundColor: '#eff6ff' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <input style={s.inputInner} type="email" value={emailInt} onChange={e => setEmailInt(e.target.value)} placeholder="seu@clinicavida.com" autoCapitalize="none" required />
          </div>

          <label style={s.label}>Senha</label>
          <div style={{ ...s.inputWrap, borderColor: '#dbeafe', backgroundColor: '#eff6ff' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <input style={s.inputInner} type="password" value={senhaInt} onChange={e => setSenhaInt(e.target.value)} placeholder="••••••••" required />
          </div>

          <button type="submit" disabled={loadingInt}
            style={{ width: '100%', background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 8, fontSize: 16, fontWeight: 700, color: '#fff', opacity: loadingInt ? 0.7 : 1, boxShadow: '0 4px 16px rgba(13,27,42,0.3)' }}>
            {loadingInt ? <span style={s.spinner} /> : 'Entrar'}
          </button>
        </form>

        <div style={{ height: 1, background: '#F3F4F6', margin: '20px 0' }} />

        <button onClick={() => { setModoInterno(false); setErroInt('') }}
          style={{ width: '100%', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 14, padding: 14, fontSize: 14, color: '#6B7280', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          Sou paciente
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ===== TELA PACIENTE =====
  return (
    <div style={s.container}>
      <svg style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 0 }} width="100%" height="120" viewBox="0 0 390 120" preserveAspectRatio="none">
        <path d="M0,60 C100,20 200,100 300,60 C340,40 370,70 390,50 L390,120 L0,120 Z" fill="#1e3a8a" opacity="0.5"/>
        <path d="M0,80 C130,40 260,110 390,75 L390,120 L0,120 Z" fill="#1d4ed8" opacity="0.3"/>
      </svg>

      <div style={s.logoArea}>
        <div style={s.logoCircle}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </div>
        <p style={s.brand}>Clínica Vida+</p>
        <p style={s.sub}>Cuidado completo para sua saúde</p>
      </div>

      <div style={s.card}>
        <p style={s.cardTitle}>{aba === 'login' ? 'Bem-vindo(a) de volta! 👋' : 'Criar sua conta'}</p>
        <p style={s.cardSub}>{aba === 'login' ? 'Faça login para continuar' : 'Preencha seus dados abaixo'}</p>

        <div style={s.abas}>
          {[['login','Entrar'],['cadastro','Cadastrar'],['interno','🏥 Equipe']].map(([a,l]) => (
            <button key={a} style={{ ...s.aba, ...(aba === a ? (a === 'interno' ? s.abaOnInterno : s.abaOn) : {}) }}
              onClick={() => { setAba(a); setErro(''); setSucesso('') }}>
              {l}
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <input style={s.inputInner} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoCapitalize="none" />
            </div>
            <label style={s.label}>Senha</label>
            <div style={s.inputWrap}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <input style={s.inputInner} type={showSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowSenha(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1d4ed8', fontSize: 12, fontWeight: 600 }}>
                {showSenha ? 'ocultar' : 'ver'}
              </button>
            </div>
            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? <span style={s.spinner} /> : 'Entrar'}
            </button>
            <button type="button" style={{ ...s.linkBtn, display: 'block', textAlign: 'center', width: '100%', marginTop: 8, marginBottom: 4, fontSize: 13 }}
              onClick={() => { setEsqueci(true); setErro(''); setEsqueciOk(false); setEsqueciEmail(email) }}>
              Esqueci minha senha
            </button>
            <p style={s.switchText}>
              Não tem conta?{' '}
              <button type="button" style={s.linkBtn} onClick={() => setAba('cadastro')}>Cadastre-se</button>
            </p>

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
                  <input style={{ ...s.inputInner, paddingLeft: 0 }} type={f.type} value={f.value}
                    onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    maxLength={f.maxLength} autoCapitalize="none" />
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
            <p style={s.switchText}>
              Já tem conta?{' '}
              <button type="button" style={s.linkBtn} onClick={() => setAba('login')}>Entrar</button>
            </p>
          </form>
        )}

        {aba === 'interno' && (
          <form onSubmit={handleLoginInterno}>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Use o e-mail cadastrado pela clínica</p>
            <label style={s.label}>E-mail</label>
            <div style={{ ...s.inputWrap, borderColor: '#dbeafe', backgroundColor: '#eff6ff' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <input style={s.inputInner} type="email" value={emailInt} onChange={e => setEmailInt(e.target.value)} placeholder="seu@clinicavida.com" autoCapitalize="none" required />
            </div>
            <label style={s.label}>Senha</label>
            <div style={{ ...s.inputWrap, borderColor: '#dbeafe', backgroundColor: '#eff6ff' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" style={{ marginRight: 10, flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <input style={s.inputInner} type="password" value={senhaInt} onChange={e => setSenhaInt(e.target.value)} placeholder="••••••••" required />
            </div>
            {erroInt && (
              <div style={s.erroBox}>
                <p style={{ fontSize: 13, color: '#991B1B' }}>{erroInt}</p>
              </div>
            )}
            <button type="submit" disabled={loadingInt}
              style={{ width: '100%', background: 'linear-gradient(135deg, #0D1B2A, #1e3a5f)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 6, fontSize: 16, fontWeight: 700, color: '#fff', opacity: loadingInt ? 0.7 : 1, boxShadow: '0 4px 16px rgba(13,27,42,0.3)' }}>
              {loadingInt ? <span style={s.spinner} /> : 'Entrar como equipe'}
            </button>
          </form>
        )}
      </div>

      {esqueci && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '24px 24px 0 0', width: '100%', padding: '28px 24px 48px' }}>
            {!esqueciOk ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A' }}>Redefinir senha</p>
                  <button onClick={() => { setEsqueci(false); setErro('') }} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Informe o e-mail da sua conta. Enviaremos um link para redefinir sua senha.</p>
                {erro && <div style={s.erroBox}><p style={{ fontSize: 13, color: '#991B1B' }}>{erro}</p></div>}
                <form onSubmit={handleEsqueci}>
                  <label style={s.label}>E-mail cadastrado</label>
                  <div style={s.inputWrap}>
                    <input style={{ ...s.inputInner, paddingLeft: 0 }} type="email" value={esqueciEmail}
                      onChange={e => setEsqueciEmail(e.target.value)} placeholder="seu@email.com" autoCapitalize="none" />
                  </div>
                  <button type="submit" style={{ ...s.btn, opacity: esqueciLoading ? 0.7 : 1 }} disabled={esqueciLoading}>
                    {esqueciLoading ? <span style={s.spinner} /> : 'Enviar link de redefinição'}
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#0D1B2A', marginBottom: 8 }}>E-mail enviado!</p>
                <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: '20px' }}>
                  Verifique sua caixa de entrada em <strong>{esqueciEmail}</strong> e siga as instruções.
                </p>
                <button onClick={() => { setEsqueci(false); setEsqueciOk(false); setErro('') }} style={{ ...s.btn, maxWidth: 280, margin: '0 auto' }}>
                  Voltar para o login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const s = {
  container: { minHeight: '100dvh', backgroundColor: '#0c1a3a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0', overflowY: 'auto', position: 'relative' },
  logoArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 65, paddingBottom: 28, zIndex: 1 },
  logoCircle: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brand: { fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 6 },
  sub: { fontSize: 14, color: '#60a5fa', fontWeight: 400 },
  card: { width: '100%', maxWidth: 390, backgroundColor: '#fff', borderRadius: '28px 28px 0 0', padding: '28px 24px 40px', flex: 1, zIndex: 1 },
  cardTitle: { fontSize: 22, fontWeight: 800, color: '#0D1B2A', marginBottom: 4 },
  cardSub: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  abas: { display: 'flex', backgroundColor: '#f1f5f9', borderRadius: 14, padding: 4, marginBottom: 20 },
  aba: { flex: 1, padding: '10px 0', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 600, color: '#6B7280', background: 'none', cursor: 'pointer', transition: 'all 0.2s' },
  abaOn: { backgroundColor: '#fff', color: '#1d4ed8', boxShadow: '0 2px 8px rgba(29,78,216,0.15)' },
  abaOnInterno: { backgroundColor: '#0D1B2A', color: '#fff', boxShadow: '0 2px 8px rgba(13,27,42,0.2)' },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 2 },
  inputWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '0 14px', marginBottom: 14, height: 52, backgroundColor: '#eff6ff', transition: 'border 0.2s' },
  inputInner: { flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0D1B2A', backgroundColor: 'transparent', fontFamily: 'inherit' },
  btn: { width: '100%', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginTop: 6, marginBottom: 4, fontSize: 16, fontWeight: 700, color: '#fff', boxShadow: '0 4px 16px rgba(29,78,216,0.35)' },
  spinner: { width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' },
  erroBox: { display: 'flex', alignItems: 'center', backgroundColor: '#FEF2F2', padding: '10px 14px', borderRadius: 12, marginBottom: 14, border: '1px solid #FECACA' },
  sucessoBox: { display: 'flex', alignItems: 'center', backgroundColor: '#F0FDF4', padding: '10px 14px', borderRadius: 12, marginBottom: 14, border: '1px solid #BBF7D0' },
  switchText: { textAlign: 'center', fontSize: 13, color: '#9CA3AF', marginTop: 14, marginBottom: 8 },
  linkBtn: { background: 'none', border: 'none', color: '#1d4ed8', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
}