'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import BrandLink from '@/components/shared/BrandLink';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';

type SubscriptionStatus = 'failure' | 'pending' | 'success';

type SubscriptionStatusClientProps = {
  status: SubscriptionStatus;
};

const statusCopy: Record<SubscriptionStatus, {
  accentClassName: string;
  description: string;
  headline: string;
  icon: React.ComponentType<{ size?: number }>;
  primaryActionHref: string;
  primaryActionLabel: string;
  secondaryActionHref: string;
  secondaryActionLabel: string;
}> = {
  success: {
    accentClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    description: 'Recebemos a confirmacao do pagamento. Seu acesso premium esta sendo liberado e voce pode acompanhar os detalhes da cobranca na area da conta.',
    headline: 'Assinatura confirmada',
    icon: CheckCircle2,
    primaryActionHref: '/profile/billing',
    primaryActionLabel: 'Abrir minha assinatura',
    secondaryActionHref: '/planos',
    secondaryActionLabel: 'Ver planos',
  },
  pending: {
    accentClassName: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    description: 'O pagamento ainda esta em processamento. Em geral a plataforma atualiza automaticamente assim que a operadora conclui a confirmacao.',
    headline: 'Pagamento em analise',
    icon: Clock3,
    primaryActionHref: '/profile/billing',
    primaryActionLabel: 'Acompanhar cobranca',
    secondaryActionHref: '/support',
    secondaryActionLabel: 'Falar com suporte',
  },
  failure: {
    accentClassName: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    description: 'Nao conseguimos concluir a cobranca. Voce pode revisar a forma de pagamento, escolher outro plano ou tentar novamente em seguida.',
    headline: 'Pagamento nao aprovado',
    icon: AlertTriangle,
    primaryActionHref: '/planos',
    primaryActionLabel: 'Tentar novamente',
    secondaryActionHref: '/support',
    secondaryActionLabel: 'Preciso de ajuda',
  },
};

export default function SubscriptionStatusClient({ status }: SubscriptionStatusClientProps) {
  const router = useRouter();
  const { currentUser, isAuthenticated } = useAuthSession();
  const copy = statusCopy[status];
  const StatusIcon = copy.icon;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="mx-auto flex min-h-[80vh] max-w-2xl flex-col items-center justify-center">
        <BrandLink className="mb-8" />

        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full border ${copy.accentClassName}`}>
            <StatusIcon size={38} />
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">{copy.headline}</h1>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              {copy.description}
            </p>
          </div>

          <div className={`mt-8 rounded-[1.5rem] border px-5 py-4 text-sm font-semibold ${copy.accentClassName}`}>
            {isAuthenticated && currentUser
              ? `Conta conectada: ${currentUser.email}.`
              : 'Se voce ainda nao estiver logado, entre na sua conta para acompanhar a assinatura.'}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push(
                isAuthenticated
                  ? copy.primaryActionHref
                  : `/auth?mode=login&redirect=${encodeURIComponent(copy.primaryActionHref)}`,
              )}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700"
            >
              {copy.primaryActionLabel}
              <ArrowRight size={16} />
            </button>

            <Link
              href={copy.secondaryActionHref}
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {copy.secondaryActionLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
