import { ArrowDown, ArrowRight, Cpu, Radio, Satellite, ShieldCheck, Waves } from 'lucide-react';
import { INTRO_DURATION_MS } from './LoadingSequence';

export function SystemStatus({ active }: { active: boolean }) {
  // Capability labels, qualified below. Hardware status must come from verified
  // telemetry, never from the intro timer or the API's existing sample readings.
  return <div className={`intro-status ${active ? 'is-active' : ''}`}>
    <p className="intro-status-caption">SYSTEM CAPABILITIES</p>
    <div><Radio /><span>IoT system <b>ready</b></span></div>
    <div><Waves /><span>Real-time monitoring</span></div>
    <div><ShieldCheck /><span>AI flood prediction</span></div>
    <p className="intro-status-note">Live connection status available in dashboard</p>
  </div>;
}

export function DataSignal({ stage }: { stage: number }) {
  return <div className={`intro-signals ${stage >= 3 ? 'signals-active' : ''}`} aria-hidden="true">
    <span className="signal-gps"><Satellite /> GPS <i /></span>
    <span className="signal-sensor"><Waves /> SENSOR <i /></span>
    <span className="signal-lora"><Radio /> LoRa <i /></span>
    <span className="signal-iot"><Cpu /> IoT <i /></span>
    <span className="signal-data">LIVE DATA <small>TELEMETRY LINK</small></span>
  </div>;
}

export function LandingOverlay({ elapsed, stage, onEnter }: { elapsed: number; stage: number; onEnter: () => void }) {
  const progress = Math.min(100, elapsed / INTRO_DURATION_MS * 100);
  const step = ['Establishing the environment', 'Revealing the river environment', 'Introducing the monitoring buoy', 'Exploring sensor connectivity', 'Smart flood monitoring', 'System initialized'][stage];
  return <div className="intro-ui">
    <header className="intro-header">
      <a className="intro-brand" href="?intro=skip" onClick={(event) => { event.preventDefault(); onEnter(); }} aria-label="FloodGuard AI dashboard">
        <span className="intro-brand-icon"><Waves size={23} /></span><span>FloodGuard <b>AI</b><small>INTELLIGENCE THAT PROTECTS</small></span>
      </a>
      <span className="intro-header-label">ENVIRONMENTAL INTELLIGENCE PLATFORM</span>
      <button className="intro-skip" onClick={onEnter}>Skip intro <ArrowRight size={15} /></button>
    </header>
    <div className="intro-copy">
      <div className="intro-eyebrow"><span /> SMART FLOOD MONITORING</div>
      <h1>Predict.<br />Monitor.<br /><span>Protect.</span></h1>
      <p className="intro-subtitle">AI-powered flood prediction with<br className="intro-desktop-break" /> real-time IoT water monitoring.</p>
      <SystemStatus active={stage >= 3} />
      <button className="intro-enter" onClick={onEnter}>ENTER MONITORING DASHBOARD <ArrowRight size={19} /></button>
      <p className="intro-initializing"><span className="intro-spinner" />{stage === 5 ? 'System initialized' : 'Initializing flood monitoring system...'}</p>
    </div>
    <div className={`intro-buoy-caption ${stage >= 2 ? 'caption-active' : ''}`}>
      <span className="intro-caption-line" /><div><p>DESIGNED FOR THE REAL WORLD</p><h2>Small device. Greater awareness.</h2><span>GPS positioning <i /> Water-level sensing <i /> LoRa connectivity</span></div>
    </div>
    <footer className="intro-footer">
      <div className="intro-sequence-label"><span className="intro-step-number">0{Math.max(1, stage)}</span><div><span className="intro-footer-kicker">{stage === 5 ? 'SYSTEM INITIALIZED' : 'INITIALIZATION SEQUENCE'}</span><p role="status">{step}</p></div></div>
      <div className="intro-progress-block"><div className="intro-progress-label"><span>RIVER TO INSIGHT</span><span>{Math.round(progress)}%</span></div><div className="intro-progress" role="progressbar" aria-label="Intro animation" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div></div>
      <div className="intro-footer-detail"><ArrowDown size={16} /><span>From early signals<br /><b>to informed decisions.</b></span></div>
    </footer>
  </div>;
}
