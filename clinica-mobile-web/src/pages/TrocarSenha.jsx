import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function validarSenha(senha) {
  const erros = []
  if (senha.length < 8) erros.push('Mínimo 8 caracteres')
  if (!/[A-Z]/.test(senha)) erros.push('1 letra maiúscula')
  if (!/[0-9]/.test(senha)) erros.push('1 número')
  if (!/[^A-Za-z0-9]/.test(senha)) erros.push('1 caractere especial (!@#$...)')
  return erros
}

export default function TrocarSenha({ onConcluido }) {
  const { profile } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [erros, setErros] = useState([])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    const errosSenha = validarSenha(senha)
    if (errosSenha.length > 0) { setErros(errosSenha); return }
    if (senha !== confirma) { setErro('As senhas não coincidem.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setErro('Erro ao atualizar senha: ' + error.message)
      setLoading(false)
      return
    }

    // Marca que a senha foi trocada
    await supabase.from('profiles').update({ senha_provisoria: false }).eq('id', profile.id)
    setLoading(false)
    onConcluido?.()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0047AB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 24, padding: '36px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔐</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0D1B2A', marginBottom: 6 }}>Defina sua senha</h2>
          <p style={{ fontSize: 13, color: '#6B7280' }}>
            Olá, <strong>{profile?.nome?.split(' ')[0]}</strong>! Este é seu primeiro acesso.<br/>
            Crie uma senha segura para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Nova senha *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => { setSenha(e.target.value); setErros(validarSenha(e.target.value)) }}
                placeholder="Mín. 8 caracteres"
                style={{ width: '100%', padding: '12px 50px 12px 14px', border: '1.5px solid #E5E7EB', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setShowSenha(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9CA3AF' }}>
                {showSenha ? 'ocultar' : 'ver'}
              </button>
            </div>
            {/* Requisitos */}
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { texto: 'Mínimo 8 caracteres', ok: senha.length >= 8 },
                { texto: '1 letra maiúscula', ok: /[A-Z]/.test(senha) },
                { texto: '1 número', ok: /[0-9]/.test(senha) },
                { texto: '1 caractere especial (!@#$...)', ok: /[^A-Za-z0-9]/.test(senha) },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: senha.length > 0 ? (r.ok ? '#059669' : '#DC2626') : '#9CA3AF' }}>
                    {senha.length > 0 ? (r.ok ? '✓' : '✗') : '○'}
                  </span>
                  <span style={{ color: senha.length > 0 ? (r.ok ? '#059669' : '#DC2626') : '#9CA3AF' }}>{r.texto}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Confirmar senha *</label>
            <input
              type={showSenha ? 'text' : 'password'}
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              placeholder="Repita a senha"
              style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #E5E7EB', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
            {confirma && senha !== confirma && (
              <div style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>As senhas não coincidem.</div>
            )}
          </div>

          {erro && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#991B1B', marginBottom: 16 }}>
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || erros.length > 0 || senha !== confirma || !senha}
            style={{ width: '100%', background: erros.length > 0 || senha !== confirma || !senha ? '#E5E7EB' : 'linear-gradient(135deg, #0047AB, #1a6fdf)', color: erros.length > 0 || senha !== confirma || !senha ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, cursor: erros.length > 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
            {loading ? 'Salvando...' : 'Definir senha e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}