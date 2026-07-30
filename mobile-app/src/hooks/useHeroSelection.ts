import { useState, useEffect, useRef, useCallback } from 'react';

export function useHeroSelection(totalPlates: number = 4, intervalMs: number = 5000) {
  const [selectedIndex, setSelectedIndexState] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSelectedIndexState((prev) => (prev + 1) % totalPlates);
    }, intervalMs);
  }, [totalPlates, intervalMs]);

  const selectIndex = useCallback(
    (index: number) => {
      setSelectedIndexState(index);
      startTimer();
    },
    [startTimer]
  );

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  return {
    selectedIndex,
    selectIndex,
  };
}
