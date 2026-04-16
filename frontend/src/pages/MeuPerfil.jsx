import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { userService } from '../services/api'
import Sidebar from '../components/Sidebar'

export default function MeuPerfil() {
  const { user, login } = useAuth()

  const [editing,    setEditing]    = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [saveError,  setSaveError]  = useState('')
  const [saving,     setSaving]     = useState(false)

  const [form, setForm] = useState({
    name:       user?.name       || '',
    email:      user?.email      || '',
    position:   user?.position   || '',
  })

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [showPw,    setShowPw]    = useState({ current: false, next: false, confirm: false })
  const [pwError,   setPwError]   = useState('')
  const [pwSaved,   setPwSaved]   = useState(false)
  const [pwSaving,  setPwSaving]  = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setSaveError('')
    setSaving(true)
    try {
      const res = await userService.updateMyProfile(form)
      // Atualiza o contexto local com os dados novos
      login(localStorage.getItem('tramitadoc_token'), { ...user, ...res.data })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setSaveError(e.response?.data?.error || 'Erro ao salvar dados.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordSave() {
    setPwError('')
    if (!passwords.current) return setPwError('Informe a senha atual.')
    if (passwords.next.length < 6) return setPwError('A nova senha deve ter no mínimo 6 caracteres.')
    if (passwords.next !== passwords.confirm) return setPwError('As senhas não coincidem.')
    setPwSaving(true)
    try {
      await userService.changePassword({ currentPassword: passwords.current, newPassword: passwords.next })
      setPasswords({ current: '', next: '', confirm: '' })
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 3000)
    } catch (e) {
      setPwError(e.response?.data?.error || 'Erro ao alterar senha.')
    } finally {
      setPwSaving(false)
    }
  }

  const ROLE_BADGE = {
    SUPER_ADMIN: { label: 'Super Admin', cls: 'bg-violet-900 text-violet-300 border-violet-700' },
    ADM:         { label: 'Administrador', cls: 'bg-blue-900 text-blue-300 border-blue-700' },
    USER:        { label: 'Servidor', cls: 'bg-slate-700 text-slate-300 border-slate-600' },
  }
  const badge = ROLE_BADGE[user?.role] || ROLE_BADGE.USER

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base">👤</div>
          <div>
            <h1 className="text-base font-bold text-white">Meu Perfil</h1>
            <p className="text-xs text-slate-500">Visualize e edite seus dados cadastrais</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-5">

            {/* Avatar + nome */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-800 border-2 border-blue-700 flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
                {user?.name?.[0] || 'U'}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{user?.name}</p>
                <p className="text-sm text-slate-400">{user?.position}</p>
                <p className="text-xs text-slate-600 mt-0.5">{user?.department?.name}</p>
              </div>
            </div>

            {/* Dados pessoais */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">📋 Dados Pessoais</h2>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                  >
                    ✏️ Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-colors font-bold disabled:opacity-50"
                    >
                      {saving ? '⏳ Salvando...' : '💾 Salvar'}
                    </button>
                  </div>
                )}
              </div>

              {saved && (
                <div className="mb-4 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs rounded-lg px-3 py-2">
                  ✅ Dados salvos com sucesso!
                </div>
              )}
              {saveError && (
                <div className="mb-4 bg-red-950 border border-red-800 text-red-400 text-xs rounded-lg px-3 py-2">
                  ⚠️ {saveError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Campos editáveis */}
                {[
                  { label: 'Nome completo',  name: 'name',     span: true },
                  { label: 'E-mail',         name: 'email',    span: true },
                  { label: 'Cargo / Função', name: 'position', span: false },
                ].map(field => (
                  <div key={field.name} className={field.span ? 'col-span-2' : ''}>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      {field.label}
                    </label>
                    {editing ? (
                      <input
                        name={field.name}
                        value={form[field.name]}
                        onChange={handleChange}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-600 transition-colors"
                      />
                    ) : (
                      <p className="text-sm text-slate-300 bg-slate-800/50 border border-slate-800 rounded-lg px-3 py-2">
                        {form[field.name] || <span className="text-slate-600 italic">Não informado</span>}
                      </p>
                    )}
                  </div>
                ))}
                {/* Campos somente-leitura */}
                {[
                  { label: user?.registrationLabel || 'Matrícula', value: user?.registration },
                  { label: 'Departamento', value: user?.department?.name || user?.secretary?.name },
                ].map(field => (
                  <div key={field.label}>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      {field.label}
                    </label>
                    <p className="text-sm text-slate-400 bg-slate-800/30 border border-slate-800 rounded-lg px-3 py-2">
                      {field.value || <span className="text-slate-600 italic">Não informado</span>}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alterar senha */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-bold text-white mb-4">🔑 Alterar Senha</h2>

              {pwError && (
                <div className="mb-4 bg-red-950 border border-red-800 text-red-400 text-xs rounded-lg px-3 py-2">
                  ⚠️ {pwError}
                </div>
              )}
              {pwSaved && (
                <div className="mb-4 bg-emerald-950 border border-emerald-800 text-emerald-400 text-xs rounded-lg px-3 py-2">
                  ✅ Senha alterada com sucesso!
                </div>
              )}

              <div className="flex flex-col gap-3">
                {[
                  { label: 'Senha atual',          key: 'current' },
                  { label: 'Nova senha',            key: 'next' },
                  { label: 'Confirmar nova senha',  key: 'confirm' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                      {f.label}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw[f.key] ? 'text' : 'password'}
                        value={passwords[f.key]}
                        onChange={e => setPasswords(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pr-9 text-sm text-white focus:outline-none focus:border-blue-600 transition-colors"
                        placeholder="••••••••"
                      />
                      <button type="button"
                        onClick={() => setShowPw(s => ({ ...s, [f.key]: !s[f.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors text-sm leading-none">
                        {showPw[f.key] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={handlePasswordSave}
                  disabled={pwSaving}
                  className="mt-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors w-fit disabled:opacity-50"
                >
                  {pwSaving ? '⏳ Alterando...' : '🔒 Alterar senha'}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}