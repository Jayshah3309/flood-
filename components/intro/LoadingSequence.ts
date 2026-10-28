import { useEffect, useState } from 'react';

export const INTRO_DURATION_MS = 46_000;
export const INTRO_FADE_MS = 850;

export function sequenceStage(elapsed: number) {
  if (elapsed < 1000) return 0;
  if (elapsed < 12_000) return 1;
  if (elapsed < 23_000) return 2;
  if (elapsed < 34_000) return 3;
  if (elapsed < 45_000) return 4;
  return 5;
}

// Presentation clock, never a sensor connection or API progress meter.
// Hidden-tab time does not advance; reduced motion gets a brief static view.
export function useLoadingSequence(onFinish: () => void) {
  const [elapsed, setElapsed] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let activeTime = 0;
    let previous = performance.now();
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) activeTime += Math.min(now - previous, 250);
      previous = now;
      const duration = preference.matches ? 1800 : INTRO_DURATION_MS;
      setElapsed(Math.min(activeTime / duration, 1) * INTRO_DURATION_MS);
      if (activeTime >= duration) { window.clearInterval(timer); onFinish(); }
    }, 80);
    return () => { window.clearInterval(timer); preference.removeEventListener('change', updatePreference); };
  }, [onFinish]);
  return { elapsed, reducedMotion, stage: sequenceStage(elapsed) };
}
