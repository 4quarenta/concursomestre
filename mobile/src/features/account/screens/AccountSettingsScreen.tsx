import React from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppButton, AppSurface, AppText, MotionPressable } from "@/components/ui/Primitives";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { useAuth } from "@/providers/AuthProvider";
import { accountService } from "@/services/auth/accountService";
import { readApiErrorMessage } from "@/services/api/response";
import { borders, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function AccountSettingsScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  const changePassword = async () => {
    setErrorMessage("");
    setSuccessMessage("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Preencha sua senha atual, a nova senha e a confirmação.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("A confirmação da nova senha não confere.");
      return;
    }

    setSaving(true);
    try {
      const result = await accountService.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(readApiErrorMessage(error, "Não foi possível alterar a senha. Tente novamente."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ContentHeader title="Conta" subtitle="Email e senha" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing[6] + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {user ? (
          <>
            <AppSurface variant="outlined" style={styles.accountCard}>
              <AppText variant="sectionTitle">Informações da conta</AppText>
              <AccountInfoRow icon="mail-outline" label="Email" value={user.email || "Não informado"} theme={theme} />
              <AccountInfoRow icon="person-outline" label="Nome" value={user.name || "Não informado"} theme={theme} last />
            </AppSurface>

            <View style={styles.section}>
              <AppText variant="sectionTitle">Alterar senha</AppText>
              <AppText variant="body" tone="muted">Confirme sua senha atual para definir uma nova.</AppText>
              <AppSurface variant="outlined" style={styles.passwordCard}>
                <PasswordInput label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} autoComplete="current-password" textContentType="password" theme={theme} />
                <PasswordInput label="Nova senha" value={newPassword} onChangeText={setNewPassword} autoComplete="new-password" textContentType="newPassword" theme={theme} />
                <PasswordInput label="Confirmar nova senha" value={confirmPassword} onChangeText={setConfirmPassword} autoComplete="new-password" textContentType="newPassword" theme={theme} />
                {errorMessage ? <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{errorMessage}</AppText> : null}
                {successMessage ? <AppText variant="caption" tone="success" accessibilityLiveRegion="polite">{successMessage}</AppText> : null}
                <AppButton label="Salvar nova senha" onPress={() => void changePassword()} loading={saving} />
              </AppSurface>
            </View>
          </>
        ) : (
          <AppSurface variant="outlined" style={styles.guestCard}>
            <Ionicons name="lock-closed-outline" size={26} color={theme.primary} />
            <AppText variant="sectionTitle">Entre na sua conta</AppText>
            <AppText variant="body" tone="muted">É necessário estar conectado para consultar os dados da conta ou alterar a senha.</AppText>
            <AppButton label="Entrar" onPress={() => router.push("/login" as never)} />
          </AppSurface>
        )}
      </ScrollView>
    </View>
  );
}

function AccountInfoRow({
  icon,
  label,
  value,
  theme,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: ReturnType<typeof useAppTheme>;
  last?: boolean;
}) {
  const styles = createStyles(theme);
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <View style={styles.infoCopy}>
        <AppText variant="caption" tone="muted">{label}</AppText>
        <AppText variant="bodyStrong">{value}</AppText>
      </View>
    </View>
  );
}

function PasswordInput({
  label,
  value,
  onChangeText,
  autoComplete,
  textContentType,
  theme,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  textContentType: "password" | "newPassword";
  theme: ReturnType<typeof useAppTheme>;
}) {
  const [visible, setVisible] = React.useState(false);
  const styles = createStyles(theme);
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete={autoComplete}
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={label}
          placeholderTextColor={theme.textSubtle}
          secureTextEntry={!visible}
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          onPress={() => setVisible((current) => !current)}
          style={styles.visibilityButton}
        >
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={19} color={theme.textMuted} />
        </MotionPressable>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[5], padding: spacing[5] },
  accountCard: { gap: spacing[2] },
  section: { gap: spacing[3] },
  passwordCard: { gap: spacing[3] },
  infoRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 64, paddingVertical: spacing[2] },
  infoRowBorder: { borderBottomColor: theme.border, borderBottomWidth: borders.hairline },
  infoIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.button, height: 40, justifyContent: "center", width: 40 },
  infoCopy: { flex: 1, gap: spacing[1] },
  field: { gap: spacing[1] },
  inputRow: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.field, borderWidth: borders.subtle, flexDirection: "row", minHeight: 48 },
  input: { color: theme.text, flex: 1, fontSize: typography.role.body.fontSize, minHeight: 46, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  visibilityButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  guestCard: { alignItems: "flex-start", gap: spacing[3] },
});

export default AccountSettingsScreen;
