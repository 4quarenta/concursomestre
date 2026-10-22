'use client';

import React from 'react';

const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.concursomestre.mobile';

interface AppStoreLinksProps {
  playStoreUrl?: string | null;
  surface?: 'platform' | 'commercial';
}

const AppStoreLinks: React.FC<AppStoreLinksProps> = ({ playStoreUrl, surface = 'platform' }) => {
  const configuredUrl = playStoreUrl?.trim();
  const href = configuredUrl && /^https:\/\//i.test(configuredUrl)
    ? configuredUrl
    : DEFAULT_PLAY_STORE_URL;
  const commercial = surface === 'commercial';
  const linkClass = commercial
    ? 'border-slate-300 bg-white text-slate-900 hover:border-[#684cff]'
    : 'border-slate-700 bg-slate-900 text-white hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-950';
  const disabledClass = commercial
    ? 'border-slate-200 bg-slate-50 text-slate-400'
    : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500';

  return (
    <div className="flex flex-wrap gap-2" aria-label="Aplicativos ConcursoMestre">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex min-h-11 items-center rounded-md border px-3.5 py-2 transition-colors ${linkClass}`}
      >
        <span className="text-left leading-tight">
          <span className="block text-[9px] font-medium uppercase tracking-wide opacity-75">Baixe na</span>
          <span className="block text-sm font-bold">Google Play</span>
        </span>
      </a>
      <button
        type="button"
        disabled
        aria-label="App Store: em breve"
        className={`inline-flex min-h-11 cursor-not-allowed items-center rounded-md border px-3.5 py-2 opacity-80 ${disabledClass}`}
      >
        <span className="text-left leading-tight">
          <span className="block text-[9px] font-medium uppercase tracking-wide">Em breve</span>
          <span className="block text-sm font-bold">App Store</span>
        </span>
      </button>
    </div>
  );
};

export default AppStoreLinks;
