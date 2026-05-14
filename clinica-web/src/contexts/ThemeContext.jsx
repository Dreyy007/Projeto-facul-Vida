import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => localStorage.getItem('tema-web') || 'claro')

  const temaEfetivo = tema === 'sistema'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro')
    : tema

  useEffect(() => {
    document.body.setAttribute('data-theme', temaEfetivo)
    localStorage.setItem('tema-web', tema)
  }, [tema, temaEfetivo])

  useEffect(() => {
    if (tema !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => document.body.setAttribute('data-theme', mq.matches ? 'escuro' : 'claro')
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
