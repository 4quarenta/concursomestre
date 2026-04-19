'use client';

import { useAuth } from '@providers/AuthProvider';
import DashboardPage from './dashboard/page';
import LandingPage from './landing/page';

export default function HomePage() {
  const { currentUser } = useAuth();

  return currentUser ? <DashboardPage /> : <LandingPage />;
}
