'use client';

import Link from 'next/link';
import { ArrowRight, BookOpenCheck, Sparkles } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { hasActivePlanAccess } from '@services/plans/planAccess';
import { publicRoutes } from '@services/routes/publicRoutes';

type BlogConversionCtaProps = {
  tone?: 'light' | 'dark';
  compact?: boolean;
};

export default function BlogConversionCta({ tone = 'dark', compact = false }: BlogConversionCtaProps) {
  const { currentUser, isLoading } = useAuth();
  const hasSubscription = hasActivePlanAccess(currentUser);

  if (isLoading) {
    return (
      <section data-hydration-interaction className={tone === 'dark' ? 'border-y border-slate-800 bg-slate-950' : 'border-y border-indigo-100 bg-indigo-50 dark:border-indigo-900/60 dark:bg-indigo-950/30'} aria-label="Carregando próximo passo">
        <div className={`mx-auto max-w-7xl px-5 lg:px-8 ${compact ? 'py-7' : 'py-10'}`}>
          <div className="h-20 animate-pulse rounded-md bg-slate-200/20" aria-hidden="true" />
        </div>
      </section>
    );
  }

  const content = !currentUser
    ? {
        eyebrow: 'Sua preparação começa agora',
        title: 'Transforme informação em questões resolvidas.',
        description: 'Crie uma conta gratuita para salvar conteúdos, montar filtros e acompanhar sua evolução.',
        primaryHref: '/auth?mode=signup',
        primaryLabel: 'Criar conta grátis',
        secondaryHref: '/plans',
        secondaryLabel: 'Conhecer planos',
      }
    : hasSubscription
      ? {
          eyebrow: 'Continue estudando',
          title: 'Leu a notícia? Agora consolide o conteúdo na prática.',
          description: 'Resolva questões relacionadas e use seu desempenho para decidir o próximo passo.',
          primaryHref: publicRoutes.questions.index(),
          primaryLabel: 'Resolver questões',
          secondaryHref: '/dashboard',
          secondaryLabel: 'Ver meu desempenho',
        }
      : {
          eyebrow: 'Estude com mais recursos',
          title: 'Organize notícias, questões e simulados em uma preparação completa.',
          description: 'Compare os planos e escolha os recursos adequados ao seu objetivo de aprovação.',
          primaryHref: '/plans',
          primaryLabel: 'Ver planos',
          secondaryHref: publicRoutes.questions.index(),
          secondaryLabel: 'Praticar agora',
        };

  const isDark = tone === 'dark';

  return (
    <section
      data-hydration-interaction
      className={isDark
        ? 'border-y border-slate-800 bg-slate-950 text-white'
        : 'border-y border-indigo-100 bg-indigo-50 text-slate-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-white'}
      aria-label="Próximo passo da preparação"
    >
      <div className={`mx-auto flex max-w-7xl flex-col justify-between gap-6 px-5 lg:flex-row lg:items-center lg:px-8 ${compact ? 'py-7' : 'py-10'}`}>
        <div className="max-w-3xl">
          <p className={`flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] ${isDark ? 'text-indigo-300' : 'text-indigo-700 dark:text-indigo-200'}`}>
            <Sparkles size={15} /> {content.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-black leading-tight">{content.title}</h2>
          {!compact ? <p className={`mt-2 text-sm leading-6 ${isDark ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'}`}>{content.description}</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={content.primaryHref}
            prefetch={false}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-sm font-black ${isDark ? 'bg-white text-slate-950 hover:bg-indigo-100' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            <BookOpenCheck size={17} /> {content.primaryLabel}
          </Link>
          <Link
            href={content.secondaryHref}
            prefetch={false}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-md border px-5 text-sm font-bold ${isDark ? 'border-slate-700 text-white hover:border-indigo-400' : 'border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 dark:border-indigo-800 dark:bg-slate-950 dark:text-indigo-200'}`}
          >
            {content.secondaryLabel} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
