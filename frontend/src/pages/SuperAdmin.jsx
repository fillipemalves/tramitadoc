import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { memoService, userService, secretaryService } from '../services/api'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'overview', label: '📊 Visão Geral' },
  { id: 'depts',    label: '🏛️ Secretarias' },
]

export default function SuperAdmin() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [activeTab,    setActiveTab]    = useState('overview')
  const [stats,        setStats]        = useState({ totalDepts: 0, totalUsers: 0, totalMemos: 0, memosPending: 0 })
  const [secretaries,  setSecretaries]  = useState([])
  const [recentMemos,  setRecentMemos]  = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    Promise.all([
      memoService.list({ limit: 50 }),
      userService.list(),
      secretaryService.list(),
    ]).then(([memRes, usrRes, secRes]) => {
      const memos = memRes.data?.items || []
      const users = usrRes.data || []
      const secs  = secRes.data || []
      const totalDepts = secs.reduce((acc, s) => acc + (s.departments?.length || 0), 0)
      setStats({
        totalDepts,
        totalUsers:   users.length,
        totalMemos:   memos.length,
        memosPending: memos.filter(m => m.status === 'SENT' || m.status === 'RECEIVED').length,
      })
      setSecretaries(secs)
      setRecentMemos(memos.slice(0, 5))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-900 border border-violet-700 flex items-center justify-center text-base">⚙️</div>
          <div>
            <h1 className="text-base font-bold text-white">Painel Super Admin</h1>
            <p className="text-xs text-slate-500">Controle total do sistema TramitaDOC</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-violet-900 text-violet-300 border border-violet-700">
              ⚙️ Super Admin
            </span>
            <span className="text-xs text-slate-500">{user?.name}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 flex gap-1 flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer
                ${activeTab === tab.id
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* ── VISÃO GERAL ── */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">

              {/* KPIs */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Secretarias/Depts', value: stats.totalDepts,   icon: '🏛️', color: 'border-blue-800 bg-blue-950/40' },
                  { label: 'Usuários',           value: stats.totalUsers,   icon: '👥', color: 'border-emerald-800 bg-emerald-950/40' },
                  { label: 'Memorandos',         value: stats.totalMemos,   icon: '📄', color: 'border-violet-800 bg-violet-950/40' },
                  { label: 'Em trâmite',         value: stats.memosPending, icon: '⏳', color: 'border-amber-800 bg-amber-950/40' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
                    <div className="text-2xl mb-1">{s.icon}</div>
                    <div className="text-2xl font-black text-white">{loading ? '—' : s.value}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Ações rápidas */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-bold text-white mb-4">⚡ Ações Rápidas</h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Entidades',       icon: '🏛️', action: () => navigate('/entidades') },
                    { label: 'Gerenciar Usuários', icon: '👤', action: () => navigate('/usuarios') },
                    { label: 'Ver Memorandos',  icon: '📄', action: () => navigate('/memorandos') },
                  ].map(a => (
                    <button key={a.label} onClick={a.action}
                      className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer transition-colors">
                      <span className="text-xl">{a.icon}</span>
                      <span className="font-semibold text-xs text-slate-300">{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Memorandos recentes */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h2 className="text-sm font-bold text-white mb-4">📋 Últimos Memorandos</h2>
                {loading ? (
                  <p className="text-xs text-slate-500">Carregando...</p>
                ) : recentMemos.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum memorando encontrado.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentMemos.map(m => (
                      <button key={m.id} onClick={() => navigate(`/memorandos/${m.id}`)}
                        className="flex items-center gap-3 text-left hover:bg-slate-800/60 rounded-lg px-3 py-2.5 transition-colors cursor-pointer">
                        <span className="text-slate-500 text-xs font-mono w-36 flex-shrink-0 truncate">{m.protocol || '—'}</span>
                        <span className="text-sm text-slate-300 flex-1 truncate">{m.subject}</span>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{m.sender?.department?.acronym || m.sender?.secretary?.acronym || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SECRETARIAS ── */}
          {activeTab === 'depts' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Secretarias cadastradas</h2>
                <button onClick={() => navigate('/entidades')}
                  className="bg-blue-700 hover:bg-blue-600 rounded-lg px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-colors">
                  Gerenciar Entidades
                </button>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-left">
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Sigla</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Nome</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Departamentos</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Servidores</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide text-center">Template</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">Carregando...</td></tr>
                    ) : secretaries.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">Nenhuma secretaria cadastrada.</td></tr>
                    ) : secretaries.map(s => (
                      <tr key={s.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-blue-400 bg-blue-950/50 border border-blue-900 rounded px-1.5 py-0.5">{s.acronym}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">{s.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-400 text-center">{s.departments?.length || 0}</td>
                        <td className="px-4 py-3 text-sm text-slate-400 text-center">{s.users?.length || 0}</td>
                        <td className="px-4 py-3 text-center">
                          {s.watermarkUrl
                            ? <span className="text-xs text-amber-400">🖼 Sim</span>
                            : <span className="text-xs text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
