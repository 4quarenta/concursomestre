import React from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';
import { NavigationProgressProvider } from './NavigationProgressProvider';

export default function NextAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <NavigationProgressProvider>
        <NextRouteFrame>{children}</NextRouteFrame>
      </NavigationProgressProvider>
    </AppProviders>
  );
}
