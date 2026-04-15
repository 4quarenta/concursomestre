import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/providers/AuthProvider';
import { readApiErrorMessage } from '@/services/api/response';
import { cardsService } from '@/services/billing/cardsService';
import { formatMaskedCardLabelAscii } from '@/services/billing/cardDisplay';
import { subscriptionsService } from '@/services/subscriptions/subscriptionsService';
import { transactionsService } from '@/services/transactions/transactionsService';
import { colors } from '@/theme/colors';
import type { SavedCard } from '@/types/billing';
import type { MobileTransaction } from '@/types/transactions';

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  }
  return Boolean(value);
};

const cancelReasonOptions = [
  { value: 'price', label: 'Valor da assinatura' },
  { value: 'usage', label: 'Nao estou usando o suficiente' },
  { value: 'technical', label: 'Problemas tecnicos' },
  { value: 'content', label: 'Falta de conteudos especificos' },
  { value: 'other', label: 'Outros motivos' },
];

const hasActiveSubscriptionStatus = (status?: string): boolean => {
  const normalized = String(status || '').toLowerCase();
  return ['active', 'trialing', 'past_due'].includes(normalized);
};

const parseDate = (rawValue?: string | number): Date | null => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  const numeric = Number(rawValue);
  const parsed = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
    : new Date(String(rawValue));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const diffInDays = (start: Date, end: Date): number => {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

const formatDate = (rawValue?: string | number): string => {
  const parsed = parseDate(rawValue);
  if (!parsed) return '--';
  return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const formatDateTime = (rawValue?: string | number): string => {
  const parsed = parseDate(rawValue);
  if (!parsed) return '--';
  return parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const getSubscriptionDaysSinceStart = (rawValue?: string | number): number | null => {
  const start = parseDate(rawValue);
  if (!start) return null;

  const now = Date.now();
  const diffMs = now - start.getTime();
  if (diffMs < 0) return 0;

  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
};

const formatCurrency = (value: number | string): string => {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(amount) ? amount : 0);
};

const stripPlanCycleSuffix = (value?: string | null) =>
  String(value || '')
    .replace(/\s*-\s*Mensal$/i, '')
    .replace(/\s*-\s*Trimestral$/i, '')
    .replace(/\s*-\s*Anual$/i, '')
    .trim();

const resolveTransactionPlanName = (tx: MobileTransaction): string => {
  const name = stripPlanCycleSuffix(tx.planName || tx.transactionName || tx.description || 'Assinatura');
  return name || 'Assinatura';
};

const resolveTransactionCycleLabel = (tx: MobileTransaction): string => {
  const explicit = String(
    tx.cycleLabel
    || tx.planCycleLabel
    || tx.billingCycleLabel
    || tx.billingCycle
    || '',
  ).trim();
  const explicitNormalized = explicit.toLowerCase();

  if (
    explicit
    && explicitNormalized !== 'nao informado'
    && explicitNormalized !== '-'
  ) {
    return explicit;
  }

  const intervalUnit = String(tx.intervalUnit || tx.interval_unit || '').toLowerCase();
  const intervalCount = Number(tx.intervalCount || tx.interval_count || 1);
  const planLikeLabel = String(tx.planName || tx.transactionName || tx.description || '').toLowerCase();

  if (intervalUnit === 'year') return 'Anual';
  if (intervalUnit === 'month' && intervalCount === 3) return 'Trimestral';
  if (intervalUnit === 'month') return 'Mensal';
  if (intervalUnit === 'week') return 'Semanal';
  if (intervalUnit === 'day') return 'Diario';
  if (planLikeLabel.includes('anual')) return 'Anual';
  if (planLikeLabel.includes('trimestral')) return 'Trimestral';
  if (planLikeLabel.includes('mensal')) return 'Mensal';

  return 'Nao informado';
};

const resolveTransactionGatewayLabel = (tx: MobileTransaction): string => {
  const provider = String(
    tx.paymentProvider
    || tx.payment_provider
    || tx.provider
    || tx.gateway
    || '',
  ).trim();
  if (!provider) return 'Nao informado';
  if (provider.toLowerCase() === 'stripe') return 'Stripe';
  return provider;
};

const resolveTransactionMethodLabel = (tx: MobileTransaction): string => {
  const explicit = String(
    tx.paymentMethodLabel
    || tx.paymentMethod
    || tx.payment_method
    || '',
  ).trim();
  if (explicit) return explicit;

  const fallback = String(tx.paymentMethodType || tx.method || '').toLowerCase();
  if (fallback === 'card') return 'Cartao';
  if (fallback === 'pix') return 'Pix';
  if (fallback === 'boleto') return 'Boleto';
  return 'Nao informado';
};

const canRequestRefundForStatus = (status?: string): boolean => {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'approved' || normalized === 'completed';
};

const canCancelRefundForStatus = (status?: string): boolean => (
  String(status || '').toLowerCase() === 'refund_requested'
);

const resolveTransactionInvoiceUrl = (tx: MobileTransaction): string => (
  String(tx.invoicePdfUrl || tx.hostedInvoiceUrl || '').trim()
);

const getTransactionStatusMeta = (status?: string) => {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'approved' || normalized === 'completed') {
    return {
      label: 'Aprovado',
      bg: '#ECFDF3',
      color: '#047857',
      border: '#A7F3D0',
    };
  }

  if (normalized === 'refund_requested') {
    return {
      label: 'Reembolso em analise',
      bg: '#FFFBEB',
      color: '#B45309',
      border: '#FCD34D',
    };
  }

  if (normalized === 'refunded') {
    return {
      label: 'Reembolsado',
      bg: '#EEF2FF',
      color: '#4338CA',
      border: '#C7D2FE',
    };
  }

  if (normalized === 'pending' || normalized === 'pre-approved') {
    return {
      label: normalized === 'pre-approved' ? 'Pre-aprovada' : 'Pendente',
      bg: '#FFFBEB',
      color: '#B45309',
      border: '#FCD34D',
    };
  }

  if (normalized === 'rejected') {
    return {
      label: 'Recusado',
      bg: '#FEF2F2',
      color: '#B91C1C',
      border: '#FECACA',
    };
  }

  return {
    label: 'Cancelado',
    bg: '#F8FAFC',
    color: '#475569',
    border: '#CBD5E1',
  };
};

const getCardExpiryState = (card?: SavedCard | null) => {
  if (!card?.exp_month || !card?.exp_year) {
    return { isExpired: false, isExpiringSoon: false };
  }

  const now = new Date();
  const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
  const expiryMonthIndex = (Number(card.exp_year) * 12) + (Number(card.exp_month) - 1);
  const remainingMonths = expiryMonthIndex - currentMonthIndex;

  return {
    isExpired: remainingMonths < 0,
    isExpiringSoon: remainingMonths >= 0 && remainingMonths <= 1,
  };
};

/**
 * Perfil mobile com assinatura, cartoes Stripe e historico de transacoes.
 * @since v1.0.0
 */
export const ProfileScreen: React.FC = () => {
  const { user, logout, isLoading, refreshProfile } = useAuth();
  const [cards, setCards] = React.useState<SavedCard[]>([]);
  const [transactions, setTransactions] = React.useState<MobileTransaction[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [loadingTransactions, setLoadingTransactions] = React.useState(false);
  const [cardsError, setCardsError] = React.useState<string | null>(null);
  const [transactionsError, setTransactionsError] = React.useState<string | null>(null);
  const [updatingCardId, setUpdatingCardId] = React.useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = React.useState(false);
  const [updatingRenewal, setUpdatingRenewal] = React.useState(false);
  const [updatingRefundId, setUpdatingRefundId] = React.useState<string | null>(null);
  const [updatingSubscriptionAction, setUpdatingSubscriptionAction] = React.useState(false);
  const [showCancelForm, setShowCancelForm] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [cancelDetails, setCancelDetails] = React.useState('');

  const activeSubscription = hasActiveSubscriptionStatus(user?.subscription?.status);
  const hasCancelAtPeriodEndFlag = typeof user?.subscription?.cancel_at_period_end === 'boolean';
  const renewalEnabled = hasCancelAtPeriodEndFlag
    ? !toBoolean(user?.subscription?.cancel_at_period_end)
    : toBoolean(user?.subscription?.auto_renew);
  const cancelAtPeriodEnd = toBoolean(user?.subscription?.cancel_at_period_end);
  const subscriptionCancelPending = activeSubscription && cancelAtPeriodEnd;
  const subscriptionDaysSinceStart = getSubscriptionDaysSinceStart(user?.subscription?.current_period_start);
  const withinRefundWindow = subscriptionDaysSinceStart !== null && subscriptionDaysSinceStart <= 7;
  const subscriptionPlanName = user?.subscription?.plan?.name || user?.plan || 'Gratuito';
  const totalInstallments = Math.max(1, Number(user?.subscription?.total_installments || 1));
  const paidInstallments = Math.max(0, Number(user?.subscription?.paid_installments || 0));
  const currentInstallment = totalInstallments > 1
    ? Math.min(Math.max(paidInstallments, 1), totalInstallments)
    : 1;
  const termCommitmentRemaining = totalInstallments > 1 && paidInstallments < totalInstallments;
  const subscriptionStartAt = parseDate(user?.subscription?.current_period_start);
  const subscriptionEndAt = parseDate(user?.subscription?.current_period_end);
  const subscriptionNextChargeAt = parseDate(user?.subscription?.next_billing_at) || subscriptionEndAt;
  const subscriptionTotalDays = (
    subscriptionStartAt
    && subscriptionEndAt
    && subscriptionEndAt.getTime() > subscriptionStartAt.getTime()
  )
    ? diffInDays(subscriptionStartAt, subscriptionEndAt)
    : 0;
  const subscriptionUsedDays = (
    subscriptionStartAt
    && subscriptionEndAt
    && subscriptionEndAt.getTime() > subscriptionStartAt.getTime()
  )
    ? Math.min(
      subscriptionTotalDays,
      Math.max(0, diffInDays(subscriptionStartAt, new Date())),
    )
    : 0;
  const subscriptionRemainingDays = Math.max(0, subscriptionTotalDays - subscriptionUsedDays);
  const subscriptionProgressPercent = subscriptionTotalDays > 0
    ? Math.max(0, Math.min(100, Math.round((subscriptionUsedDays / subscriptionTotalDays) * 100)))
    : 0;
  const recurringAmount = Number(user?.subscription?.recurring_amount || 0);
  const subscriptionChargeAmount = recurringAmount > 0
    ? recurringAmount
    : Number(user?.subscription?.plan?.price || 0);
  const subscriptionValueDescription = totalInstallments > 1
    ? `Parcela ${currentInstallment} de ${totalInstallments} do termo contratado.`
    : 'Cobranca recorrente por ciclo ativo.';
  const subscriptionHeadline = activeSubscription
    ? (renewalEnabled
      ? `Renovacao automatica ligada. Proxima cobranca prevista para ${formatDate(subscriptionNextChargeAt?.getTime())}.`
      : (termCommitmentRemaining
        ? 'Renovacao desligada. O termo atual segue ate a ultima parcela contratada.'
        : `Renovacao desligada. Seu acesso segue ativo ate ${formatDate(subscriptionEndAt?.getTime())}.`))
    : 'Sem assinatura ativa no momento.';
  const hasPendingRefundRequest = React.useMemo(
    () => transactions.some((transaction) => String(transaction.status || '').toLowerCase() === 'refund_requested'),
    [transactions],
  );
  const billingStatusLabel = hasPendingRefundRequest
    ? 'Reembolso em analise'
    : activeSubscription
      ? 'Acesso liberado'
      : 'Assinatura inativa';
  const billingStatusDescription = hasPendingRefundRequest
    ? 'Sua solicitacao esta em andamento e atualizaremos o historico apos retorno do gateway.'
    : activeSubscription
      ? 'Seu acesso premium esta liberado e o ciclo atual segue normalmente.'
      : 'Sua assinatura nao esta ativa no momento.';
  const cycleSummaryLabel = activeSubscription
    ? formatDate(subscriptionEndAt?.getTime())
    : 'Indeterminado';
  const cycleSummaryDescription = activeSubscription
    ? `${subscriptionRemainingDays} dias restantes no ciclo atual.`
    : 'Sem ciclo de cobranca em andamento.';
  const paymentIssueMessage = String(user?.paymentIssue?.message || '').trim();
  const paymentIssueCode = String(user?.paymentIssue?.type || user?.paymentIssue?.code || '').toLowerCase();
  const hasPaymentIssue = Boolean(paymentIssueMessage || paymentIssueCode);
  const isExpiringCardIssue = paymentIssueCode.includes('expir') || paymentIssueCode.includes('card');

  const primaryCard = React.useMemo(
    () => cards.find((card) => toBoolean(card?.is_default)) || cards[0] || null,
    [cards],
  );
  const primaryCardExpiry = React.useMemo(() => getCardExpiryState(primaryCard), [primaryCard]);

  const loadCards = React.useCallback(async () => {
    if (!user?.id) return;

    setLoadingCards(true);
    setCardsError(null);
    try {
      const result = await cardsService.listSavedCards(user.id);
      setCards(result.cards || []);
    } catch (error: any) {
      setCardsError(error?.message || 'Nao foi possivel sincronizar cartoes agora.');
    } finally {
      setLoadingCards(false);
    }
  }, [user?.id]);

  const loadTransactions = React.useCallback(async () => {
    if (!user?.id) return;

    setLoadingTransactions(true);
    setTransactionsError(null);
    try {
      const rows = await transactionsService.list({
        userId: user.id,
        limit: 30,
      });
      setTransactions(rows);
    } catch (error: any) {
      setTransactionsError(error?.message || 'Nao foi possivel carregar transacoes agora.');
    } finally {
      setLoadingTransactions(false);
    }
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel sair.');
    }
  };

  const handleSetDefaultCard = async (cardId: string) => {
    setUpdatingCardId(cardId);
    try {
      const result = await cardsService.setDefaultSavedCard(cardId, user?.id);
      Alert.alert('Cartao atualizado', result.message || 'Cartao padrao atualizado.');
      await loadCards();
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel definir cartao padrao.');
    } finally {
      setUpdatingCardId(null);
    }
  };

  const handleRemoveCard = async (card: SavedCard) => {
    const cardId = String(card.id || '');
    if (!cardId) return;

    const isLockedByRecurring = toBoolean(card.locked_by_recurring);
    const isOnlyCard = cards.length <= 1;

    if (isLockedByRecurring || (isOnlyCard && activeSubscription)) {
      Alert.alert(
        'Cartao protegido',
        'Este cartao esta vinculado a assinatura ativa. Defina outro como padrao antes de remover.',
      );
      return;
    }

    Alert.alert(
      'Remover cartao',
      'Tem certeza que deseja remover este cartao?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setUpdatingCardId(cardId);
            try {
              const result = await cardsService.removeSavedCard(cardId, user?.id);
              Alert.alert('Cartao removido', result.message || 'Cartao removido com sucesso.');
              await loadCards();
            } catch (error: any) {
              Alert.alert('Erro', error?.message || 'Nao foi possivel remover cartao.');
            } finally {
              setUpdatingCardId(null);
            }
          },
        },
      ],
    );
  };

  const handleManageOnStripe = async () => {
    setOpeningPortal(true);
    try {
      const result = await subscriptionsService.createStripePortalSession();
      const canOpen = await Linking.canOpenURL(result.url);
      if (!canOpen) {
        throw new Error('Nao foi possivel abrir o portal da Stripe neste dispositivo.');
      }
      await Linking.openURL(result.url);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel abrir o portal da Stripe.');
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleRenewalToggle = async () => {
    if (!activeSubscription) {
      Alert.alert('Assinatura inativa', 'Ative um plano para usar a renovacao automatica.');
      return;
    }

    const nextAutoRenew = !renewalEnabled;
    if (nextAutoRenew && cards.length === 0) {
      Alert.alert(
        'Cartao obrigatorio',
        'Voce precisa de um cartao salvo para ativar a renovacao automatica.',
        [
          { text: 'Agora nao', style: 'cancel' },
          {
            text: 'Abrir Stripe',
            onPress: () => {
              void handleManageOnStripe();
            },
          },
        ],
      );
      return;
    }

    setUpdatingRenewal(true);
    try {
      const result = await subscriptionsService.updateRenewal(nextAutoRenew);
      Alert.alert(
        'Renovacao atualizada',
        result.message || (
          nextAutoRenew
            ? 'Renovacao automatica ativada.'
            : (termCommitmentRemaining
              ? 'Renovacao automatica desativada. A assinatura sera encerrada ao fim do termo contratado.'
              : 'Renovacao automatica desativada. A assinatura sera encerrada ao fim do periodo atual.')
        ),
      );
      await refreshProfile();
    } catch (error: any) {
      Alert.alert(
        'Erro',
        readApiErrorMessage(error, 'Nao foi possivel atualizar a renovacao automatica.'),
      );
    } finally {
      setUpdatingRenewal(false);
    }
  };

  const resetCancelForm = () => {
    setShowCancelForm(false);
    setCancelReason('');
    setCancelDetails('');
  };

  const executeCancelSubscription = async () => {
    setUpdatingSubscriptionAction(true);
    try {
      const reason = cancelReason.trim() || (withinRefundWindow ? 'arrependimento' : 'user_request');
      const details = cancelDetails.trim() || undefined;
      const result = await subscriptionsService.cancelSubscription(reason, details);
      Alert.alert(
        'Solicitacao enviada',
        result.message || 'Cancelamento registrado com sucesso.',
      );
      await refreshProfile();
      await loadTransactions();
      resetCancelForm();
    } catch (error: any) {
      Alert.alert('Erro', readApiErrorMessage(error, 'Nao foi possivel cancelar a assinatura.'));
    } finally {
      setUpdatingSubscriptionAction(false);
    }
  };

  const handleCancelSubscription = () => {
    if (!activeSubscription) {
      Alert.alert('Assinatura inativa', 'Nao existe assinatura ativa para cancelar.');
      return;
    }

    Alert.alert(
      'Confirmar cancelamento',
      withinRefundWindow
        ? 'Voce ainda esta no periodo de garantia. Deseja seguir com o cancelamento agora?'
        : 'Deseja cancelar a assinatura ao final do ciclo atual?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: () => {
            void executeCancelSubscription();
          },
        },
      ],
    );
  };

  const handleUndoCancellation = async () => {
    setUpdatingSubscriptionAction(true);
    try {
      const result = await subscriptionsService.undoCancellationRequest();
      Alert.alert(
        'Assinatura reativada',
        result.message || 'Cancelamento revertido com sucesso.',
      );
      await refreshProfile();
      await loadTransactions();
      resetCancelForm();
    } catch (error: any) {
      Alert.alert('Erro', readApiErrorMessage(error, 'Nao foi possivel reverter o cancelamento.'));
    } finally {
      setUpdatingSubscriptionAction(false);
    }
  };

  const handleOpenInvoice = async (transaction: MobileTransaction) => {
    const invoiceUrl = resolveTransactionInvoiceUrl(transaction);
    if (!invoiceUrl) {
      Alert.alert('Fatura indisponivel', 'Esta transacao nao possui URL de fatura no momento.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(invoiceUrl);
      if (!canOpen) {
        throw new Error('Nao foi possivel abrir a fatura neste dispositivo.');
      }

      await Linking.openURL(invoiceUrl);
    } catch (error: any) {
      Alert.alert('Erro', readApiErrorMessage(error, 'Nao foi possivel abrir a fatura agora.'));
    }
  };

  const handleRequestRefund = (transaction: MobileTransaction) => {
    const transactionId = String(transaction.id || '').trim();
    if (!transactionId) {
      Alert.alert('Transacao invalida', 'Nao foi possivel identificar esta transacao.');
      return;
    }

    Alert.alert(
      'Solicitar reembolso',
      'Deseja abrir uma solicitacao de reembolso para esta transacao?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solicitar',
          onPress: async () => {
            setUpdatingRefundId(transactionId);
            try {
              const result = await transactionsService.requestRefund(
                transactionId,
                'Solicitacao via app mobile',
              );
              Alert.alert('Solicitacao enviada', result.message || 'Reembolso solicitado com sucesso.');
              await loadTransactions();
              await refreshProfile();
            } catch (error: any) {
              Alert.alert('Erro', readApiErrorMessage(error, 'Nao foi possivel solicitar o reembolso.'));
            } finally {
              setUpdatingRefundId(null);
            }
          },
        },
      ],
    );
  };

  const handleCancelRefundRequest = (transaction: MobileTransaction) => {
    const transactionId = String(transaction.id || '').trim();
    if (!transactionId) {
      Alert.alert('Transacao invalida', 'Nao foi possivel identificar esta transacao.');
      return;
    }

    Alert.alert(
      'Cancelar reembolso',
      'Deseja realmente cancelar esta solicitacao de reembolso?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar solicitacao',
          style: 'destructive',
          onPress: async () => {
            setUpdatingRefundId(transactionId);
            try {
              const result = await transactionsService.cancelRefundRequest(transactionId);
              Alert.alert('Solicitacao cancelada', result.message || 'Solicitacao de reembolso cancelada.');
              await loadTransactions();
              await refreshProfile();
            } catch (error: any) {
              Alert.alert(
                'Erro',
                readApiErrorMessage(error, 'Nao foi possivel cancelar a solicitacao de reembolso.'),
              );
            } finally {
              setUpdatingRefundId(null);
            }
          },
        },
      ],
    );
  };

  React.useEffect(() => {
    if (!activeSubscription || subscriptionCancelPending) {
      resetCancelForm();
    }
  }, [activeSubscription, subscriptionCancelPending]);

  useFocusEffect(
    React.useCallback(() => {
      void refreshProfile();
      void loadCards();
      void loadTransactions();

      const interval = setInterval(() => {
        void loadCards();
      }, 15 * 60 * 1000);

      return () => clearInterval(interval);
    }, [loadCards, loadTransactions, refreshProfile]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Perfil</Text>

      {hasPaymentIssue && (
        <View style={[styles.card, isExpiringCardIssue ? styles.paymentIssueWarningCard : styles.paymentIssueDangerCard]}>
          <Text style={styles.paymentIssueTitle}>Atencao no pagamento</Text>
          <Text style={styles.paymentIssueMessage}>
            {paymentIssueMessage || 'Atualize sua forma de pagamento para evitar interrupcao no acesso.'}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.paymentIssueButton,
              pressed && !openingPortal && styles.paymentIssueButtonPressed,
              openingPortal && styles.paymentIssueButtonDisabled,
            ]}
            onPress={() => void handleManageOnStripe()}
            disabled={openingPortal}
          >
            <Text style={styles.paymentIssueButtonText}>
              {openingPortal ? 'Abrindo Stripe...' : 'Resolver na Stripe'}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Assinatura</Text>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{user?.name || '-'}</Text>

        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.value}>{user?.email || '-'}</Text>

        <Text style={styles.label}>Plano atual</Text>
        <Text style={styles.value}>{subscriptionPlanName}</Text>
        <Text style={styles.valueHint}>{subscriptionHeadline}</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{activeSubscription ? 'Assinatura ativa' : 'Plano gratuito/inativo'}</Text>

        <View style={styles.subscriptionSummaryGrid}>
          <View style={styles.subscriptionSummaryItem}>
            <Text style={styles.subscriptionSummaryEyebrow}>Status</Text>
            <Text style={styles.subscriptionSummaryValue}>{billingStatusLabel}</Text>
            <Text style={styles.subscriptionSummaryHint}>{billingStatusDescription}</Text>
          </View>
          <View style={styles.subscriptionSummaryItem}>
            <Text style={styles.subscriptionSummaryEyebrow}>Ciclo / vigencia</Text>
            <Text style={styles.subscriptionSummaryValue}>{cycleSummaryLabel}</Text>
            <Text style={styles.subscriptionSummaryHint}>{cycleSummaryDescription}</Text>
          </View>
          <View style={styles.subscriptionSummaryItem}>
            <Text style={styles.subscriptionSummaryEyebrow}>Valor</Text>
            <Text style={styles.subscriptionSummaryValue}>
              {activeSubscription ? formatCurrency(subscriptionChargeAmount) : formatCurrency(0)}
            </Text>
            <Text style={styles.subscriptionSummaryHint}>{subscriptionValueDescription}</Text>
          </View>
        </View>

        <Text style={styles.label}>Renovacao automatica</Text>
        <Text style={styles.value}>{renewalEnabled ? 'Ativada' : 'Desativada'}</Text>
        {totalInstallments > 1 && (
          <Text style={styles.valueHint}>
            Parcela {currentInstallment} de {totalInstallments} do termo contratado.
          </Text>
        )}
        {!renewalEnabled && termCommitmentRemaining && (
          <Text style={styles.valueHint}>
            As cobrancas atuais seguem ate a ultima parcela contratada.
          </Text>
        )}
        {activeSubscription ? (
          <Pressable
            style={({ pressed }) => [
              styles.renewalButton,
              pressed && !updatingRenewal && styles.renewalButtonPressed,
              updatingRenewal && styles.renewalButtonDisabled,
            ]}
            onPress={() => void handleRenewalToggle()}
            disabled={updatingRenewal || updatingSubscriptionAction}
          >
            {updatingRenewal ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.renewalButtonText}>
                {renewalEnabled ? 'Desativar renovacao' : 'Ativar renovacao'}
              </Text>
            )}
          </Pressable>
        ) : null}

        <Text style={styles.label}>Cancelamento</Text>
        <Text style={styles.value}>
          {subscriptionCancelPending ? 'Cancelamento agendado para o fim do ciclo' : 'Sem solicitacao pendente'}
        </Text>
        {hasPendingRefundRequest && (
          <Text style={styles.valueHint}>
            Existe uma solicitacao de reembolso pendente em analise.
          </Text>
        )}
        {activeSubscription ? (
          subscriptionCancelPending ? (
            <Pressable
              style={({ pressed }) => [
                styles.undoCancelButton,
                pressed && !updatingSubscriptionAction && styles.undoCancelButtonPressed,
                updatingSubscriptionAction && styles.undoCancelButtonDisabled,
              ]}
              onPress={() => void handleUndoCancellation()}
              disabled={updatingSubscriptionAction}
            >
              {updatingSubscriptionAction ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.undoCancelButtonText}>Desfazer cancelamento</Text>
              )}
            </Pressable>
          ) : (
            <View style={styles.cancelFlowBlock}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && !updatingSubscriptionAction && styles.cancelButtonPressed,
                  updatingSubscriptionAction && styles.cancelButtonDisabled,
                ]}
                onPress={() => setShowCancelForm((previous) => !previous)}
                disabled={updatingSubscriptionAction}
              >
                <Text style={styles.cancelButtonText}>
                  {showCancelForm ? 'Fechar cancelamento' : 'Cancelar assinatura'}
                </Text>
              </Pressable>

              {showCancelForm && (
                <View style={styles.cancelFormPanel}>
                  <Text style={styles.cancelFormTitle}>Confirme seu pedido de cancelamento</Text>
                  <Text style={styles.cancelFormDescription}>
                    {withinRefundWindow
                      ? 'Voce ainda esta na janela de garantia. Informe o motivo e confirme para seguirmos com sua solicitacao.'
                      : 'Seu acesso continua ativo ate o fim do ciclo atual. Se quiser, compartilhe o motivo do cancelamento.'}
                  </Text>

                  <Text style={styles.cancelFormLabel}>Motivo principal (opcional)</Text>
                  <View style={styles.cancelReasonGrid}>
                    {cancelReasonOptions.map((option) => {
                      const isSelected = cancelReason === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          style={[styles.cancelReasonChip, isSelected && styles.cancelReasonChipSelected]}
                          onPress={() => setCancelReason(option.value)}
                        >
                          <Text style={[styles.cancelReasonChipText, isSelected && styles.cancelReasonChipTextSelected]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.cancelFormLabel}>Detalhes adicionais (opcional)</Text>
                  <TextInput
                    value={cancelDetails}
                    onChangeText={setCancelDetails}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholder="Se quiser, conte rapidamente o que motivou o cancelamento."
                    placeholderTextColor={colors.muted}
                    style={styles.cancelDetailsInput}
                  />

                  <View style={styles.cancelFormActions}>
                    <Pressable
                      style={styles.cancelKeepButton}
                      onPress={resetCancelForm}
                      disabled={updatingSubscriptionAction}
                    >
                      <Text style={styles.cancelKeepButtonText}>Manter assinatura</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.cancelConfirmButton, updatingSubscriptionAction && styles.cancelButtonDisabled]}
                      onPress={handleCancelSubscription}
                      disabled={updatingSubscriptionAction}
                    >
                      {updatingSubscriptionAction ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.cancelConfirmButtonText}>Confirmar cancelamento</Text>
                      )}
                    </Pressable>
                  </View>

                  <Text style={styles.cancelFormFootnote}>
                    Seu acesso permanece ativo ate {formatDate(user?.subscription?.current_period_end)}.
                  </Text>
                </View>
              )}
            </View>
          )
        ) : null}

        <Text style={styles.label}>Proxima cobranca</Text>
        <Text style={styles.value}>{formatDate(user?.subscription?.next_billing_at || user?.billing?.nextBilling)}</Text>

        <Text style={styles.label}>Fim do ciclo</Text>
        <Text style={styles.value}>{formatDate(user?.subscription?.current_period_end)}</Text>

        {activeSubscription && subscriptionTotalDays > 0 && (
          <View style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>Andamento do ciclo</Text>
            <Text style={styles.timelineValue}>
              {subscriptionUsedDays} de {subscriptionTotalDays} dias utilizados
            </Text>
            <Text style={styles.timelineHint}>{subscriptionValueDescription}</Text>

            <View style={styles.timelineProgressTrack}>
              <View style={[styles.timelineProgressFill, { width: `${subscriptionProgressPercent}%` }]} />
            </View>

            <View style={styles.timelineMetaRow}>
              <Text style={styles.timelineMetaText}>Restantes: {subscriptionRemainingDays} dias</Text>
              <Text style={styles.timelineMetaText}>Proxima cobranca: {formatDate(subscriptionNextChargeAt?.getTime())}</Text>
            </View>
            <View style={styles.timelineMetaRow}>
              <Text style={styles.timelineMetaText}>Inicio: {formatDate(subscriptionStartAt?.getTime())}</Text>
              <Text style={styles.timelineMetaText}>Fim: {formatDate(subscriptionEndAt?.getTime())}</Text>
            </View>
          </View>
        )}
      </View>

      {(primaryCardExpiry.isExpired || primaryCardExpiry.isExpiringSoon) && (
        <View style={[styles.card, primaryCardExpiry.isExpired ? styles.warningCardDanger : styles.warningCard]}>
          <Text style={styles.warningTitle}>
            {primaryCardExpiry.isExpired ? 'Cartao expirado' : 'Cartao vence em breve'}
          </Text>
          <Text style={styles.warningText}>
            Atualize seu cartao para evitar falha de cobranca na renovacao da assinatura.
          </Text>
          <Pressable style={styles.warningButton} onPress={() => void handleManageOnStripe()} disabled={openingPortal}>
            <Text style={styles.warningButtonText}>
              {openingPortal ? 'Abrindo...' : 'Atualizar cartao'}
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pagamento</Text>
        <Text style={styles.label}>Provedor</Text>
        <Text style={styles.value}>Stripe</Text>

        <Text style={styles.label}>Cartoes salvos</Text>
        <Text style={styles.value}>{cards.length}</Text>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
            openingPortal && styles.secondaryButtonDisabled,
          ]}
          onPress={() => void handleManageOnStripe()}
          disabled={openingPortal}
        >
          <Text style={styles.secondaryButtonText}>
            {openingPortal ? 'Abrindo Stripe...' : 'Adicionar/gerenciar cartoes'}
          </Text>
        </Pressable>

        {loadingCards ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>Sincronizando cartoes...</Text>
          </View>
        ) : cardsError ? (
          <Text style={styles.errorText}>{cardsError}</Text>
        ) : cards.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum cartao salvo no cofre Stripe.</Text>
        ) : (
          <View style={styles.cardsList}>
            {cards.map((card) => {
              const cardId = String(card.id || '');
              const isDefault = toBoolean(card.is_default);
              const isLocked = toBoolean(card.locked_by_recurring);
              const expiry = getCardExpiryState(card);
              const canRemove = !isLocked && !(cards.length <= 1 && activeSubscription);

              return (
                <View key={cardId} style={styles.savedCardRow}>
                  <View style={styles.savedCardInfo}>
                    <Text style={styles.savedCardLabel}>{formatMaskedCardLabelAscii(card)}</Text>
                    <Text style={styles.savedCardMeta}>
                      Expira em {String(card.exp_month || '--').padStart(2, '0')}/{String(card.exp_year || '--')}
                    </Text>
                    {isLocked && (
                      <Text style={styles.savedCardHint}>
                        Cartao vinculado a assinatura ativa.
                      </Text>
                    )}
                    {expiry.isExpired && (
                      <Text style={styles.savedCardDanger}>Expirado</Text>
                    )}
                    {!expiry.isExpired && expiry.isExpiringSoon && (
                      <Text style={styles.savedCardWarn}>Vence em breve</Text>
                    )}
                  </View>

                  <View style={styles.savedCardActions}>
                    {!isDefault && (
                      <Pressable
                        style={styles.cardActionButton}
                        onPress={() => void handleSetDefaultCard(cardId)}
                        disabled={updatingCardId === cardId}
                      >
                        <Text style={styles.cardActionText}>Padrao</Text>
                      </Pressable>
                    )}
                    {canRemove && (
                      <Pressable
                        style={[styles.cardActionButton, styles.cardActionDanger]}
                        onPress={() => void handleRemoveCard(card)}
                        disabled={updatingCardId === cardId}
                      >
                        <Text style={styles.cardActionDangerText}>Remover</Text>
                      </Pressable>
                    )}
                    {isDefault && (
                      <Text style={styles.defaultBadge}>Padrao</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>Transacoes</Text>
          <Pressable style={styles.refreshMiniButton} onPress={() => void loadTransactions()}>
            <Text style={styles.refreshMiniButtonText}>Atualizar</Text>
          </Pressable>
        </View>

        {loadingTransactions ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>Carregando transacoes...</Text>
          </View>
        ) : transactionsError ? (
          <Text style={styles.errorText}>{transactionsError}</Text>
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma transacao encontrada.</Text>
        ) : (
          <View style={styles.transactionsList}>
            {transactions.map((transaction) => {
              const statusMeta = getTransactionStatusMeta(transaction.status);
              const planName = resolveTransactionPlanName(transaction);
              const cycleLabel = resolveTransactionCycleLabel(transaction);
              const gatewayLabel = resolveTransactionGatewayLabel(transaction);
              const methodLabel = resolveTransactionMethodLabel(transaction);
              const amountLabel = formatCurrency(transaction.amount || 0);
              const eventAt = transaction.updatedAt || transaction.createdAt || transaction.timestamp;
              const eventLabel = String(transaction.dateTimeFormatted || '').trim()
                || formatDateTime(eventAt);
              const transactionId = String(transaction.id || '--');
              const referenceId = String(
                transaction.providerTransactionId
                || transaction.referenceId
                || transaction.id
                || '--',
              ).trim();
              const referenceLabel = String(transaction.providerTransactionLabel || 'ID Stripe').trim();
              const installmentCount = Math.max(0, Number(transaction.installmentCount || 0));
              const installmentNumber = Math.max(1, Number(transaction.installmentNumber || 1));
              const installmentLabel = installmentCount > 1
                ? `Parcela ${Math.min(installmentNumber, installmentCount)}/${installmentCount}`
                : null;
              const scheduleLabel = String(transaction.scheduleLabel || '').trim();
              const canRequestRefund = canRequestRefundForStatus(transaction.status);
              const canCancelRefund = canCancelRefundForStatus(transaction.status);
              const hasInvoice = Boolean(resolveTransactionInvoiceUrl(transaction));
              const isRefundMutationRunning = updatingRefundId === String(transaction.id || '');

              return (
                <View key={String(transaction.id)} style={styles.transactionRow}>
                  <View style={styles.transactionReferenceBlock}>
                    <Text style={styles.transactionReferenceLabel}>{referenceLabel}</Text>
                    <Text numberOfLines={1} style={styles.transactionReferenceValue}>{referenceId || '--'}</Text>
                  </View>

                  <View style={styles.transactionTop}>
                    <Text numberOfLines={1} style={styles.transactionPlan}>
                      {planName}
                    </Text>
                    <Text style={styles.transactionAmount}>{amountLabel}</Text>
                  </View>

                  <View style={styles.transactionTags}>
                    <Text style={styles.transactionTag}>Ciclo: {cycleLabel}</Text>
                    {installmentLabel && <Text style={styles.transactionTag}>{installmentLabel}</Text>}
                    <Text style={styles.transactionTag}>Gateway: {gatewayLabel}</Text>
                    <Text style={styles.transactionTag}>Metodo: {methodLabel}</Text>
                  </View>

                  <View style={styles.transactionBottom}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusMeta.bg, borderColor: statusMeta.border },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                    <Text style={styles.transactionDate}>{eventLabel}</Text>
                  </View>

                  {scheduleLabel ? (
                    <Text style={styles.transactionScheduleLabel}>{scheduleLabel}</Text>
                  ) : null}

                  {!!transaction.providerRefundId && (
                    <Text style={styles.transactionRefundId}>
                      Refund: {transaction.providerRefundId}
                    </Text>
                  )}

                  <View style={styles.transactionActions}>
                    {hasInvoice ? (
                      <Pressable
                        style={styles.transactionActionButton}
                        onPress={() => void handleOpenInvoice(transaction)}
                      >
                        <Text style={styles.transactionActionText}>Fatura</Text>
                      </Pressable>
                    ) : null}

                    {canRequestRefund ? (
                      <Pressable
                        style={[styles.transactionActionButton, styles.transactionActionWarn]}
                        onPress={() => handleRequestRefund(transaction)}
                        disabled={isRefundMutationRunning}
                      >
                        {isRefundMutationRunning ? (
                          <ActivityIndicator size="small" color="#B45309" />
                        ) : (
                          <Text style={[styles.transactionActionText, styles.transactionActionWarnText]}>
                            Solicitar reembolso
                          </Text>
                        )}
                      </Pressable>
                    ) : null}

                    {canCancelRefund ? (
                      <Pressable
                        style={[styles.transactionActionButton, styles.transactionActionDanger]}
                        onPress={() => handleCancelRefundRequest(transaction)}
                        disabled={isRefundMutationRunning}
                      >
                        {isRefundMutationRunning ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Text style={[styles.transactionActionText, styles.transactionActionDangerText]}>
                            Cancelar reembolso
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>

                  <Text style={styles.transactionId}>ID: {transactionId}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <Pressable
        onPress={handleLogout}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && !isLoading && styles.logoutButtonPressed,
          isLoading && styles.logoutButtonDisabled,
        ]}
      >
        <Text style={styles.logoutText}>{isLoading ? 'Saindo...' : 'Sair da conta'}</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 6,
  },
  paymentIssueWarningCard: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  paymentIssueDangerCard: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  paymentIssueTitle: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  paymentIssueMessage: {
    color: '#7C2D12',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  paymentIssueButton: {
    marginTop: 6,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  paymentIssueButtonPressed: {
    opacity: 0.92,
  },
  paymentIssueButtonDisabled: {
    opacity: 0.65,
  },
  paymentIssueButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  label: {
    marginTop: 8,
    fontSize: 11,
    color: colors.muted,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  valueHint: {
    marginTop: 2,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  subscriptionSummaryGrid: {
    marginTop: 10,
    gap: 8,
  },
  subscriptionSummaryItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 4,
  },
  subscriptionSummaryEyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  subscriptionSummaryValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  subscriptionSummaryHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  timelineCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 6,
  },
  timelineTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timelineValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  timelineHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  timelineProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 2,
  },
  timelineProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  timelineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineMetaText: {
    flex: 1,
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
  },
  renewalButton: {
    marginTop: 8,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  renewalButtonPressed: {
    opacity: 0.92,
  },
  renewalButtonDisabled: {
    opacity: 0.65,
  },
  renewalButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cancelButton: {
    marginTop: 8,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  cancelButtonPressed: {
    opacity: 0.92,
  },
  cancelButtonDisabled: {
    opacity: 0.65,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  cancelFlowBlock: {
    marginTop: 8,
    gap: 8,
  },
  cancelFormPanel: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    padding: 10,
    gap: 8,
  },
  cancelFormTitle: {
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cancelFormDescription: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  cancelFormLabel: {
    color: '#991B1B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  cancelReasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cancelReasonChip: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelReasonChipSelected: {
    borderColor: colors.danger,
    backgroundColor: '#FEE2E2',
  },
  cancelReasonChipText: {
    color: '#7F1D1D',
    fontSize: 10,
    fontWeight: '800',
  },
  cancelReasonChipTextSelected: {
    color: colors.danger,
  },
  cancelDetailsInput: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelFormActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelKeepButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelKeepButtonText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  cancelConfirmButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  cancelFormFootnote: {
    color: '#7F1D1D',
    fontSize: 10,
    fontWeight: '800',
  },
  undoCancelButton: {
    marginTop: 8,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  undoCancelButtonPressed: {
    opacity: 0.92,
  },
  undoCancelButtonDisabled: {
    opacity: 0.65,
  },
  undoCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  secondaryButton: {
    marginTop: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonDisabled: {
    opacity: 0.65,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  inlineLoader: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  emptyText: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  cardsList: {
    marginTop: 10,
    gap: 8,
  },
  savedCardRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 10,
  },
  savedCardInfo: {
    gap: 2,
  },
  savedCardLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  savedCardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  savedCardHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  savedCardWarn: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedCardDanger: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardActionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  cardActionText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardActionDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  cardActionDangerText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  defaultBadge: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  warningCard: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  warningCardDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  warningTitle: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  warningText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  warningButton: {
    marginTop: 4,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transactionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  refreshMiniButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  refreshMiniButtonText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  transactionsList: {
    marginTop: 6,
    gap: 8,
  },
  transactionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 7,
  },
  transactionReferenceBlock: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  transactionReferenceLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  transactionReferenceValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
  transactionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  transactionPlan: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  transactionAmount: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  transactionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  transactionTag: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    color: '#475569',
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '800',
  },
  transactionBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  transactionDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  transactionScheduleLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  transactionId: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  transactionRefundId: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  transactionActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  transactionActionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionActionText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  transactionActionWarn: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  transactionActionWarnText: {
    color: '#B45309',
  },
  transactionActionDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  transactionActionDangerText: {
    color: colors.danger,
  },
  logoutButton: {
    marginTop: 6,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
  },
  logoutButtonPressed: {
    opacity: 0.9,
  },
  logoutButtonDisabled: {
    opacity: 0.65,
  },
  logoutText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

export default ProfileScreen;
