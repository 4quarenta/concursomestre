'use client';

import React, { Suspense } from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';

export default function NextAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <Suspense fallback={null}>
        <NextRouteFrame>{children}</NextRouteFrame>
      </Suspense>
    </AppProviders>
  );
}
