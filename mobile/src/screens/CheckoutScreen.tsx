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
import { readApiErrorMessage } from '@/services/api/response';
import { authFlowService } from '@/services/auth/authFlowService';
import { cardsService } from '@/services/billing/cardsService';
import { formatMaskedCardLabelAscii } from '@/services/billing/cardDisplay';
import { planService } from '@/services/plans/planService';
import { subscriptionsService } from '@/services/subscriptions/subscriptionsService';
import { colors } from '@/theme/colors';
import type { SavedCard } from '@/types/billing';

type CheckoutRoute = RouteProp<AppStackParamList, 'Checkout'>;
type PaymentMode = 'hosted' | 'saved-card';
type CheckoutRequirementKey =
  | 'name'
  | 'cpf'
  | 'zipCode'
  | 'street'
  | 'number'
  | 'neighborhood'
  | 'city'
  | 'state'
  | 'emailVerified';

const checkoutRequirementLabelMap: Record<CheckoutRequirementKey, string> = {
  name: 'nome',
  cpf: 'CPF',
  zipCode: 'CEP',
  street: 'logradouro',
  number: 'numero',
  neighborhood: 'bairro',
  city: 'cidade',
  state: 'UF',
  emailVerified: 'confirmacao de e-mail',
};

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

const isValidCpf = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, factor: number) => {
    const total = base
      .split('')
      .reduce((sum, digit) => sum + (Number(digit) * factor--), 0);
    const result = 11 - (total % 11);
    return result > 9 ? 0 : result;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 9), 10);
  const digit2 = calcCheckDigit(digits.slice(0, 10), 11);
  return digit1 === Number(digits[9]) && digit2 === Number(digits[10]);
};

/**
 * Checkout mobile com suporte a sessão hospedada e cartão salvo.
 * @since v1.0.0
 */
export const CheckoutScreen: React.FC = () => {
  const { user, refreshProfile, updateUser } = useAuth();
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
  const [isSavingCheckoutRequirements, setIsSavingCheckoutRequirements] = React.useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = React.useState(false);
  const [checkoutRequirementData, setCheckoutRequirementData] = React.useState({
    name: '',
    cpf: '',
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
  });

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
  const missingCheckoutRequirements = React.useMemo<CheckoutRequirementKey[]>(() => {
    if (!user) return ['name'];

    const missing: CheckoutRequirementKey[] = [];
    const address = user.address || {};

    if (!String(user.name || '').trim()) missing.push('name');
    if (!String(user.cpf || '').trim()) missing.push('cpf');
    if (!String(address.zipCode || '').trim()) missing.push('zipCode');
    if (!String(address.street || '').trim()) missing.push('street');
    if (!String(address.number || '').trim()) missing.push('number');
    if (!String(address.neighborhood || '').trim()) missing.push('neighborhood');
    if (!String(address.city || '').trim()) missing.push('city');
    if (!String(address.state || '').trim()) missing.push('state');
    if (!toBoolean(user.emailVerified)) missing.push('emailVerified');

    return missing;
  }, [
    user?.address?.city,
    user?.address?.neighborhood,
    user?.address?.number,
    user?.address?.state,
    user?.address?.street,
    user?.address?.zipCode,
    user?.cpf,
    user?.emailVerified,
    user?.name,
  ]);
  const hasPendingCheckoutRequirements = missingCheckoutRequirements.length > 0;

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
    if (!user) return;

    setCheckoutRequirementData({
      name: user.name || '',
      cpf: user.cpf || '',
      zipCode: user.address?.zipCode || '',
      street: user.address?.street || '',
      number: user.address?.number || '',
      complement: user.address?.complement || '',
      neighborhood: user.address?.neighborhood || '',
      city: user.address?.city || '',
      state: user.address?.state || '',
    });
  }, [
    user?.address?.city,
    user?.address?.complement,
    user?.address?.neighborhood,
    user?.address?.number,
    user?.address?.state,
    user?.address?.street,
    user?.address?.zipCode,
    user?.cpf,
    user?.id,
    user?.name,
  ]);

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

  const handleCheckoutRequirementFieldChange = (
    field: keyof typeof checkoutRequirementData,
    value: string,
  ) => {
    setCheckoutRequirementData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateCheckoutAddress = () => {
    const zipCodeDigits = checkoutRequirementData.zipCode.replace(/\D/g, '');
    const state = checkoutRequirementData.state.trim().toUpperCase();
    const street = checkoutRequirementData.street.trim();
    const number = checkoutRequirementData.number.trim();
    const neighborhood = checkoutRequirementData.neighborhood.trim();
    const city = checkoutRequirementData.city.trim();

    if (!isValidCpf(checkoutRequirementData.cpf)) {
      return { valid: false, message: 'CPF invalido. Verifique e tente novamente.' };
    }
    if (zipCodeDigits.length !== 8) {
      return { valid: false, message: 'CEP invalido. Informe um CEP com 8 digitos.' };
    }
    if (street.length < 3) {
      return { valid: false, message: 'Logradouro invalido. Informe um endereco valido.' };
    }
    if (number.length < 1 || !/[0-9a-zA-Z]/.test(number)) {
      return { valid: false, message: 'Numero invalido. Informe um numero de endereco valido.' };
    }
    if (neighborhood.length < 2) {
      return { valid: false, message: 'Bairro invalido. Informe um bairro valido.' };
    }
    if (city.length < 2) {
      return { valid: false, message: 'Cidade invalida. Informe uma cidade valida.' };
    }
    if (!/^[A-Z]{2}$/.test(state)) {
      return { valid: false, message: 'UF invalida. Use a sigla com 2 letras (ex.: SP).' };
    }

    return { valid: true as const };
  };

  const handleSaveCheckoutRequirements = async () => {
    if (!user) return;

    const requiredFields = [
      ['name', checkoutRequirementData.name],
      ['cpf', checkoutRequirementData.cpf],
      ['zipCode', checkoutRequirementData.zipCode],
      ['street', checkoutRequirementData.street],
      ['number', checkoutRequirementData.number],
      ['neighborhood', checkoutRequirementData.neighborhood],
      ['city', checkoutRequirementData.city],
      ['state', checkoutRequirementData.state],
    ] as const;

    const missingField = requiredFields.find(([, value]) => !String(value || '').trim());
    if (missingField) {
      Alert.alert('Campos obrigatorios', 'Preencha todos os dados obrigatorios para concluir a compra.');
      return;
    }

    const addressValidation = validateCheckoutAddress();
    if (!addressValidation.valid) {
      Alert.alert('Dados invalidos', addressValidation.message);
      return;
    }

    setIsSavingCheckoutRequirements(true);
    try {
      await updateUser({
        name: checkoutRequirementData.name.trim(),
        cpf: checkoutRequirementData.cpf.replace(/\D/g, ''),
        address: {
          zipCode: checkoutRequirementData.zipCode.replace(/\D/g, ''),
          street: checkoutRequirementData.street.trim(),
          number: checkoutRequirementData.number.trim(),
          complement: checkoutRequirementData.complement.trim(),
          neighborhood: checkoutRequirementData.neighborhood.trim(),
          city: checkoutRequirementData.city.trim(),
          state: checkoutRequirementData.state.trim().toUpperCase(),
        },
      });

      await refreshProfile();
      Alert.alert('Dados atualizados', 'Perfil atualizado. Agora voce ja pode concluir a compra.');
    } catch (error: any) {
      Alert.alert('Erro', readApiErrorMessage(error, 'Nao foi possivel atualizar os dados do checkout.'));
    } finally {
      setIsSavingCheckoutRequirements(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!user?.email) return;

    setIsResendingConfirmation(true);
    try {
      const message = await authFlowService.resendConfirmation(user.email);
      Alert.alert('Confirmacao de e-mail', message || 'E-mail de confirmacao reenviado com sucesso.');
    } catch (error: any) {
      Alert.alert('Erro', readApiErrorMessage(error, 'Nao foi possivel reenviar o e-mail de confirmacao.'));
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const ensureCheckoutRequirements = () => {
    if (!hasPendingCheckoutRequirements) return true;

    const missingLabels = missingCheckoutRequirements
      .map((key) => checkoutRequirementLabelMap[key])
      .join(', ');
    Alert.alert(
      'Complete seu perfil',
      `Antes de concluir a compra, atualize: ${missingLabels}.`,
    );
    return false;
  };

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
    if (!ensureCheckoutRequirements()) {
      return;
    }

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

      {hasPendingCheckoutRequirements && (
        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>Requisitos para concluir a compra</Text>
          <Text style={styles.requirementsDescription}>
            Complete os dados de cadastro e confirme seu e-mail antes de prosseguir.
          </Text>

          <View style={styles.requirementStatusList}>
            {missingCheckoutRequirements.includes('emailVerified') ? (
              <View style={[styles.requirementStatusRow, styles.requirementStatusPending]}>
                <Text style={styles.requirementStatusText}>Confirmacao de e-mail pendente</Text>
                <Pressable
                  style={[styles.requirementActionButton, isResendingConfirmation && styles.buttonDisabled]}
                  onPress={() => void handleResendConfirmation()}
                  disabled={isResendingConfirmation}
                >
                  {isResendingConfirmation ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.requirementActionButtonText}>Reenviar</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View style={[styles.requirementStatusRow, styles.requirementStatusDone]}>
                <Text style={styles.requirementStatusTextDone}>E-mail confirmado</Text>
              </View>
            )}
          </View>

          <TextInput
            value={checkoutRequirementData.name}
            onChangeText={(value) => handleCheckoutRequirementFieldChange('name', value)}
            placeholder="Nome completo"
            placeholderTextColor={colors.muted}
            style={styles.requirementInput}
          />
          <TextInput
            value={checkoutRequirementData.cpf}
            onChangeText={(value) => handleCheckoutRequirementFieldChange('cpf', value)}
            placeholder="CPF (somente numeros)"
            placeholderTextColor={colors.muted}
            style={styles.requirementInput}
            keyboardType="number-pad"
          />
          <TextInput
            value={checkoutRequirementData.zipCode}
            onChangeText={(value) => handleCheckoutRequirementFieldChange('zipCode', value)}
            placeholder="CEP"
            placeholderTextColor={colors.muted}
            style={styles.requirementInput}
            keyboardType="number-pad"
          />
          <TextInput
            value={checkoutRequirementData.street}
            onChangeText={(value) => handleCheckoutRequirementFieldChange('street', value)}
            placeholder="Logradouro"
            placeholderTextColor={colors.muted}
            style={styles.requirementInput}
          />
          <View style={styles.requirementGrid}>
            <TextInput
              value={checkoutRequirementData.number}
              onChangeText={(value) => handleCheckoutRequirementFieldChange('number', value)}
              placeholder="Numero"
              placeholderTextColor={colors.muted}
              style={[styles.requirementInput, styles.requirementHalfInput]}
            />
            <TextInput
              value={checkoutRequirementData.complement}
              onChangeText={(value) => handleCheckoutRequirementFieldChange('complement', value)}
              placeholder="Complemento"
              placeholderTextColor={colors.muted}
              style={[styles.requirementInput, styles.requirementHalfInput]}
            />
          </View>
          <TextInput
            value={checkoutRequirementData.neighborhood}
            onChangeText={(value) => handleCheckoutRequirementFieldChange('neighborhood', value)}
            placeholder="Bairro"
            placeholderTextColor={colors.muted}
            style={styles.requirementInput}
          />
          <View style={styles.requirementGrid}>
            <TextInput
              value={checkoutRequirementData.city}
              onChangeText={(value) => handleCheckoutRequirementFieldChange('city', value)}
              placeholder="Cidade"
              placeholderTextColor={colors.muted}
              style={[styles.requirementInput, styles.requirementCityInput]}
            />
            <TextInput
              value={checkoutRequirementData.state}
              onChangeText={(value) => handleCheckoutRequirementFieldChange('state', value.toUpperCase())}
              placeholder="UF"
              placeholderTextColor={colors.muted}
              style={[styles.requirementInput, styles.requirementStateInput]}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>

          <Pressable
            style={[styles.requirementSaveButton, isSavingCheckoutRequirements && styles.buttonDisabled]}
            onPress={() => void handleSaveCheckoutRequirements()}
            disabled={isSavingCheckoutRequirements}
          >
            {isSavingCheckoutRequirements ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.requirementSaveButtonText}>Salvar dados do checkout</Text>
            )}
          </Pressable>
        </View>
      )}

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
  requirementsCard: {
    borderWidth: 1,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  requirementsTitle: {
    color: '#92400E',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  requirementsDescription: {
    color: '#78350F',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  requirementStatusList: {
    gap: 8,
  },
  requirementStatusRow: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  requirementStatusPending: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  requirementStatusDone: {
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
  },
  requirementStatusText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  requirementStatusTextDone: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  requirementActionButton: {
    minWidth: 84,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  requirementActionButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  requirementInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  requirementGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  requirementHalfInput: {
    flex: 1,
  },
  requirementCityInput: {
    flex: 1,
  },
  requirementStateInput: {
    width: 64,
    textAlign: 'center',
  },
  requirementSaveButton: {
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
