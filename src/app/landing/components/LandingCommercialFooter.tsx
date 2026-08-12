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

import Link from 'next/link';
import PublicBrandLink from '../../../components/shared/layout/PublicBrandLink';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { landingSocialIconMap } from '../landingContent';
import { isModulePathEnabled } from '@services/system/moduleFlags';

const FOOTER_COLUMNS = [
  {
    title: 'Navegação',
    links: [
      { label: 'Disciplinas', href: '/disciplinas' },
      { label: 'Bancas', href: '/bancas' },
      { label: 'Recursos', href: '/#recursos' },
      { label: 'Planos', href: '/#planos' },
      { label: 'Depoimentos', href: '/#depoimentos' },
      { label: 'Blog', href: '/blog' },
      { label: 'Novidades', href: '/novidades' },
    ],
  },
  {
    title: 'Suporte',
    links: [
      { label: 'Central de ajuda', href: '/support' },
      { label: 'Fale conosco', href: '/support' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Termos de uso', href: '/terms' },
      { label: 'Política de privacidade', href: '/privacy' },
    ],
  },
];

const LandingCommercialFooter = () => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const settingsLoaded = useAppConfigStore((state) => state.isSystemSettingsLoaded);
  const socialLinks = useAppConfigStore((state) => state.systemSettings.landingPageContent?.socialLinks ?? [])
    .filter((link) => link.enabled && /^https?:\/\//i.test(link.url));

  return (
    <footer className="mx-auto w-full max-w-7xl px-5 pb-10 pt-6 sm:px-8">
      <div className="grid gap-10 border-t border-slate-100 pt-10 lg:grid-cols-[1.4fr_2fr_0.8fr]">
        <div>
          <PublicBrandLink width={205} surface="light" />
          <p className="mt-5 max-w-xs text-sm font-medium leading-6 text-slate-500">
            Estude com estratégia. Aprove com consistência.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-black text-[#07103a]">{column.title}</h3>
              <ul className="mt-4 space-y-3">
              {column.links.filter((link) => (
                isModulePathEnabled(systemSettings, link.href, false) || (
                  settingsLoaded && isModulePathEnabled(systemSettings, link.href)
                )
              )).map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="text-sm font-medium text-slate-500 transition hover:text-[#684cff]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-sm font-black text-[#07103a]">Siga a gente</h3>
          <div className="mt-4 flex gap-3">
            {socialLinks.map(({ id, label, iconKey, url }) => {
              const Icon = landingSocialIconMap[iconKey];
              return (
                <Link
                  key={id}
                  href={url}
                  prefetch={false}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-[#07103a] transition hover:border-[#684cff] hover:text-[#684cff]"
                  aria-label={label}
                >
                  <Icon size={17} />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-10 text-center text-xs font-medium text-slate-400">
        © {new Date().getFullYear()} ConcursoMestre. Todos os direitos reservados.
      </p>
    </footer>
  );
};

export default LandingCommercialFooter;
