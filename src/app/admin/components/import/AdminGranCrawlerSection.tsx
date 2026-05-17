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
import { ExternalLink, Shield, TerminalSquare } from 'lucide-react';
import apiClient from '@services/api/client';
import {
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

const GRAN_CRAWLER_ENTRY_PATH = 'scripts/importers/questions/gran/index.php';
const GRAN_CRAWLER_WORKER_PATH = 'scripts/importers/questions/gran/import_worker.php';

const resolveBackendRootUrl = (): string => {
  const rawBaseUrl = String(
    apiClient.defaults.baseURL
      || process.env.NEXT_PUBLIC_API_BASE_URL
      || '/questao-pro-backend/api/',
  );

  const normalizedBaseUrl = typeof window === 'undefined'
    ? rawBaseUrl
    : new URL(rawBaseUrl, window.location.origin).toString();

  return normalizedBaseUrl.replace(/\/api\/?$/i, '');
};

const appendBackendPath = (backendRoot: string, path: string) => (
  `${backendRoot.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
);

/**
 * Superficie operacional para abrir o crawler da Gran a partir do admin.
 * O fluxo permanece externo (script legado), mas agora com entrada oficial no painel.
 */
const AdminGranCrawlerSection = () => {
  const [lastOpenedAt, setLastOpenedAt] = React.useState<string | null>(null);
  const backendRoot = React.useMemo(() => resolveBackendRootUrl(), []);
  const crawlerUrl = React.useMemo(
    () => appendBackendPath(backendRoot, GRAN_CRAWLER_ENTRY_PATH),
    [backendRoot],
  );
  const workerUrl = React.useMemo(
    () => appendBackendPath(backendRoot, GRAN_CRAWLER_WORKER_PATH),
    [backendRoot],
  );

  const handleOpenCrawler = React.useCallback(() => {
    window.open(crawlerUrl, '_blank', 'noopener,noreferrer');
    setLastOpenedAt(new Date().toLocaleString('pt-BR'));
  }, [crawlerUrl]);

  return (
    <div className="space-y-5">
      <section className={ADMIN_PAGE_PANEL_CLASS}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Importacao externa
            </p>
            <h3 className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">
              Crawler Gran
            </h3>
            <p className="mt-2 max-w-3xl text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Entrada oficial do painel para o crawler legado da Gran. O bearer token da Gran deve ser
              inserido no proprio crawler, respeitando o fluxo manual de autenticacao.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCrawler}
            className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-5 py-2 text-[10px] uppercase tracking-[0.18em]`}
          >
            <ExternalLink size={14} />
            Abrir crawler
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={`${ADMIN_PAGE_PANEL_CLASS} space-y-3`}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Endpoint de entrada
          </p>
          <code className="block break-all rounded-md bg-slate-100 px-3 py-3 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {crawlerUrl}
          </code>
          <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Use este endereco para iniciar coleta e revisao de questoes antes da importacao para o banco.
          </p>
        </article>

        <article className={`${ADMIN_PAGE_PANEL_CLASS} space-y-3`}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Worker backend
          </p>
          <code className="block break-all rounded-md bg-slate-100 px-3 py-3 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {workerUrl}
          </code>
          <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Endpoint processador usado pelo crawler durante a ingestao automatizada.
          </p>
        </article>
      </section>

      <section className={`space-y-4 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
        <div className="flex items-start gap-3">
          <Shield size={17} className="mt-0.5 text-amber-600 dark:text-amber-300" />
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">Boas praticas operacionais</p>
            <ul className="mt-2 space-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <li>1. Use apenas sessao administrativa para abrir o crawler.</li>
              <li>2. Nao reutilize bearer token expirado da Gran.</li>
              <li>3. Revise as questoes importadas antes de publicar em massa.</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCrawler}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} px-4 py-2 text-[10px] uppercase tracking-[0.18em]`}
          >
            <TerminalSquare size={13} />
            Abrir em nova guia
          </button>

          {lastOpenedAt ? (
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
              Ultima abertura: {lastOpenedAt}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default AdminGranCrawlerSection;
