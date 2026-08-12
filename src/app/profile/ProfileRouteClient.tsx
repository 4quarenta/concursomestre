'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const ProfilePage = dynamic(() => import('./ProfilePage'), {
  ssr: false,
  loading: () => <RouteContentSkeleton variant="profile" testId="profile-interactive-loading" />,
});

const scheduleProfileModule = (callback: () => void): (() => void) => {
  let timeoutId: number | null = null;
  const frameId = window.requestAnimationFrame(() => {
    timeoutId = window.setTimeout(callback, 0);
  });

  return () => {
    window.cancelAnimationFrame(frameId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  };
};

export default function ProfileRouteClient() {
  const [canLoadProfile, setCanLoadProfile] = React.useState(false);

  React.useEffect(() => scheduleProfileModule(() => setCanLoadProfile(true)), []);

  return canLoadProfile
    ? <ProfilePage />
    : <RouteContentSkeleton variant="profile" testId="profile-interactive-loading" />;
}
