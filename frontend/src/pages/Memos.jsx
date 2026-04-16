import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import { memoService, deptService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'

const PRIO_LABEL = { NORMAL: '⚪ Normal', URGENT: '🔴 Urgente', CONFIDENTIAL: '🟣 Conf.' }

export default function Memos() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const canCreate = user?.role === 'ADM' || user?.role === 'SUPER_ADMIN'

  const [memos,      setMemos]      = useState([])
  const [search,     setSearch]     = useState('')
  const [status,     setStatus]     = useState(searchParams.get('status') || '')
  const [loading,    setLoading]    = useState(true)
  const [deleting,   setDeleting]   = useState(null)
  const [deptFilter, setDeptFilter] = useState('')
  const [depts,      setDepts]      = useState([])

  // Carrega departamentos da secretaria para ADMs sem departamento
  const isSecretaryAdm = canCreate && !user?.departmentId && user?.secretaryId
  useEffect(() => {
    if (!isSecretaryAdm) return
    deptService.list({ secretaryId: user.secretaryId })
      .then(res => setDepts(res.data || []))
      .catch(() => {})
  }, [isSecretaryAdm, user?.secretaryId])

  const myDeptId = user?.departmentId
  const mySecId  = user?.secretaryId
  const myId     = user?.id
  const isSecretaryChief = canCreate && !myDeptId && Boolean(mySecId)

  // Destinatário direto do usuário atual (departamento ou secretaria)
  const getMyRecip = (m) =>
    myDeptId
      ? m.recipients?.find(r => r.departmentId === myDeptId)
      : mySecId
        ? m.recipients?.find(r => r.secretaryId === mySecId)
        : null

  // Para chefe de secretaria: todos os destinatários da secretaria (inclui departamentos)
  const getSecretaryRecips = (m) => {
    if (!mySecId) return []
    return m.recipients?.filter(r =>
      r.secretaryId === mySecId ||
      r.department?.secretaryId === mySecId
    ) || []
  }

  const applyPerspectiveFilter = (items, tab) => {
    if (tab === 'SENT') {
      if (isSecretaryChief) {
        // Chefe de secretaria: enviados por qualquer pessoa da secretaria
        return items.filter(m =>
          m.status !== 'DRAFT' && (
            m.senderId === myId ||
            m.sender?.secretaryId === mySecId ||
            m.sender?.department?.secretaryId === mySecId
          )
        )
      }
      return items.filter(m => m.senderId === myId && m.status !== 'DRAFT')
    }
    if (tab === 'RECEIVED') {
      if (isSecretaryChief) {
        // Recebidos = qualquer destinatário da secretaria já abriu
        return items.filter(m => getSecretaryRecips(m).some(r => r.status === 'RECEIVED'))
      }
      return items.filter(m => {
        const r = getMyRecip(m)
        return r && r.status === 'RECEIVED'
      })
    }
    if (tab === 'PENDING') {
      if (isSecretaryChief) {
        // Pendentes = qualquer destinatário da secretaria ainda não abriu
        return items.filter(m => getSecretaryRecips(m).some(r => r.status === 'SENT'))
      }
      return items.filter(m => {
        if (m.senderId === myId) return false
        const r = getMyRecip(m)
        return r && r.status === 'SENT'
      })
    }
    return items  // Todos / DRAFT — sem filtro extra
  }

  const loadMemos = () => {
    setLoading(true)
    // Para tabs baseadas em perspectiva, busca tudo sem filtrar por status no backend
    const perspectiveTabs = ['SENT', 'RECEIVED', 'PENDING']
    const fetchStatus = perspectiveTabs.includes(status) ? undefined : (status || undefined)

    memoService.list({ status: fetchStatus, search: search || undefined, departmentId: deptFilter || undefined })
      .then(res => {
        const items = res.data?.items || []
        setMemos(applyPerspectiveFilter(items, status))
      })
      .catch(() => setMemos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadMemos() }, [status, search, deptFilter])

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const handleDelete = async (e, memoId, subject) => {
    e.stopPropagation()
    const msg = isSuperAdmin
      ? `Excluir permanentemente "${subject}"?\n\nEsta ação remove o memorando e todo o histórico. Não pode ser desfeita.`
      : 'Excluir este rascunho? Esta ação não pode ser desfeita.'
    if (!window.confirm(msg)) return
    setDeleting(memoId)
    try {
      await memoService.deleteDraft(memoId)
      loadMemos()
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao excluir.')
    } finally {
      setDeleting(null)
    }
  }

  // ADM/SUPER_ADMIN: vê rascunhos, enviados e pendentes; USER: só recebidos
  const STATUS_TABS = canCreate
    ? [
        { label: 'Todos',      value: '' },
        { label: 'Rascunhos',  value: 'DRAFT' },
        { label: 'Enviados',   value: 'SENT' },
        { label: 'Pendentes',  value: 'PENDING' },
        { label: 'Recebidos',  value: 'RECEIVED' },
      ]
    : [
        { label: 'Todos',      value: '' },
        { label: 'Pendentes',  value: 'PENDING' },
        { label: 'Recebidos',  value: 'RECEIVED' },
      ]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Memorandos</h1>
            <p className="text-xs text-slate-500">Enviados e recebidos pelo seu departamento</p>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/memorandos/novo')}
              className="bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg px-4 py-2 text-sm font-bold text-white cursor-pointer transition-colors">
              ✏️ Novo Memorando
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* Filtros */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Buscar por assunto ou protocolo..."
              className="flex-1 min-w-[200px] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none placeholder-slate-600 focus:border-slate-600 transition-colors" />
            {isSecretaryAdm && depts.length > 0 && (
              <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-600 transition-colors cursor-pointer">
                <option value="">Todos os departamentos</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.acronym} — {d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Chips de status */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setStatus(tab.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all
                  ${status === tab.value
                    ? 'bg-blue-900 text-blue-300 border-blue-700'
                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:border-slate-600 hover:text-slate-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-950">
                  {['Protocolo','Assunto','Remetente','Destinatário(s)','Status','Prioridade','Data','Ações'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">Carregando...</td></tr>
                ) : memos.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">Nenhum memorando encontrado.</td></tr>
                ) : memos.map(m => (
                  <tr key={m.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/memorandos/${m.id}`)}>
                    <td className="px-4 py-3 text-blue-400 font-semibold text-xs">{m.protocol || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-200 max-w-[240px] truncate">{m.subject}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-300 font-medium leading-tight">{m.sender?.name || '—'}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">
                          {m.sender?.department?.acronym || m.sender?.secretary?.acronym || ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {m.recipients?.map((r, i) => (
                          <span key={i} className="inline-flex items-center bg-blue-950 text-blue-400 border border-blue-900 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                            {r.department?.acronym || r.secretary?.acronym || '—'}
                          </span>
                        ))}
                        {!m.recipients?.length && <span className="text-slate-600 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{(() => {
                      const r = getMyRecip(m)
                      return <StatusBadge
                        status={r ? r.status : m.status}
                        recipientView={Boolean(r && r.status === 'SENT' && m.senderId !== user?.id)}
                      />
                    })()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{PRIO_LABEL[m.priority] || m.priority}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {m.createdAt ? format(new Date(m.createdAt), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate(`/memorandos/${m.id}`)}
                          className="bg-blue-950 hover:bg-blue-900 border border-blue-900 text-blue-400 text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors">
                          Ver
                        </button>
                        {m.status === 'DRAFT' && canCreate && (
                          <button onClick={() => navigate(`/memorandos/${m.id}/editar`)}
                            className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-900 text-emerald-400 text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors">
                            Editar
                          </button>
                        )}
                        {(m.status === 'DRAFT' ? canCreate : isSuperAdmin) && (
                          <button onClick={e => handleDelete(e, m.id, m.subject)} disabled={deleting === m.id}
                            className="bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 text-xs px-2.5 py-1 rounded-md cursor-pointer transition-colors disabled:opacity-50">
                            {deleting === m.id ? '...' : 'Excluir'}
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
    </div>
  )
}
