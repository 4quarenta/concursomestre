'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Clock3, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { buildProfilePath } from '../../profile/profileNavigation';

const successStatuses = new Set(['success', 'approved', 'paid', 'complete', 'completed']);
const failureStatuses = new Set(['failure', 'failed', 'error', 'cancel', 'cancelled', 'canceled']);

export default function SubscriptionStatusPage() {
  const params = useParams<{ status?: string }>();
  const searchParams = useSearchParams();
  const { currentUser, isLoading, refreshUser } = useAuth();
  const [refreshAttempted, setRefreshAttempted] = React.useState(false);
  const rawStatus = String(params.status || 'success').toLowerCase();
  const isFailure = failureStatuses.has(rawStatus);
  const isSuccess = successStatuses.has(rawStatus) || !isFailure;
  const provider = String(searchParams.get('provider') || 'Stripe');

  React.useEffect(() => {
    if (!currentUser || refreshAttempted) {
      return;
    }

    setRefreshAttempted(true);
    void refreshUser();
  }, [currentUser, refreshAttempted, refreshUser]);

  const title = isSuccess ? 'Parabéns pela assinatura' : 'Checkout não concluído';
  const subtitle = isSuccess
    ? 'Recebemos o retorno do pagamento e estamos sincronizando seu acesso premium.'
    : 'Não foi possível confirmar sua assinatura neste retorno.';
  const description = isSuccess
    ? 'Se o pagamento já foi aprovado, seus recursos ficam disponíveis automaticamente. Você pode acompanhar o plano, cartões e transações em Minha assinatura.'
    : 'Você pode tentar novamente ou escolher outro método de pagamento. Nenhum acesso premium novo foi liberado por esta tentativa.';

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950 dark:bg-[#070b1a] dark:text-white sm:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-[#111827] dark:shadow-none">
          <div className={`relative overflow-hidden px-8 py-12 text-center text-white sm:px-12 ${
            isSuccess ? 'bg-slate-950' : 'bg-red-950'
          }`}>
            <div className={`absolute inset-0 ${
              isSuccess
                ? 'bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.28),transparent_38%)]'
                : 'bg-[radial-gradient(circle_at_center,rgba(248,113,113,0.24),transparent_38%)]'
            }`} />
            <div className="relative z-10">
              <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] shadow-2xl ${
                isSuccess
                  ? 'bg-emerald-500 shadow-emerald-500/30'
                  : 'bg-red-500 shadow-red-500/30'
              }`}>
                {isSuccess ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
              </div>
              <p className={`mt-6 text-[10px] font-black uppercase tracking-[0.24em] ${
                isSuccess ? 'text-emerald-200' : 'text-red-200'
              }`}>
                {isSuccess ? 'Pagamento aprovado' : 'Pagamento não confirmado'}
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-relaxed text-slate-300">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="grid border-b border-slate-100 dark:border-slate-800 md:grid-cols-3">
            <div className="border-t border-slate-100 px-6 py-5 first:border-t-0 dark:border-slate-800 md:border-l md:border-t-0 md:first:border-l-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Status</p>
              <p className="mt-3 text-lg font-black leading-none">{isSuccess ? 'Em sincronização' : 'Não concluído'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {isLoading ? 'Carregando sessão...' : currentUser ? 'Sessão identificada.' : 'Faça login para ver sua assinatura.'}
              </p>
            </div>
            <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-800 md:border-l md:border-t-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Provedor</p>
              <p className="mt-3 text-lg font-black leading-none">{provider}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Checkout seguro.</p>
            </div>
            <div className="border-t border-slate-100 px-6 py-5 dark:border-slate-800 md:border-l md:border-t-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Próximo passo</p>
              <p className="mt-3 text-lg font-black leading-none">{isSuccess ? 'Minha assinatura' : 'Planos'}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Acompanhe os detalhes.</p>
            </div>
          </div>

          <div className="space-y-6 px-8 py-8 sm:px-12">
            <p className="mx-auto max-w-2xl text-center text-sm font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Acesso',
                  hint: isSuccess ? 'Liberado assim que a Stripe confirmar.' : 'Nada foi alterado no seu plano.',
                  Icon: ShieldCheck,
                },
                {
                  label: 'Transação',
                  hint: isSuccess ? 'Registrada no histórico financeiro.' : 'Sem cobrança confirmada.',
                  Icon: CreditCard,
                },
                {
                  label: 'Sincronização',
                  hint: isSuccess ? 'Pode levar alguns segundos.' : 'Você pode tentar novamente.',
                  Icon: Clock3,
                },
              ].map(({ label, hint, Icon: LucideIcon }) => {
                return (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <LucideIcon size={18} className={isSuccess ? 'text-emerald-500' : 'text-red-400'} />
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">{hint}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={isSuccess ? buildProfilePath('billing') : '/plans'}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-700"
              >
                {isSuccess ? 'Ir para minha assinatura' : 'Escolher plano'}
                <ArrowRight size={16} />
              </Link>
              {!currentUser && (
                <Link
                  href="/auth"
                  className="inline-flex h-14 items-center justify-center rounded-2xl border border-slate-200 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Fazer login
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
