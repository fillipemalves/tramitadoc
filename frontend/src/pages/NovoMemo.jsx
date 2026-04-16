/**
 * NovoMemo.jsx — Abordagem de clipes (viewport por página)
 *
 * ARQUITETURA:
 *   • O editor TipTap vive numa div oculta (bodyRef) usada apenas para medir altura.
 *   • Cada página é um "clipe" (overflow:hidden) que mostra uma fatia do conteúdo
 *     via translateY(-offset), onde offset vem do hook useMemoPages.
 *   • Página 1: exibe o <EditorContent> real (interativo).
 *   • Páginas 2+: exibem um clone HTML (dangerouslySetInnerHTML) com cursor:text
 *     e um overlay que redireciona cliques ao editor real.
 *
 * CORREÇÕES CRÍTICAS APLICADAS:
 *   1. handleScrollToSelection: () => true — impede o ProseMirror de alterar
 *      o scrollTop do clipe overflow:hidden (o que empurraria conteúdo para cima).
 *   2. useMemoPages usa setPages(prev => ...) com comparação — evita re-renders
 *      desnecessários que alimentariam o ResizeObserver em loop.
 *   3. bodyRef usa position:fixed, top:-9999px — completamente fora da tela e
 *      do fluxo de layout, sem contribuir para o scroll height de nenhum container.
 *   4. editorHtml sincronizado imediatamente em cada keystroke — clones sempre atuais.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useMemoPages, PAGE_H, HEADER_H, FOOTER_H, CONTENT_H, BODY_W } from '../hooks/useMemoPages'
import { useNavigate, useParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit      from '@tiptap/starter-kit'
import TextAlign       from '@tiptap/extension-text-align'
import Underline       from '@tiptap/extension-underline'
import Link            from '@tiptap/extension-link'
import Placeholder     from '@tiptap/extension-placeholder'
import Sidebar         from '../components/Sidebar'
import ModalAssinatura from '../components/ModalAssinatura'
import { memoService, deptService, secretaryService } from '../services/api'
import { useAuth }     from '../context/AuthContext'
import { useDebounce } from '../hooks/useDebounce'
import { format }      from 'date-fns'
import { ptBR }        from 'date-fns/locale'

const FONT      = 'Arial, sans-serif'
const SEP_H     = 36   // altura do separador visual entre páginas

const TOOLBAR = [
  [
    { cmd: 'toggleBold',      label: 'N',  isBold: true,      title: 'Negrito (Ctrl+B)',  active: 'bold' },
    { cmd: 'toggleItalic',    label: 'I',  isItalic: true,    title: 'Itálico (Ctrl+I)',  active: 'italic' },
    { cmd: 'toggleUnderline', label: 'S',  isUnderline: true, title: 'Sublinhado',        active: 'underline' },
    { cmd: 'toggleStrike',    label: 'T',  isStrike: true,    title: 'Tachado',           active: 'strike' },
  ],
  [
    { cmd: 'setTextAlign', arg: 'left',    label: '≡L', title: 'Alinhar à esquerda' },
    { cmd: 'setTextAlign', arg: 'justify', label: '≡J', title: 'Justificado' },
    { cmd: 'setTextAlign', arg: 'center',  label: '≡C', title: 'Centralizar' },
    { cmd: 'setTextAlign', arg: 'right',   label: '≡R', title: 'Alinhar à direita' },
  ],
  [
    { cmd: 'toggleBulletList',  label: '≡•', title: 'Lista com marcadores', active: 'bulletList' },
    { cmd: 'toggleOrderedList', label: '≡1', title: 'Lista numerada',       active: 'orderedList' },
  ],
  [
    { cmd: 'undo', label: '↩', title: 'Desfazer (Ctrl+Z)' },
    { cmd: 'redo', label: '↪', title: 'Refazer (Ctrl+Y)' },
  ],
]

export default function NovoMemo() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user: rawUser } = useAuth()
  const user   = { ...rawUser, registration: rawUser?.registration || '00123456' }
  const isEdit = Boolean(id)

  const [subject,     setSubject]     = useState('')
  const [recipients,  setRecipients]  = useState([])
  const [chipInput,   setChipInput]   = useState('')
  const [priority,    setPriority]    = useState('NORMAL')
  const [deptList,    setDeptList]    = useState([])
  const [secList,     setSecList]     = useState([])
  const [autoSaved,   setAutoSaved]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showModal,   setShowModal]   = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [sentMemoId,  setSentMemoId]  = useState(null)
  const [memoId,      setMemoId]      = useState(id || null)
  const [saving,      setSaving]      = useState(false)
  const [zoom,        setZoom]        = useState(0.85)
  const [watermarkUrl, setWatermarkUrl] = useState(null)
  const [editorHtml,  setEditorHtml]  = useState('<p>Prezado(a),</p><p></p><p></p>')
  const [vcursor,     setVcursor]     = useState(null)  // {pi, top, left, height}

  const memoIdRef          = useRef(id || null)
  const signingRef         = useRef(false)
  const metaRef            = useRef(null)
  const bodyRef            = useRef(null)
  const scrollContainerRef = useRef(null)
  const pageEls            = useRef({})   // refs das divs físicas de cada página
  const clipEls            = useRef({})   // refs dos clips de conteúdo de cada página
  const pagesRef           = useRef(null) // inicializado após useMemoPages
  const zoomRef            = useRef(zoom)
  const dragRef            = useRef(null) // estado de arraste para seleção

  const pages = useMemoPages(metaRef, bodyRef)

  // Mantém refs sincronizados para uso dentro de handlers sem re-criar effects
  useEffect(() => { pagesRef.current = pages }, [pages])
  useEffect(() => { zoomRef.current  = zoom  }, [zoom])

  const today       = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
  const currentYear = new Date().getFullYear()
  const senderName    = rawUser?.department?.name    || rawUser?.secretary?.name    || ''
  const senderAcronym = rawUser?.department?.acronym || rawUser?.secretary?.acronym || 'SEM'

  // ── Editor ──────────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Prezado(a),' }),
    ],
    content: '<p>Prezado(a),</p><p></p><p></p>',
    editorProps: {
      // CRÍTICO: impede o ProseMirror de chamar scrollIntoView / alterar scrollTop.
      // Sem isso, ele modifica o scrollTop do clipe overflow:hidden, fazendo o
      // conteúdo "subir" dentro da página 1 e desaparecer visualmente.
      handleScrollToSelection: () => true,
    },
  })

  // ── Dados ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    deptService.list().then(res => {
      const depts = res.data || []
      setDeptList(depts)
      const secMap = {}
      depts.forEach(d => { if (d.secretary) secMap[d.secretary.id] = d.secretary })
      setSecList(Object.values(secMap))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    deptService.list().then(res => {
      const depts  = res.data || []
      const myDept = depts.find(d => d.id === rawUser?.departmentId)
      if (myDept?.watermarkUrl) { setWatermarkUrl(`/api${myDept.watermarkUrl}`); return }
      secretaryService.list().then(r2 => {
        const secs = r2.data || []
        const sec  = secs.find(s =>
          s.departments?.some(d => d.id === rawUser?.departmentId) ||
          s.id === rawUser?.secretaryId
        )
        if (sec?.watermarkUrl) setWatermarkUrl(`/api${sec.watermarkUrl}`)
      }).catch(() => {})
    }).catch(() => {})
  }, [rawUser?.departmentId, rawUser?.secretaryId])

  useEffect(() => {
    if (!isEdit || !editor) return
    memoService.getById(id).then(res => {
      const m = res.data
      setSubject(m.subject || '')
      setPriority(m.priority || 'NORMAL')
      const loaded = [
        ...(m.recipients?.filter(r => r.department).map(r => ({ ...r.department, _type: 'dept' })) || []),
        ...(m.recipients?.filter(r => r.secretary && !r.department).map(r => ({ ...r.secretary, _type: 'sec' })) || []),
      ]
      setRecipients(loaded)
      editor.commands.setContent(m.body || '')
    }).catch(console.error)
  }, [id, isEdit, editor])

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const saveDraft = useCallback(async () => {
    if (signingRef.current) return
    if (!subject && !editor?.getText()?.trim()) return
    setSaving(true)
    const body = editor?.getHTML() || ''
    const data = {
      subject, body, priority,
      recipientDepartmentIds: recipients.filter(r => r._type === 'dept').map(r => r.id),
      recipientSecretaryIds:  recipients.filter(r => r._type === 'sec').map(r => r.id),
    }
    try {
      if (memoIdRef.current) {
        await memoService.update(memoIdRef.current, data)
      } else {
        const res = await memoService.create(data)
        memoIdRef.current = res.data.id
        setMemoId(res.data.id)
      }
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 3000)
    } catch (e) { console.error('Autosave:', e) }
    finally { setSaving(false) }
  }, [subject, editor, priority, recipients])

  const debouncedSave = useDebounce(saveDraft, 30000)

  // Sincroniza editorHtml imediatamente para que clones das páginas 2+ sejam atuais
  useEffect(() => {
    if (!editor) return
    const onUpdate = () => setEditorHtml(editor.getHTML())
    editor.on('update', onUpdate)
    editor.on('update', debouncedSave)
    return () => {
      editor.off('update', onUpdate)
      editor.off('update', debouncedSave)
    }
  }, [editor, debouncedSave])

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  // Mantém o cursor visível no scrollContainer.
  // Para cursores na zona de overflow (além de page1BodyH), rola para a posição
  // visual na página 2+, não para a posição DOM dentro do clipe da página 1.
  const scrollToCursor = useCallback(() => {
    if (!editor || !scrollContainerRef.current) return
    requestAnimationFrame(() => {
      try {
        const container = scrollContainerRef.current
        if (!container) return
        const cRect  = container.getBoundingClientRect()
        const MARGIN = 80

        const { from } = editor.state.selection
        const editorEl   = editor.view.dom
        const editorRect = editorEl.getBoundingClientRect()
        const coords     = editor.view.coordsAtPos(from, -1)

        // Y do cursor no espaço de conteúdo do editor (px não-escalados)
        const cursorContentY = (coords.top - editorRect.top) / zoom

        if (cursorContentY > pages.page1BodyH && pages.totalPages >= 2) {
          // Cursor na zona de overflow → mostra a posição VISUAL na página 2+
          const overflowY    = cursorContentY - pages.page1BodyH
          const pi           = 1 + Math.floor(overflowY / CONTENT_H)
          const pageEl       = pageEls.current[pi]
          if (!pageEl) return
          const pageRect     = pageEl.getBoundingClientRect()
          const offsetInPage = overflowY - (pi - 1) * CONTENT_H
          const targetY      = pageRect.top + (HEADER_H + offsetInPage) * zoom
          if (targetY > cRect.bottom - MARGIN)
            container.scrollBy({ top: targetY - cRect.bottom + MARGIN })
          else if (targetY < cRect.top + MARGIN)
            container.scrollBy({ top: targetY - cRect.top - MARGIN })
        } else {
          // Cursor na página 1 → usa posição DOM direta
          const domPos = editor.view.domAtPos(from, 0)
          let node = domPos.node
          if (node.nodeType === 3) node = node.parentElement
          if (!node) return
          const rect = node.getBoundingClientRect()
          if (rect.bottom > cRect.bottom - MARGIN)
            container.scrollBy({ top: rect.bottom - cRect.bottom + MARGIN })
          else if (rect.top < cRect.top + MARGIN)
            container.scrollBy({ top: rect.top - cRect.top - MARGIN })
        }
      } catch {}
    })
  }, [editor, pages, zoom])

  useEffect(() => {
    if (!editor) return
    editor.on('selectionUpdate', scrollToCursor)
    editor.on('update', scrollToCursor)
    return () => {
      editor.off('selectionUpdate', scrollToCursor)
      editor.off('update', scrollToCursor)
    }
  }, [editor, scrollToCursor])

  // ── Cursor virtual nas páginas 2+ ────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return
    const update = () => {
      if (!editor.isFocused) { setVcursor(null); return }
      try {
        const { from } = editor.state.selection
        const editorEl   = editor.view.dom
        const editorRect = editorEl.getBoundingClientRect()
        const coords     = editor.view.coordsAtPos(from, -1)
        const z          = zoomRef.current
        const cursorY    = (coords.top  - editorRect.top)  / z
        const p1h        = pagesRef.current.page1BodyH
        if (cursorY <= p1h) { setVcursor(null); return }
        const overflowY    = cursorY - p1h
        const pi           = 1 + Math.floor(overflowY / CONTENT_H)
        const offsetInPage = overflowY - (pi - 1) * CONTENT_H
        const cursorX      = (coords.left - editorRect.left) / z
        const cursorH      = Math.max(16, (coords.bottom - coords.top) / z)
        setVcursor({ pi, top: offsetInPage, left: cursorX, height: cursorH })
      } catch { setVcursor(null) }
    }
    const onBlur = () => setVcursor(null)
    editor.on('selectionUpdate', update)
    editor.on('update',          update)
    editor.on('focus',           update)
    editor.on('blur',            onBlur)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update',          update)
      editor.off('focus',           update)
      editor.off('blur',            onBlur)
    }
  }, [editor])

  // ── Seleção por arraste nas páginas 2+ ───────────────────────────────────────
  useEffect(() => {
    if (!editor) return

    // Encontra a posição ProseMirror mais próxima via busca em duas fases:
    // Fase 1: bloco com menor distância Y; Fase 2: caractere com menor distância X no bloco
    const findPos = (contentY, contentX) => {
      const editorEl   = editor.view.dom
      const editorRect = editorEl.getBoundingClientRect()
      const z          = zoomRef.current

      // Fase 1 — bloco mais próximo por Y
      let blockPos  = editor.state.doc.content.size
      let bestYDist = Infinity
      editor.state.doc.descendants((node, pos) => {
        if (!node.isBlock) return
        try {
          const coords = editor.view.coordsAtPos(pos)
          const nodeY  = (coords.top - editorRect.top) / z
          const dist   = Math.abs(nodeY - contentY)
          if (dist < bestYDist) { bestYDist = dist; blockPos = pos }
        } catch {}
      })

      // Fase 2 — caractere mais próximo por X dentro do bloco
      if (contentX !== undefined) {
        const blockNode = editor.state.doc.nodeAt(blockPos)
        if (blockNode) {
          const blockEnd = blockPos + blockNode.nodeSize - 1
          let bestPos   = blockPos
          let bestXDist = Infinity
          for (let p = blockPos; p <= blockEnd; p++) {
            try {
              const c    = editor.view.coordsAtPos(p)
              const yOff = Math.abs((c.top  - editorRect.top)  / z - contentY)
              if (yOff > bestYDist + 20) continue  // linha diferente
              const xOff = Math.abs((c.left - editorRect.left) / z - contentX)
              if (xOff < bestXDist) { bestXDist = xOff; bestPos = p }
            } catch {}
          }
          return bestPos
        }
      }

      return blockPos
    }

    // Converte clientY numa posição de tela para Y em espaço de conteúdo do editor
    const getContentY = (clientY, pi) => {
      const clipEl = clipEls.current[pi]
      if (!clipEl) return null
      const clipRect = clipEl.getBoundingClientRect()
      const offsets  = pagesRef.current.offsets
      return (offsets[pi] || 0) + (clientY - clipRect.top) / zoomRef.current
    }

    const onMouseMove = (e) => {
      if (!dragRef.current) return
      const { startPos, pi } = dragRef.current
      const contentY = getContentY(e.clientY, pi)
      if (contentY === null) return
      const editorEl   = editor.view.dom
      const editorRect = editorEl.getBoundingClientRect()
      const contentX   = (e.clientX - editorRect.left) / zoomRef.current
      const pos  = findPos(contentY, contentX)
      const from = Math.min(startPos, pos)
      const to   = Math.max(startPos, pos)
      if (from !== to) editor.commands.setTextSelection({ from, to })
    }
    const onMouseUp = () => { dragRef.current = null }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onMouseUp)
    }
  }, [editor])

  // ── Destinatários ─────────────────────────────────────────────────────────────
  const addRecipient    = (item) => {
    if (!recipients.find(r => r.id === item.id)) setRecipients(p => [...p, item])
    setChipInput('')
  }
  const removeRecipient = (rid) => setRecipients(p => p.filter(r => r.id !== rid))

  const mySecretaryId = rawUser?.secretaryId || rawUser?.department?.secretaryId
  const searchItems   = [
    ...secList.filter(s => s.id !== mySecretaryId).map(s => ({ ...s, _type: 'sec' })),
    ...deptList.filter(d => d.acronym !== user?.department?.acronym).map(d => ({ ...d, _type: 'dept' })),
  ]
  const filteredItems = chipInput
    ? searchItems.filter(item => {
        if (recipients.find(r => r.id === item.id)) return false
        const q = chipInput.toLowerCase()
        return item.name.toLowerCase().includes(q) || item.acronym.toLowerCase().includes(q) ||
          (item._type === 'dept' && item.secretary &&
            (item.secretary.name.toLowerCase().includes(q) || item.secretary.acronym.toLowerCase().includes(q)))
      })
    : []

  // ── Assinar ───────────────────────────────────────────────────────────────────
  const handleSign = async ({ password }) => {
    signingRef.current = true
    try {
      const recipientDepartmentIds = recipients.filter(r => r._type === 'dept').map(r => r.id)
      const recipientSecretaryIds  = recipients.filter(r => r._type === 'sec').map(r => r.id)
      const body = editor?.getHTML() || ''
      let cid = memoIdRef.current
      if (!cid) {
        const res = await memoService.create({ subject, body, priority, recipientDepartmentIds, recipientSecretaryIds })
        cid = res.data.id; memoIdRef.current = cid; setMemoId(cid)
      } else {
        await memoService.update(cid, { subject, body, priority, recipientDepartmentIds, recipientSecretaryIds })
      }
      await memoService.sign(cid, { password })
      await memoService.send(cid)
      setSentMemoId(cid); setShowModal(false); setShowSuccess(true)
    } catch (err) { signingRef.current = false; throw err }
    finally { signingRef.current = false }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">

        {/* Action bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-2.5 flex items-center gap-3 flex-shrink-0 z-10">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-white text-lg cursor-pointer">←</button>
          <span className="text-sm text-slate-400">{isEdit ? 'Editar Memorando' : 'Novo Memorando'}</span>
          <div className="flex-1 flex items-center gap-2">
            {autoSaved && <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" /><span className="text-xs text-emerald-400">Rascunho salvo</span></>}
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
            <button onClick={() => setZoom(z => Math.max(0.5, parseFloat((z-0.1).toFixed(1))))} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer font-bold rounded hover:bg-slate-700 transition-colors">−</button>
            <span className="text-xs text-slate-300 w-10 text-center font-semibold select-none">{Math.round(zoom*100)}%</span>
            <button onClick={() => setZoom(z => Math.min(1.5, parseFloat((z+0.1).toFixed(1))))} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer font-bold rounded hover:bg-slate-700 transition-colors">+</button>
            <button onClick={() => setZoom(0.85)} className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer px-1 transition-colors">↺</button>
          </div>
          <label className="text-xs text-slate-400 font-semibold">Prioridade:</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-gray-300 outline-none cursor-pointer">
            <option value="NORMAL">⚪ Normal</option>
            <option value="URGENT">🔴 Urgente</option>
            <option value="CONFIDENTIAL">🟣 Confidencial</option>
          </select>
          <button onClick={saveDraft} disabled={saving} className="bg-slate-800 hover:bg-slate-700 border border-slate-800 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-300 cursor-pointer transition-colors disabled:opacity-50">
            {saving ? '⏳ Salvando...' : '💾 Salvar Rascunho'}
          </button>
          <button onClick={() => setShowConfirm(true)} className="bg-blue-700 hover:bg-blue-600 border border-blue-700 rounded-lg px-4 py-2 text-xs font-bold text-white cursor-pointer transition-colors">
            ✍️ Assinar e Enviar
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-slate-900 border-b border-slate-800 px-3 py-1.5 flex items-center gap-1 flex-shrink-0 flex-wrap">
          {TOOLBAR.map((group, gi) => (
            <div key={gi} className="flex items-center gap-0.5">
              {gi > 0 && <div className="w-px h-5 bg-slate-700 mx-1.5" />}
              {group.map(({ cmd, arg, label, title, active, isBold, isItalic, isUnderline, isStrike }) => {
                const isActive = active && editor?.isActive(active)
                const rendered = isBold ? <strong>{label}</strong> : isItalic ? <em>{label}</em> : isUnderline ? <u>{label}</u> : isStrike ? <s>{label}</s> : label
                return (
                  <button key={cmd+(arg||'')} title={title}
                    onClick={() => { if (!editor) return; const c = editor.chain().focus(); if (arg) c[cmd](arg).run(); else c[cmd]().run() }}
                    className={`flex items-center justify-center w-7 h-7 rounded text-xs border transition-all cursor-pointer ${isActive ? 'bg-blue-900 text-blue-300 border-blue-700' : 'text-gray-300 border-transparent hover:bg-slate-700 hover:text-white'}`}>
                    {rendered}
                  </button>
                )
              })}
            </div>
          ))}
          <div className="w-px h-5 bg-slate-600 mx-1.5" />
          <button
            onClick={async () => {
              if (!memoIdRef.current) { alert('Salve o rascunho primeiro.'); return }
              try {
                const res = await memoService.downloadPdf(memoIdRef.current)
                const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
                const a = document.createElement('a'); a.href = url; a.download = 'memorando.pdf'; a.click(); URL.revokeObjectURL(url)
              } catch { alert('Erro ao gerar PDF.') }
            }}
            className="flex items-center justify-center h-7 px-2 rounded text-xs text-gray-300 border border-transparent hover:bg-slate-700 hover:text-white cursor-pointer">
            📥 PDF
          </button>
        </div>

        {/* Régua */}
        <div className="bg-slate-800 flex justify-center flex-shrink-0 border-b border-slate-700" style={{ height: 20 }}>
          <div className="bg-slate-300 flex items-end" style={{ width: 794, height: 20 }}>
            {Array.from({ length: 21 }, (_, i) => (
              <div key={i} style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: '50%', width: 1, height: i%2===0 ? 10 : 5, background: '#94a3b8' }} />
                {i > 0 && i%2===0 && <span style={{ fontSize: 8, color: '#6b7280', lineHeight: 1, position: 'absolute', bottom: 11 }}>{i}</span>}
              </div>
            ))}
          </div>
        </div>

        {/*
          DIV DE MEDIÇÃO — off-screen, invisível, fora de qualquer scroll container.
          position:fixed + top:-9999px garante que está acima do viewport e não
          contribui para o scrollHeight de nenhum container pai.
          Mede APENAS o corpo do texto (sem metadados, sem bloco do remetente)
          para que useMemoPages calcule páginas corretamente.
        */}
        <div ref={bodyRef} style={{
          position: 'fixed', top: -9999, left: 0,
          width: BODY_W, fontFamily: FONT, fontSize: 14, lineHeight: 1.9,
          visibility: 'hidden', pointerEvents: 'none', zIndex: -1,
        }}>
          <div className="ProseMirror" style={{ minHeight: 0 }}
            dangerouslySetInnerHTML={{ __html: editorHtml }} />
        </div>

        {/* Área de rolagem principal */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto bg-slate-800 py-6 flex justify-center">

          {/* Stack de páginas com zoom
              marginBottom compensa o mismatch entre tamanho visual (zoom) e layout box:
              visualHeight = layoutHeight × zoom
              layoutHeight + marginBottom = visualHeight
              → marginBottom = layoutHeight × (zoom - 1) */}
          <div style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            marginBottom: (pages.totalPages * PAGE_H + Math.max(0, pages.totalPages - 1) * SEP_H) * (zoom - 1),
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>

              {Array.from({ length: pages.totalPages }).map((_, pi) => (
                <div key={pi}>

                  {/* Separador entre páginas */}
                  {pi > 0 && (
                    <div style={{ width: 794 }}>
                      <div style={{ height: 4, background: 'linear-gradient(to bottom, rgba(0,0,0,0.04), rgba(0,0,0,0.22))' }} />
                      <div style={{ height: 28, background: '#334155', display: 'flex', alignItems: 'center' }}>
                        <div style={{ flex: 1, height: 1, background: '#475569', marginLeft: 16 }} />
                        <span style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, padding: '0 8px', whiteSpace: 'nowrap' }}>
                          Página {pi + 1}
                        </span>
                        <div style={{ flex: 1, height: 1, background: '#475569', marginRight: 16 }} />
                      </div>
                      <div style={{ height: 4, background: 'linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.02))' }} />
                    </div>
                  )}

                  {/* Página física */}
                  <div
                    ref={el => { pageEls.current[pi] = el }}
                    style={{
                      width: 794, height: PAGE_H,
                      position: 'relative',
                      backgroundColor: 'white',
                      overflow: 'hidden',
                      boxShadow: '0 4px 32px rgba(0,0,0,0.35)',
                      flexShrink: 0,
                    }}
                  >
                    {/* Marca d'água / timbrado */}
                    {watermarkUrl && (
                      <img src={watermarkUrl} alt="" style={{
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
                      {/* Zona do timbrado (cabeçalho) */}
                      <div style={{ height: HEADER_H, flexShrink: 0 }} />

                      {/* Metadados — apenas página 1 */}
                      {pi === 0 && (
                        <div ref={metaRef} style={{ padding: '0 80px', backgroundColor: 'white' }}>
                          {/* Linha 1: protocolo (esquerda) + data (direita) */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                            <span style={{ fontFamily: FONT, fontSize: 13, color: '#111827' }}>
                              <strong>Memorando [gerado no envio]/{currentYear} - {senderAcronym}</strong>
                            </span>
                            <span style={{ fontFamily: FONT, fontSize: 13, color: '#111827' }}>
                              Redenção/PA, {today}.
                            </span>
                          </div>

                          {/* Destinatários: À: (primeiro) + C/c: (demais) */}
                          <div style={{ marginBottom: 6, position: 'relative' }}>
                            {recipients.map((r, idx) => (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', fontFamily: FONT, fontSize: 13, color: '#111827', lineHeight: 1.8 }}>
                                <strong style={{ whiteSpace: 'nowrap', minWidth: 36 }}>{idx === 0 ? 'À:' : 'C/c:'}</strong>
                                <span style={{ marginLeft: 8, flex: 1 }}>{r.name}</span>
                                <button onClick={() => removeRecipient(r.id)} style={{ opacity: 0.4, cursor: 'pointer', fontSize: 10, background: 'none', border: 'none', color: '#111827', marginLeft: 8, flexShrink: 0 }}>✕</button>
                              </div>
                            ))}
                            <input
                              value={chipInput}
                              onChange={e => setChipInput(e.target.value)}
                              onBlur={() => setTimeout(() => setChipInput(''), 150)}
                              placeholder={recipients.length ? 'Adicionar outro destinatário...' : 'Buscar secretaria ou departamento...'}
                              style={{ border: 'none', borderBottom: '1px dashed #d1d5db', background: 'transparent', outline: 'none', fontFamily: FONT, fontSize: 13, color: '#6b7280', width: '100%', paddingBottom: 2, marginTop: recipients.length ? 2 : 0 }}
                            />
                            {filteredItems.length > 0 && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, marginTop: 4 }}
                                className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-56 overflow-y-auto">
                                {filteredItems.map(item => (
                                  <button key={item.id} onMouseDown={e => { e.preventDefault(); addRecipient(item) }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-700 flex items-center gap-2 cursor-pointer transition-colors">
                                    <span className={`font-bold text-xs w-16 flex-shrink-0 ${item._type==='sec' ? 'text-amber-400' : 'text-blue-400'}`}>{item.acronym}</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-slate-200 text-sm truncate">{item.name}</div>
                                      {item._type==='dept' && item.secretary && <div className="text-slate-500 text-[10px] truncate">{item.secretary.acronym} — {item.secretary.name}</div>}
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${item._type==='sec' ? 'bg-amber-900 text-amber-300' : 'bg-slate-700 text-slate-400'}`}>
                                      {item._type==='sec' ? 'Secretaria' : 'Departamento'}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Assunto */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 14, borderBottom: '1px solid #d1d5db', marginBottom: 10 }}>
                            <strong style={{ fontFamily: FONT, fontSize: 13, color: '#111827', whiteSpace: 'nowrap' }}>Assunto:</strong>
                            <input value={subject} onChange={e => setSubject(e.target.value)}
                              placeholder="Informe o assunto do memorando..."
                              style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: FONT, fontSize: 13, color: '#111827', marginLeft: 4 }} />
                          </div>
                        </div>
                      )}

                      {/*
                        Clipe do corpo — overflow:hidden exibe apenas a fatia correta.
                        • Página 1 (pi=0): editor real, sem offset (conteúdo começa em y=0).
                        • Páginas 2+ (pi≥1): clone HTML com marginTop negativo.
                          marginTop: -offsets[pi] puxa o clone para cima, fazendo o clip
                          mostrar o conteúdo a partir de y=offsets[pi] — a fatia correta.
                          Usamos marginTop (layout flow) em vez de translateY (transform) para
                          garantir que overflow:hidden corte o conteúdo de forma confiável.
                      */}
                      <div
                        ref={el => { clipEls.current[pi] = el }}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          padding: '0 80px',
                          backgroundColor: 'white',
                          flexShrink: 0,
                          height: pi === 0 ? pages.page1BodyH : CONTENT_H,
                        }}
                      >
                        {pi === 0 ? (
                          /* Editor real — interativo, sem offset */
                          <EditorContent
                            editor={editor}
                            className="outline-none"
                            style={{ fontFamily: FONT, fontSize: 14, color: '#111827', lineHeight: 1.9 }}
                          />
                        ) : (
                          /* Clone — páginas 2+: marginTop negativo desloca para mostrar
                             apenas o overflow correspondente ao índice desta página. */
                          <div
                            style={{ marginTop: -(pages.offsets[pi] ?? 0), cursor: 'text' }}
                            onMouseDown={e => {
                              e.preventDefault()
                              if (!editor) return
                              const clipEl   = clipEls.current[pi]
                              const clipRect = clipEl?.getBoundingClientRect()
                              if (!clipRect) { editor.chain().focus('end', { scrollIntoView: false }).run(); return }
                              const editorEl   = editor.view.dom
                              const editorRect = editorEl.getBoundingClientRect()
                              const offset     = pages.offsets[pi] ?? 0
                              // Coordenadas em espaço de layout (divididas pelo zoom para cancelar o scale).
                              // coordsAtPos também retorna coordenadas de tela (escala aplicada), portanto
                              // dividir ambos pelo mesmo zoom mantém consistência.
                              const contentY   = offset + (e.clientY - clipRect.top) / zoom
                              const contentX   = (e.clientX - editorRect.left) / zoom

                              // Fase 1 — bloco com menor distância Y
                              let blockPos  = editor.state.doc.content.size
                              let bestYDist = Infinity
                              editor.state.doc.descendants((node, pos) => {
                                if (!node.isBlock) return
                                try {
                                  const c    = editor.view.coordsAtPos(pos)
                                  const dist = Math.abs((c.top - editorRect.top) / zoom - contentY)
                                  if (dist < bestYDist) { bestYDist = dist; blockPos = pos }
                                } catch {}
                              })

                              // Fase 2 — caractere com menor distância X dentro do bloco
                              const blockNode = editor.state.doc.nodeAt(blockPos)
                              let bestPos  = blockPos
                              if (blockNode) {
                                const blockEnd = blockPos + blockNode.nodeSize - 1
                                let bestXDist  = Infinity
                                for (let p = blockPos; p <= blockEnd; p++) {
                                  try {
                                    const c    = editor.view.coordsAtPos(p)
                                    const yOff = Math.abs((c.top  - editorRect.top)  / zoom - contentY)
                                    if (yOff > bestYDist + 20) continue  // linha diferente
                                    const xOff = Math.abs((c.left - editorRect.left) / zoom - contentX)
                                    if (xOff < bestXDist) { bestXDist = xOff; bestPos = p }
                                  } catch {}
                                }
                              }

                              if (e.shiftKey) {
                                const { from } = editor.state.selection
                                // scrollIntoView: false — impede o ProseMirror de alterar o
                                // scrollTop do clipe overflow:hidden da página 1, que empurraria
                                // o conteúdo para cima e vazaria para o clone da primeira página.
                                editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection({ from, to: bestPos }).run()
                              } else {
                                editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(bestPos).run()
                                dragRef.current = { startPos: bestPos, pi }
                              }
                            }}
                          >
                            <div
                              className="ProseMirror"
                              style={{ minHeight: 0, fontFamily: FONT, fontSize: 14, color: '#111827', lineHeight: 1.9 }}
                              dangerouslySetInnerHTML={{ __html: editorHtml }}
                            />
                          </div>
                        )}

                        {/* Cursor virtual piscante nas páginas 2+ */}
                        {vcursor?.pi === pi && (
                          <div
                            className="virtual-cursor"
                            style={{
                              position:      'absolute',
                              left:          80 + vcursor.left,
                              top:           vcursor.top,
                              width:         2,
                              height:        vcursor.height,
                              background:    '#111827',
                              zIndex:        10,
                              pointerEvents: 'none',
                            }}
                          />
                        )}
                      </div>

                      {/* Bloco do remetente — fixo no fundo da última página */}
                      {pi === pages.totalPages - 1 && (
                        <div style={{
                          position: 'absolute',
                          bottom: FOOTER_H + 16,
                          left: 80, right: 80,
                          zIndex: 2,
                          backgroundColor: 'white',
                          textAlign: 'center',
                        }}>
                          <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: '#111827', margin: 0 }}>{user?.name}</p>
                          <p style={{ fontFamily: FONT, fontSize: 13, color: '#374151', margin: '2px 0 0' }}>{user?.position}</p>
                          <p style={{ fontFamily: FONT, fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                            {rawUser?.registrationLabel || 'Matrícula'}: {user?.registration || '___________'}
                          </p>
                        </div>
                      )}

                      {/* Zona do timbrado (rodapé) */}
                      <div style={{ height: FOOTER_H, flexShrink: 0 }} />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmação */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={e => e.target === e.currentTarget && setShowConfirm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[480px] max-w-[95vw] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">📋 Confirmar Envio do Memorando</h2>
              <button onClick={() => setShowConfirm(false)} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex gap-2 text-sm"><span className="text-slate-500 w-20 flex-shrink-0">Assunto:</span><span className="text-white font-semibold">{subject||'—'}</span></div>
                <div className="flex gap-2 text-sm"><span className="text-slate-500 w-20 flex-shrink-0">De:</span><span className="text-slate-300">{senderName||'—'}</span></div>
                <div className="flex gap-2 text-sm">
                  <span className="text-slate-500 w-20 flex-shrink-0">Para:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {recipients.length === 0
                      ? <span className="text-red-400 text-xs">Nenhum destinatário selecionado</span>
                      : recipients.map(r => (
                          <span key={r.id} className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${r._type==='sec' ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-blue-950 text-blue-300 border-blue-800'}`}>
                            {r.acronym} — {r.name}
                          </span>
                        ))}
                  </div>
                </div>
                <div className="flex gap-2 text-sm">
                  <span className="text-slate-500 w-20 flex-shrink-0">Prioridade:</span>
                  <span className="text-slate-300">{priority==='NORMAL' ? '⚪ Normal' : priority==='URGENT' ? '🔴 Urgente' : '🟣 Confidencial'}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500">Após confirmar, você precisará inserir sua senha para assinar digitalmente e o memorando será enviado aos destinatários.</p>
            </div>
            <div className="px-6 pb-5 flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl py-2.5 text-sm text-slate-300 cursor-pointer transition-colors">
                Revisar
              </button>
              <button
                disabled={recipients.length === 0 || !subject}
                onClick={() => { setShowConfirm(false); setShowModal(true) }}
                className="flex-[2] bg-blue-700 hover:bg-blue-600 border border-blue-600 rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                ✍️ Prosseguir e Assinar
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ModalAssinatura memo={{ subject, recipients }} onClose={() => setShowModal(false)} onConfirm={handleSign} />
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-emerald-800 rounded-2xl w-[420px] max-w-[95vw] shadow-2xl overflow-hidden">
            <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-900 border-2 border-emerald-600 flex items-center justify-center text-3xl">✅</div>
              <div>
                <h2 className="text-lg font-bold text-white">Memorando Enviado!</h2>
                <p className="text-sm text-slate-400 mt-1">O memorando foi assinado digitalmente e enviado com sucesso.</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 w-full text-sm text-slate-300">
                <div className="flex gap-2">
                  <span className="text-slate-500 w-16 flex-shrink-0">Para:</span>
                  <span>{recipients.map(r => r.name).join('; ')}</span>
                </div>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <button onClick={() => navigate('/memorandos')} className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl py-2.5 text-sm text-slate-300 cursor-pointer transition-colors">
                  Ver Memorandos
                </button>
                <button onClick={() => navigate(`/memorandos/${sentMemoId}`)} className="flex-[2] bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 rounded-xl py-2.5 text-sm font-bold text-white cursor-pointer transition-colors">
                  Abrir Memorando
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
