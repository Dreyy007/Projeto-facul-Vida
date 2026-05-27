import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [paciente, setPaciente] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const buscando = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUsuario(session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        if (!buscando.current) fetchUsuario(session.user.email)
      } else {
        buscando.current = false
        setPaciente(null)
        setPerfil(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUsuario(email) {
    if (buscando.current) return
    buscando.current = true

    // SEMPRE busca profiles PRIMEIRO — se encontrar, é interno, ponto final
    const { data: perfilData } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (perfilData) {
      // É membro da equipe — ignora pacientes completamente
      setPerfil(perfilData)
      setPaciente(null)
      setLoading(false)
      buscando.current = false
      return
    }

    // Só busca paciente se NÃO encontrou em profiles
    const { data: pacienteData } = await supabase
      .from('pacientes')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    setPaciente(pacienteData ?? null)
    setPerfil(null)
    setLoading(false)
    buscando.current = false
  }

  async function signIn(email, password) {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  async function signInWithCodigo(codigoOuEmail, password) {
    let emailParaLogin = codigoOuEmail.trim()

    if (!emailParaLogin.includes('@')) {
      const { data: perfilData } = await supabase
        .from('profiles')
        .select('email')
        .eq('codigo', emailParaLogin.toUpperCase())
        .maybeSingle()

      if (!perfilData?.email) return { error: { message: 'Código não encontrado.' } }
      emailParaLogin = perfilData.email
    }

    return await supabase.auth.signInWithPassword({ email: emailParaLogin, password })
  }

  async function signUp({ nome, cpf, data_nascimento, email, telefone, senha }) {
    const { data, error } = await supabase.auth.signUp({
      email, password: senha, options: { data: { nome } },
    })
    if (error) return { error }

    const { error: erroPaciente } = await supabase.from('pacientes').insert([{
      nome, email, cpf: cpf.replace(/\D/g, ''), data_nascimento, telefone, ativo: true,
    }])

    if (erroPaciente?.code === '23505') {
      await supabase.from('pacientes').update({
        nome, cpf: cpf.replace(/\D/g, ''), data_nascimento, telefone, ativo: true,
      }).eq('email', email)
    }

    return { error: null }
  }

  async function signOut() {
    buscando.current = false
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      user, paciente, perfil, loading,
      isInterno: !!perfil,
      isPaciente: !!paciente,
      signIn, signInWithCodigo, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)