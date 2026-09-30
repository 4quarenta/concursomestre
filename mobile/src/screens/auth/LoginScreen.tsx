import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthField, AuthHero, AuthSubmitButton } from "@/screens/auth/AuthVisualPrimitives";
import { AppLink, MotionPressable } from "@/components/ui/Primitives";
import { useAuth } from "@/providers/AuthProvider";
import { PUBLIC_LINKS } from "@/config/publicLinks";
import { assertAllowedExternalUrl } from "@/services/navigation/externalUrlService";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

export const LoginScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { login, verifyTwoFactor, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = React.useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = React.useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Campos obrigatórios", "Preencha e-mail e senha.");
      return;
    }

    try {
      const result = await login({ email: email.trim(), password });
      if (result.requiresTwoFactor) setTwoFactorEmail(result.email || email.trim());
    } catch (error: any) {
      Alert.alert("Falha no login", error?.message || "Não foi possível realizar o login.");
    } finally {
    }
  };

  const handleTwoFactor = async () => {
    if (!twoFactorEmail || !twoFactorCode.trim()) {
      Alert.alert("Código obrigatório", "Informe o código de segurança.");
      return;
    }

    try {
      await verifyTwoFactor(twoFactorEmail, twoFactorCode.trim());
    } catch (error: any) {
      Alert.alert("Falha na verificação", error?.message || "Não foi possível validar o código.");
    }
  };

  const handleSocialLogin = (provider: "Google" | "Facebook") => {
    Alert.alert(
      `Entrar com ${provider}`,
      `O acesso com ${provider} está disponível na plataforma web, mas o fluxo nativo ainda não foi conectado neste app.`,
    );
  };

  const openPublicLink = async (url: string) => {
    try {
      const safeUrl = assertAllowedExternalUrl(url);
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert("Link indisponível", "Não foi possível abrir esta página agora.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing[6] }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHero
          title="Seu próximo passo começa nos estudos."
          subtitle="Acesse e continue de onde parou."
        />

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>
            {twoFactorEmail ? "Confirme sua identidade" : "Acesse sua conta"}
          </Text>

          {twoFactorEmail ? (
            <View style={styles.fields}>
              <Text style={styles.twoFactorHint}>
                Informe o código enviado para {twoFactorEmail}.
              </Text>
              <AuthField
                label="Código de segurança"
                icon="shield-checkmark-outline"
                keyboardType="number-pad"
                onChangeText={setTwoFactorCode}
                placeholder="Digite o código"
                value={twoFactorCode}
              />
              <AuthSubmitButton
                label="Validar código"
                busyLabel="Validando..."
                loading={isLoading}
                onPress={() => void handleTwoFactor()}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setTwoFactorEmail(null);
                  setTwoFactorCode("");
                }}
                style={styles.textAction}
              >
                <Text style={styles.textActionLabel}>Voltar ao login</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.fields}>
              <AuthField
                label="E-mail"
                icon="mail-outline"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="seu@email.com"
                textContentType="emailAddress"
                value={email}
              />
              <AuthField
                label="Senha"
                icon="lock-closed-outline"
                onChangeText={setPassword}
                placeholder="Sua senha"
                secureTextEntry={!showPassword}
                textContentType="password"
                value={password}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    hitSlop={10}
                    onPress={() => setShowPassword((current) => !current)}
                  >
                    <Ionicons
                      color={theme.textMuted}
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                    />
                  </Pressable>
                }
              />
              <AppLink label="Esqueci minha senha" onPress={() => router.push("/esqueci-senha")} style={styles.forgotButton} />
              <AuthSubmitButton
                label="Entrar"
                busyLabel="Entrando..."
                loading={isLoading}
                onPress={() => void handleLogin()}
              />
            </View>
          )}
        </View>

        {!twoFactorEmail && (
          <View style={styles.socialSection}>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>ou entre com</Text>
              <View style={styles.divider} />
            </View>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Entrar com Google"
              onPress={() => handleSocialLogin("Google")}
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
            >
              <FontAwesome name="google" size={16} color="#4285F4" />
              <Text style={styles.socialText}>Continuar com Google</Text>
            </MotionPressable>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Entrar com Facebook"
              onPress={() => handleSocialLogin("Facebook")}
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialButtonPressed]}
            >
              <FontAwesome name="facebook" size={16} color="#1877F2" />
              <Text style={styles.socialText}>Continuar com Facebook</Text>
            </MotionPressable>
          </View>
        )}

        {!twoFactorEmail && (
          <>
            <Text style={styles.signupText}>
              Primeira vez por aqui?{" "}
              <Text onPress={() => router.push("/cadastro")} style={styles.linkText}>
                Criar conta
              </Text>
            </Text>
            <View style={styles.legalLinks}>
              <Text onPress={() => void openPublicLink(PUBLIC_LINKS.privacy)} style={styles.legalLink}>
                Privacidade
              </Text>
              <Text style={styles.legalSeparator}>·</Text>
              <Text onPress={() => void openPublicLink(PUBLIC_LINKS.support)} style={styles.legalLink}>
                Suporte
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { flexGrow: 1 },
    formCard: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      elevation: 5,
      marginHorizontal: spacing[5],
      marginTop: -26,
      padding: spacing[4],
      shadowColor: palette.brand.navy,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
    },
    cardTitle: {
      color: theme.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
      marginBottom: spacing[3],
    },
    fields: { gap: spacing[2] },
    twoFactorHint: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
    forgotButton: { alignSelf: "flex-end", paddingVertical: spacing[1] },
    forgotLabel: {
      color: theme.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    textAction: { alignItems: "center", paddingVertical: spacing[1] },
    textActionLabel: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    socialSection: { marginHorizontal: spacing[5], marginTop: spacing[1] },
    dividerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      marginBottom: spacing[2],
      marginTop: spacing[1],
    },
    divider: { backgroundColor: theme.border, flex: 1, height: 1 },
    dividerText: { color: theme.textMuted, fontSize: typography.size.xs },
    socialButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.button,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      justifyContent: "center",
      marginBottom: spacing[1],
      minHeight: 44,
    },
    socialButtonPressed: { backgroundColor: theme.surfaceSubtle },
    socialText: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    signupText: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      marginTop: spacing[2],
      textAlign: "center",
    },
    linkText: { color: theme.primary, fontWeight: typography.weight.bold },
    legalLinks: { alignItems: "center", flexDirection: "row", gap: spacing[2], justifyContent: "center", marginTop: spacing[2], paddingVertical: spacing[2] },
    legalLink: { color: theme.textMuted, fontSize: typography.size.xs, textDecorationLine: "underline" },
    legalSeparator: { color: theme.textSubtle, fontSize: typography.size.xs },
  });
