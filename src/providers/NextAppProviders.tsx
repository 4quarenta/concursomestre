import React from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';
import { NavigationProgressProvider } from './NavigationProgressProvider';

export default function NextAppProviders({
  children,
  initialPublicSettings = null,
}: {
  children: React.ReactNode;
  initialPublicSettings?: Record<string, unknown> | null;
}) {
  return (
    <AppProviders initialPublicSettings={initialPublicSettings}>
      <NavigationProgressProvider>
        <NextRouteFrame>{children}</NextRouteFrame>
      </NavigationProgressProvider>
    </AppProviders>
  );
}
