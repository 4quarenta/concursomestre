import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { cardsService } from '@/services/billing/cardsService';
import { formatMaskedCardLabelAscii } from '@/services/billing/cardDisplay';
import { planService } from '@/services/plans/planService';
import { subscriptionsService } from '@/services/subscriptions/subscriptionsService';
import { colors } from '@/theme/colors';
import type { SavedCard } from '@/types/billing';

type CheckoutRoute = RouteProp<AppStackParamList, 'Checkout'>;
type PaymentMode = 'hosted' | 'saved-card';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
};

const resolveCycleLabel = (count: number, unit: string) => {
  if (unit === 'year') return 'anual';
  if (unit === 'month' && count === 3) return 'trimestral';
  if (unit === 'month') return 'mensal';
  if (unit === 'week') return 'semanal';
  if (unit === 'day') return 'diario';
  return 'periodico';
};

const resolveMaxInstallments = (count: number, unit: string, planName: string) => {
  const normalizedUnit = String(unit || '').toLowerCase();
  const normalizedName = String(planName || '').toLowerCase();
  if (normalizedUnit === 'year' || normalizedName.includes('anual') || normalizedName.includes('annual')) {
    return 12;
  }
  if ((normalizedUnit === 'month' && count === 3) || normalizedName.includes('trimestral')) {
    return 3;
  }
  return 1;
};

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

/**
 * Checkout mobile com suporte a sessão hospedada e cartão salvo.
 * @since v1.0.0
 */
export const CheckoutScreen: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<CheckoutRoute>();
  const { plan } = route.params;
  const defaultInstallments = React.useMemo(
    () => resolveMaxInstallments(
      Number(plan.interval_count || 1),
      String(plan.interval_unit || 'month'),
      String(plan.name || ''),
    ),
    [plan.interval_count, plan.interval_unit, plan.name],
  );

  const [couponCode, setCouponCode] = React.useState('');
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [couponMessage, setCouponMessage] = React.useState('');
  const [couponDiscount, setCouponDiscount] = React.useState(0);
  const [autoRenew, setAutoRenew] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);
  const [installmentCount, setInstallmentCount] = React.useState(String(defaultInstallments));
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>('hosted');
  const [savedCards, setSavedCards] = React.useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = React.useState(false);
  const [cardsError, setCardsError] = React.useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(null);
  const [openingStripePortal, setOpeningStripePortal] = React.useState(false);

  const cycleLabel = resolveCycleLabel(Number(plan.interval_count || 1), String(plan.interval_unit || 'month'));
  const subtotal = Number(plan.price || 0);
  const total = Math.max(0, subtotal - couponDiscount);
  const maxInstallments = React.useMemo(
    () => resolveMaxInstallments(
      Number(plan.interval_count || 1),
      String(plan.interval_unit || 'month'),
      String(plan.name || ''),
    ),
    [plan.interval_count, plan.interval_unit, plan.name],
  );
  const supportsStripeBillingChoices = maxInstallments > 1;
  const selectedInstallmentCount = React.useMemo(() => {
    if (!supportsStripeBillingChoices) return 1;
    const parsed = Number.parseInt(installmentCount, 10);
    if (!Number.isFinite(parsed) || parsed <= 1) return 1;
    return Math.min(maxInstallments, parsed);
  }, [installmentCount, maxInstallments, supportsStripeBillingChoices]);
  const selectedStripeBillingMode: 'single_installment' | 'term_recurring' = selectedInstallmentCount > 1
    ? 'term_recurring'
    : 'single_installment';
  const installmentAmount = Math.max(0, total / selectedInstallmentCount);
  const installmentLabel = selectedInstallmentCount > 1
    ? `${selectedInstallmentCount}x de ${formatCurrency(installmentAmount)} sem juros`
    : `1x de ${formatCurrency(total)} sem juros`;
  const selectedCard = React.useMemo(
    () => savedCards.find((card) => String(card.id) === String(selectedCardId)) || null,
    [savedCards, selectedCardId],
  );

  const openExternalUrl = React.useCallback(async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error('Nao foi possivel abrir o checkout no dispositivo.');
    }
    await Linking.openURL(url);
  }, []);

  const loadSavedCards = React.useCallback(async () => {
    if (!user?.id) return;

    setLoadingCards(true);
    setCardsError(null);
    try {
      const result = await cardsService.listSavedCards(user.id);
      const cards = result.cards || [];
      setSavedCards(cards);

      const defaultCard = cards.find((card) => toBoolean(card.is_default));
      setSelectedCardId((current) => {
        if (current && cards.some((card) => String(card.id) === String(current))) {
          return current;
        }
        if (defaultCard?.id) return String(defaultCard.id);
        if (cards[0]?.id) return String(cards[0].id);
        return null;
      });
    } catch (error: any) {
      setCardsError(error?.message || 'Nao foi possivel carregar cartoes salvos agora.');
      setSavedCards([]);
      setSelectedCardId(null);
    } finally {
      setLoadingCards(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    void loadSavedCards();
  }, [loadSavedCards]);

  React.useEffect(() => {
    if (paymentMode === 'saved-card' && savedCards.length === 0 && !loadingCards) {
      setPaymentMode('hosted');
    }
  }, [loadingCards, paymentMode, savedCards.length]);

  React.useEffect(() => {
    setInstallmentCount(String(maxInstallments > 1 ? maxInstallments : 1));
  }, [plan.id, maxInstallments]);

  const handleOpenStripePortal = async () => {
    setOpeningStripePortal(true);
    try {
      const result = await subscriptionsService.createStripePortalSession();
      await openExternalUrl(result.url);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel abrir o portal da Stripe.');
    } finally {
      setOpeningStripePortal(false);
    }
  };

  const handleApplyCoupon = async () => {
    const normalized = couponCode.trim().toUpperCase();
    if (!normalized) {
      setCouponMessage('Informe o codigo do cupom.');
      setCouponDiscount(0);
      return;
    }

    setCouponLoading(true);
    setCouponMessage('');

    try {
      const result = await planService.validateCoupon(normalized, subtotal, plan.id);
      if (!result.valid) {
        setCouponDiscount(0);
        setCouponMessage(result.message || 'Cupom invalido.');
        return;
      }

      const discount = Number(result.discount_amount || 0);
      setCouponDiscount(discount);
      setCouponMessage(result.message || 'Cupom aplicado com sucesso.');
    } catch (error: any) {
      setCouponDiscount(0);
      setCouponMessage(error?.message || 'Nao foi possivel validar o cupom.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleProceedHostedCheckout = async () => {
    setProcessing(true);
    try {
      const result = await planService.createStripeCheckoutSession({
        plan_id: plan.id,
        auto_renew: autoRenew,
        coupon_code: couponCode.trim() || undefined,
        billing_mode: selectedStripeBillingMode,
        installment_count: selectedInstallmentCount,
      });

      await openExternalUrl(result.url);
    } catch (error: any) {
      Alert.alert('Erro no checkout', error?.message || 'Nao foi possivel iniciar o checkout.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProceedSavedCard = async () => {
    if (!selectedCardId) {
      Alert.alert('Cartao obrigatorio', 'Selecione um cartao salvo para continuar.');
      return;
    }

    setProcessing(true);
    try {
      const response = await planService.createStripeSubscription({
        plan_id: plan.id,
        auto_renew: autoRenew,
        coupon_code: couponCode.trim() || undefined,
        saved_card_id: selectedCardId,
        save_card: true,
        billing_mode: selectedStripeBillingMode,
        installment_count: selectedInstallmentCount,
      });

      const payload = response?.data || response;
      const subscriptionId = String(payload?.subscription_id || '').trim();
      const paymentMethodId = String(
        payload?.payment_method_id
          || (selectedCard as any)?.stripe_payment_method_id
          || '',
      ).trim();

      if (payload?.client_secret) {
        const fallback = await planService.createStripeCheckoutSession({
          plan_id: plan.id,
          auto_renew: autoRenew,
          coupon_code: couponCode.trim() || undefined,
          billing_mode: selectedStripeBillingMode,
          installment_count: selectedInstallmentCount,
        });
        await openExternalUrl(fallback.url);
        return;
      }

      if (subscriptionId) {
        const finalizeResponse = await planService.finalizeStripeSubscription({
          subscription_id: subscriptionId,
          plan_id: plan.id,
          auto_renew: autoRenew,
          payment_method_id: paymentMethodId || undefined,
          payment_intent_id: payload?.payment_intent_id || undefined,
          saved_card_id: selectedCardId,
          save_card: true,
          billing_mode: selectedStripeBillingMode,
        });

        const finalizePayload = finalizeResponse?.data || finalizeResponse;
        if (finalizePayload?.approved === false) {
          throw new Error('Pagamento bloqueado pela validacao antifraude.');
        }
      }

      await refreshProfile();
      Alert.alert('Assinatura concluida', 'Pagamento processado com sucesso.', [
        {
          text: 'OK',
          onPress: () => navigation.replace('MainTabs'),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Erro no pagamento',
        error?.message || 'Nao foi possivel concluir o pagamento com cartao salvo.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const handleProceed = async () => {
    if (paymentMode === 'saved-card') {
      await handleProceedSavedCard();
      return;
    }
    await handleProceedHostedCheckout();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={loadingCards}
          onRefresh={() => void loadSavedCards()}
          tintColor={colors.primary}
        />
      )}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>Resumo do plano</Text>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planCycle}>Assinatura {cycleLabel}</Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Forma de pagamento</Text>
          <Text style={styles.totalValue}>{paymentMode === 'saved-card' ? 'Cartao salvo' : 'Checkout Stripe'}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Cobranca</Text>
          <Text style={[styles.totalValue, styles.totalValueCompact]}>{installmentLabel}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
        </View>
        {couponDiscount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Desconto</Text>
            <Text style={styles.discountValue}>- {formatCurrency(couponDiscount)}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.totalRowStrong]}>
          <Text style={styles.totalStrongLabel}>Total</Text>
          <Text style={styles.totalStrongValue}>{formatCurrency(total)}</Text>
        </View>
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.blockTitle}>Metodo de pagamento</Text>
        <View style={styles.modeToggleRow}>
          <Pressable
            style={[
              styles.modeChip,
              paymentMode === 'hosted' && styles.modeChipActive,
            ]}
            onPress={() => setPaymentMode('hosted')}
          >
            <Text style={[styles.modeChipText, paymentMode === 'hosted' && styles.modeChipTextActive]}>
              Checkout Stripe
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeChip,
              paymentMode === 'saved-card' && styles.modeChipActive,
              savedCards.length === 0 && styles.modeChipDisabled,
            ]}
            onPress={() => savedCards.length > 0 && setPaymentMode('saved-card')}
          >
            <Text style={[styles.modeChipText, paymentMode === 'saved-card' && styles.modeChipTextActive]}>
              Cartao salvo
            </Text>
          </Pressable>
        </View>

        {paymentMode === 'saved-card' ? (
          loadingCards ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loaderText}>Carregando cartoes...</Text>
            </View>
          ) : savedCards.length === 0 ? (
            <View style={styles.emptySavedCardBlock}>
              <Text style={styles.emptySavedCardText}>Nenhum cartao salvo encontrado.</Text>
              {!!cardsError && <Text style={styles.couponError}>{cardsError}</Text>}
              <Pressable
                style={[styles.portalButton, openingStripePortal && styles.buttonDisabled]}
                onPress={() => void handleOpenStripePortal()}
                disabled={openingStripePortal}
              >
                <Text style={styles.portalButtonText}>
                  {openingStripePortal ? 'Abrindo portal...' : 'Adicionar cartao na Stripe'}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.savedCardsList}>
              {savedCards.map((card) => {
                const cardId = String(card.id || '');
                const isSelected = String(selectedCardId) === cardId;
                return (
                  <Pressable
                    key={cardId}
                    style={[styles.savedCardRow, isSelected && styles.savedCardRowSelected]}
                    onPress={() => setSelectedCardId(cardId)}
                  >
                    <View style={styles.savedCardInfo}>
                      <Text style={styles.savedCardLabel}>{formatMaskedCardLabelAscii(card)}</Text>
                      <Text style={styles.savedCardMeta}>
                        Expira em {String(card.exp_month || '--').padStart(2, '0')}/{String(card.exp_year || '--')}
                      </Text>
                    </View>
                    <View style={[styles.savedCardSelector, isSelected && styles.savedCardSelectorSelected]} />
                  </Pressable>
                );
              })}
            </View>
          )
        ) : (
          <Text style={styles.switchDescription}>
            O checkout hospedado da Stripe sera aberto no navegador com as validacoes completas.
          </Text>
        )}
      </View>

      <View style={styles.blockCard}>
        <Text style={styles.blockTitle}>Cupom de desconto</Text>
        <View style={styles.couponRow}>
          <TextInput
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
            placeholder="Digite seu cupom"
            placeholderTextColor={colors.muted}
            style={styles.couponInput}
          />
          <Pressable
            style={[styles.couponButton, couponLoading && styles.buttonDisabled]}
            onPress={() => void handleApplyCoupon()}
            disabled={couponLoading}
          >
            {couponLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.couponButtonText}>Aplicar</Text>
            )}
          </Pressable>
        </View>
        {!!couponMessage && (
          <Text style={couponDiscount > 0 ? styles.couponSuccess : styles.couponError}>{couponMessage}</Text>
        )}
      </View>

      {supportsStripeBillingChoices && (
        <View style={styles.blockCard}>
          <Text style={styles.blockTitle}>Parcelamento sem juros</Text>
          <Text style={styles.switchDescription}>
            Escolha em quantas parcelas voce quer dividir este ciclo.
          </Text>
          <View style={styles.installmentGrid}>
            {Array.from({ length: maxInstallments }, (_, index) => {
              const count = index + 1;
              const isSelected = count === selectedInstallmentCount;
              const amount = Math.max(0, total / count);
              return (
                <Pressable
                  key={`installment-${count}`}
                  style={[styles.installmentChip, isSelected && styles.installmentChipActive]}
                  onPress={() => setInstallmentCount(String(count))}
                >
                  <Text style={[styles.installmentChipTitle, isSelected && styles.installmentChipTitleActive]}>
                    {count}x
                  </Text>
                  <Text style={[styles.installmentChipAmount, isSelected && styles.installmentChipAmountActive]}>
                    {formatCurrency(amount)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.blockCard}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextBlock}>
            <Text style={styles.blockTitle}>Renovacao automatica</Text>
            <Text style={styles.switchDescription}>
              Quando ativa, a assinatura renova automaticamente no proximo ciclo.
            </Text>
          </View>
          <Switch
            value={autoRenew}
            onValueChange={setAutoRenew}
            trackColor={{ false: '#CBD5E1', true: '#A5B4FC' }}
            thumbColor={autoRenew ? colors.primary : '#FFFFFF'}
          />
        </View>
      </View>

      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Pagamento seguro</Text>
        <Text style={styles.securityText}>
          {paymentMode === 'saved-card'
            ? 'Pagamento com cartao salvo no cofre Stripe. Se houver validacao adicional, abrimos checkout seguro automaticamente.'
            : 'O pagamento sera processado pelo checkout seguro da Stripe. Voce conclui em poucos passos.'}
        </Text>
      </View>

      <Pressable
        style={[styles.mainButton, processing && styles.buttonDisabled]}
        onPress={() => void handleProceed()}
        disabled={processing}
      >
        {processing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.mainButtonText}>
            {paymentMode === 'saved-card' ? 'Garantir assinatura com cartao salvo' : 'Continuar para assinatura segura'}
          </Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryButtonText}>Voltar aos planos</Text>
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
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  planName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  planCycle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalRowStrong: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  totalValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  totalValueCompact: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
  },
  discountValue: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '800',
  },
  totalStrongLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  totalStrongValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  blockCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modeChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  modeChipDisabled: {
    opacity: 0.55,
  },
  modeChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modeChipTextActive: {
    color: colors.primary,
  },
  installmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  installmentChip: {
    width: '31%',
    minHeight: 54,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  installmentChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  installmentChipTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  installmentChipTitleActive: {
    color: colors.primary,
  },
  installmentChipAmount: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  installmentChipAmountActive: {
    color: colors.primary,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  couponButton: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    minWidth: 84,
  },
  couponButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  couponSuccess: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  couponError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchTextBlock: {
    flex: 1,
    gap: 4,
  },
  switchDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  emptySavedCardBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 8,
  },
  emptySavedCardText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  portalButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedCardsList: {
    gap: 8,
  },
  savedCardRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  savedCardRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  savedCardInfo: {
    flex: 1,
    gap: 2,
  },
  savedCardLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  savedCardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  savedCardSelector: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
  },
  savedCardSelectorSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  securityCard: {
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#F0FDF4',
    gap: 4,
  },
  securityTitle: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  securityText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  mainButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

export default CheckoutScreen;
