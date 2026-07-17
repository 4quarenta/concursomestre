import type { UserProfile } from '@types';
import { hasActivePlanAccess } from '@services/plans/planAccess';
import type { PaymentStatus } from './paymentStatus';

export type ResolvedPaymentIssue = NonNullable<UserProfile['paymentIssue']>;

const DEFAULT_PAYMENT_ISSUE: ResolvedPaymentIssue = {
  type: 'no_card',
  code: 'missing_required_card',
  severity: 'warning',
  interactionLock: false,
  actionLabel: 'Cadastrar cartão',
  actionTarget: '/profile/personal#saved-cards-personal-section',
  message: 'Nenhum cartão de pagamento encontrado para sua assinatura ativa. Por favor, cadastre um cartão.',
};

const MANUAL_GIFT_PAYMENT_ISSUE: ResolvedPaymentIssue = {
  type: 'manual_gift_no_card',
  code: 'manual_gift_missing_card',
  severity: 'warning',
  interactionLock: false,
  actionLabel: 'Cadastrar cartão para renovar',
  actionTarget: '/profile/personal#saved-cards-personal-section',
  message: 'Você recebeu um período grátis de presente. Para continuar usando os benefícios no próximo ciclo, adicione um cartão; ele só será usado na renovação.',
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

const EXPIRED_CARD_PAYMENT_ISSUE: ResolvedPaymentIssue = {
  type: 'expired_card',
  code: 'card_expired',
  severity: 'blocking',
  interactionLock: true,
  actionLabel: 'Atualizar cartão',
  actionTarget: '/profile/personal#saved-cards-personal-section',
  message: 'O cartão da sua assinatura expirou. Atualize seus dados para desbloquear novamente os recursos premium.',
  blockingReason: 'expired_card',
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

const isManualGiftSubscription = (user: UserProfile): boolean => (
  String(user.subscription?.payment_provider || '').toLowerCase() === 'manual_admin'
);

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
    if (user.paymentIssue.type === 'manual_gift_no_card' || user.paymentIssue.code === 'manual_gift_missing_card') {
      return {
        ...MANUAL_GIFT_PAYMENT_ISSUE,
        ...user.paymentIssue,
        severity: 'warning',
        interactionLock: false,
      };
    }

    if (user.paymentIssue.type === 'expired_card' || user.paymentIssue.code === 'card_expired') {
      return {
        ...EXPIRED_CARD_PAYMENT_ISSUE,
        ...user.paymentIssue,
        severity: 'blocking',
        interactionLock: true,
        blockingReason: user.paymentIssue.blockingReason || 'expired_card',
      };
    }

    return {
      ...DEFAULT_PAYMENT_ISSUE,
      ...user.paymentIssue,
    };
  }

  if (!hasActivePlanAccess(user) || user.hasSavedCard || user.hasSavedCard === undefined) {
    return null;
  }

  if (isManualGiftSubscription(user)) {
    const planName = user.planDisplayName || user.subscription?.plan?.name || user.plan || 'plano premium';
    return {
      ...MANUAL_GIFT_PAYMENT_ISSUE,
      message: `Você recebeu uma cortesia do ${planName}. Para continuar usando os benefícios no próximo ciclo, adicione um cartão; ele só será usado na renovação.`,
    };
  }

  const blocking = hasBlockingCycle(user);

  return {
    ...DEFAULT_PAYMENT_ISSUE,
    severity: blocking ? 'blocking' : 'warning',
    interactionLock: blocking,
  };
};

/**
 * Traduz exclusivamente o contrato financeiro autoritativo em mensagem de UI.
 * A ausência, o carregamento ou uma falha HTTP retornam `null` e nunca um falso
 * diagnóstico de cartão ausente.
 */
export const resolvePaymentStatusIssue = (status?: PaymentStatus | null): ResolvedPaymentIssue | null => {
  if (!status) return null;

  if (status.subscriptionStatus === 'past_due' || status.actionRequired === 'payment_failed') {
    return PAST_DUE_PAYMENT_ISSUE;
  }

  if (
    status.subscriptionStatus !== 'active'
    || status.requiresPaymentMethod !== true
    || status.hasValidPaymentMethod !== false
    || status.actionRequired === null
  ) {
    return null;
  }

  if (status.actionRequired === 'replace_expired_payment_method') {
    return EXPIRED_CARD_PAYMENT_ISSUE;
  }

  if (status.actionRequired === 'add_payment_method' || status.actionRequired === 'authentication_required') {
    return DEFAULT_PAYMENT_ISSUE;
  }

  return null;
};
