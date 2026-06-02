import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext({})

const ICONS = { success: '✅', error: '❌', info: 'ℹ️' }
const COLORS = {
  success: { bg: 'var(--sbg)', color: 'var(--success)', border: 'var(--success)' },
  error:   { bg: 'var(--dbg)', color: 'var(--danger)',  border: 'var(--danger)' },
  info:    { bg: 'var(--p3)',  color: 'var(--p)',       border: 'var(--p)' },
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', top: 'max(16px, env(safe-area-inset-top, 16px))', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none', width: 'calc(100% - 32px)', maxWidth: 360 }}>
      {toasts.map(t => {
        const c = COLORS[t.type] || COLORS.info
        return (
          <div key={t.id}
            style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', animation: 'toastIn 0.2s ease', pointerEvents: 'all' }}>
            <span>{ICONS[t.type]}</span>
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button onClick={() => onDismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.color, fontSize: 18, padding: 0, lineHeight: 1, opacity: 0.6 }}>×</button>
          </div>
        )
      })}
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev.slice(-2), { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === 'error' ? 4500 : 3000)
  }, [])

  const toast = {
    success: msg => addToast(msg, 'success'),
    error:   msg => addToast(msg, 'error'),
    info:    msg => addToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
