import React from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAccountTransactionsQuery } from "@/features/account/api/useAccountTransactionsQuery";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { accountService } from "@/services/auth/accountService";
import { subscriptionsService } from "@/services/subscriptions/subscriptionsService";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import type { MobileTransaction } from "@/types/transactions";

const formatDate = (raw?: string | number) => {
  if (raw === undefined || raw === null || raw === "") return "--";
  const numeric = Number(raw);
  const date =
    Number.isFinite(numeric) && numeric > 0
      ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
      : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleDateString("pt-BR");
};

const formatCurrency = (raw?: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(Number(raw)) ? Number(raw) : 0);

const transactionTitle = (item: MobileTransaction) =>
  item.planName || item.transactionName || item.description || "Transacao";
const transactionProvider = (item: MobileTransaction) =>
  item.paymentProvider ||
  item.payment_provider ||
  item.provider ||
  item.gateway ||
  "Nao informado";
const isManagedSubscriptionStatus = (status?: string) =>
  ["active", "trialing", "past_due"].includes(
    String(status || "").toLowerCase(),
  );

export const AccountScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser, refreshProfile, isLoading } = useAuth();
  const transactionsQuery = useAccountTransactionsQuery();

  const [editingName, setEditingName] = React.useState(false);
  const [name, setName] = React.useState(user?.name || "");
  const [savingName, setSavingName] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [deletionPassword, setDeletionPassword] = React.useState("");
  const [deletionReason, setDeletionReason] = React.useState("");
  const [requestingDeletion, setRequestingDeletion] = React.useState(false);
  const [updatingRenewal, setUpdatingRenewal] = React.useState(false);
  const [openingPortal, setOpeningPortal] = React.useState(false);

  React.useEffect(() => {
    if (!editingName) setName(user?.name || "");
  }, [editingName, user?.name]);

  const subscription = user?.subscription;
  const planName = subscription?.plan?.name || user?.plan || "Gratuito";
  const subscriptionStatus = subscription?.status || "sem assinatura";
  const renewalEnabled =
    subscription?.cancel_at_period_end === true
      ? false
      : subscription?.auto_renew !== false;
  const paymentProvider = String(
    subscription?.payment_provider || "",
  ).toLowerCase();
  const canManageStripeSubscription =
    paymentProvider === "stripe" &&
    isManagedSubscriptionStatus(subscription?.status);

  const refresh = async () => {
    await Promise.allSettled([refreshProfile(), transactionsQuery.refetch()]);
  };

  const saveName = async () => {
    const nextName = name.trim();
    if (nextName.length < 2)
      return Alert.alert("Conta", "Informe um nome valido.");
    setSavingName(true);
    try {
      await updateUser({ name: nextName });
      setEditingName(false);
    } catch (error: any) {
      Alert.alert(
        "Conta",
        error?.message || "Nao foi possivel atualizar o nome.",
      );
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword)
      return Alert.alert("Seguranca", "Informe a senha atual e a nova senha.");
    if (newPassword.length < 6)
      return Alert.alert(
        "Seguranca",
        "A nova senha precisa ter pelo menos 6 caracteres.",
      );
    if (newPassword !== confirmPassword)
      return Alert.alert(
        "Seguranca",
        "A confirmacao da nova senha nao confere.",
      );
    setChangingPassword(true);
    try {
      const result = await accountService.changePassword(
        currentPassword,
        newPassword,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Seguranca", result.message);
    } catch (error: any) {
      Alert.alert(
        "Seguranca",
        error?.message || "Nao foi possivel alterar a senha.",
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const toggleRenewal = () => {
    const nextValue = !renewalEnabled;
    Alert.alert(
      nextValue
        ? "Ativar renovacao automatica?"
        : "Desativar renovacao automatica?",
      nextValue
        ? "O backend validara o meio de pagamento e reativara a renovacao da assinatura."
        : "Seu acesso atual sera mantido conforme o periodo ou termo contratado. Novas renovacoes serao desativadas.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: nextValue ? "Ativar" : "Desativar",
          style: nextValue ? "default" : "destructive",
          onPress: async () => {
            setUpdatingRenewal(true);
            try {
              const result =
                await subscriptionsService.updateRenewal(nextValue);
              await refreshProfile();
              Alert.alert(
                "Assinatura",
                result.message ||
                  (nextValue ? "Renovacao ativada." : "Renovacao desativada."),
              );
            } catch (error: any) {
              Alert.alert(
                "Assinatura",
                error?.message || "Nao foi possivel atualizar a renovacao.",
              );
            } finally {
              setUpdatingRenewal(false);
            }
          },
        },
      ],
    );
  };

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const result = await subscriptionsService.createStripePortalSession();
      const supported = await Linking.canOpenURL(result.url);
      if (!supported)
        throw new Error(
          "Nao foi possivel abrir o gerenciamento de cobranca neste aparelho.",
        );
      await Linking.openURL(result.url);
    } catch (error: any) {
      Alert.alert(
        "Cobranca",
        error?.message || "Nao foi possivel abrir o gerenciamento de cobranca.",
      );
    } finally {
      setOpeningPortal(false);
    }
  };

  const requestDeletion = () => {
    if (!deletionPassword || deletionReason.trim().length < 3) {
      Alert.alert(
        "Excluir conta",
        "Informe sua senha atual e o motivo da exclusao.",
      );
      return;
    }
    Alert.alert(
      "Solicitar exclusao da conta?",
      "Sua solicitacao sera registrada no servidor. Esta acao exige reautenticacao pela senha atual.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Solicitar exclusao",
          style: "destructive",
          onPress: async () => {
            setRequestingDeletion(true);
            try {
              const result = await accountService.requestAccountDeletion(
                deletionPassword,
                deletionReason.trim(),
              );
              Alert.alert("Conta", result.message, [
                { text: "OK", onPress: () => void logout() },
              ]);
            } catch (error: any) {
              Alert.alert(
                "Excluir conta",
                error?.message || "Nao foi possivel registrar a solicitacao.",
              );
            } finally {
              setRequestingDeletion(false);
            }
          },
        },
      ],
    );
  };

  const confirmLogout = () =>
    Alert.alert("Sair da conta?", "Sua sessao neste aparelho sera encerrada.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => void logout() },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: spacing[4],
          paddingBottom: spacing[10] + insets.bottom + 64,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isLoading || transactionsQuery.isRefetching}
          onRefresh={() => void refresh()}
          tintColor={theme.primary}
        />
      }
    >
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Conta</Text>
        <Text style={styles.title}>{user?.name || "Usuario"}</Text>
        <Text style={styles.muted}>{user?.email || "--"}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Dados pessoais</Text>
          {!editingName ? (
            <Pressable onPress={() => setEditingName(true)}>
              <Text style={styles.link}>Editar</Text>
            </Pressable>
          ) : null}
        </View>
        {editingName ? (
          <View style={styles.stack}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              style={styles.input}
              placeholder="Seu nome"
              placeholderTextColor={theme.textSubtle}
            />
            <View style={styles.actionsRow}>
              <Pressable
                disabled={savingName}
                style={styles.secondaryButton}
                onPress={() => {
                  setEditingName(false);
                  setName(user?.name || "");
                }}
              >
                <Text style={styles.secondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={savingName}
                style={[styles.primaryButton, savingName && styles.disabled]}
                onPress={() => void saveName()}
              >
                {savingName ? (
                  <ActivityIndicator color={theme.onPrimary} />
                ) : (
                  <Text style={styles.primaryText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.stack}>
            <View>
              <Text style={styles.label}>Nome</Text>
              <Text style={styles.value}>{user?.name || "--"}</Text>
            </View>
            <View>
              <Text style={styles.label}>E-mail</Text>
              <Text style={styles.value}>{user?.email || "--"}</Text>
            </View>
            <View>
              <Text style={styles.label}>Nivel</Text>
              <Text style={styles.value}>
                {user?.level ?? 1} · {user?.xp ?? 0} XP
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assinatura</Text>
        <View style={styles.planCard}>
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.muted}>Status: {subscriptionStatus}</Text>
          {paymentProvider ? (
            <Text style={styles.muted}>
              Provedor:{" "}
              {paymentProvider === "stripe" ? "Stripe" : paymentProvider}
            </Text>
          ) : null}
          {subscription?.current_period_end ? (
            <Text style={styles.muted}>
              Ciclo atual ate {formatDate(subscription.current_period_end)}
            </Text>
          ) : null}
          {subscription ? (
            <Text style={styles.muted}>
              Renovacao automatica: {renewalEnabled ? "ativada" : "desativada"}
            </Text>
          ) : null}
          {subscription?.next_renewal_date && renewalEnabled ? (
            <Text style={styles.muted}>
              Proxima renovacao: {formatDate(subscription.next_renewal_date)}
            </Text>
          ) : null}
          {Number(subscription?.next_renewal_amount || 0) > 0 &&
          renewalEnabled ? (
            <Text style={styles.muted}>
              Valor previsto:{" "}
              {formatCurrency(subscription?.next_renewal_amount)}
            </Text>
          ) : null}
        </View>

        {user?.paymentIssue?.message ? (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Atencao com o pagamento</Text>
            <Text style={styles.warningText}>{user.paymentIssue.message}</Text>
          </View>
        ) : null}

        {canManageStripeSubscription ? (
          <View style={styles.stack}>
            <Pressable
              disabled={updatingRenewal}
              style={[
                renewalEnabled ? styles.dangerButton : styles.primaryButtonWide,
                updatingRenewal && styles.disabled,
              ]}
              onPress={toggleRenewal}
            >
              {updatingRenewal ? (
                <ActivityIndicator
                  color={renewalEnabled ? theme.danger : theme.onPrimary}
                />
              ) : (
                <Text
                  style={
                    renewalEnabled ? styles.dangerText : styles.primaryText
                  }
                >
                  {renewalEnabled
                    ? "Desativar renovacao automatica"
                    : "Reativar renovacao automatica"}
                </Text>
              )}
            </Pressable>
            <Pressable
              disabled={openingPortal}
              style={[
                styles.secondaryButtonWide,
                openingPortal && styles.disabled,
              ]}
              onPress={() => void openBillingPortal()}
            >
              {openingPortal ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Text style={styles.secondaryText}>
                  {subscription?.payment_blocking
                    ? "Regularizar pagamento"
                    : "Gerenciar cobranca"}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {subscription && paymentProvider !== "stripe" ? (
          <Text style={styles.helper}>
            Esta assinatura nao usa o fluxo Stripe gerenciavel pelo aplicativo.
            O app preserva o acesso e exibe o estado recebido do servidor.
          </Text>
        ) : null}
        {!subscription ? (
          <Text style={styles.helper}>
            Nenhuma assinatura ativa vinculada a esta conta.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Transacoes recentes</Text>
          <Pressable onPress={() => void transactionsQuery.refetch()}>
            <Text style={styles.link}>Atualizar</Text>
          </Pressable>
        </View>
        {transactionsQuery.isPending ? (
          <ActivityIndicator color={theme.primary} />
        ) : null}
        {transactionsQuery.isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              {transactionsQuery.error instanceof Error
                ? transactionsQuery.error.message
                : "Nao foi possivel carregar as transacoes."}
            </Text>
          </View>
        ) : null}
        {!transactionsQuery.isPending &&
        !transactionsQuery.isError &&
        (transactionsQuery.data?.length || 0) === 0 ? (
          <Text style={styles.muted}>Nenhuma transacao encontrada.</Text>
        ) : null}
        {(transactionsQuery.data || []).map((item) => (
          <View key={String(item.id)} style={styles.transactionRow}>
            <View style={styles.transactionText}>
              <Text style={styles.transactionTitle}>
                {transactionTitle(item)}
              </Text>
              <Text style={styles.muted}>
                {formatDate(item.createdAt || item.timestamp)} ·{" "}
                {transactionProvider(item)}
              </Text>
            </View>
            <View style={styles.transactionRight}>
              <Text style={styles.value}>{formatCurrency(item.amount)}</Text>
              <Text style={styles.status}>{item.status || "--"}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Seguranca</Text>
        <Text style={styles.helper}>Alterar senha</Text>
        <TextInput
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
          style={styles.input}
          placeholder="Senha atual"
          placeholderTextColor={theme.textSubtle}
          autoCapitalize="none"
        />
        <TextInput
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
          style={styles.input}
          placeholder="Nova senha"
          placeholderTextColor={theme.textSubtle}
          autoCapitalize="none"
        />
        <TextInput
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          style={styles.input}
          placeholder="Confirmar nova senha"
          placeholderTextColor={theme.textSubtle}
          autoCapitalize="none"
        />
        <Pressable
          disabled={changingPassword}
          style={[
            styles.primaryButtonWide,
            changingPassword && styles.disabled,
          ]}
          onPress={() => void changePassword()}
        >
          {changingPassword ? (
            <ActivityIndicator color={theme.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>Alterar senha</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Exclusao da conta</Text>
        <Text style={styles.helper}>
          O pedido de exclusao e registrado no servidor e exige confirmacao da
          senha atual. O app encerra a sessao apos o pedido.
        </Text>
        <TextInput
          secureTextEntry
          value={deletionPassword}
          onChangeText={setDeletionPassword}
          style={styles.input}
          placeholder="Senha atual"
          placeholderTextColor={theme.textSubtle}
          autoCapitalize="none"
        />
        <TextInput
          value={deletionReason}
          onChangeText={setDeletionReason}
          style={[styles.input, styles.multiline]}
          placeholder="Motivo da exclusao"
          placeholderTextColor={theme.textSubtle}
          multiline
        />
        <Pressable
          disabled={requestingDeletion}
          onPress={requestDeletion}
          style={[styles.dangerButton, requestingDeletion && styles.disabled]}
        >
          {requestingDeletion ? (
            <ActivityIndicator color={theme.danger} />
          ) : (
            <Text style={styles.dangerText}>Solicitar exclusao da conta</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sessao</Text>
        <Pressable onPress={confirmLogout} style={styles.secondaryButtonWide}>
          <Text style={styles.secondaryText}>Sair da conta</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: {
      gap: spacing[4],
      padding: spacing[4],
      paddingBottom: spacing[10],
    },
    headerCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[1],
      padding: spacing[4],
    },
    eyebrow: {
      color: theme.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase",
    },
    title: {
      color: theme.text,
      fontSize: typography.size["2xl"],
      fontWeight: typography.weight.black,
    },
    muted: { color: theme.textMuted, fontSize: typography.size.sm },
    card: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing[3],
      padding: spacing[4],
    },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.extrabold,
    },
    rowBetween: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing[3],
    },
    stack: { gap: spacing[3] },
    label: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    value: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    link: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    input: {
      backgroundColor: theme.surfaceSubtle,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: theme.text,
      minHeight: 48,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    multiline: { minHeight: 84, textAlignVertical: "top" },
    actionsRow: { flexDirection: "row", gap: spacing[2] },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      flex: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing[4],
    },
    primaryButtonWide: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    primaryText: { color: theme.onPrimary, fontWeight: typography.weight.bold },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing[4],
    },
    secondaryButtonWide: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    secondaryText: { color: theme.text, fontWeight: typography.weight.bold },
    disabled: { opacity: 0.55 },
    planCard: {
      backgroundColor: theme.primarySubtle,
      borderColor: theme.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing[1],
      padding: spacing[3],
    },
    planName: {
      color: theme.primary,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.black,
    },
    helper: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      lineHeight: 18,
    },
    warningCard: {
      backgroundColor: theme.warningSubtle,
      borderColor: theme.warningBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing[1],
      padding: spacing[3],
    },
    warningTitle: {
      color: theme.warning,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    warningText: {
      color: theme.text,
      fontSize: typography.size.sm,
      lineHeight: 20,
    },
    errorCard: {
      backgroundColor: theme.dangerSubtle,
      borderColor: theme.dangerBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing[3],
    },
    errorText: { color: theme.danger, fontSize: typography.size.sm },
    transactionRow: {
      alignItems: "flex-start",
      borderTopColor: theme.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      justifyContent: "space-between",
      paddingTop: spacing[3],
    },
    transactionText: { flex: 1, gap: spacing[1] },
    transactionTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    transactionRight: { alignItems: "flex-end", gap: spacing[1] },
    status: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      textTransform: "capitalize",
    },
    dangerButton: {
      alignItems: "center",
      backgroundColor: theme.dangerSubtle,
      borderColor: theme.dangerBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    dangerText: {
      color: theme.danger,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
  });

export default AccountScreen;
