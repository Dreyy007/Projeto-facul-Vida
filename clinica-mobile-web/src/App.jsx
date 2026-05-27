import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LayoutInterno from './components/LayoutInterno'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pacientes from './pages/Pacientes'
import PacienteDetalhe from './pages/PacienteDetalhe'
import Agenda from './pages/Agenda'
import Consultas from './pages/Consultas'
import Aprovacoes from './pages/Aprovacoes'
import Chat from './pages/Chat'
import Usuarios from './pages/Usuarios'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'
import Resultados from './pages/Resultados'

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0047AB' }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return !user ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/" element={<PrivateRoute><LayoutInterno /></PrivateRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="pacientes" element={<Pacientes />} />
              <Route path="pacientes/:id" element={<PacienteDetalhe />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="consultas" element={<Consultas />} />
              <Route path="aprovacoes" element={<Aprovacoes />} />
              <Route path="chat" element={<Chat />} />
              <Route path="usuarios" element={<Usuarios />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="resultados" element={<Resultados />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}