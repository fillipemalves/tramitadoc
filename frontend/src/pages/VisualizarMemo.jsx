import { useState, useEffect, useCallback, useRef } from 'react'
import { useMemoPages, PAGE_H, HEADER_H, FOOTER_H, CONTENT_H, BODY_W } from '../hooks/useMemoPages'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import { memoService } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const FONT  = 'Arial, sans-serif'
const STEPS = ['Rascunho', 'Enviado', 'Recebido']
// Status legados (COMPLETED, RETURNED, IN_PROGRESS) mapeados para RECEIVED
const STEP_STATUS = { DRAFT: 0, SENT: 1, RECEIVED: 2, IN_PROGRESS: 2, RETURNED: 2, COMPLETED: 2 }

export default function VisualizarMemo() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user: rawUser } = useAuth()

  const [memo,        setMemo]       = useState(null)
  const [loading,     setLoading]    = useState(true)
  const [actionError, setActionError] = useState('')
  const didAutoReceive = useRef(false)
  const metaRef        = useRef(null)
  const bodyRef        = useRef(null)
  const pages          = useMemoPages(metaRef, bodyRef, memo?.id)

  const load = useCallback(() => {
    setLoading(true)
    memoService.getById(id)
      .then(res => setMemo(res.data))
      .catch(() => setMemo(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!memo || didAutoReceive.current) return
    if (memo.status !== 'SENT' && memo.status !== 'RECEIVED') return

    const myDeptId = rawUser?.departmentId
    // secretaryId efetivo: direto no usuário ou via departamento
    const mySecId  = rawUser?.secretaryId || rawUser?.department?.secretaryId || null

    // Encontra o destinatário deste usuário: por departamento (prioridade) ou por secretaria
    const myRecip = memo.recipients?.find(r => {
      if (myDeptId && r.departmentId === myDeptId) return true
      if (!myDeptId && mySecId && r.secretaryId === mySecId) return true
      return false
    }) ?? null

    // Só dispara se este destinatário específico ainda não recebeu
    if (!myRecip || myRecip.status !== 'SENT') return

    didAutoReceive.current = true
    memoService.receive(memo.id, myRecip.id)
      .then(() => load())
      .catch(err => {
        didAutoReceive.current = false // permite nova tentativa
        setActionError(err.response?.data?.error || 'Erro ao confirmar recebimento.')
      })
  }, [memo, rawUser, load])

  if (loading) return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm bg-slate-950">
        Carregando memorando...
      </div>
    </div>
  )

  if (!memo) return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm bg-slate-950">
        Memorando não encontrado.
      </div>
    </div>
  )

  const myDeptId    = rawUser?.departmentId
  const mySecId     = rawUser?.secretaryId
  const myRecipient = myDeptId
    ? memo.recipients?.find(r => r.departmentId === myDeptId)
    : mySecId
      ? memo.recipients?.find(r => r.secretaryId === mySecId)
      : null
  const isRecipient = Boolean(myRecipient)
  const canManage   = rawUser?.role === 'ADM' || rawUser?.role === 'SUPER_ADMIN'
  const currentStep = STEP_STATUS[memo.status] ?? 0

  const wmRelUrl = memo.sender?.department?.watermarkUrl || memo.sender?.secretary?.watermarkUrl
  const wmSrc    = wmRelUrl ? `/api${wmRelUrl}` : null

  const senderRegistrationLabel = memo.sender?.registrationLabel || 'Matrícula'
  const verifyUrl = `${window.location.origin}/verificar/${memo.signature?.verificationCode}`

  // docBody: apenas o corpo do texto (sem assinatura/remetente — ficam fixos no fundo da última página)
  const docBodyJSX = (
    <div
      className="ProseMirror"
      style={{ minHeight: 0, fontFamily: FONT, fontSize: 13, color: '#111827', lineHeight: 1.9 }}
      dangerouslySetInnerHTML={{ __html: memo.body || '' }}
    />
  )

  // Bloco fixo: QR de assinatura + nome/cargo/matrícula do remetente
  const bottomBlockJSX = (
    <>
      {memo.signature && (
        <div style={{ paddingBottom: 12, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden', fontSize: 11 }}>
            <div style={{ background: '#f9fafb', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flexShrink: 0 }}>
                <QRCodeSVG value={verifyUrl} size={52} level="M" />
              </div>
              <div style={{ fontFamily: FONT }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', marginBottom: 2 }}>
                  {memo.sender?.name}
                </div>
                <div style={{ color: '#374151', fontSize: 11, marginBottom: 2 }}>
                  Assinado em: {memo.signature.signedAt
                    ? format(new Date(memo.signature.signedAt), 'dd/MM/yyyy HH:mm:ss')
                    : '—'}
                </div>
                <div style={{ color: '#6b7280', fontSize: 10, wordBreak: 'break-all' }}>
                  Verifique em {window.location.origin}/verificar/{memo.signature.verificationCode}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>
          {memo.sender?.name}
        </p>
        <p style={{ fontFamily: FONT, fontSize: 13, color: '#374151', margin: '2px 0 0' }}>
          {memo.sender?.position}
        </p>
        <p style={{ fontFamily: FONT, fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
          {senderRegistrationLabel}: {memo.sender?.registration || '___________'}
        </p>
      </div>
    </>
  )

  // Altura reservada no fundo da última página para não sobrepor o bloco fixo
  const bottomBlockReserve = memo.signature ? 160 : 80

  const isSuperAdmin = rawUser?.role === 'SUPER_ADMIN'

  const handleDeleteDraft = async () => {
    if (!window.confirm('Excluir este rascunho? Esta ação não pode ser desfeita.')) return
    try {
      await memoService.deleteDraft(memo.id)
      navigate('/memorandos')
    } catch (e) { setActionError(e.response?.data?.error || 'Erro ao excluir.') }
  }

  const handleDeleteAny = async () => {
    if (!window.confirm(
      `Excluir permanentemente "${memo.protocol || memo.subject}"?\n\nEsta ação remove o memorando e todo o seu histórico. Não pode ser desfeita.`
    )) return
    try {
      await memoService.deleteDraft(memo.id)
      navigate('/memorandos')
    } catch (e) { setActionError(e.response?.data?.error || 'Erro ao excluir.') }
  }

  const handleDownload = async () => {
    try {
      const res = await memoService.downloadPdf(memo.id)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a'); a.href = url; a.download = `${memo.protocol}.pdf`; a.click()
    } catch { alert('PDF disponível após integração com backend.') }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center gap-3 flex-shrink-0 flex-wrap">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white text-lg cursor-pointer">←</button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{memo.protocol || 'Rascunho'}</h1>
            <p className="text-xs text-slate-500 truncate">
              {memo.subject} · {memo.createdAt ? format(new Date(memo.createdAt), 'dd/MM/yyyy') : ''}
            </p>
          </div>
          <StatusBadge
            status={myRecipient ? myRecipient.status : memo.status}
            recipientView={Boolean(myRecipient && myRecipient.status === 'SENT')}
          />

          {actionError && (
            <span className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded px-2 py-1">{actionError}</span>
          )}

          {canManage && memo.status === 'DRAFT' && (<>
            <button onClick={() => navigate(`/memorandos/${memo.id}/editar`)}
              className="bg-blue-800 hover:bg-blue-700 border border-blue-700 rounded-lg px-3.5 py-2 text-xs font-bold text-white cursor-pointer transition-colors">
              ✏️ Editar Rascunho
            </button>
            <button onClick={handleDeleteDraft}
              className="bg-red-900 hover:bg-red-800 border border-red-800 rounded-lg px-3.5 py-2 text-xs font-bold text-red-300 cursor-pointer transition-colors">
              🗑️ Excluir Rascunho
            </button>
          </>)}

          <button onClick={handleDownload}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-300 cursor-pointer transition-colors">
            📥 Baixar PDF
          </button>

          {isSuperAdmin && memo.status !== 'DRAFT' && (
            <button onClick={handleDeleteAny}
              className="bg-red-950 hover:bg-red-900 border border-red-900 rounded-lg px-3.5 py-2 text-xs font-bold text-red-400 cursor-pointer transition-colors">
              🗑️ Excluir
            </button>
          )}
        </div>

        {/* Barra de progresso */}
        <div className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center flex-shrink-0">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${i < currentStep  ? 'bg-blue-600 text-white'
                  : i === currentStep ? 'bg-blue-900 text-blue-300 ring-2 ring-blue-600'
                  : 'bg-slate-800 text-slate-500'}`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium
                  ${i === currentStep ? 'text-blue-300' : i < currentStep ? 'text-slate-300' : 'text-slate-600'}`}>
                  {step}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 ${i < currentStep ? 'bg-blue-600' : 'bg-slate-800'}`} />
              )}
            </div>
          ))}
        </div>


        {/* Painel de entrega multi-destinatário — visível apenas para o remetente */}
        {memo.senderId === rawUser?.id && memo.status !== 'DRAFT' && memo.recipients?.length > 0 && (
          <div className="bg-slate-900 border-b border-slate-800 px-6 py-2.5 flex items-center gap-3 flex-shrink-0 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex-shrink-0">Entrega:</span>
            {memo.recipients.map(r => {
              const label = r.department?.acronym || r.secretary?.acronym || '—'
              const received = r.status === 'RECEIVED' || r.status === 'COMPLETED'
              return (
                <span key={r.id} className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  received
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950 text-amber-500 border-amber-800'
                }`}>
                  {received ? '✓' : '⏳'} {label}
                </span>
              )
            })}
            {memo.recipients.some(r => r.status === 'SENT') && (
              <span className="text-[11px] text-amber-600 ml-1">
                {memo.recipients.filter(r => r.status === 'SENT').length === memo.recipients.length
                  ? 'Nenhum destinatário abriu ainda.'
                  : `${memo.recipients.filter(r => r.status === 'SENT').length} pendente(s) de abertura.`}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 overflow-hidden flex">

          {/* Papel */}
          <div className="flex-1 overflow-y-auto bg-slate-800 p-6 flex justify-center" style={{ position: 'relative' }}>

            {/* Div de medição oculto — fora da stack de páginas */}
            <div ref={bodyRef} style={{
              position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
              width: BODY_W, fontFamily: FONT, fontSize: 13, lineHeight: 1.9, color: '#111827',
              top: 0, left: -9999,
            }}>
              {docBodyJSX}
            </div>

            {/* Stack de páginas */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
              {Array.from({ length: pages.totalPages }).map((_, pi) => (
                <div key={pi}>
                  {/* Separador entre páginas */}
                  {pi > 0 && (
                    <div style={{ width: 794, flexShrink: 0 }}>
                      <div style={{ height: 4, background: 'linear-gradient(to bottom, rgba(0,0,0,0.04), rgba(0,0,0,0.22))' }} />
                      <div style={{ height: 28, background: '#334155', display: 'flex', alignItems: 'center' }}>
                        <div style={{ flex: 1, height: 1, background: '#475569', marginLeft: 16 }} />
                        <span style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, padding: '0 8px', whiteSpace: 'nowrap' }}>Página {pi + 1}</span>
                        <div style={{ flex: 1, height: 1, background: '#475569', marginRight: 16 }} />
                      </div>
                      <div style={{ height: 4, background: 'linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.02))' }} />
                    </div>
                  )}

                  {/* Página física */}
                  <div style={{
                    width: 794, height: PAGE_H,
                    position: 'relative',
                    backgroundColor: 'white',
                    overflow: 'hidden',
                    boxShadow: '0 4px 32px rgba(0,0,0,0.35)',
                    flexShrink: 0,
                  }}>
                    {/* Timbrado */}
                    {wmSrc && (
                      <img src={wmSrc} alt="" style={{
                        position: 'absolute', top: 0, left: 0,
                        width: 794, height: PAGE_H,
                        objectFit: 'fill', zIndex: 0, pointerEvents: 'none',
                      }} />
                    )}

                    {/* Camada de conteúdo */}
                    <div style={{
                      position: 'relative', zIndex: 1,
                      height: PAGE_H, display: 'flex', flexDirection: 'column',
                    }}>
                      {/* Zona cabeçalho */}
                      <div style={{ height: HEADER_H, flexShrink: 0 }} />

                      {/* Metadados — apenas página 1 */}
                      {pi === 0 && (
                        <div ref={metaRef} style={{ padding: '0 80px', backgroundColor: 'white' }}>
                          {/* Linha 1: protocolo (esquerda) + data (direita) */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                            <span style={{ fontFamily: FONT, fontSize: 13, color: '#111827' }}>
                              <strong>{memo.protocol || 'Memorando [gerado no envio]'}</strong>
                            </span>
                            <span style={{ fontFamily: FONT, fontSize: 13, color: '#111827' }}>
                              Redenção/PA, {memo.createdAt
                                ? format(new Date(memo.createdAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                                : ''}.
                            </span>
                          </div>

                          {/* Destinatários: À: (primeiro) + C/c: (demais) */}
                          <div style={{ marginBottom: 6 }}>
                            {memo.recipients?.map((r, idx) => (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', fontFamily: FONT, fontSize: 13, color: '#111827', lineHeight: 1.8 }}>
                                <strong style={{ whiteSpace: 'nowrap', minWidth: 36 }}>{idx === 0 ? 'À:' : 'C/c:'}</strong>
                                <span style={{ marginLeft: 8 }}>{r.department?.name || r.secretary?.name || '—'}</span>
                              </div>
                            ))}
                          </div>

                          {/* Assunto */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 14, borderBottom: '1px solid #d1d5db', marginBottom: 10, fontFamily: FONT, fontSize: 13, color: '#111827' }}>
                            <strong>Assunto:</strong>
                            <span style={{ marginLeft: 4 }}>{memo.subject}</span>
                          </div>
                        </div>
                      )}

                      {/* Fatia do docBody */}
                      <div style={{
                        overflow: 'hidden',
                        padding: '0 80px',
                        backgroundColor: 'white',
                        flexShrink: 0,
                        ...(pi === pages.totalPages - 1
                          ? { flex: 1 }
                          : { height: pi === 0 ? pages.page1BodyH : CONTENT_H }),
                      }}>
                        <div style={{
                          transform: `translateY(-${pages.offsets[pi]}px)`,
                          ...(pi === pages.totalPages - 1 ? { paddingBottom: bottomBlockReserve } : {}),
                        }}>
                          {docBodyJSX}
                        </div>
                      </div>

                      {/* Bloco fixo na última página: QR + nome/cargo/matrícula */}
                      {pi === pages.totalPages - 1 && (
                        <div style={{
                          position: 'absolute',
                          bottom: FOOTER_H + 16,
                          left: 80, right: 80,
                          zIndex: 2,
                          backgroundColor: 'white',
                        }}>
                          {bottomBlockJSX}
                        </div>
                      )}

                      {/* Zona rodapé */}
                      <div style={{ height: FOOTER_H, flexShrink: 0 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="w-72 min-w-[288px] bg-slate-900 border-l border-slate-800 overflow-y-auto p-5 flex-shrink-0">
            <h3 className="text-sm font-bold text-white mb-4">📋 Histórico de Tramitação</h3>

            {memo.recipients?.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 mb-5">
                <p className="text-xs font-bold text-amber-400 mb-2">⏳ Status por Destinatário</p>
                {memo.recipients.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                    <span className="text-xs text-slate-400">
                      {r.department?.acronym || r.secretary?.acronym || '—'}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {memo.events?.map((ev, i) => (
                <div key={i} className="flex gap-3 relative">
                  {i < memo.events.length - 1 && (
                    <div className="absolute left-3 top-6 bottom-[-16px] w-0.5 bg-slate-700" />
                  )}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${ev.color}`}>
                    {ev.icon}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-200">{ev.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{ev.user} — {ev.dept}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {ev.createdAt ? format(new Date(ev.createdAt), 'dd/MM/yyyy HH:mm') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}