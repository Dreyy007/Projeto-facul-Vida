import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Paciente
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Consultas from './pages/Consultas'
import Chat from './pages/Chat'
import Perfil from './pages/Perfil'
import Agendar from './pages/Agendar'
import Resultados from './pages/Resultados'
import RedefinirSenha from './pages/RedefinirSenha'

// Interno
import LayoutInterno from './components/LayoutInterno'
import HomeInterno from './pages/interno/HomeInterno'
import AgendaInterno from './pages/interno/AgendaInterno'
import AprovacoesInterno from './pages/interno/AprovacoesInterno'
import ChatInterno from './pages/interno/ChatInterno'
import PacientesInterno from './pages/interno/PacientesInterno'
import ResultadosInterno from './pages/interno/ResultadosInterno'
import EscalaInterno from './pages/interno/EscalaInterno'
import PerfilInterno from './pages/interno/PerfilInterno'

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
  const { user, loading, isInterno } = useAuth()
  if (loading) return null
  if (!user) return children
  return <Navigate to={isInterno ? '/interno' : '/'} replace />
}

// Redireciona para a área correta após login
function RootRedirect() {
  const { user, loading, isInterno, isPaciente } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (isInterno) return <Navigate to="/interno" replace />
  return <Navigate to="/" replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Público */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />

            {/* App paciente */}
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Home />} />
              <Route path="consultas" element={<Consultas />} />
              <Route path="chat" element={<Chat />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="agendar" element={<Agendar />} />
              <Route path="resultados" element={<Resultados />} />
            </Route>

            {/* App interno (estagiário/admin/coordenador) */}
            <Route path="/interno" element={<PrivateRoute><LayoutInterno /></PrivateRoute>}>
              <Route index element={<HomeInterno />} />
              <Route path="agenda" element={<AgendaInterno />} />
              <Route path="aprovacoes" element={<AprovacoesInterno />} />
              <Route path="chat" element={<ChatInterno />} />
              <Route path="pacientes" element={<PacientesInterno />} />
              <Route path="resultados" element={<ResultadosInterno />} />
              <Route path="escala" element={<EscalaInterno />} />
              <Route path="perfil" element={<PerfilInterno />} />
            </Route>

            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}