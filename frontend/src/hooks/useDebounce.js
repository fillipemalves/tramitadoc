import { useRef } from 'react'

export function useDebounce(fn, delay) {
  const timerRef = useRef(null)
  return (...args) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fn(...args), delay)
  }
}