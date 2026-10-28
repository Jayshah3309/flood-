'use client';

import Dashboard from '@/components/dashboard';
import { IntroTransition } from '@/components/intro/IntroTransition';

export default function Home() {
  return <IntroTransition><Dashboard /></IntroTransition>;
}
