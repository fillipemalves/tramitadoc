import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('tramitadoc_token'))
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('tramitadoc_user')) } catch { return null }
  })

  const login = (token, user) => {
    localStorage.setItem('tramitadoc_token', token)
    localStorage.setItem('tramitadoc_user',  JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('tramitadoc_token')
    localStorage.removeItem('tramitadoc_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
