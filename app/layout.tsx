import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'FloodWatch | Flood Prediction & Monitoring System', description: 'Flood prediction and monitoring dashboard.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
