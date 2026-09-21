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
import { PUBLIC_LINKS } from "@/config/publicLinks";
import { useAuth } from "@/providers/AuthProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { accountService } from "@/services/auth/accountService";
import { subscriptionsService } from "@/services/subscriptions/subscriptionsService";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

const formatDate = (raw?: string | number) => {
  if (raw === undefined || raw === null || raw === "") return "--";
  const numeric = Number(raw);
  const date =
    Number.isFinite(numeric) && numeric > 0
      ? new Date(numeric > 9999999999 ? numeric : numeric * 1000)
      : new Date(String(raw));
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleDateString("pt-BR");
};

export const StoreAccountScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user, logout, refreshProfile, isLoading } = useAuth();

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [deletionPassword, setDeletionPassword] = React.useState("");
  const [deletionReason, setDeletionReason] = React.useState("");
  const [requestingDeletion, setRequestingDeletion] = React.useState(false);
  const [cancellingRenewal, setCancellingRenewal] = React.useState(false);

  const subscription = user?.subscription;
  const planName = subscription?.plan?.name || user?.plan || "Gratuito";
  const subscriptionStatus = subscription?.status || "sem assinatura";
  const renewalEnabled =
    subscription?.cancel_at_period_end === true
      ? false
      : subscription?.auto_renew !== false;

  const openPublicLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error("URL indisponivel");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Navegacao", "Nao foi possivel abrir este link agora.");
    }
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Seguranca", "Informe a senha atual e a nova senha.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(
        "Seguranca",
        "A nova senha precisa ter pelo menos 6 caracteres.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Seguranca", "A confirmacao da nova senha nao confere.");
      return;
    }

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

  const cancelRenewal = () => {
    Alert.alert(
      "Desativar renovacao automatica?",
      "O acesso atual sera mantido pelo periodo contratado. Esta versao do aplicativo nao inicia compras ou reativacoes de assinatura.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: async () => {
            setCancellingRenewal(true);
            try {
              const result = await subscriptionsService.updateRenewal(false);
              await refreshProfile();
              Alert.alert(
                "Assinatura",
                result.message || "Renovacao automatica desativada.",
              );
            } catch (error: any) {
              Alert.alert(
                "Assinatura",
                error?.message || "Nao foi possivel atualizar a renovacao.",
              );
            } finally {
              setCancellingRenewal(false);
            }
          },
        },
      ],
    );
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
          refreshing={isLoading}
          onRefresh={() => void refreshProfile()}
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
        <Text style={styles.cardTitle}>Assinatura</Text>
        <View style={styles.planCard}>
          <Text style={styles.planName}>{planName}</Text>
          <Text style={styles.muted}>Status: {subscriptionStatus}</Text>
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
        </View>
        <Text style={styles.helper}>
          Esta versao para loja reconhece o acesso associado a sua conta, mas
          nao inicia compras, upgrades ou pagamentos externos.
        </Text>
        {subscription && renewalEnabled ? (
          <Pressable
            disabled={cancellingRenewal}
            onPress={cancelRenewal}
            style={[styles.dangerButton, cancellingRenewal && styles.disabled]}
          >
            {cancellingRenewal ? (
              <ActivityIndicator color={theme.danger} />
            ) : (
              <Text style={styles.dangerText}>
                Desativar renovacao automatica
              </Text>
            )}
          </Pressable>
        ) : null}
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
        <Text style={styles.cardTitle}>Documentos e suporte</Text>
        <Pressable
          onPress={() => void openPublicLink(PUBLIC_LINKS.privacy)}
          style={styles.secondaryButtonWide}
        >
          <Text style={styles.secondaryText}>Politica de Privacidade</Text>
        </Pressable>
        <Pressable
          onPress={() => void openPublicLink(PUBLIC_LINKS.terms)}
          style={styles.secondaryButtonWide}
        >
          <Text style={styles.secondaryText}>Termos de Uso</Text>
        </Pressable>
        <Pressable
          onPress={() => void openPublicLink(PUBLIC_LINKS.support)}
          style={styles.secondaryButtonWide}
        >
          <Text style={styles.secondaryText}>Suporte</Text>
        </Pressable>
        <Pressable
          onPress={() => void openPublicLink(PUBLIC_LINKS.accountDeletion)}
          style={styles.secondaryButtonWide}
        >
          <Text style={styles.secondaryText}>Exclusao de conta na web</Text>
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
    primaryButtonWide: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.md,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing[4],
    },
    primaryText: { color: theme.onPrimary, fontWeight: typography.weight.bold },
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
    disabled: { opacity: 0.55 },
  });

export default StoreAccountScreen;
