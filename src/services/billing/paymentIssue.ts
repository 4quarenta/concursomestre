import type { UserProfile } from '@types';
import { hasActivePlanAccess } from '@services/plans/planAccess';

export type ResolvedPaymentIssue = NonNullable<UserProfile['paymentIssue']>;

const DEFAULT_PAYMENT_ISSUE: ResolvedPaymentIssue = {
  type: 'no_card',
  code: 'missing_required_card',
  severity: 'warning',
  interactionLock: false,
  actionLabel: 'Cadastrar cartao',
  actionTarget: '/profile/personal#saved-cards-personal-section',
  message: 'Nenhum cartao de pagamento encontrado para sua assinatura ativa. Por favor, cadastre um cartao.',
};

const PAST_DUE_PAYMENT_ISSUE: ResolvedPaymentIssue = {
  type: 'past_due',
  code: 'payment_past_due',
  severity: 'blocking',
  interactionLock: true,
  actionLabel: 'Regularizar pagamento',
  actionTarget: '/profile/billing',
  message: 'Existe uma fatura em aberto na sua assinatura. Regularize o pagamento para desbloquear novamente os recursos premium.',
  blockingReason: 'past_due',
};

const hasBlockingCycle = (user: UserProfile): boolean => {
  const billingCycle = String(user.billing?.billingCycle || '').toLowerCase();
  const intervalUnit = String(user.subscription?.plan?.interval_unit || '').toLowerCase();
  const intervalCount = Math.max(1, Number(user.subscription?.plan?.interval_count || 1));
  const totalInstallments = Math.max(1, Number(user.subscription?.total_installments || 1));

  return billingCycle === 'quarterly'
    || billingCycle === 'annual'
    || intervalUnit === 'year'
    || intervalCount >= 3
    || totalInstallments >= 3;
};

export const resolveUserPaymentIssue = (user?: UserProfile | null): ResolvedPaymentIssue | null => {
  if (!user) {
    return null;
  }

  if (user.subscription?.payment_blocking || user.subscription?.status === 'past_due') {
    return {
      ...PAST_DUE_PAYMENT_ISSUE,
      ...(user.paymentIssue || {}),
      blockingReason: user.subscription?.payment_block_reason || user.paymentIssue?.blockingReason || 'past_due',
    };
  }

  if (user.paymentIssue) {
    return {
      ...DEFAULT_PAYMENT_ISSUE,
      ...user.paymentIssue,
    };
  }

  if (!hasActivePlanAccess(user) || user.hasSavedCard) {
    return null;
  }

  const blocking = hasBlockingCycle(user);

  return {
    ...DEFAULT_PAYMENT_ISSUE,
    severity: blocking ? 'blocking' : 'warning',
    interactionLock: blocking,
  };
};
