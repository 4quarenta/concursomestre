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
import { ArrowRight, BookOpen, Loader2, ShoppingBag, Star, Tag, UserRound } from 'lucide-react';
import type { Material } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { useMarketplace } from '@providers/MarketplaceProvider';
import { marketplaceService } from '@services/marketplace';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { buildAbsoluteUrl, buildMaterialPath, buildMaterialSlug, summarizeSeoText, useDocumentSeo } from '@services/seo';

const MaterialPublicPage: React.FC = () => {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { transactions } = useMarketplace();
  const [material, setMaterial] = React.useState<Material | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setError('Material nao encontrado.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    marketplaceService.getMaterialById(id)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        if (!payload) {
          setError('Material nao encontrado.');
          return;
        }

        setMaterial(payload);
        setError(null);
      })
      .catch((requestError) => {
        if (!isMounted) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar o material.');
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
    if (!material?.id) {
      return null;
    }

    return buildMaterialPath(material);
  }, [material]);

  React.useEffect(() => {
    if (!material?.id || !canonicalPath) {
      return;
    }

    const canonicalSlug = buildMaterialSlug(material);
    if (slug !== canonicalSlug) {
      navigate(canonicalPath, { replace: true });
    }
  }, [canonicalPath, material, navigate, slug]);

  useDocumentSeo(material ? {
    title: `${summarizeSeoText(material.title, 60)} | ConcursoMestre`,
    description: summarizeSeoText(material.description || material.details || 'Material do marketplace ConcursoMestre.', 160),
    canonical: buildAbsoluteUrl(canonicalPath || `/material/${material.id}`),
    ogTitle: summarizeSeoText(material.title, 95),
    ogDescription: summarizeSeoText(material.description || material.details || 'Material do marketplace ConcursoMestre.', 180),
    ogImage: material.coverUrl,
  } : null);

  const hasReaderAccess = Boolean(
    currentUser
    && transactions.some((transaction) =>
      String(transaction.materialId) === String(material?.id)
      && String(transaction.buyerId) === String(currentUser.id)
      && ['completed', 'approved'].includes(String(transaction.status || ''))
    )
  );

  if (isLoading) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-[320px] items-center justify-center p-8`}>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin text-indigo-600" />
            Carregando material...
          </div>
        </div>
      </section>
    );
  }

  if (error || !material) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-8`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Material indisponivel</p>
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Nao foi possivel abrir este material</h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{error || 'O material solicitado nao esta disponivel no momento.'}</p>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
          >
            Voltar ao marketplace <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 px-4 py-8 sm:px-6 lg:px-8`}>
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Material publico</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{material.title}</h1>
              <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                {summarizeSeoText(material.description || material.details || 'Material do marketplace ConcursoMestre.', 180)}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-right shadow-sm dark:border-emerald-900/30 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Preco</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                {material.price > 0 ? `R$ ${material.price.toFixed(2)}` : 'Gratis'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.5fr),360px]">
          <article className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
            <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Descricao</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {material.description || material.details || 'Sem descricao adicional.'}
            </p>
          </article>

          <aside className="space-y-4">
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
              <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Resumo</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-600 dark:text-indigo-300" />
                  <span>{typeof material.subject === 'string' ? material.subject : material.subjectText || 'Materia nao informada'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-fuchsia-600 dark:text-fuchsia-300" />
                  <span>{material.topic || 'Topico nao informado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-sky-600 dark:text-sky-300" />
                  <span>{material.authorName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star size={16} className="text-amber-600 dark:text-amber-300" />
                  <span>{material.rating?.toFixed?.(1) || material.rating || 0} de avaliacao media</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShoppingBag size={16} className="text-emerald-600 dark:text-emerald-300" />
                  <span>{material.salesCount || 0} vendas registradas</span>
                </div>
              </div>
            </div>

            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
              <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Acoes</h2>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
                >
                  Ver no marketplace <ArrowRight size={14} />
                </Link>
                {hasReaderAccess ? (
                  <Link
                    to={`/read/${material.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-700 transition-all hover:border-emerald-300 dark:border-emerald-900/30 dark:text-emerald-300"
                  >
                    Abrir no leitor
                  </Link>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default MaterialPublicPage;
