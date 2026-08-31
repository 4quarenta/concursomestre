'use client';

import React, { Suspense } from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';
import { NavigationProgressProvider } from './NavigationProgressProvider';
import GlobalLoader from '@/components/GlobalLoader';

const AppShellFallback: React.FC = () => (
  <GlobalLoader forceVisible />
);

export default function NextAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <Suspense fallback={<AppShellFallback />}>
        <NavigationProgressProvider>
          <NextRouteFrame>{children}</NextRouteFrame>
        </NavigationProgressProvider>
      </Suspense>
    </AppProviders>
  );
}
