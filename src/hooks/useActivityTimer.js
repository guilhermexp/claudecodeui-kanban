import { useEffect, useRef, useState } from 'react'

export function useActivityTimer(active) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (active) {
      if (startRef.current == null) startRef.current = Date.now()
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - (startRef.current || Date.now())) / 1000))
        }, 250)
      }
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      startRef.current = null
      setElapsed(0)
    }
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null } }
  }, [active])

  return elapsed
}