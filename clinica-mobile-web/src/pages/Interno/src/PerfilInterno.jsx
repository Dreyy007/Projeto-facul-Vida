import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const roleLabel = { admin: 'Administrador', coordenador: 'Coordenador', estagiario: 'Estagiário', recepcionista: 'Recepcionista' }

export default function PerfilInterno() {
  const { perfil, signOut } = useAuth()
  const [form, setForm] = useState({ nome: '', especialidade: '', crp_crm: '' })
  const [senhaForm, setSenhaForm] = useState({ nova: '', confirma: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [aba, setAba] = useState('perfil')

  useEffect(() => {
    if (perfil) setForm({ nome: perfil.nome || '', especialidade: perfil.especialidade || '', crp_crm: perfil.crp_crm || '' })
  }, [perfil])

  async function salvarPerfil() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ nome: form.nome, especialidade: form.especialidade, crp_crm: form.crp_crm }).eq('id', perfil.id)
    setMsg(error ? '❌ Erro ao salvar.' : '✅ Perfil atualizado!')
    setTimeout(() => setMsg(''), 3000)
    setSaving(false)
  }

  async function salvarSenha() {
    if (senhaForm.nova !== senhaForm.confirma) { setMsg('❌ Senhas não coincidem.'); return }
    if (senhaForm.nova.length < 6) { setMsg('❌ Mínimo 6 caracteres.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: senhaForm.nova })
    setMsg(error ? '❌ Erro ao alterar senha.' : '✅ Senha alterada!')
    if (!error) setSenhaForm({ nova: '', confirma: '' })
    setTimeout(() => setMsg(''), 3000)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <div style={{ background: 'linear-gradient(135deg, #0047AB, #1d6fef)', padding: '52px 20px 20px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#fff' }}>
          {perfil?.nome?.slice(0,2).toUpperCase()}
        </div>
        <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: '0 0 4px' }}>{perfil?.nome}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{roleLabel[perfil?.tipo] || perfil?.tipo}</span>
          {perfil?.codigo && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{perfil.codigo}</span>}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
        {[['perfil', 'Meus dados'], ['senha', 'Senha']].map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} style={{ flex: 1, padding: '12px 0', fontSize: 13, fontWeight: aba === k ? 700 : 500, color: aba === k ? '#0047AB' : '#9CA3AF', border: 'none', background: 'none', borderBottom: aba === k ? '2px solid #0047AB' : '2px solid transparent', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {msg && <div style={{ background: msg.startsWith('✅') ? '#D1FAE5' : '#FEE2E2', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 12, color: msg.startsWith('✅') ? '#166534' : '#991B1B' }}>{msg}</div>}

        {aba === 'perfil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Nome completo', key: 'nome', placeholder: 'Seu nome' },
              { label: 'Especialidade', key: 'especialidade', placeholder: 'Ex: Psicologia Infantil' },
              { label: 'CRP / CRM', key: 'crp_crm', placeholder: 'Ex: CRP 06/12345' },
            ].map(f => (
              <div key={f.key}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>{f.label}</p>
                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={salvarPerfil} disabled={saving}
              style={{ background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        )}

        {aba === 'senha' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Nova senha', key: 'nova', placeholder: '••••••••' },
              { label: 'Confirmar senha', key: 'confirma', placeholder: '••••••••' },
            ].map(f => (
              <div key={f.key}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', margin: '0 0 6px' }}>{f.label}</p>
                <input type="password" value={senhaForm[f.key]} onChange={e => setSenhaForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: 12, padding: 13, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={salvarSenha} disabled={saving || !senhaForm.nova}
              style={{ background: 'linear-gradient(135deg, #0047AB, #1a6fdf)', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button onClick={signOut}
            style={{ width: '100%', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Sair da conta
          </button>
        </div>
        <div style={{ height: 32 }} />
      </div>
    </div>
  )
}