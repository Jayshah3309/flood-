'use client';

import { useEffect, useState } from 'react';

export type TelemetryData = {
  water_level: number; rainfall: number; temperature: number;
  latitude: number; longitude: number; risk: string; prediction: string;
  rise_rate: number; water_level_score: number; rainfall_score: number;
  rise_rate_score: number; overall_risk_score: number; updated_at?: string;
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const jitter = (value: number) => Math.max(0, value * (1 + (Math.random() < 0.5 ? -1 : 1) * (0.005 + Math.random() * 0.005)));

// Mirrors backend/app/services/risk.py so the displayed factors agree with the simulated readings.
function factorScore(value: number, low: number, medium: number, high: number, maximum: number) {
  if (value <= 0) return 0;
  const score = value < low ? value / low * 24
    : value < medium ? 25 + (value - low) / (medium - low) * 24
      : value < high ? 50 + (value - medium) / (high - medium) * 24
        : 75 + (value - high) / (maximum - high) * 25;
  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

function simulate(baseline: TelemetryData): TelemetryData {
  const water_level = jitter(baseline.water_level);
  const rainfall = jitter(baseline.rainfall);
  const temperature = jitter(baseline.temperature);
  const water_level_score = factorScore(water_level, 2, 3, 3.5, 4);
  const rainfall_score = factorScore(rainfall, 10, 30, 50, 70);
  const rise_rate_score = factorScore(baseline.rise_rate, 0.05, 0.15, 0.3, 0.5);
  const overall_risk_score = Math.round((water_level_score * 0.5 + rainfall_score * 0.3 + rise_rate_score * 0.2) * 10) / 10;
  const risk = overall_risk_score < 25 ? 'LOW' : overall_risk_score < 50 ? 'MEDIUM' : overall_risk_score < 75 ? 'HIGH' : 'CRITICAL';
  const prediction = { LOW: 'Normal conditions', MEDIUM: 'Flood conditions developing', HIGH: 'High flood risk', CRITICAL: 'Critical flood risk' }[risk];
  return { ...baseline, water_level, rainfall, temperature, water_level_score, rainfall_score, rise_rate_score, overall_risk_score, risk, prediction };
}

export function useTelemetrySimulation(baseline: TelemetryData) {
  const [frame, setFrame] = useState({ baseline, telemetry: baseline, sampledAt: null as number | null });

  useEffect(() => {
    let timeout: number;
    const schedule = () => {
      timeout = window.setTimeout(() => {
        setFrame({ baseline, telemetry: simulate(baseline), sampledAt: Date.now() });
        schedule();
      }, 2000 + Math.random() * 3000);
    };
    schedule();
    return () => window.clearTimeout(timeout);
  }, [baseline]);

  return frame.baseline === baseline
    ? { telemetry: frame.telemetry, sampledAt: frame.sampledAt }
    : { telemetry: baseline, sampledAt: null };
}
