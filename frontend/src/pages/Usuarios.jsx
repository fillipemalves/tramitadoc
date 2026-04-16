import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import { userService, secretaryService } from '../services/api'
import { useAuth } from '../context/AuthContext'

const EMPTY_FORM = { name: '', email: '', registration: '', registrationLabel: 'Matrícula', position: '', role: 'USER', departmentId: '', secretaryId: '', isActive: true }

export default function Usuarios() {
  const { user: rawUser } = useAuth()
  const isSuperAdmin = rawUser?.role === 'SUPER_ADMIN'
  const mySecretaryId = rawUser?.secretaryId || rawUser?.department?.secretaryId || null

  const [users,         setUsers]         = useState([])
  const [secretaries,   setSecretaries]   = useState([])
  const [depts,         setDepts]         = useState([])
  const [deleteTarget,  setDeleteTarget]  = useState(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [search,        setSearch]        = useState('')
  const [filterSecId,   setFilterSecId]   = useState('')
  const [filterDeptId,  setFilterDeptId]  = useState('')
  const [filterCargo,   setFilterCargo]   = useState('')
  const [modal,         setModal]         = useState(null)
  const [form,          setForm]          = useState(EMPTY_FORM)
  const [secId,         setSecId]         = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  const load = () => {
    userService.list().then(res => setUsers(res.data || [])).catch(() => {})
  }

  useEffect(() => {
    load()
    secretaryService.list({ scope: 'manage' }).then(res => {
      const secs = res.data || []
      setSecretaries(secs)
      // ADM: pré-seleciona a própria secretaria e não pode trocar
      if (!isSuperAdmin && mySecretaryId) {
        setSecId(mySecretaryId)
        const mine = secs.find(s => s.id === mySecretaryId)
        if (mine) setDepts(mine.departments || [])
      }
    }).catch(() => {})
  }, []) // eslint-disable-line

  // Filtra departamentos quando muda a secretaria selecionada
  useEffect(() => {
    if (!secId) { setDepts([]); return }
    const sec = secretaries.find(s => s.id === secId)
    setDepts(sec?.departments || [])
    setForm(f => ({ ...f, departmentId: '' }))
  }, [secId, secretaries])

  const openNew = () => {
    const initialSecId = isSuperAdmin ? '' : mySecretaryId || ''
    const initialDepts = isSuperAdmin ? [] : depts
    setForm(EMPTY_FORM); setSecId(initialSecId); setDepts(initialDepts)
    setError(''); setModal('new')
  }

  const openEdit = (u) => {
    // Descobre a secretaria do departamento do usuário
    const sec = secretaries.find(s => s.departments?.some(d => d.id === u.department?.id))
    setSecId(sec?.id || '')
    setDepts(sec?.departments || [])
    setForm({ ...u, departmentId: u.department?.id || '', registrationLabel: u.registrationLabel || 'Matrícula' })
    setError(''); setModal('edit')
  }

  const handleSave = async () => {
  if (!form.name || !form.email || !secId) return setError('Nome, e-mail e secretaria são obrigatórios.')
  setSaving(true); setError('')
  try {
    const payload = {
      ...form,
      secretaryId:  secId,
      departmentId: form.departmentId || null, // null se não selecionou
    }
    if (modal === 'new') {
      await userService.create({ ...payload, password: 'Redef@2026' })
    } else {
      await userService.update(form.id, payload)
    }
    setModal(null); load()
  } catch (e) { setError(e.response?.data?.error || 'Erro ao salvar.') }
  setSaving(false)
}

  // Departamentos disponíveis no filtro (dependem da secretaria selecionada no filtro)
  const filterDepts = filterSecId
    ? (secretaries.find(s => s.id === filterSecId)?.departments || [])
    : secretaries.flatMap(s => s.departments || [])

  // Cargos únicos da lista de usuários
  const uniqueCargos = [...new Set(users.map(u => u.position).filter(Boolean))].sort()

  const filtered = users.filter(u => {
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.includes(search)) return false
    if (filterSecId) {
      const uSecId = u.secretaryId || u.department?.secretaryId
      if (uSecId !== filterSecId) return false
    }
    if (filterDeptId && u.department?.id !== filterDeptId) return false
    if (filterCargo && u.position !== filterCargo) return false
    return true
  })

  const ROLE_BADGE = {
    SUPER_ADMIN: 'bg-violet-950 text-violet-400 border-violet-800',
    ADM:         'bg-blue-950 text-blue-400 border-blue-900',
    USER:        'bg-slate-800 text-slate-400 border-slate-700',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">👥 Usuários</h1>
            <p className="text-xs text-slate-500">Gerenciamento de servidores cadastrados</p>
          </div>
          <button onClick={openNew}
            className="bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg px-4 py-2 text-sm font-bold text-white cursor-pointer transition-colors">
            + Novo Usuário
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Barra de filtros */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Buscar por nome ou e-mail..."
              className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 outline-none w-64 placeholder-slate-600 focus:border-slate-600 transition-colors" />

            {/* Filtro Secretaria — apenas SUPER_ADMIN */}
            {isSuperAdmin && (
              <select value={filterSecId} onChange={e => { setFilterSecId(e.target.value); setFilterDeptId('') }}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer focus:border-slate-600 transition-colors">
                <option value="">Todas as secretarias</option>
                {secretaries.map(s => (
                  <option key={s.id} value={s.id}>{s.acronym} — {s.name}</option>
                ))}
              </select>
            )}

            {/* Filtro Departamento */}
            <select value={filterDeptId} onChange={e => setFilterDeptId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer focus:border-slate-600 transition-colors">
              <option value="">Todos os departamentos</option>
              {filterDepts.map(d => (
                <option key={d.id} value={d.id}>{d.acronym} — {d.name}</option>
              ))}
            </select>

            {/* Filtro Cargo */}
            <select value={filterCargo} onChange={e => setFilterCargo(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer focus:border-slate-600 transition-colors">
              <option value="">Todos os cargos</option>
              {uniqueCargos.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Limpar filtros */}
            {(search || filterSecId || filterDeptId || filterCargo) && (
              <button onClick={() => { setSearch(''); setFilterSecId(''); setFilterDeptId(''); setFilterCargo('') }}
                className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded-lg px-3 py-2.5 cursor-pointer transition-colors">
                ✕ Limpar
              </button>
            )}

            <span className="ml-auto text-xs text-slate-600">{filtered.length} resultado(s)</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-950">
                  {['Servidor','Matrícula/Portaria','Cargo','Departamento','Perfil','Status','Ações'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-900 border border-blue-800 rounded-full flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{u.registration}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{u.position}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center bg-blue-950 text-blue-400 border border-blue-900 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {u.department?.acronym}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${ROLE_BADGE[u.role] || ROLE_BADGE.USER}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border
                        ${u.isActive ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-red-950 text-red-400 border-red-800'}`}>
                        {u.isActive ? '● Ativo' : '○ Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(u)}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors">
                          Editar
                        </button>
                        {isSuperAdmin && u.role !== 'SUPER_ADMIN' && (
                          <button onClick={() => { setDeleteError(''); setDeleteTarget(u) }}
                            className="bg-red-950/60 hover:bg-red-900/60 border border-red-900 text-red-400 text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors">
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{modal === 'new' ? '+ Novo Usuário' : '✏️ Editar Usuário'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">✕</button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

              {[
                { label: 'Nome completo',       key: 'name',  type: 'text' },
                { label: 'E-mail institucional', key: 'email', type: 'email' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key] || ''}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-600 transition-colors" />
                </div>
              ))}

              {/* Matrícula / Portaria com seletor de tipo */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Número de Identificação *
                </label>
                <div className="flex gap-2 mb-2">
                  {['Matrícula', 'Portaria'].map(tipo => (
                    <button key={tipo} type="button"
                      onClick={() => setForm(p => ({ ...p, registrationLabel: tipo }))}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer transition-colors ${
                        form.registrationLabel === tipo
                          ? 'bg-blue-700 border-blue-600 text-white'
                          : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}>
                      {tipo}
                    </button>
                  ))}
                </div>
                <input type="text" value={form.registration || ''}
                  onChange={e => setForm(p => ({ ...p, registration: e.target.value }))}
                  placeholder={form.registrationLabel === 'Matrícula' ? 'Ex: 00123456' : 'Ex: 001/2024'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-600 transition-colors" />
              </div>

              {/* Cargo */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Cargo</label>
                <input type="text" value={form.position || ''}
                  onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-600 transition-colors" />
              </div>

              {/* Secretaria — ADM vê apenas a própria e não pode trocar */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Secretaria *</label>
                {isSuperAdmin ? (
                  <select value={secId} onChange={e => setSecId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer focus:border-slate-600">
                    <option value="">Selecione a secretaria...</option>
                    {secretaries.map(s => (
                      <option key={s.id} value={s.id}>{s.acronym} — {s.name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-slate-950/60 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-400">
                    {secretaries.find(s => s.id === mySecretaryId)?.name || '—'}
                  </div>
                )}
              </div>

              {/* Departamento */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
  Departamento <span className="text-slate-600 normal-case">(opcional)</span>
</label>
<select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))}
  disabled={!secId}
  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer focus:border-slate-600 disabled:opacity-40">
  <option value="">Nenhum (vinculado direto à secretaria)</option>
  {depts.map(d => (
    <option key={d.id} value={d.id}>{d.acronym} — {d.name}</option>
  ))}
</select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Perfil</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer">
                    <option value="USER">Servidor</option>
                    <option value="ADM">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select value={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'true' }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-300 outline-none cursor-pointer">
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              {modal === 'new' && (
                <p className="text-[11px] text-slate-500 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
                  🔑 Senha inicial: <strong className="text-slate-300">Redef@2026</strong> — o usuário deve alterar no primeiro acesso.
                </p>
              )}

              {error && <p className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg py-2.5 text-sm text-slate-300 cursor-pointer transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg py-2.5 text-sm font-bold text-white cursor-pointer transition-colors disabled:opacity-50">
                  {saving ? '⏳ Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-900/60 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-950 border border-red-800 flex items-center justify-center text-xl flex-shrink-0">🗑</div>
                <div>
                  <h2 className="text-sm font-bold text-white">Excluir usuário</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-1">
                Deseja excluir permanentemente <strong className="text-white">{deleteTarget.name}</strong>?
              </p>
              <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/50 rounded-lg px-3 py-2 mb-1">
                ⚠️ O usuário só pode ser excluído se não possuir memorandos enviados.
              </p>
              {deleteError && (
                <p className="mt-2 text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{deleteError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeleteError('') }}
                className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg cursor-pointer transition-colors">
                Cancelar
              </button>
              <button
                disabled={deleteLoading}
                onClick={async () => {
                  setDeleteLoading(true); setDeleteError('')
                  try {
                    await userService.delete(deleteTarget.id)
                    setDeleteTarget(null); load()
                  } catch (e) { setDeleteError(e.response?.data?.error || 'Erro ao excluir.') }
                  setDeleteLoading(false)
                }}
                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-800 hover:bg-red-700 border border-red-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                {deleteLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}