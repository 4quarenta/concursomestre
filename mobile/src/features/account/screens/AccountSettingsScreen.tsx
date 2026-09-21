import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { useAuth } from "@/providers/AuthProvider";
import { accountService } from "@/services/auth/accountService";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export function AccountSettingsScreen() {
  const theme = useAppTheme();
  const { user, logout } = useAuth();
  const [passwordOpen, setPasswordOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const changePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert("Segurança", "Informe a senha atual e a nova senha.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Segurança", "A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Segurança", "A confirmação da nova senha não confere.");
      return;
    }

    setSaving(true);
    try {
      const result = await accountService.changePassword(
        currentPassword,
        newPassword,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
      Alert.alert("Segurança", result.message);
    } catch (error: any) {
      Alert.alert(
        "Segurança",
        error?.message || "Não foi possível alterar a senha.",
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () =>
    Alert.alert("Sair da conta?", "Sua sessão neste aparelho será encerrada.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => void logout() },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title="Conta" subtitle="Email e senha" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            INFORMAÇÕES DA CONTA
          </Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <InfoRow
              icon="mail-outline"
              label="Email da conta"
              value={user?.email || "Não informado"}
              theme={theme}
            />
            <InfoRow
              icon="person-outline"
              label="Nome"
              value={user?.name || "Não informado"}
              theme={theme}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            SEGURANÇA
          </Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPasswordOpen((current) => !current)}
              style={styles.actionRow}
            >
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.text} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Senha</Text>
                <Text style={[styles.rowDescription, { color: theme.textMuted }]}>
                  {passwordOpen ? "Atualize sua senha com segurança" : "Altere sua senha atual"}
                </Text>
              </View>
              <Ionicons
                name={passwordOpen ? "chevron-up" : "chevron-forward"}
                size={20}
                color={theme.textMuted}
              />
            </Pressable>

            {passwordOpen && (
              <View style={[styles.passwordForm, { borderTopColor: theme.border }]}>
                <TextInput
                  secureTextEntry
                  placeholder="Senha atual"
                  placeholderTextColor={theme.textMuted}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                />
                <TextInput
                  secureTextEntry
                  placeholder="Nova senha"
                  placeholderTextColor={theme.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                />
                <TextInput
                  secureTextEntry
                  placeholder="Confirmar nova senha"
                  placeholderTextColor={theme.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void changePassword()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.onPrimary} />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: theme.onPrimary }]}>Salvar nova senha</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            SESSÃO
          </Text>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.actionRow}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
                <Ionicons name="phone-portrait-outline" size={18} color={theme.text} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>Sessão atual</Text>
                <Text style={[styles.rowDescription, { color: theme.textMuted }]}>Este aparelho</Text>
              </View>
              <View style={[styles.activeDot, { backgroundColor: theme.success }]} />
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={confirmLogout}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Sair da conta</Text>
        </Pressable>
        <Text style={[styles.helper, { color: theme.textMuted }]}>
          As alterações de senha são processadas com segurança pela plataforma.
        </Text>
      </ScrollView>
    </View>
  );
}

function InfoRow({
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
  return (
    <View style={[styles.actionRow, !last && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.surfaceSubtle }]}>
        <Ionicons name={icon} size={18} color={theme.text} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.rowTitle, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowDescription, { color: theme.textMuted }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: spacing[6],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    paddingBottom: spacing[12],
  },
  section: { gap: spacing[2] },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 1,
    paddingHorizontal: spacing[1],
  },
  card: { borderRadius: radius.lg, elevation: 2, overflow: "hidden", shadowOpacity: 0.06, shadowRadius: 5 },
  actionRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 72, padding: spacing[4] },
  iconBox: { alignItems: "center", borderRadius: radius.md, height: 40, justifyContent: "center", width: 40 },
  copy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  rowDescription: { fontSize: typography.size.xs, lineHeight: 17 },
  passwordForm: { borderTopWidth: StyleSheet.hairlineWidth, gap: spacing[3], padding: spacing[4] },
  input: { borderRadius: radius.md, borderWidth: 1, minHeight: 48, paddingHorizontal: spacing[3] },
  primaryButton: { alignItems: "center", borderRadius: radius.md, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[4] },
  primaryButtonText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  activeDot: { borderRadius: radius.pill, height: 10, width: 10 },
  logout: { alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 48, paddingHorizontal: spacing[2] },
  logoutText: { fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  helper: { fontSize: typography.size.xs, lineHeight: 18, textAlign: "center" },
  pressed: { opacity: 0.84 },
});
