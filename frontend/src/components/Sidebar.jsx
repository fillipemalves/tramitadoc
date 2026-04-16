import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ALL = [
  { path: '/dashboard',  icon: '🏠', label: 'Dashboard',  roles: ['USER', 'ADM', 'SUPER_ADMIN'] },
  { path: '/memorandos', icon: '📄', label: 'Memorandos', roles: ['USER', 'ADM', 'SUPER_ADMIN'] },
]

const NAV_USER = [
  { path: '/entidades', icon: '🏛️', label: 'Minha Secretaria', roles: ['USER'] },
]

const NAV_ADM = [
  { path: '/entidades', icon: '🏛️', label: 'Entidades',  roles: ['ADM'] },
  { path: '/usuarios',  icon: '👥', label: 'Usuários',   roles: ['ADM'] },
]

const NAV_SUPER = [
  { path: '/entidades',   icon: '🏛️', label: 'Entidades',    roles: ['SUPER_ADMIN'] },
  { path: '/usuarios',    icon: '👥', label: 'Usuários',     roles: ['SUPER_ADMIN'] },
  { path: '/super-admin', icon: '⚙️', label: 'Painel Super', roles: ['SUPER_ADMIN'] },
]

const ROLE_BADGE = {
  SUPER_ADMIN: { label: 'Super Admin',   cls: 'bg-violet-900 text-violet-300 border-violet-700' },
  ADM:         { label: 'Administrador', cls: 'bg-blue-900 text-blue-300 border-blue-700' },
  USER:        { label: 'Servidor',      cls: 'bg-slate-700 text-slate-300 border-slate-600' },
}

export default function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const role  = user?.role || 'USER'
  const badge = ROLE_BADGE[role] || ROLE_BADGE.USER

  const allItems = [
    ...NAV_ALL,
    ...(role === 'USER'        ? NAV_USER  : []),
    ...(role === 'ADM'         ? NAV_ADM   : []),
    ...(role === 'SUPER_ADMIN' ? NAV_SUPER : []),
  ]

  return (
    <div className={`flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200 flex-shrink-0 ${collapsed ? 'w-14' : 'w-56'}`}>

      {/* Logo */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-slate-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-black">S</div>
            <span className="text-white font-bold text-sm tracking-wide">TramitaDOC</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-slate-500 hover:text-white transition-colors cursor-pointer text-base p-1 rounded hover:bg-slate-800"
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto">

        {/* Novo Memorando — apenas ADM e SUPER_ADMIN */}
        {(role === 'ADM' || role === 'SUPER_ADMIN') && (
          <button
            onClick={() => navigate('/memorandos/novo')}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-600 cursor-pointer transition-colors mb-3 ${collapsed ? 'justify-center' : ''}`}
            title="Novo Memorando"
          >
            <span className="text-base">✍️</span>
            {!collapsed && <span>Novo Memorando</span>}
          </button>
        )}

        {!collapsed && <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest px-2 mb-1">Menu</p>}

        {allItems.map(item => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer
                ${active
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                ${collapsed ? 'justify-center' : ''}`}
            >
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Usuário */}
      <div className={`border-t border-slate-800 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <button
            onClick={logout}
            title="Sair"
            className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:bg-red-900 cursor-pointer transition-colors text-xs"
          >
            ⏻
          </button>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-blue-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.department?.acronym || user?.secretary?.acronym}</p>
              </div>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mb-2 ${badge.cls}`}>
              {badge.label}
            </span>
            <button
              onClick={() => navigate('/meu-perfil')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <span>👤</span>
              <span>Meu perfil</span>
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <span>⏻</span>
              <span>Sair do sistema</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}