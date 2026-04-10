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
import { useLocation } from 'react-router-dom';
import { useAuth } from '@providers/AuthProvider';
import type { UserProfile } from '@types';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';

/**
 * Lista de rotas que usam o shell principal autenticado da plataforma.
 * Esse mapeamento ajuda o fallback a imitar o layout real enquanto a pagina lazy ainda não terminou de carregar.
 */
const APP_LAYOUT_PATHS = new Set([
  '/',
  '/faq',
  '/plans',
  '/changelog',
  '/practice',
  '/simulation',
  '/x-ray',
  '/marketplace',
  '/ranking',
  '/profile',
  '/performance/subjects',
  '/notifications',
  '/support',
]);

const AUTH_PATHS = new Set(['/auth', '/reset-password', '/confirm-email']);
const DOCUMENT_PATHS = new Set(['/terms', '/privacy']);

const usesAppLayout = (pathname: string): boolean => (
  pathname.startsWith('/promo')
  || pathname.startsWith('/profile')
  || pathname.startsWith('/question/')
  || pathname.startsWith('/ranking/')
  || pathname.startsWith('/material/')
  || APP_LAYOUT_PATHS.has(pathname)
);

/**
 * Bloco base do skeleton.
 * Ele e reutilizado por todos os fallbacks para manter a mesma linguagem visual durante as transicoes.
 */
const Block: React.FC<{ className: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
  />
);

/**
 * Monta grupos de linhas falsas para areas textuais como titulos, subtitulos e paragrafos.
 */
const Lines: React.FC<{ widths: string[]; tone?: string }> = ({ widths, tone = '' }) => (
  <div className="space-y-3">
    {widths.map((width, index) => (
      <Block key={index} className={`h-4 ${width} ${tone}`.trim()} />
    ))}
  </div>
);

/**
 * Simula os atalhos do menu lateral das areas com navegacao persistente.
 */
const SidebarItems: React.FC<{ count: number; activeTone?: string }> = ({ count, activeTone = 'bg-indigo-500/20 dark:bg-indigo-500/20' }) => (
  <div className="space-y-2">
    <Block className={`h-11 w-full rounded-xl ${activeTone}`} />
    {Array.from({ length: count - 1 }).map((_, index) => (
      <Block key={index} className="h-11 w-full rounded-xl" />
    ))}
  </div>
);

/**
 * Replica a faixa promocional superior usada no shell público da plataforma.
 */
const PromoStrip = () => (
  <div className="flex items-center justify-center gap-3 border-b border-white/10 bg-slate-900 px-6 py-2.5 dark:bg-indigo-950">
    <Block className="h-3 w-48 rounded-full bg-white/15" />
    <Block className="h-7 w-24 rounded-full bg-white/15" />
  </div>
);

/**
 * Skeleton do painel administrativo e do painel de parceiros.
 * Ele preserva a sensacao de shell fixo dessas areas mesmo quando a rota interna ainda esta carregando.
 */
const PanelFallback: React.FC<{ accent: 'rose' | 'indigo' }> = ({ accent }) => {
  const accentBox = accent === 'rose' ? 'bg-rose-100 dark:bg-rose-900/30' : 'bg-indigo-100 dark:bg-indigo-900/30';
  const activeTone = accent === 'rose' ? 'bg-rose-500/15 dark:bg-rose-500/20' : 'bg-indigo-500/20 dark:bg-indigo-500/20';

  return (
    <div className="flex h-[100dvh] max-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside className="hidden h-[100dvh] max-h-screen w-64 flex-none border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:fixed md:z-50 md:flex md:flex-col">
        <div className="border-b border-slate-50 p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Block className={`h-10 w-10 rounded-xl ${accentBox}`} />
            <div className="space-y-2">
              <Block className="h-4 w-28" />
              <Block className="h-3 w-24 bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <SidebarItems count={6} activeTone={activeTone} />
        </div>

        <div className="space-y-4 border-t border-slate-50 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <Block className="h-10 w-10 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/20" />
            <div className="flex-1 space-y-2">
              <Block className="h-3 w-24" />
              <Block className="h-3 w-36" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Block className="h-11 w-full rounded-xl" />
            <Block className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:ml-64">
        <header className="border-b border-slate-200 bg-slate-50/80 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
            <Block className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900" />
            <Block className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900" />
            <Block className="h-8 w-px rounded-none bg-slate-200 dark:bg-slate-800" />
            <Block className="h-10 w-44 rounded-full bg-slate-900/10 dark:bg-indigo-500/20" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">
            <div className="space-y-3">
              <Block className="h-5 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
              <Block className="h-10 w-72 rounded-[2rem]" />
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Block key={index} className="h-36 w-full rounded-[2rem] bg-white dark:bg-slate-900" />
              ))}
            </div>
            <Block className="h-80 w-full rounded-[2rem] bg-white dark:bg-slate-900" />
          </div>
        </main>
      </div>
    </div>
  );
};

/**
 * Skeleton do shell autenticado principal com sidebar, cabeçalho e area central de conteúdo.
 * Ele e usado nas paginas internas que compartilham o Layout oficial do site.
 */
const AppLayoutFallback = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
    <PromoStrip />

    <div className="flex min-h-[calc(100vh-42px)] flex-col md:flex-row">
      <aside className="hidden w-64 flex-none border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex md:flex-col">
        <div className="flex items-center gap-3 px-6 py-7">
          <Block className="h-9 w-9 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30" />
          <Block className="h-6 w-40 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="mx-4 mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <Block className="h-10 w-10 rounded-full bg-indigo-500/20 dark:bg-indigo-500/20" />
            <div className="space-y-2">
              <Block className="h-3 w-24" />
              <Block className="h-3 w-16" />
            </div>
          </div>
        </div>

        <div className="px-4">
          <SidebarItems count={7} />
        </div>

        <div className="mx-4 mt-6 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
          <Block className="mb-2 h-3 w-20 bg-white/20" />
          <Block className="mb-2 h-6 w-28 bg-white/20" />
          <Lines widths={['w-full', 'w-24']} tone="bg-white/20" />
        </div>

        <div className="mt-auto border-t border-slate-100 p-4 dark:border-slate-800">
          <Block className="mb-3 h-10 w-full rounded-xl bg-slate-900/10 dark:bg-slate-800" />
          <Block className="h-10 w-full rounded-xl bg-slate-900/10 dark:bg-slate-800" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Block className="h-9 w-9 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30" />
              <Block className="h-5 w-36 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Block className="h-10 w-10 rounded-xl" />
              <Block className="h-10 w-10 rounded-xl" />
              <Block className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="hidden justify-end p-4 px-8 md:flex">
          <div className="flex items-center gap-4">
            <Block className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900" />
            <Block className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900" />
            <Block className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900" />
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6 dark:border-slate-800">
              <div className="space-y-2">
                <Block className="h-3 w-24" />
                <Block className="h-3 w-16" />
              </div>
              <Block className="h-9 w-9 rounded-full bg-slate-900/10 dark:bg-indigo-500/20" />
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className={`mx-auto flex ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} flex-col gap-8 pb-10`}>
            <Block className="h-24 w-full rounded-[2rem] bg-gradient-to-r from-slate-200/80 to-slate-100 dark:from-slate-800 dark:to-slate-900" />

            <section className="space-y-5">
              <div className="space-y-3">
                <Block className="h-10 w-72 rounded-[2rem]" />
                <Block className="h-4 w-56" />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Block key={index} className="h-44 w-full rounded-[2rem] bg-white dark:bg-slate-900" />
                ))}
              </div>
            </section>

            <Block className="h-[360px] w-full rounded-[2rem] bg-white dark:bg-slate-900" />
            <Block className="h-24 w-full rounded-[2rem] bg-gradient-to-r from-slate-200/80 to-slate-100 dark:from-slate-800 dark:to-slate-900" />

            <footer className="border-t border-slate-200 pt-8 dark:border-slate-800">
              <div className="grid gap-8 md:grid-cols-[1.2fr_repeat(3,0.8fr)]">
                <div className="space-y-3">
                  <Block className="h-6 w-40 rounded-full" />
                  <Lines widths={['w-56', 'w-48']} />
                </div>
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3">
                    <Block className="h-3 w-20 rounded-full" />
                    <Lines widths={['w-28', 'w-24', 'w-20']} />
                  </div>
                ))}
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  </div>
);

/**
 * Skeleton da experiencia de autenticação.
 * Mantem a leitura visual proxima do fluxo real de login, cadastro e recuperacao de senha.
 */
const AuthFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-slate-900">
    <div className="flex min-h-screen">
      <div className="hidden w-5/12 flex-col justify-center bg-indigo-600 p-16 lg:flex">
        <div className="space-y-8 text-white">
          <div className="flex items-center gap-3">
            <Block className="h-10 w-10 rounded-2xl bg-white/15" />
            <Block className="h-8 w-44 rounded-full bg-white/15" />
          </div>
          <div className="space-y-4">
            <Block className="h-14 w-96 rounded-[2rem] bg-white/15" />
            <Block className="h-14 w-72 rounded-[2rem] bg-white/15" />
          </div>
          <Lines widths={['w-80', 'w-72', 'w-60']} tone="bg-white/15" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Block key={index} className="h-5 w-56 rounded-full bg-white/15" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex justify-center lg:hidden">
            <Block className="h-10 w-52 rounded-full bg-indigo-200/50 dark:bg-indigo-900/30" />
          </div>

          <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
            <div className="mb-8 space-y-3">
              <Block className="h-9 w-60 rounded-[2rem]" />
              <Block className="h-4 w-44" />
            </div>
            <div className="space-y-4">
              <Block className="h-12 w-full rounded-2xl" />
              <Block className="h-12 w-full rounded-2xl" />
              <Block className="h-12 w-full rounded-2xl" />
              <Block className="h-14 w-full rounded-2xl bg-indigo-500/20 dark:bg-indigo-500/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton dedicado da confirmacao de e-mail.
 * Ele evita o flash visual do layout de login durante a validacao do token.
 */
const ConfirmEmailFallback = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
    <div className="mb-8 flex items-center gap-2 text-xl font-bold text-indigo-600 dark:text-indigo-400">
      <Block className="h-7 w-7 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30" />
      <Block className="h-7 w-44 rounded-full bg-indigo-200/50 dark:bg-indigo-900/30" />
    </div>

    <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col items-center space-y-6 py-8">
        <Block className="h-20 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
        <div className="space-y-3">
          <Block className="mx-auto h-8 w-52 rounded-[2rem]" />
          <Block className="mx-auto h-4 w-64" />
          <Block className="mx-auto h-4 w-56" />
        </div>
        <div className="w-full space-y-3 pt-2">
          <Block className="h-12 w-full rounded-2xl bg-indigo-500/20 dark:bg-indigo-500/20" />
          <Block className="mx-auto h-4 w-32" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton das paginas de marketing e descoberta, como landing e promos.
 * O objetivo e manter hero, CTA e prova social com a mesma hierarquia da plataforma pública.
 */
const MarketingFallback = () => (
  <div className="min-h-screen bg-white dark:bg-slate-950">
    <PromoStrip />

    <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-900 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Block className="h-9 w-9 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30" />
          <Block className="h-6 w-44 rounded-full" />
        </div>
        <div className="hidden items-center gap-5 md:flex">
          <Block className="h-4 w-14" />
          <Block className="h-4 w-20" />
          <Block className="h-4 w-20" />
          <Block className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-3">
          <Block className="h-10 w-20 rounded-xl" />
          <Block className="h-11 w-36 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/20" />
        </div>
      </div>
    </div>

    <section className="px-6 pb-28 pt-20">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center">
        <Block className="h-7 w-56 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
        <div className="space-y-4">
          <Block className="mx-auto h-14 w-full max-w-4xl rounded-[2rem]" />
          <Block className="mx-auto h-14 w-4/5 max-w-3xl rounded-[2rem]" />
        </div>
        <Lines widths={['w-full max-w-3xl mx-auto', 'w-5/6 max-w-2xl mx-auto', 'w-2/3 max-w-xl mx-auto']} />
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Block className="h-14 w-72 rounded-[2rem] bg-indigo-500/20 dark:bg-indigo-500/20" />
          <Block className="h-14 w-56 rounded-[2rem]" />
        </div>

        <div className="mt-6 w-full max-w-6xl rounded-[2.5rem] border border-white/15 bg-slate-900/95 p-4 shadow-2xl">
          <Block className="h-[420px] w-full rounded-[2rem] bg-white/10" />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Block key={index} className="h-8 w-28 rounded-full bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    </section>

    <section className="bg-slate-950 px-6 py-16">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-3 text-center">
            <Block className="mx-auto h-8 w-8 rounded-full bg-white/10" />
            <Block className="mx-auto h-10 w-24 rounded-[2rem] bg-white/10" />
            <Block className="mx-auto h-3 w-28 rounded-full bg-white/10" />
          </div>
        ))}
      </div>
    </section>
  </div>
);

/**
 * Skeleton das paginas documentais, como termos e privacidade.
 */
const DocumentFallback = () => (
  <div className="min-h-screen bg-white dark:bg-slate-950">
    <div className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 px-6 py-4 backdrop-blur dark:border-slate-900 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Block className="h-9 w-9 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30" />
          <Block className="h-6 w-40 rounded-full" />
        </div>
        <Block className="h-10 w-28 rounded-xl" />
      </div>
    </div>

    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900">
        <Block className="h-12 w-2/3 rounded-[2rem]" />
        <Lines widths={['w-full', 'w-11/12', 'w-10/12', 'w-9/12']} />
        <Block className="h-px w-full rounded-none bg-slate-200 dark:bg-slate-800" />
        <Lines widths={['w-full', 'w-full', 'w-11/12', 'w-10/12', 'w-8/12']} />
      </div>
    </main>
  </div>
);

/**
 * Skeleton do checkout, refletindo a separacao entre resumo da compra e formulário.
 */
const CheckoutFallback = () => (
  <div className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-4 rounded-[2.5rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <Block className="h-6 w-32 rounded-full" />
        <Block className="h-28 w-full rounded-[2rem]" />
        <Block className="h-28 w-full rounded-[2rem]" />
      </div>
      <div className="space-y-5 rounded-[2.5rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <Block className="h-10 w-72 rounded-[2rem]" />
        <Block className="h-12 w-full rounded-2xl" />
        <Block className="h-12 w-full rounded-2xl" />
        <Block className="h-12 w-full rounded-2xl" />
        <Block className="h-14 w-full rounded-2xl bg-indigo-500/20 dark:bg-indigo-500/20" />
      </div>
    </div>
  </div>
);

/**
 * Skeleton do leitor de materiais, preservando o shell focado do reader.
 */
const ReaderFallback = () => (
  <div className="min-h-screen bg-slate-950">
    <header className="border-b border-slate-800 bg-slate-900 px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Block className="h-10 w-10 rounded-xl bg-slate-800" />
          <Block className="h-5 w-56 rounded-full bg-slate-800" />
        </div>
        <div className="flex items-center gap-2">
          <Block className="h-10 w-10 rounded-xl bg-slate-800" />
          <Block className="h-10 w-10 rounded-xl bg-slate-800" />
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-[2rem] bg-slate-900 p-4">
        <Block className="h-[75vh] w-full rounded-[1.5rem] bg-slate-800" />
      </div>
    </main>
  </div>
);

/**
 * Fallback local das rotas com Layout.
 * Ele substitui apenas a area central da pagina para que a sidebar e o shell real não sumam durante a transicao.
 */
export const LayoutContentRouteFallback: React.FC = () => (
  <div className="flex flex-col gap-8 animate-pulse">
    <div className="space-y-3">
      <Block className="h-5 w-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
      <Block className="h-10 w-72 rounded-[2rem]" />
      <Block className="h-4 w-56" />
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Block key={index} className="h-44 w-full rounded-[2rem] bg-white dark:bg-slate-900" />
      ))}
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Block className="h-[360px] w-full rounded-[2rem] bg-white dark:bg-slate-900" />
      <div className="grid gap-6">
        <Block className="h-[168px] w-full rounded-[2rem] bg-white dark:bg-slate-900" />
        <Block className="h-[168px] w-full rounded-[2rem] bg-white dark:bg-slate-900" />
      </div>
    </div>

    <Block className="h-24 w-full rounded-[2rem] bg-gradient-to-r from-slate-200/80 to-slate-100 dark:from-slate-800 dark:to-slate-900" />
  </div>
);

/**
 * Decide qual skeleton mostrar com base na rota atual e no estado de autenticação.
 * Esse componente fica ligado diretamente ao roteador oficial e garante que cada transicao se pareca com a pagina real.
 */
interface RouteSuspenseFallbackProps {
  pathnameOverride?: string;
  currentUserOverride?: UserProfile | null;
  preferAppLayoutAtRoot?: boolean;
}

const RouteSuspenseFallback: React.FC<RouteSuspenseFallbackProps> = ({
  pathnameOverride,
  currentUserOverride,
  preferAppLayoutAtRoot = false,
}) => {
  const location = useLocation();
  const { currentUser: authCurrentUser } = useAuth();
  const pathname = pathnameOverride || location.pathname;
  const currentUser = currentUserOverride !== undefined ? currentUserOverride : authCurrentUser;

  if (pathname.startsWith('/admin')) {
    return <PanelFallback accent="rose" />;
  }

  if (pathname.startsWith('/partner-dashboard')) {
    return <PanelFallback accent="indigo" />;
  }

  if (AUTH_PATHS.has(pathname)) {
    if (pathname === '/confirm-email') {
      return <ConfirmEmailFallback />;
    }

    return <AuthFallback />;
  }

  if (DOCUMENT_PATHS.has(pathname)) {
    return <DocumentFallback />;
  }

  if (pathname.startsWith('/checkout')) {
    return <CheckoutFallback />;
  }

  if (pathname.startsWith('/read/')) {
    return <ReaderFallback />;
  }

  if (pathname === '/' && !currentUser && !preferAppLayoutAtRoot) {
    return <MarketingFallback />;
  }

  if (pathname === '/' || usesAppLayout(pathname)) {
    return <AppLayoutFallback />;
  }

  return currentUser ? <AppLayoutFallback /> : <MarketingFallback />;
};

export default RouteSuspenseFallback;
