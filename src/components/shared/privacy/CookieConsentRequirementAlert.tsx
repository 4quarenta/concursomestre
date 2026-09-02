'use client';

import React from 'react';
import { Settings2, ShieldAlert } from 'lucide-react';
import { requestCookieConsentPreferences } from '@services/privacy/cookieConsent';
import { useCookieConsent } from './CookieConsentManager';

type OptionalCookieCategory = 'analytics' | 'marketing';

type CookieConsentRequirementAlertProps = Readonly<{
  category: OptionalCookieCategory;
  description: string;
  className?: string;
}>;

const categoryLabels: Record<OptionalCookieCategory, string> = {
  analytics: 'medição de uso',
  marketing: 'recursos de publicidade e campanhas',
};

/** Render only when a user-facing feature genuinely cannot continue without an optional category. */
export default function CookieConsentRequirementAlert({
  category,
  description,
  className = '',
}: CookieConsentRequirementAlertProps) {
  const { preferences } = useCookieConsent();

  if (!preferences || preferences[category] === true) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100 ${className}`}
    >
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Preferência de cookies necessária</p>
        <p className="mt-1 text-sm leading-6">
          {description} Para continuar, permita {categoryLabels[category]} nas suas preferências de cookies.
        </p>
        <button
          type="button"
          onClick={requestCookieConsentPreferences}
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-amber-900 underline underline-offset-2 transition hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:text-amber-100 dark:hover:text-white"
        >
          <Settings2 size={15} aria-hidden="true" />
          Alterar preferências
        </button>
      </div>
    </div>
  );
}
