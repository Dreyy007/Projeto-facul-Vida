import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchPaciente(session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchPaciente(session.user.email)
      else { setPaciente(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchPaciente(email) {
    const { data } = await supabase.from('pacientes').select('*').eq('email', email).single()
    setPaciente(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp({ nome, cpf, data_nascimento, email, telefone, senha }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome } },
    })
    if (error) return { error }

    const { error: erroPaciente } = await supabase.from('pacientes').insert([{
      nome, email,
      cpf: cpf.replace(/\D/g, ''),
      data_nascimento,
      telefone,
      ativo: true,
    }])

    if (erroPaciente?.code === '23505') {
      await supabase.from('pacientes').update({
        nome, cpf: cpf.replace(/\D/g, ''), data_nascimento, telefone, ativo: true,
      }).eq('email', email)
    }

    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, paciente, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)