import { useEffect, useRef, useState } from 'react';

// Tracks elapsed seconds while `active` is true. Resets when inactive.
export function useActivityTimer(active) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    let id;
    if (active) {
      if (!startRef.current) {
        startRef.current = Date.now();
        setElapsedSec(0);
      }
      id = setInterval(() => {
        const start = startRef.current || Date.now();
        setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }, 1000);
    } else {
      startRef.current = null;
      setElapsedSec(0);
    }
    return () => { if (id) clearInterval(id); };
  }, [active]);

  return elapsedSec;
}

