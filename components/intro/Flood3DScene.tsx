'use client';

import { useEffect, useRef } from 'react';
import { DataSignal } from './LandingOverlay';

export function Flood3DScene({ stage }: { stage: number }) {
  const visual = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = visual.current;
    if (!host) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    import('./photographic-scene').then(({ createPhotographicScene }) => {
      if (!cancelled) dispose = createPhotographicScene(host);
    }).catch(error => {
      console.error('River animation could not start; keeping the landscape image.', error);
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);

  return (
    <div className="intro-scene intro-photographic" aria-hidden="true">
      <div className="intro-visual" ref={visual}>
        <picture className="intro-landscape">
          <source media="(max-width: 700px)" srcSet="/intro/river-valley-hero-mobile.webp" />
          <img src="/intro/river-valley-hero.webp" alt="" fetchPriority="high" decoding="async" />
        </picture>
      </div>
      <DataSignal stage={stage} />
    </div>
  );
}

