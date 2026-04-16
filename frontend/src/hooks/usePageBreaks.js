import { useState, useEffect } from 'react'

const PAGE_H = 1123
const SEP_H  = 36

export function usePageBreaks(ref) {
  const [breaks, setBreaks] = useState([])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const compute = () => {
      const inner = el.firstElementChild
      if (!inner) return
      const h = inner.scrollHeight
      const result = []
      for (let y = PAGE_H; y < h; y += PAGE_H) result.push(y)
      setBreaks(result)
    }

    compute()

    const inner = el.firstElementChild
    if (!inner) return

    const obs = new ResizeObserver(compute)
    obs.observe(inner)
    return () => obs.disconnect()
  }, [])

  return breaks
}