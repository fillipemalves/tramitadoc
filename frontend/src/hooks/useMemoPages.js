// Constantes de layout A4 em pixels (96dpi)
export const PAGE_W    = 794
export const PAGE_H    = 1123
export const HEADER_H  = 180
export const FOOTER_H  = 130
export const CONTENT_H = PAGE_H - HEADER_H - FOOTER_H  // 813
export const BODY_W    = 634  // PAGE_W - 2×80px margens

// useMemoPages mantido para compatibilidade com VisualizarMemo.jsx (read-only)
// NovoMemo.jsx não usa mais este hook — usa abordagem de documento contínuo
import { useState, useEffect } from 'react'

export function useMemoPages(metaRef, bodyRef, contentKey = null) {
  const [pages, setPages] = useState({
    totalPages: 1,
    page1BodyH: CONTENT_H,
    offsets:    [0],
  })

  useEffect(() => {
    const compute = () => {
      const metaH = metaRef.current?.offsetHeight ?? 0
      const bodyH = bodyRef.current?.scrollHeight  ?? 0
      if (!bodyH) return
      const pg1   = Math.max(50, CONTENT_H - metaH)
      const over  = Math.max(0, bodyH - pg1)
      const extra = over > 0 ? Math.ceil(over / CONTENT_H) : 0
      const total = 1 + extra
      setPages(prev => {
        if (prev.totalPages === total && prev.page1BodyH === pg1) return prev
        const offsets = Array.from({ length: total }, (_, i) =>
          i === 0 ? 0 : pg1 + (i - 1) * CONTENT_H
        )
        return { totalPages: total, page1BodyH: pg1, offsets }
      })
    }
    compute()
    const obs = new ResizeObserver(compute)
    if (metaRef.current) obs.observe(metaRef.current)
    if (bodyRef.current) obs.observe(bodyRef.current)
    return () => obs.disconnect()
  }, [metaRef, bodyRef, contentKey]) // eslint-disable-line

  return pages
}