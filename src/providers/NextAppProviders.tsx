'use client';

import React from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';

export default function NextAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <NextRouteFrame>{children}</NextRouteFrame>
    </AppProviders>
  );
}
