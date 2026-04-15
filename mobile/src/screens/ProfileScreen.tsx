import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

  const activeSubscription = hasActiveSubscriptionStatus(user?.subscription?.status);
  const renewalEnabled = toBoolean(user?.subscription?.auto_renew);
  const subscriptionPlanName = user?.subscription?.plan?.name || user?.plan || 'Gratuito';

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
    setUpdatingRenewal(true);
    try {
      const result = await subscriptionsService.updateRenewal(nextAutoRenew);
      Alert.alert(
        'Renovacao atualizada',
        result.message || (nextAutoRenew ? 'Renovacao automatica ativada.' : 'Renovacao automatica desativada.'),
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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Assinatura</Text>
        <Text style={styles.label}>Nome</Text>
        <Text style={styles.value}>{user?.name || '-'}</Text>

        <Text style={styles.label}>E-mail</Text>
        <Text style={styles.value}>{user?.email || '-'}</Text>

        <Text style={styles.label}>Plano atual</Text>
        <Text style={styles.value}>{subscriptionPlanName}</Text>

        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{activeSubscription ? 'Assinatura ativa' : 'Plano gratuito/inativo'}</Text>

        <Text style={styles.label}>Renovacao automatica</Text>
        <Text style={styles.value}>{renewalEnabled ? 'Ativada' : 'Desativada'}</Text>
        {activeSubscription ? (
          <Pressable
            style={({ pressed }) => [
              styles.renewalButton,
              pressed && !updatingRenewal && styles.renewalButtonPressed,
              updatingRenewal && styles.renewalButtonDisabled,
            ]}
            onPress={() => void handleRenewalToggle()}
            disabled={updatingRenewal}
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

        <Text style={styles.label}>Proxima cobranca</Text>
        <Text style={styles.value}>{formatDate(user?.subscription?.next_billing_at || user?.billing?.nextBilling)}</Text>

        <Text style={styles.label}>Fim do ciclo</Text>
        <Text style={styles.value}>{formatDate(user?.subscription?.current_period_end)}</Text>
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
              const transactionId = String(transaction.id || '--');
              const canRequestRefund = canRequestRefundForStatus(transaction.status);
              const canCancelRefund = canCancelRefundForStatus(transaction.status);
              const hasInvoice = Boolean(resolveTransactionInvoiceUrl(transaction));
              const isRefundMutationRunning = updatingRefundId === String(transaction.id || '');

              return (
                <View key={String(transaction.id)} style={styles.transactionRow}>
                  <View style={styles.transactionTop}>
                    <Text numberOfLines={1} style={styles.transactionPlan}>
                      {planName}
                    </Text>
                    <Text style={styles.transactionAmount}>{amountLabel}</Text>
                  </View>

                  <View style={styles.transactionTags}>
                    <Text style={styles.transactionTag}>Ciclo: {cycleLabel}</Text>
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
                    <Text style={styles.transactionDate}>{formatDateTime(eventAt)}</Text>
                  </View>

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
