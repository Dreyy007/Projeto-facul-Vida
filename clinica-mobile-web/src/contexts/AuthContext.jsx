import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [loading, setLoading] = useState(true)
  const buscando = useRef(false) // CORRIGIDO: evita double fetch

  useEffect(() => {
    // Busca sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchPaciente(session.user.email)
      } else {
        setLoading(false)
      }
    })

    // Escuta mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // CORRIGIDO: só busca se ainda não está buscando
        if (!buscando.current) fetchPaciente(session.user.email)
      } else {
        buscando.current = false
        setPaciente(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchPaciente(email) {
    if (buscando.current) return
    buscando.current = true

    const { data } = await supabase
      .from('pacientes')
      .select('*')
      .eq('email', email)
      .single()

    setPaciente(data ?? null)
    setLoading(false)
    buscando.current = false
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
        nome,
        cpf: cpf.replace(/\D/g, ''),
        data_nascimento,
        telefone,
        ativo: true,
      }).eq('email', email)
    }

    return { error: null }
  }

  async function signOut() {
    buscando.current = false
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, paciente, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)