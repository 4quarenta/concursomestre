import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAccountTransactionsQuery } from '@/features/account/api/useAccountTransactionsQuery';
import { useAuth } from '@/providers/AuthProvider';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme, type ResolvedAppTheme } from '@/theme/useAppTheme';
import type { MobileTransaction } from '@/types/transactions';

const formatDate = (raw?: string | number) => {
  if (raw === undefined || raw === null || raw === '') return '--';
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
    : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString('pt-BR');
};

const formatCurrency = (raw?: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number.isFinite(Number(raw)) ? Number(raw) : 0);

const transactionTitle = (item: MobileTransaction) => item.planName || item.transactionName || item.description || 'Transacao';
const transactionProvider = (item: MobileTransaction) => item.paymentProvider || item.payment_provider || item.provider || item.gateway || 'Nao informado';

export const AccountScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, logout, updateUser, refreshProfile, isLoading } = useAuth();
  const transactionsQuery = useAccountTransactionsQuery();
  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(user?.name || '');
  const [savingName, setSavingName] = React.useState(false);

  React.useEffect(() => {
    if (!editingName) setName(user?.name || '');
  }, [editingName, user?.name]);

  const subscription = user?.subscription;
  const planName = subscription?.plan?.name || user?.plan || 'Gratuito';
  const subscriptionStatus = subscription?.status || 'sem assinatura';
  const renewalEnabled = subscription?.cancel_at_period_end === true
    ? false
    : subscription?.auto_renew !== false;

  const refresh = async () => {
    await Promise.allSettled([refreshProfile(), transactionsQuery.refetch()]);
  };

  const saveName = async () => {
    const nextName = name.trim();
    if (nextName.length < 2) {
      Alert.alert('Conta', 'Informe um nome valido.');
      return;
    }
    setSavingName(true);
    try {
      await updateUser({ name: nextName });
      setEditingName(false);
    } catch (error: any) {
      Alert.alert('Conta', error?.message || 'Nao foi possivel atualizar o nome.');
    } finally {
      setSavingName(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Sair da conta?', 'Sua sessao neste aparelho sera encerrada.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading || transactionsQuery.isRefetching} onRefresh={() => void refresh()} tintColor={theme.primary} />}
    >
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Conta</Text>
        <Text style={styles.title}>{user?.name || 'Usuario'}</Text>
        <Text style={styles.muted}>{user?.email || '--'}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Dados pessoais</Text>
          {!editingName ? <Pressable onPress={() => setEditingName(true)}><Text style={styles.link}>Editar</Text></Pressable> : null}
        </View>

        {editingName ? (
          <View style={styles.stack}>
            <Text style={styles.label}>Nome</Text>
            <TextInput value={name} onChangeText={setName} autoCapitalize="words" style={styles.input} placeholder="Seu nome" placeholderTextColor={theme.textSubtle} />
            <View style={styles.actionsRow}>
              <Pressable disabled={savingName} style={styles.secondaryButton} onPress={() => { setEditingName(false); setName(user?.name || ''); }}><Text style={styles.secondaryText}>Cancelar</Text></Pressable>
              <Pressable disabled={savingName} style={[styles.primaryButton, savingName && styles.disabled]} onPress={() => void saveName()}>{savingName ? <ActivityIndicator color={theme.onPrimary} /> : <Text style={styles.primaryText}>Salvar</Text>}</Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.stack}>
            <View><Text style={styles.label}>Nome</Text><Text style={styles.value}>{user?.name || '--'}</Text></View>
            <View><Text style={styles.label}>E-mail</Text><Text style={styles.value}>{user?.email || '--'}</Text></View>
            <View><Text style={styles.label}>Nivel</Text><Text style={styles.value}>{user?.level ?? 1} · {user?.xp ?? 0} XP</Text></View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assinatura</Text>
        <View style={styles.planCard}>
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.muted}>Status: {subscriptionStatus}</Text>
          {subscription?.current_period_end ? <Text style={styles.muted}>Ciclo atual ate {formatDate(subscription.current_period_end)}</Text> : null}
          {subscription ? <Text style={styles.muted}>Renovacao automatica: {renewalEnabled ? 'ativada' : 'desativada'}</Text> : null}
        </View>
        <Text style={styles.helper}>Acoes de cobranca permanecem fora desta tela ate o contrato final de gateway ser consolidado. A Conta nao assume Stripe, Mercado Pago ou outro provedor como regra fixa.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Transacoes recentes</Text>
          <Pressable onPress={() => void transactionsQuery.refetch()}><Text style={styles.link}>Atualizar</Text></Pressable>
        </View>

        {transactionsQuery.isPending ? <ActivityIndicator color={theme.primary} /> : null}
        {transactionsQuery.isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{transactionsQuery.error instanceof Error ? transactionsQuery.error.message : 'Nao foi possivel carregar as transacoes.'}</Text>
          </View>
        ) : null}
        {!transactionsQuery.isPending && !transactionsQuery.isError && (transactionsQuery.data?.length || 0) === 0 ? <Text style={styles.muted}>Nenhuma transacao encontrada.</Text> : null}

        {(transactionsQuery.data || []).map((item) => (
          <View key={String(item.id)} style={styles.transactionRow}>
            <View style={styles.transactionText}>
              <Text style={styles.transactionTitle}>{transactionTitle(item)}</Text>
              <Text style={styles.muted}>{formatDate(item.createdAt || item.timestamp)} · {transactionProvider(item)}</Text>
            </View>
            <View style={styles.transactionRight}>
              <Text style={styles.value}>{formatCurrency(item.amount)}</Text>
              <Text style={styles.status}>{item.status || '--'}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sessao</Text>
        <Pressable onPress={confirmLogout} style={styles.dangerButton}><Text style={styles.dangerText}>Sair da conta</Text></Pressable>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { gap: spacing[4], padding: spacing[4], paddingBottom: spacing[10] },
  headerCard: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[1], padding: spacing[4] },
  eyebrow: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.bold, textTransform: 'uppercase' },
  title: { color: theme.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.black },
  muted: { color: theme.textMuted, fontSize: typography.size.sm },
  card: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[3], padding: spacing[4] },
  cardTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.extrabold },
  rowBetween: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  stack: { gap: spacing[3] },
  label: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  value: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  link: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  input: { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, color: theme.text, minHeight: 48, paddingHorizontal: spacing[3] },
  actionsRow: { flexDirection: 'row', gap: spacing[2] },
  primaryButton: { alignItems: 'center', backgroundColor: theme.primary, borderRadius: radius.md, flex: 1, justifyContent: 'center', minHeight: 46, paddingHorizontal: spacing[4] },
  primaryText: { color: theme.onPrimary, fontWeight: typography.weight.bold },
  secondaryButton: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 46, paddingHorizontal: spacing[4] },
  secondaryText: { color: theme.text, fontWeight: typography.weight.bold },
  disabled: { opacity: 0.55 },
  planCard: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder, borderRadius: radius.md, borderWidth: 1, gap: spacing[1], padding: spacing[3] },
  planName: { color: theme.primary, fontSize: typography.size.lg, fontWeight: typography.weight.black },
  helper: { color: theme.textMuted, fontSize: typography.size.xs, lineHeight: 18 },
  errorCard: { backgroundColor: theme.dangerSubtle, borderColor: theme.dangerBorder, borderRadius: radius.md, borderWidth: 1, padding: spacing[3] },
  errorText: { color: theme.danger, fontSize: typography.size.sm },
  transactionRow: { alignItems: 'flex-start', borderTopColor: theme.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between', paddingTop: spacing[3] },
  transactionText: { flex: 1, gap: spacing[1] },
  transactionTitle: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  transactionRight: { alignItems: 'flex-end', gap: spacing[1] },
  status: { color: theme.textMuted, fontSize: typography.size.xs, textTransform: 'capitalize' },
  dangerButton: { alignItems: 'center', backgroundColor: theme.dangerSubtle, borderColor: theme.dangerBorder, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing[4] },
  dangerText: { color: theme.danger, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
});

export default AccountScreen;
