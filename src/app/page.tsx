'use client';

import { useAuth } from '@providers/AuthProvider';
import DashboardPage from './dashboard/DashboardPage';
import LandingPage from './landing/LandingPage';

export default function HomePage() {
  const { currentUser } = useAuth();

  return currentUser ? <DashboardPage /> : <LandingPage />;
}
