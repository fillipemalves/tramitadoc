import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import { memoService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PRIO_LABEL = { NORMAL: '⚪ Normal', URGENT: '🔴 Urgente', CONFIDENTIAL: '🟣 Conf.' }

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = user?.role === 'ADM' || user?.role === 'SUPER_ADMIN'

  const [recent,  setRecent]  = useState([])
  const [kpi,     setKpi]     = useState({ drafts: 0, sent: 0, pending: 0, received: 0 })
  const [loading, setLoading] = useState(true)

  const myDeptId = user?.departmentId
  const mySecId  = user?.secretaryId
  const myId     = user?.id

  // ADM sem departamento = chefe de secretaria (visão ampla)
  const isSecretaryChief = canCreate && !myDeptId && Boolean(mySecId)

  // Destinatário direto do usuário atual (departamento ou secretaria)
  const getMyRecip = useCallback((m) =>
    myDeptId
      ? m.recipients?.find(r => r.departmentId === myDeptId)
      : mySecId
        ? m.recipients?.find(r => r.secretaryId === mySecId)
        : null
  , [myDeptId, mySecId])

  // Para chefe de secretaria: todos os destinatários da secretaria (inclui departamentos)
  const getSecretaryRecips = useCallback((m) => {
    if (!mySecId) return []
    return m.recipients?.filter(r =>
      r.secretaryId === mySecId ||
      r.department?.secretaryId === mySecId
    ) || []
  }, [mySecId])

  useEffect(() => {
    setLoading(true)
    memoService.list({})
      .then(res => {
        const items = res.data?.items || []

        const drafts = items.filter(m => m.senderId === myId && m.status === 'DRAFT').length

        let sent, pending, received

        if (isSecretaryChief) {
          // Chefe de secretaria: visão de toda a secretaria
          sent = items.filter(m =>
            m.status !== 'DRAFT' && (
              m.senderId === myId ||
              m.sender?.secretaryId === mySecId ||
              m.sender?.department?.secretaryId === mySecId
            )
          ).length
          // Pendentes = qualquer destinatário da secretaria ainda não abriu
          pending = items.filter(m =>
            getSecretaryRecips(m).some(r => r.status === 'SENT')
          ).length
          // Recebidos = qualquer destinatário da secretaria já abriu
          received = items.filter(m =>
            getSecretaryRecips(m).some(r => r.status === 'RECEIVED')
          ).length
        } else {
          // ADM com departamento ou USER: visão individual
          sent = items.filter(m => m.senderId === myId && m.status !== 'DRAFT').length
          pending = items.filter(m => {
            if (m.senderId === myId) return false
            const r = getMyRecip(m)
            return r && r.status === 'SENT'
          }).length
          received = items.filter(m => {
            if (m.senderId === myId) return false
            const r = getMyRecip(m)
            return r && r.status === 'RECEIVED'
          }).length
        }

        setKpi({ drafts, sent, pending, received })
        setRecent(items.slice(0, 6))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [myId, mySecId, isSecretaryChief, getMyRecip, getSecretaryRecips])

  const today = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })

  const kpiCards = canCreate
    ? [
        { label: '📝 Rascunhos',
          value: kpi.drafts,   color: 'text-slate-300',
          border: 'border-slate-700 bg-slate-800/60',     nav: '/memorandos?status=DRAFT'    },
        { label: isSecretaryChief ? '📤 Enviados pela Secretaria' : '📤 Enviados',
          value: kpi.sent,     color: 'text-blue-400',
          border: 'border-blue-800 bg-blue-950/40',       nav: '/memorandos?status=SENT'     },
        { label: isSecretaryChief ? '⏳ Pendentes na Secretaria' : '⏳ Aguardando Abertura',
          value: kpi.pending,  color: 'text-amber-400',
          border: 'border-amber-800 bg-amber-950/40',     nav: '/memorandos?status=PENDING'  },
        { label: isSecretaryChief ? '📥 Recebidos na Secretaria' : '📥 Recebidos',
          value: kpi.received, color: 'text-emerald-400',
          border: 'border-emerald-800 bg-emerald-950/40', nav: '/memorandos?status=RECEIVED' },
      ]
    : [
        { label: '⏳ Pendentes',  value: kpi.pending,  color: 'text-amber-400',
          border: 'border-amber-800 bg-amber-950/40',     nav: '/memorandos?status=PENDING'  },
        { label: '📥 Recebidos', value: kpi.received, color: 'text-emerald-400',
          border: 'border-emerald-800 bg-emerald-950/40', nav: '/memorandos?status=RECEIVED' },
      ]

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">Dashboard</h1>
            <p className="text-xs text-slate-500 capitalize">
              {today} · {user?.department?.name || user?.secretary?.name || ''}
            </p>
          </div>
          {canCreate && (
            <button onClick={() => navigate('/memorandos/novo')}
              className="bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg px-4 py-2 text-sm font-bold text-white cursor-pointer transition-colors">
              ✏️ Novo Memorando
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* KPIs */}
          <div className={`grid gap-3.5 mb-6 ${canCreate ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {kpiCards.map(k => (
              <div key={k.label}
                onClick={() => navigate(k.nav)}
                className={`rounded-xl border p-4 cursor-pointer hover:brightness-110 transition-all ${k.border}`}>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
                <p className={`text-3xl font-extrabold ${k.color}`}>{loading ? '—' : k.value}</p>
              </div>
            ))}
          </div>

          {/* Tabela de memorandos recentes */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">📋 Memorandos Recentes</h2>
              <button onClick={() => navigate('/memorandos')}
                className="border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-500 hover:text-slate-200 cursor-pointer transition-colors">
                Ver todos →
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-950">
                  {['Protocolo','Assunto','Remetente','Destinatário(s)','Status','Prioridade','Data',''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">Carregando...</td></tr>
                ) : recent.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">Nenhum memorando encontrado.</td></tr>
                ) : recent.map(m => (
                  <tr key={m.id} onClick={() => navigate(`/memorandos/${m.id}`)}
                    className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-blue-400 font-semibold text-xs">{m.protocol || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-200 max-w-[180px] truncate">{m.subject}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-300 font-medium leading-tight">{m.sender?.name || '—'}</span>
                        <span className="text-[10px] text-slate-500 leading-tight">
                          {m.sender?.department?.acronym || m.sender?.secretary?.acronym || ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {m.recipients?.map(r => r.department?.acronym || r.secretary?.acronym || '—').join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">{(() => {
                      const r = myDeptId
                        ? m.recipients?.find(rec => rec.departmentId === myDeptId)
                        : mySecId ? m.recipients?.find(rec => rec.secretaryId === mySecId) : null
                      return <StatusBadge
                        status={r ? r.status : m.status}
                        recipientView={Boolean(r && r.status === 'SENT' && m.senderId !== myId)}
                      />
                    })()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{PRIO_LABEL[m.priority] || m.priority}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {m.createdAt ? format(new Date(m.createdAt), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-blue-400 text-sm">→</td>
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
