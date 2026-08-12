'use client';

import dynamic from 'next/dynamic';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const DashboardPage = dynamic(() => import('./DashboardPage'), {
  ssr: false,
  loading: () => <RouteContentSkeleton variant="dashboard" testId="dashboard-interactive-loading" />,
});

export default function DashboardRouteClient() {
  return <DashboardPage />;
}
