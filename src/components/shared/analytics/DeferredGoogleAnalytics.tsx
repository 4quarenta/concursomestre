'use client';

import React from 'react';
import { COOKIE_CONSENT_CHANGE_EVENT, readCookieConsent } from '@services/privacy/cookieConsent';

const FALLBACK_DELAY_MS = 12000;
const INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

export default function DeferredGoogleAnalytics({ measurementId }: { measurementId: string }) {
  React.useEffect(() => {
    let disposed = false;
    let analyticsAllowed = readCookieConsent()?.analytics === true;
    let script: HTMLScriptElement | null = null;
    const disableKey = `ga-disable-${measurementId}`;

    const setAnalyticsDisabled = (disabled: boolean) => {
      (window as unknown as Record<string, unknown>)[disableKey] = disabled;
    };

    const load = () => {
      if (!analyticsAllowed || disposed || document.querySelector(`script[data-cm-ga="${measurementId}"]`)) return;
      INTERACTION_EVENTS.forEach((eventName) => window.removeEventListener(eventName, scheduleLoad));
      setAnalyticsDisabled(false);
      window.dataLayer = window.dataLayer || [];
      const gtag = (...args: unknown[]) => { window.dataLayer?.push(args); };
      gtag('js', new Date());
      gtag('config', measurementId, { anonymize_ip: true });
      script = document.createElement('script');
      script.async = true;
      script.dataset.cmGa = measurementId;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    };

    const scheduleLoad = () => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(load, { timeout: 2000 });
        return;
      }
      window.setTimeout(load, 0);
    };

    const onConsentChange = () => {
      analyticsAllowed = readCookieConsent()?.analytics === true;
      setAnalyticsDisabled(!analyticsAllowed);
      if (analyticsAllowed) load();
    };

    setAnalyticsDisabled(!analyticsAllowed);
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onConsentChange);

    if (!analyticsAllowed) {
      return () => {
        disposed = true;
        window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onConsentChange);
        setAnalyticsDisabled(true);
      };
    }

    INTERACTION_EVENTS.forEach((eventName) => window.addEventListener(eventName, scheduleLoad, {
      once: true,
      passive: true,
    }));
    const timeoutId = window.setTimeout(load, FALLBACK_DELAY_MS);

    return () => {
      disposed = true;
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onConsentChange);
      INTERACTION_EVENTS.forEach((eventName) => window.removeEventListener(eventName, scheduleLoad));
      window.clearTimeout(timeoutId);
      setAnalyticsDisabled(true);
      script?.remove();
    };
  }, [measurementId]);

  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
