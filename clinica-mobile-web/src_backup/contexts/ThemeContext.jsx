import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem('tema') || 'sistema')

  const temaEfetivo = tema === 'sistema'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro')
    : tema

  useEffect(() => {
    const root = document.getElementById('root')
    root.setAttribute('data-theme', temaEfetivo)
    localStorage.setItem('tema', tema)
  }, [tema, temaEfetivo])

  // Ouve mudança do sistema
  useEffect(() => {
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.getElementById('root').setAttribute('data-theme', mq.matches ? 'escuro' : 'claro')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [tema])

  return (
    <ThemeContext.Provider value={{ tema, setTema, temaEfetivo }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
