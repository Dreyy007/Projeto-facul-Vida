import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Consultas from './pages/Consultas'
import Chat from './pages/Chat'
import Perfil from './pages/Perfil'
import Agendar from './pages/Agendar'
import Resultados from './pages/Resultados'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0047AB' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return !user ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Home />} />
            <Route path="consultas" element={<Consultas />} />
            <Route path="chat" element={<Chat />} />
            <Route path="perfil" element={<Perfil />} />
            <Route path="agendar" element={<Agendar />} />
            <Route path="resultados" element={<Resultados />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
      </ThemeProvider>
  )
}