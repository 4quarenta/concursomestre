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
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Clock3, FileBadge2, Loader2, Trophy, Users } from 'lucide-react';
import type { Ranking } from '@types';
import { rankingsService } from '@services/rankings';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { buildAbsoluteUrl, buildRankingPath, buildRankingSlug, summarizeSeoText, useDocumentSeo } from '@services/seo';

const RankingDetailPage: React.FC = () => {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const navigate = useNavigate();
  const [ranking, setRanking] = React.useState<Ranking | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setError('Ranking nao encontrado.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    rankingsService.getById(id)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        if (!payload) {
          setError('Ranking nao encontrado.');
          return;
        }

        setRanking(payload);
        setError(null);
      })
      .catch((requestError) => {
        if (!isMounted) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar o ranking.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const canonicalPath = React.useMemo(() => {
    if (!ranking?.id) {
      return null;
    }

    return buildRankingPath(ranking);
  }, [ranking]);

  React.useEffect(() => {
    if (!ranking?.id || !canonicalPath) {
      return;
    }

    const canonicalSlug = buildRankingSlug(ranking);
    if (slug !== canonicalSlug) {
      navigate(canonicalPath, { replace: true });
    }
  }, [canonicalPath, navigate, ranking, slug]);

  useDocumentSeo(ranking ? {
    title: `${summarizeSeoText(`${ranking.name} ${ranking.institution}`, 60)} | ConcursoMestre`,
    description: summarizeSeoText(`Ranking ${ranking.name} da instituicao ${ranking.institution} com ${ranking.totalQuestions} questoes e ${ranking.entries?.length || 0} participacoes.`, 160),
    canonical: buildAbsoluteUrl(canonicalPath || `/ranking/${ranking.id}`),
    ogTitle: summarizeSeoText(`${ranking.name} | ${ranking.institution}`, 95),
    ogDescription: summarizeSeoText(`Veja colocacao, participacoes e dados do ranking ${ranking.name}.`, 180),
  } : null);

  if (isLoading) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-[320px] items-center justify-center p-8`}>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin text-indigo-600" />
            Carregando ranking...
          </div>
        </div>
      </section>
    );
  }

  if (error || !ranking) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-8`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Ranking indisponivel</p>
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Nao foi possivel abrir este ranking</h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{error || 'O ranking solicitado nao esta disponivel no momento.'}</p>
          <Link
            to="/ranking"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
          >
            Ver rankings <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  const topEntries = Array.isArray(ranking.entries) ? ranking.entries.slice(0, 20) : [];

  return (
    <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 px-4 py-8 sm:px-6 lg:px-8`}>
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 bg-gradient-to-br from-amber-50 via-white to-indigo-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Ranking publico</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{ranking.name}</h1>
              <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                {ranking.institution} · {ranking.totalQuestions} questoes · {ranking.entries?.length || 0} participacoes registradas.
              </p>
            </div>
            <Link
              to="/ranking"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
            >
              Abrir central de rankings <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
              <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Resumo</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Trophy size={16} className="text-amber-600 dark:text-amber-300" />
                  <span>Status do gabarito: {ranking.keyStatus === 'official' ? 'Oficial' : 'Pendente'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-indigo-600 dark:text-indigo-300" />
                  <span>{ranking.entries?.length || 0} participantes</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileBadge2 size={16} className="text-emerald-600 dark:text-emerald-300" />
                  <span>{ranking.examTypes?.join(', ') || 'Tipo padrao'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 size={16} className="text-sky-600 dark:text-sky-300" />
                  <span>{ranking.hasDiscursive ? 'Com discursiva' : 'Sem discursiva'}</span>
                </div>
              </div>
            </div>
          </aside>

          <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Top colocacoes</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Visao publica das primeiras participacoes registradas neste ranking.</p>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead>
                  <tr className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    <th className="pb-3 pr-4">Posicao</th>
                    <th className="pb-3 pr-4">Candidato</th>
                    <th className="pb-3 pr-4">Categoria</th>
                    <th className="pb-3 pr-4">Prova</th>
                    <th className="pb-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {topEntries.map((entry, index) => (
                    <tr key={entry.id || `${entry.userName}-${index}`} className="align-top">
                      <td className="py-3 pr-4 font-black text-slate-900 dark:text-slate-100">#{index + 1}</td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{entry.userName}</td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{entry.category}</td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">{entry.examType || 'Padrao'}</td>
                      <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RankingDetailPage;

