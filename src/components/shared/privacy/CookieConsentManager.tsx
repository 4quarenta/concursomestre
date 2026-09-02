'use client';

import React from 'react';
import Link from 'next/link';
import { Check, Cookie, Settings2, ShieldCheck, X } from 'lucide-react';
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_OPEN_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  parseCookieConsent,
  writeCookieConsent,
  type CookieConsentPreferences,
} from '@services/privacy/cookieConsent';

type CookieConsentContextValue = {
  preferences: CookieConsentPreferences | null;
  isReady: boolean;
  savePreferences: (preferences: Pick<CookieConsentPreferences, 'analytics' | 'marketing'>) => void;
};

const CookieConsentContext = React.createContext<CookieConsentContextValue | null>(null);

const subscribeToConsent = (onStoreChange: () => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_CONSENT_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStorage);
  };
};

const getConsentSnapshot = () => window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
const getServerConsentSnapshot = () => null;
const getReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

export const useCookieConsent = (): CookieConsentContextValue => {
  const context = React.useContext(CookieConsentContext);
  if (!context) throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  return context;
};

export function CookieConsentProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const consentSnapshot = React.useSyncExternalStore(subscribeToConsent, getConsentSnapshot, getServerConsentSnapshot);
  const isReady = React.useSyncExternalStore(subscribeToConsent, getReadySnapshot, getServerReadySnapshot);
  const preferences = React.useMemo(() => parseCookieConsent(consentSnapshot), [consentSnapshot]);

  const savePreferences = React.useCallback((next: Pick<CookieConsentPreferences, 'analytics' | 'marketing'>) => {
    const saved = writeCookieConsent(next);
    void saved;
  }, []);

  const value = React.useMemo(() => ({ preferences, isReady, savePreferences }), [isReady, preferences, savePreferences]);
  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}
function PreferenceRow({
  checked,
  disabled = false,
  label,
  description,
  onChange,
}: Readonly<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange?: (checked: boolean) => void;
}>) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-1 h-4 w-4 accent-indigo-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-600 dark:text-slate-300">{description}</span>
      </span>
    </label>
  );
}

export default function CookieConsentManager() {
  const { preferences, isReady, savePreferences } = useCookieConsent();
  const [isConfiguring, setIsConfiguring] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);

  const acceptAll = () => {
    savePreferences({ analytics: true, marketing: true });
    setIsConfiguring(false);
  };

  const rejectOptional = () => {
    savePreferences({ analytics: false, marketing: false });
    setIsConfiguring(false);
  };

  const saveCurrent = () => {
    savePreferences({ analytics, marketing });
    setIsConfiguring(false);
  };

  const openPreferences = React.useCallback(() => {
    setAnalytics(preferences?.analytics === true);
    setMarketing(preferences?.marketing === true);
    setIsConfiguring(true);
  }, [preferences]);

  React.useEffect(() => {
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, openPreferences);
    return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, openPreferences);
  }, [openPreferences]);

  if (!isReady) return null;

  if (preferences && !isConfiguring) {
    return null;
  }

  return (
    <section
      role="dialog"
      aria-modal={isConfiguring ? true : undefined}
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-indigo-50 p-2 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
          <Cookie size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="cookie-consent-title" className="text-base font-black text-slate-950 dark:text-white">
                Preferências de cookies
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Usamos cookies necessários para a segurança e, somente com sua autorização, cookies opcionais para medir audiência e exibir publicidade relevante.
              </p>
            </div>
            {preferences ? (
              <button
                type="button"
                onClick={() => setIsConfiguring(false)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                aria-label="Fechar preferências de cookies"
              >
                <X size={17} />
              </button>
            ) : null}
          </div>

          {isConfiguring ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <PreferenceRow
                checked
                disabled
                label="Necessários"
                description="Autenticação, segurança e funcionamento básico."
              />
              <PreferenceRow
                checked={analytics}
                label="Analytics"
                description="Medição de uso e desempenho da plataforma."
                onChange={setAnalytics}
              />
              <PreferenceRow
                checked={marketing}
                label="Marketing"
                description="Publicidade e medição de campanhas."
                onChange={setMarketing}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Link href="/privacy" className="mr-auto text-xs font-bold text-indigo-700 underline underline-offset-2 dark:text-indigo-300">
              Política de Privacidade
            </Link>
            <button type="button" onClick={rejectOptional} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              <X size={14} />
              Recusar opcionais
            </button>
            {isConfiguring ? (
              <button type="button" onClick={saveCurrent} className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200 dark:hover:bg-indigo-950">
                <ShieldCheck size={14} />
                Salvar preferências
              </button>
            ) : (
              <button type="button" onClick={openPreferences} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                <Settings2 size={14} />
                Configurar
              </button>
            )}
            <button type="button" onClick={acceptAll} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-indigo-800">
              <Check size={14} />
              Aceitar todos
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
