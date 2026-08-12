'use client';

import dynamic from 'next/dynamic';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const SimulationPage = dynamic(() => import('./SimulationPage'), {
  ssr: false,
  loading: () => <RouteContentSkeleton variant="simulation" testId="simulation-interactive-loading" />,
});

export default function SimulationRouteClient() {
  return <SimulationPage />;
}
