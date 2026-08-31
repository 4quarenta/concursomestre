import React from 'react';
import { AppProviders } from './AppProviders';
import NextRouteFrame from './NextRouteFrame';
import { NavigationProgressProvider } from './NavigationProgressProvider';
import CookieConsentManager, { CookieConsentProvider } from '@/components/shared/privacy/CookieConsentManager';

export default function NextAppProviders({
  children,
  initialPublicSettings = null,
}: {
  children: React.ReactNode;
  initialPublicSettings?: Record<string, unknown> | null;
}) {
  return (
    <CookieConsentProvider>
      <AppProviders initialPublicSettings={initialPublicSettings}>
        <NavigationProgressProvider>
          <NextRouteFrame>{children}</NextRouteFrame>
        </NavigationProgressProvider>
        <CookieConsentManager />
      </AppProviders>
    </CookieConsentProvider>
  );
}
