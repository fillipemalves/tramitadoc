import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login          from './pages/Login'
import Dashboard      from './pages/Dashboard'
import Memos          from './pages/Memos'
import NovoMemo       from './pages/NovoMemo'
import VisualizarMemo from './pages/VisualizarMemo'
import Usuarios       from './pages/Usuarios'
import Entidades      from './pages/Entidades'
import SuperAdmin     from './pages/SuperAdmin'
import MeuPerfil           from './pages/MeuPerfil'
import VerificarAssinatura from './pages/VerificarAssinatura'

function PrivateRoute({ children, roles }) {
  const { user, token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verificar/:code" element={<VerificarAssinatura />} />

        <Route path="/dashboard" element={
          <PrivateRoute roles={['USER', 'ADM', 'SUPER_ADMIN']}>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/memorandos" element={
          <PrivateRoute roles={['USER', 'ADM', 'SUPER_ADMIN']}>
            <Memos />
          </PrivateRoute>
        } />

        <Route path="/memorandos/novo" element={
          <PrivateRoute roles={['ADM', 'SUPER_ADMIN']}>
            <NovoMemo />
          </PrivateRoute>
        } />
        <Route path="/memorandos/:id" element={
          <PrivateRoute roles={['USER', 'ADM', 'SUPER_ADMIN']}>
            <VisualizarMemo />
          </PrivateRoute>
        } />
        <Route path="/memorandos/:id/editar" element={
          <PrivateRoute roles={['ADM', 'SUPER_ADMIN']}>
            <NovoMemo />
          </PrivateRoute>
        } />

        <Route path="/usuarios" element={
          <PrivateRoute roles={['ADM', 'SUPER_ADMIN']}>
            <Usuarios />
          </PrivateRoute>
        } />
        <Route path="/entidades" element={
          <PrivateRoute roles={['USER', 'ADM', 'SUPER_ADMIN']}>
            <Entidades />
          </PrivateRoute>
        } />
        <Route path="/super-admin" element={
          <PrivateRoute roles={['SUPER_ADMIN']}>
            <SuperAdmin />
          </PrivateRoute>
        } />
        <Route path="/meu-perfil" element={
          <PrivateRoute roles={['USER', 'ADM', 'SUPER_ADMIN']}>
            <MeuPerfil />
          </PrivateRoute>
        } />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  )
}