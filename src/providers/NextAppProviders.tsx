'use client';

import React, { Suspense } from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';
import { NavigationProgressProvider } from './NavigationProgressProvider';

const AppShellFallback: React.FC = () => (
  <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  </div>
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
