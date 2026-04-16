import Sidebar from '../components/Sidebar'
import { useNavigate } from 'react-router-dom'

export default function Departamentos() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-900 border border-blue-700 flex items-center justify-center text-base">
            🏛️
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Departamentos</h1>
            <p className="text-xs text-slate-500">Cadastro e gerenciamento de departamentos</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <span className="text-5xl">🏛️</span>
          <p className="text-slate-400 text-sm font-semibold">Módulo em desenvolvimento</p>
          <p className="text-slate-600 text-xs">Disponível na próxima fase do projeto</p>
          <button
            onClick={() => navigate('/super-admin')}
            className="mt-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 py-2 text-xs text-slate-300 cursor-pointer transition-colors"
          >
            ← Voltar ao Painel
          </button>
        </div>

      </div>
    </div>
  )
}