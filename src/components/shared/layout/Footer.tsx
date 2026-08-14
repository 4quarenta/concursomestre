'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import Link from 'next/link';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { isModulePathEnabled } from '@services/system/moduleFlags';
import PublicBrandLink from './PublicBrandLink';
import { publicRoutes } from '@services/routes/publicRoutes';

const FOOTER_COLUMNS = [
  {
    title: 'Explorar',
    links: [
      { label: 'Quest\u00f5es', path: publicRoutes.questions.index() },
      { label: 'Disciplinas', path: '/disciplinas' },
      { label: 'Bancas', path: '/bancas' },
      { label: 'Simulados', path: '/simulation' },
    ],
  },
  {
    title: 'Conte\u00fado',
    links: [
      { label: 'Blog', path: '/blog' },
      { label: 'Novidades', path: '/novidades' },
      { label: 'Lei comentada', path: '/lei-comentada' },
    ],
  },
  {
    title: 'Ajuda',
    links: [
      { label: 'Suporte', path: '/support' },
      { label: 'FAQ', path: '/faq' },
      { label: 'Termos de uso', path: '/terms' },
      { label: 'Privacidade', path: '/privacy' },
    ],
  },
] as const;

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const configuredVersion = useAppConfigStore((state) => state.systemSettings.platformVersion);
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const settingsLoaded = useAppConfigStore((state) => state.isSystemSettingsLoaded);
  const platformVersion = String(configuredVersion || '1.0.0').trim().replace(/^v(?=\d)/i, '') || '1.0.0';

  return (
    <footer className="mt-20 border-t border-slate-200 pb-10 pt-10 dark:border-slate-800">
      <div className="grid gap-10 md:grid-cols-[minmax(240px,1.2fr)_minmax(0,2fr)] md:items-start">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <PublicBrandLink width={220} />
          <p className="max-w-xs text-center text-xs font-medium leading-5 text-slate-500 dark:text-slate-400 md:text-left">
            A plataforma completa para sua aprova&ccedil;&atilde;o. Estude com intelig&ecirc;ncia e conquiste sua vaga.
          </p>
        </div>

        <nav aria-label="Links do rodape" className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-900 dark:text-slate-100">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.filter((link) => (
                  isModulePathEnabled(systemSettings, link.path, false) || (
                    settingsLoaded && isModulePathEnabled(systemSettings, link.path)
                  )
                )).map((link) => (
                  <li key={link.path}>
                    <Link
                      href={link.path}
                      prefetch={false}
                      className="text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-8 dark:border-slate-900 sm:flex-row">
        <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 sm:text-left">
          &copy; {currentYear} ConcursoMestre. Todos os direitos reservados.
        </p>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
          Vers&atilde;o {platformVersion}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
