'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Flood3DScene } from './Flood3DScene';
import { LandingOverlay } from './LandingOverlay';
import { INTRO_FADE_MS, useLoadingSequence } from './LoadingSequence';
import './intro.css';

function Intro({ onFinish, exiting }: { onFinish: () => void; exiting: boolean }) {
  const { elapsed, stage } = useLoadingSequence(onFinish);
  return <section className={`flood-intro ${exiting ? 'intro-exiting' : ''}`} data-stage={stage} aria-label="FloodGuard introduction">
    <Flood3DScene stage={stage} />
    <div className="intro-vignette" />
    <LandingOverlay elapsed={elapsed} stage={stage} onEnter={onFinish} />
  </section>;
}

export function IntroTransition({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const finishing = useRef(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboard = useRef<HTMLDivElement>(null);
  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    setExiting(true);
    timeout.current = setTimeout(() => setVisible(false), INTRO_FADE_MS);
  }, []);
  useEffect(() => {
    // Direct-dashboard URL without adding or changing routes.
    if (new URLSearchParams(window.location.search).get('intro') === 'skip') {
      finishing.current = true;
      setVisible(false);
    }
    return () => { if (timeout.current) clearTimeout(timeout.current); };
  }, []);
  useEffect(() => {
    if (!visible) { dashboard.current?.focus({ preventScroll: true }); return; }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [visible]);
  return <>
    <div ref={dashboard} tabIndex={-1} inert={visible} aria-hidden={visible} className="intro-dashboard">{children}</div>
    {visible && <Intro onFinish={finish} exiting={exiting} />}
  </>;
}
