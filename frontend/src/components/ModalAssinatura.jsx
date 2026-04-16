import { useState } from 'react'

export default function ModalAssinatura({ memo, onClose, onConfirm }) {
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleSubmit = async () => {
    if (!password) { setError('Informe sua senha para assinar.'); return }
    setLoading(true); setError('')
    try {
      await onConfirm({ password })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Senha incorreta ou erro ao assinar.')
    } finally {
      setLoading(false)
    }
  }

  const destinos = memo?.recipients
    ?.map(r => r.department?.acronym || r.secretary?.acronym || r.name || r.acronym)
    .filter(Boolean).join(', ') || '—'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[480px] max-w-[95vw] overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-blue-700 px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white">✍️ Assinar e Enviar Memorando</h2>
            <p className="text-xs text-blue-200 mt-0.5">Assinatura eletrônica com validação por senha — Lei nº 14.063/2020</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none cursor-pointer">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Resumo do documento */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Documento a assinar</p>
            <div className="flex gap-2 text-xs text-slate-300">
              <span className="text-slate-500 w-16 flex-shrink-0">Assunto:</span>
              <span className="font-semibold">{memo?.subject || '—'}</span>
            </div>
            <div className="flex gap-2 text-xs text-slate-300">
              <span className="text-slate-500 w-16 flex-shrink-0">Para:</span>
              <span>{destinos}</span>
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Confirme sua identidade — senha de acesso *
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                autoFocus
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••••"
                className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 rounded-lg px-3.5 py-2.5 pr-10 text-sm text-gray-100 outline-none transition-colors"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors text-base leading-none">
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
          </div>

          {/* Aviso legal */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-slate-500 leading-relaxed">
            Ao confirmar, você declara ciência do conteúdo e autoriza a emissão do memorando com sua assinatura digital registrada.
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl py-3 text-slate-300 text-sm font-medium cursor-pointer transition-colors">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={loading || !password}
              className="flex-[2] bg-blue-700 hover:bg-blue-600 border border-blue-600 rounded-xl py-3 text-white text-sm font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '⏳ Assinando...' : '✅ Assinar e Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
