import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList, CheckoutRoutePlan } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { planService } from '@/services/plans/planService';
import { colors } from '@/theme/colors';
import type { Plan } from '@/types/plans';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
};

const formatInterval = (plan: Plan) => {
  const count = Number(plan.interval_count || 1);
  const unit = String(plan.interval_unit || 'month');

  if (unit === 'year') return 'ano';
  if (unit === 'month' && count === 3) return '3 meses';
  if (unit === 'month') return 'mes';
  if (unit === 'week') return count > 1 ? `${count} semanas` : 'semana';
  if (unit === 'day') return count > 1 ? `${count} dias` : 'dia';
  return 'periodo';
};

const hasActiveSubscriptionStatus = (status?: string): boolean => {
  const normalized = String(status || '').toLowerCase();
  return ['active', 'trialing', 'past_due'].includes(normalized);
};

const resolvePlanTier = (plan: Pick<Plan, 'tier' | 'name'>): number => {
  const explicitTier = Number(plan.tier || 0);
  if (explicitTier > 0) return explicitTier;

  const normalizedName = String(plan.name || '').toLowerCase();
  if (normalizedName.includes('elite')) return 3;
  if (normalizedName.includes('pro')) return 2;
  if (normalizedName.includes('essencial')) return 1;
  return 0;
};

const resolvePlanTimeScore = (plan: Pick<Plan, 'interval_unit' | 'interval_count'>): number => {
  if (plan.interval_unit === 'year') return 12;
  if (plan.interval_unit === 'month') return Number(plan.interval_count || 1);
  return 1;
};

const normalizeCheckoutPlan = (plan: Plan): CheckoutRoutePlan => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  price: Number(plan.price || 0),
  interval_count: Number(plan.interval_count || 1),
  interval_unit: plan.interval_unit || 'month',
});

/**
 * Tela mobile de planos com origem em catalogo oficial.
 * @since v1.0.0
 */
export const PlansScreen: React.FC = () => {
  const { user, systemSettings } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const allowSameTierCycleChangeEnabled = Boolean(systemSettings.sameTierCycleChangeEnabled);
  const hasActiveSubscription = hasActiveSubscriptionStatus(user?.subscription?.status);
  const currentPlanId = hasActiveSubscription ? Number(user?.subscription?.plan_id || 0) : 0;
  const currentPlanInCatalog = React.useMemo(
    () => plans.find((plan) => Number(plan.id) === currentPlanId) || null,
    [currentPlanId, plans],
  );
  const currentTier = React.useMemo(() => {
    if (!hasActiveSubscription) return 0;
    if (currentPlanInCatalog) return resolvePlanTier(currentPlanInCatalog);
    return resolvePlanTier({
      tier: undefined,
      name: String(user?.subscription?.plan?.name || ''),
    });
  }, [currentPlanInCatalog, hasActiveSubscription, user?.subscription?.plan?.name]);
  const currentTimeScore = React.useMemo(
    () => (currentPlanInCatalog ? resolvePlanTimeScore(currentPlanInCatalog) : 0),
    [currentPlanInCatalog],
  );

  const loadPlans = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rows = await planService.getPlans();
      const activeRows = rows
        .filter((plan) => plan && (plan.is_active === undefined || plan.is_active))
        .sort((a, b) => {
          const tierA = Number(a.tier || 0);
          const tierB = Number(b.tier || 0);
          if (tierA !== tierB) return tierA - tierB;
          return Number(a.price || 0) - Number(b.price || 0);
        });
      setPlans(activeRows);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar os planos.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadPlans(false);
  }, [loadPlans]);

  const resolvePlanActionState = React.useCallback((plan: Plan) => {
    const isCurrent = hasActiveSubscription && currentPlanId > 0 && Number(plan.id) === currentPlanId;
    if (!hasActiveSubscription || isCurrent) {
      return { isCurrent, isLower: false, blocksSameTierCycleChange: false };
    }

    const targetTier = resolvePlanTier(plan);
    const targetTimeScore = resolvePlanTimeScore(plan);
    const blocksSameTierCycleChange = !allowSameTierCycleChangeEnabled && targetTier === currentTier;
    const isLower = targetTier < currentTier && targetTimeScore <= currentTimeScore;

    return { isCurrent: false, isLower, blocksSameTierCycleChange };
  }, [
    allowSameTierCycleChangeEnabled,
    currentPlanId,
    currentTier,
    currentTimeScore,
    hasActiveSubscription,
  ]);

  const handleOpenCheckout = (plan: Plan) => {
    if (Number(plan.price || 0) <= 0) {
      Alert.alert('Plano gratuito', 'Este plano nao exige pagamento no checkout.');
      return;
    }

    const actionState = resolvePlanActionState(plan);
    if (actionState.isCurrent) {
      Alert.alert('Plano atual', 'Este ja e o plano ativo da sua assinatura.');
      return;
    }
    if (actionState.blocksSameTierCycleChange) {
      Alert.alert(
        'Troca de ciclo indisponivel',
        'A troca de ciclo no mesmo tier esta desativada no painel admin.',
      );
      return;
    }
    if (actionState.isLower) {
      Alert.alert(
        'Downgrade indisponivel',
        'Nao e possivel iniciar downgrade para plano inferior enquanto sua assinatura atual estiver ativa.',
      );
      return;
    }

    navigation.navigate('Checkout', {
      plan: normalizeCheckoutPlan(plan),
    });
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={plans}
        keyExtractor={(item) => String(item.id)}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPlans(true)}
            tintColor={colors.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerCard}>
            <Text style={styles.eyebrow}>Planos de assinatura</Text>
            <Text style={styles.title}>Escolha seu plano no app</Text>
            <Text style={styles.description}>
              Selecione um plano para seguir no checkout seguro da plataforma.
            </Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum plano disponivel</Text>
            <Text style={styles.emptyText}>Tente novamente em alguns instantes.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          (() => {
            const actionState = resolvePlanActionState(item);
            const ctaLabel = actionState.isCurrent
              ? 'Plano atual'
              : actionState.blocksSameTierCycleChange
                ? 'Troca de ciclo indisponivel'
                : actionState.isLower
                ? 'Downgrade indisponivel'
                : 'Assinar plano';
            const shouldShowStateBadge = (
              actionState.isCurrent
              || actionState.isLower
              || actionState.blocksSameTierCycleChange
            );
            const stateBadgeText = actionState.isCurrent
              ? 'Plano ativo'
              : actionState.blocksSameTierCycleChange
                ? 'Mesmo tier bloqueado'
                : 'Plano inferior bloqueado';

            return (
          <View style={styles.planCard}>
            <View style={styles.planHead}>
              <View style={styles.planNameBlock}>
                <Text style={styles.planName}>{item.name}</Text>
                <Text style={styles.planInterval}>Ciclo: {formatInterval(item)}</Text>
              </View>
              <Text style={styles.planPrice}>{formatCurrency(item.price)}</Text>
            </View>

            {shouldShowStateBadge && (
              <View style={[styles.planStateBadge, actionState.isCurrent ? styles.planStateBadgeActive : styles.planStateBadgeMuted]}>
                <Text style={[styles.planStateBadgeText, actionState.isCurrent ? styles.planStateBadgeTextActive : styles.planStateBadgeTextMuted]}>
                  {stateBadgeText}
                </Text>
              </View>
            )}

            {!!item.description && (
              <Text style={styles.planDescription}>{item.description}</Text>
            )}

            <Pressable
              style={[
                styles.ctaButton,
                (
                  actionState.isCurrent
                  || actionState.isLower
                  || actionState.blocksSameTierCycleChange
                ) && styles.ctaButtonDisabled,
              ]}
              onPress={() => handleOpenCheckout(item)}
            >
              <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
            </Pressable>
          </View>
            );
          })()
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 6,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  planCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 12,
  },
  planHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  planNameBlock: {
    flex: 1,
    gap: 2,
  },
  planName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  planInterval: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planPrice: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  planDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  planStateBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planStateBadgeActive: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF3',
  },
  planStateBadgeMuted: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  planStateBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  planStateBadgeTextActive: {
    color: '#047857',
  },
  planStateBadgeTextMuted: {
    color: '#B45309',
  },
  ctaButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: '#64748B',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default PlansScreen;
