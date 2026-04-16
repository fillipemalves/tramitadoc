import { useState, useEffect, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import { secretaryService, deptService } from '../services/api'
import { useAuth } from '../context/AuthContext'

const EMPTY_SEC  = { name: '', acronym: '', secretaryName: '' }
const EMPTY_DEPT = { name: '', acronym: '' }


export default function Entidades() {
  const { user: rawUser } = useAuth()
  const isSuperAdmin  = rawUser?.role === 'SUPER_ADMIN'
  const isAdm         = rawUser?.role === 'ADM'
  const canEditDept   = isSuperAdmin || isAdm  // pode criar/editar departamentos
  const mySecretaryId = rawUser?.secretaryId || rawUser?.department?.secretaryId || null

  const [secretaries,  setSecretaries]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [currentSecId, setCurrentSecId] = useState(null)

  const [secModal,   setSecModal]   = useState(false)
  const [secForm,    setSecForm]    = useState(EMPTY_SEC)
  const [secEditing, setSecEditing] = useState(null)
  const [secLoading, setSecLoading] = useState(false)
  const [secError,   setSecError]   = useState('')

  const [watermarkFile,    setWatermarkFile]    = useState(null)
  const [watermarkPreview, setWatermarkPreview] = useState(null)
  const [watermarkRemoved, setWatermarkRemoved] = useState(false)
  const fileRef = useRef()

  const [deptModal,          setDeptModal]          = useState(false)
  const [deptForm,           setDeptForm]           = useState(EMPTY_DEPT)
  const [deptEditing,        setDeptEditing]        = useState(null)
  const [deptLoading,        setDeptLoading]        = useState(false)
  const [deptError,          setDeptError]          = useState('')
  const [deptWatermarkFile,    setDeptWatermarkFile]    = useState(null)
  const [deptWatermarkPreview, setDeptWatermarkPreview] = useState(null)
  const [deptWatermarkRemoved, setDeptWatermarkRemoved] = useState(false)
  const deptFileRef = useRef()

  const [usersModal,    setUsersModal]    = useState(null)
  const [deleteModal,   setDeleteModal]   = useState(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const currentSec = currentSecId ? secretaries.find(s => s.id === currentSecId) : null

  const load = async () => {
    setLoading(true)
    try {
      const r = await secretaryService.list({ scope: 'manage' })
      const data = r.data
      setSecretaries(data)
      // ADM/USER: navegar direto para a própria secretaria
      if (!isSuperAdmin && mySecretaryId) {
        setCurrentSecId(mySecretaryId)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  // ── Secretaria ──────────────────────────────────────────────────
  const openNewSec = () => {
    setSecForm(EMPTY_SEC); setSecEditing(null)
    setWatermarkFile(null); setWatermarkPreview(null); setWatermarkRemoved(false)
    setSecError(''); setSecModal(true)
  }

  const openEditSec = (e, sec) => {
    e?.stopPropagation()
    setSecForm({ name: sec.name, acronym: sec.acronym, secretaryName: sec.secretaryName || '' })
    setSecEditing(sec)
    setWatermarkFile(null); setWatermarkRemoved(false)
    setWatermarkPreview(sec.watermarkUrl ? `/api${sec.watermarkUrl}` : null)
    setSecError(''); setSecModal(true)
  }

  const handleWatermark = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setWatermarkFile(file)
    setWatermarkPreview(URL.createObjectURL(file))
    setWatermarkRemoved(false)
  }

  const saveSec = async () => {
    if (!secForm.name || !secForm.acronym) return setSecError('Nome e sigla são obrigatórios.')
    setSecLoading(true); setSecError('')
    try {
      let saved
      if (secEditing) {
        saved = (await secretaryService.update(secEditing.id, secForm)).data
      } else {
        saved = (await secretaryService.create(secForm)).data
      }
      if (watermarkFile) {
        await secretaryService.uploadWatermark(saved.id, watermarkFile)
      } else if (watermarkRemoved && secEditing) {
        await secretaryService.removeWatermark(secEditing.id)
      }
      setSecModal(false); load()
    } catch (e) { setSecError(e.response?.data?.error || 'Erro ao salvar.') }
    setSecLoading(false)
  }

  const confirmDelete = async () => {
    if (!deleteModal) return
    setDeleteLoading(true); setDeleteError('')
    try {
      if (deleteModal.type === 'sec') {
        await secretaryService.delete(deleteModal.item.id)
        setCurrentSecId(null)
      } else {
        await deptService.delete(deleteModal.item.id)
      }
      setDeleteModal(null); load()
    } catch (e) { setDeleteError(e.response?.data?.error || 'Erro ao excluir.') }
    setDeleteLoading(false)
  }

  // ── Departamento ─────────────────────────────────────────────────
  const openNewDept = () => {
    setDeptForm(EMPTY_DEPT); setDeptEditing(null)
    setDeptWatermarkFile(null); setDeptWatermarkPreview(null); setDeptWatermarkRemoved(false)
    setDeptError(''); setDeptModal(true)
  }

  const openEditDept = (e, dept) => {
    e?.stopPropagation()
    setDeptForm({ name: dept.name, acronym: dept.acronym })
    setDeptEditing(dept)
    setDeptWatermarkFile(null); setDeptWatermarkRemoved(false)
    setDeptWatermarkPreview(dept.watermarkUrl ? `/api${dept.watermarkUrl}` : null)
    setDeptError(''); setDeptModal(true)
  }

  const handleDeptWatermark = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setDeptWatermarkFile(file)
    setDeptWatermarkPreview(URL.createObjectURL(file))
    setDeptWatermarkRemoved(false)
  }

  const saveDept = async () => {
    if (!deptForm.name || !deptForm.acronym) return setDeptError('Nome e sigla são obrigatórios.')
    setDeptLoading(true); setDeptError('')
    try {
      let saved
      if (deptEditing) {
        saved = (await deptService.update(deptEditing.id, { ...deptForm, secretaryId: currentSecId })).data
      } else {
        saved = (await deptService.create({ ...deptForm, secretaryId: currentSecId })).data
      }
      if (deptWatermarkFile) {
        await deptService.uploadWatermark(saved.id, deptWatermarkFile)
      } else if (deptWatermarkRemoved && deptEditing) {
        await deptService.removeWatermark(deptEditing.id)
      }
      setDeptModal(false); load()
    } catch (e) { setDeptError(e.response?.data?.error || 'Erro ao salvar.') }
    setDeptLoading(false)
  }

  // ── Layout helpers ───────────────────────────────────────────────
  const isInsideSec = Boolean(currentSec)
  const headerTitle = isInsideSec ? currentSec.name : 'Entidades'
  const headerSub   = isInsideSec
    ? `${currentSec.departments?.length || 0} departamento(s) · ${currentSec.acronym}`
    : 'Secretarias e departamentos da prefeitura'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Botão voltar: apenas SUPER_ADMIN pode voltar para a lista */}
            {isInsideSec && isSuperAdmin && (
              <button onClick={() => setCurrentSecId(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors mr-1">
                ←
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-blue-900 border border-blue-700 flex items-center justify-center text-base">
              {isInsideSec ? '🏢' : '🏛️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isInsideSec && isSuperAdmin && (
                  <button onClick={() => setCurrentSecId(null)}
                    className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">
                    Entidades
                  </button>
                )}
                {isInsideSec && isSuperAdmin && <span className="text-slate-600 text-xs">›</span>}
                <h1 className="text-base font-bold text-white">{headerTitle}</h1>
              </div>
              <p className="text-xs text-slate-500">{headerSub}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Editar secretaria: apenas SUPER_ADMIN */}
            {isInsideSec && isSuperAdmin && (
              <button onClick={e => openEditSec(e, currentSec)}
                className="px-3 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg cursor-pointer transition-colors">
                ✏️ Editar Secretaria
              </button>
            )}
            {/* Excluir secretaria: apenas SUPER_ADMIN */}
            {isInsideSec && isSuperAdmin && (
              <button onClick={() => { setDeleteError(''); setDeleteModal({ type: 'sec', item: currentSec }) }}
                className="px-3 py-2 text-sm text-red-500 hover:text-red-400 border border-red-900/50 hover:border-red-700 rounded-lg cursor-pointer transition-colors">
                🗑 Excluir
              </button>
            )}
            {/* Nova secretaria: apenas SUPER_ADMIN na lista */}
            {!isInsideSec && isSuperAdmin && (
              <button onClick={openNewSec}
                className="bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg px-4 py-2 text-sm font-bold text-white cursor-pointer transition-colors">
                + Nova Secretaria
              </button>
            )}
            {/* Novo departamento: ADM ou SUPER_ADMIN dentro de secretaria */}
            {isInsideSec && canEditDept && (
              <button onClick={openNewDept}
                className="bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg px-4 py-2 text-sm font-bold text-white cursor-pointer transition-colors">
                + Novo Departamento
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm">Carregando...</div>

          ) : !isInsideSec ? (
            // ── Lista de secretarias (somente SUPER_ADMIN chega aqui) ──
            secretaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-60 gap-3">
                <span className="text-5xl">🏛️</span>
                <p className="text-slate-400 text-sm font-semibold">Nenhuma secretaria cadastrada</p>
                <p className="text-slate-600 text-xs">Clique em "Nova Secretaria" para começar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {secretaries.map(sec => (
                  <div key={sec.id} onClick={() => setCurrentSecId(sec.id)}
                    className="relative bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-5 cursor-pointer transition-all hover:bg-slate-800/60 group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="px-3 py-1.5 rounded-xl bg-blue-950 border border-blue-800 flex items-center justify-center text-xs font-black text-blue-400 min-w-[80px]">
                        {sec.acronym}
                      </div>
                      {isSuperAdmin && (
                        <div className="flex items-center gap-1">
                          <button onClick={e => openEditSec(e, sec)}
                            className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1 cursor-pointer transition-all">
                            ✏️
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeleteError(''); setDeleteModal({ type: 'sec', item: sec }) }}
                            className="text-xs text-red-500 hover:text-red-400 border border-red-900/50 hover:border-red-700 rounded-lg px-2.5 py-1 cursor-pointer transition-all">
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-bold text-white leading-tight mb-1">{sec.name}</p>
                    {sec.secretaryName && (
                      <p className="text-xs text-slate-400 mb-3">👤 {sec.secretaryName}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                      <span className="text-xs text-slate-500">{sec.departments?.length || 0} dpto(s)</span>
                      <span className="text-xs text-slate-500">{sec.users?.length || 0} servidor(es)</span>
                      {sec.watermarkUrl && <span className="text-xs text-slate-500">Template</span>}
                      <span className="ml-auto text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">Abrir →</span>
                    </div>
                  </div>
                ))}
              </div>
            )

          ) : (
            // ── Vista interna da secretaria ──────────────────────────
            <div className="flex flex-col gap-8">

              {/* Servidores diretos da secretaria */}
              {currentSec.users?.length > 0 && (
                <div>
                  <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span>👤 Servidores da Secretaria</span>
                    <span className="bg-slate-800 text-slate-400 border border-slate-700 rounded-full px-2 py-0.5 text-[10px]">
                      {currentSec.users.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {currentSec.users.map(u => (
                      <div key={u.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-900 border border-blue-800 flex items-center justify-center text-sm font-bold text-blue-300 flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-200 truncate">{u.name}</p>
                          {u.position && <p className="text-xs text-slate-500 truncate">{u.position}</p>}
                          <p className="text-xs text-slate-600 font-mono">{u.registration}</p>
                        </div>
                        {!u.isActive && (
                          <span className="text-[10px] text-red-400 border border-red-900 bg-red-950 px-2 py-0.5 rounded-full flex-shrink-0">Inativo</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Departamentos */}
              <div>
                {currentSec.departments?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-60 gap-3">
                    <span className="text-4xl">🏢</span>
                    <p className="text-slate-400 text-sm font-semibold">Nenhum departamento cadastrado</p>
                    {canEditDept && <p className="text-slate-600 text-xs">Clique em "Novo Departamento" para começar</p>}
                  </div>
                ) : (
                  <>
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span>🏢 Departamentos</span>
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 rounded-full px-2 py-0.5 text-[10px]">
                        {currentSec.departments.length}
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {currentSec.departments.map(dept => (
                        <div key={dept.id}
                          onClick={() => setUsersModal(dept)}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-5 cursor-pointer transition-all hover:bg-slate-800/40 group">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-xs font-black text-slate-300 bg-slate-700 px-2.5 py-1 rounded-lg">
                              {dept.acronym}
                            </span>
                            <div className="flex items-center gap-1">
                              {canEditDept && (
                                <button onClick={e => openEditDept(e, dept)}
                                  className="text-xs text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 rounded-lg px-2 py-1 cursor-pointer transition-all">
                                  ✏️
                                </button>
                              )}
                              {isSuperAdmin && (
                                <button onClick={e => { e.stopPropagation(); setDeleteError(''); setDeleteModal({ type: 'dept', item: dept }) }}
                                  className="text-xs text-red-500 hover:text-red-400 border border-red-900/50 hover:border-red-700 rounded-lg px-2 py-1 cursor-pointer transition-all">
                                  🗑
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-bold text-white leading-tight mb-1">{dept.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">{dept.users?.length || 0} servidor(es)</p>
                            {dept.watermarkUrl && <span className="text-[10px] text-amber-400 border border-amber-900/50 bg-amber-950/30 px-1.5 py-0.5 rounded">🖼 Template</span>}
                          </div>
                          {!dept.isActive && (
                            <span className="mt-2 inline-block text-[10px] text-red-400 border border-red-900 bg-red-950 px-2 py-0.5 rounded-full">Inativo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Servidores do Departamento */}
      {usersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">{usersModal.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{usersModal.users?.length || 0} servidor(es) atribuído(s)</p>
              </div>
              <span className="text-xs font-black text-slate-300 bg-slate-700 px-2.5 py-1 rounded-lg">{usersModal.acronym}</span>
            </div>
            <div className="px-6 py-4 max-h-80 overflow-y-auto">
              {usersModal.users?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <p className="text-sm text-slate-500">Nenhum servidor atribuído.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {usersModal.users.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-900 border border-blue-800 flex items-center justify-center text-xs font-bold text-blue-300 flex-shrink-0">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">{u.name}</p>
                          {u.position && <p className="text-xs text-slate-500">{u.position}</p>}
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">{u.registration}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-800">
              <button onClick={() => setUsersModal(null)}
                className="w-full py-2.5 text-sm font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Secretaria */}
      {secModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{secEditing ? 'Editar Secretaria' : 'Nova Secretaria'}</h2>
              <button onClick={() => setSecModal(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome completo *</label>
                <input value={secForm.name} onChange={e => setSecForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Secretaria Municipal de Governo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-500 transition-colors placeholder-slate-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sigla *</label>
                <input value={secForm.acronym} onChange={e => setSecForm(f => ({ ...f, acronym: e.target.value.toUpperCase() }))}
                  placeholder="Ex: SEGOV"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-500 transition-colors placeholder-slate-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome do(a) Secretário(a)</label>
                <input value={secForm.secretaryName} onChange={e => setSecForm(f => ({ ...f, secretaryName: e.target.value }))}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-500 transition-colors placeholder-slate-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Marca d'água — Template A4 (PNG)</label>
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-700 rounded-xl p-4 cursor-pointer transition-colors flex flex-col items-center gap-2">
                  {watermarkPreview ? (
                    <img src={watermarkPreview} alt="Preview" className="max-h-32 object-contain rounded" />
                  ) : (
                    <>
                      <span className="text-2xl">🖼️</span>
                      <p className="text-xs text-slate-500">Clique para selecionar um PNG</p>
                      <p className="text-[10px] text-slate-600">Recomendado: A4 transparente (2480 × 3508 px)</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleWatermark} className="hidden" />
                {watermarkPreview && (
                  <button onClick={() => { setWatermarkFile(null); setWatermarkPreview(null); setWatermarkRemoved(true) }}
                    className="mt-1 text-xs text-red-400 hover:text-red-300 cursor-pointer">
                    Remover imagem
                  </button>
                )}
              </div>
              {secError && <p className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{secError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setSecModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg cursor-pointer transition-colors">Cancelar</button>
              <button onClick={saveSec} disabled={secLoading} className="px-4 py-2 text-sm font-bold text-white bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                {secLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Departamento */}
      {deptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{deptEditing ? 'Editar Departamento' : 'Novo Departamento'}</h2>
              <button onClick={() => setDeptModal(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Nome completo *</label>
                <input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Departamento de Licitações"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-500 transition-colors placeholder-slate-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Sigla *</label>
                <input value={deptForm.acronym} onChange={e => setDeptForm(f => ({ ...f, acronym: e.target.value.toUpperCase() }))}
                  placeholder="Ex: DELIC"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-slate-500 transition-colors placeholder-slate-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Marca d'água própria — Template A4 (opcional)
                </label>
                <div onClick={() => deptFileRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-700 rounded-xl p-4 cursor-pointer transition-colors flex flex-col items-center gap-2">
                  {deptWatermarkPreview ? (
                    <img src={deptWatermarkPreview} alt="Preview" className="max-h-28 object-contain rounded" />
                  ) : (
                    <>
                      <span className="text-2xl">🖼️</span>
                      <p className="text-xs text-slate-500">Clique para selecionar um PNG</p>
                      <p className="text-[10px] text-slate-600">Sobrepõe a marca d'água da secretaria</p>
                    </>
                  )}
                </div>
                <input ref={deptFileRef} type="file" accept="image/png,image/jpeg" onChange={handleDeptWatermark} className="hidden" />
                {deptWatermarkPreview && (
                  <button onClick={() => { setDeptWatermarkFile(null); setDeptWatermarkPreview(null); setDeptWatermarkRemoved(true) }}
                    className="mt-1 text-xs text-red-400 hover:text-red-300 cursor-pointer">
                    Remover imagem
                  </button>
                )}
              </div>
              {deptError && <p className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{deptError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setDeptModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg cursor-pointer transition-colors">Cancelar</button>
              <button onClick={saveDept} disabled={deptLoading} className="px-4 py-2 text-sm font-bold text-white bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg cursor-pointer transition-colors disabled:opacity-50">
                {deptLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação Exclusão */}
      {deleteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-900/60 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-950 border border-red-800 flex items-center justify-center text-xl flex-shrink-0">🗑</div>
                <div>
                  <h2 className="text-sm font-bold text-white">Confirmar exclusão</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-300 mb-3">
                Deseja excluir {deleteModal.type === 'sec' ? 'a secretaria' : 'o departamento'}{' '}
                <strong className="text-white">"{deleteModal.item.name}"</strong>?
              </p>
              {deleteModal.type === 'sec' && (
                <p className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/50 rounded-lg px-3 py-2">
                  ⚠️ A secretaria só pode ser excluída se não houver departamentos ou usuários vinculados.
                </p>
              )}
              {deleteError && (
                <p className="mt-3 text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{deleteError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg cursor-pointer transition-colors">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleteLoading}
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
