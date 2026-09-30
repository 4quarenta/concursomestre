import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthField, AuthHero, AuthSubmitButton } from "@/screens/auth/AuthVisualPrimitives";
import { readApiErrorMessage } from "@/services/api/response";
import { authFlowService } from "@/services/auth/authFlowService";
import { systemSettingsService } from "@/services/system/systemSettingsService";
import { mobileRecaptchaService } from "@/services/security/mobileRecaptchaService";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

export function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const sendInstructions = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const settings = await systemSettingsService.getSystemSettings();
      const captchaToken = settings.recaptchaEnabled
        ? await mobileRecaptchaService.execute(settings.recaptchaAndroidSiteKey, "forgot_password")
        : undefined;
      await authFlowService.forgotPassword({ email: normalizedEmail, captchaToken });
      setSubmitted(true);
    } catch (requestError: any) {
      // A API atual diferencia e-mail inexistente (404). A tela mantém a
      // resposta genérica para não expor se a conta está cadastrada.
      if (requestError?.response?.status === 404) {
        setSubmitted(true);
      } else {
        setError(
          readApiErrorMessage(
            requestError,
            "Não foi possível enviar as instruções agora. Tente novamente.",
          ),
        );
      }
    } finally {
      setLoading(false);
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
          title="Vamos recuperar seu acesso."
          subtitle="Enviaremos as instruções para o e-mail da sua conta."
        />

        <View style={styles.formCard}>
          {submitted ? (
            <View style={styles.confirmation}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-open-outline" size={27} color={theme.success} />
              </View>
              <Text style={styles.cardTitle}>Confira seu e-mail</Text>
              <Text style={styles.description}>
                Se este endereço estiver cadastrado, você receberá as instruções para redefinir sua
                senha. Confira também a caixa de spam.
              </Text>
              <AuthSubmitButton
                label="Voltar ao login"
                loading={false}
                onPress={() => router.replace("/login")}
                style={styles.confirmButton}
              />
            </View>
          ) : (
            <>
              <Text style={styles.cardTitle}>Esqueceu sua senha?</Text>
              <Text style={styles.description}>
                Digite o e-mail usado no cadastro para receber um link de redefinição.
              </Text>
              <View style={styles.fields}>
                <AuthField
                  label="E-mail"
                  icon="mail-outline"
                  keyboardType="email-address"
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) setError(null);
                  }}
                  placeholder="seu@email.com"
                  textContentType="emailAddress"
                  value={email}
                />
                {error ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    {error}
                  </Text>
                ) : null}
                <AuthSubmitButton
                  label="Enviar instruções"
                  busyLabel="Enviando..."
                  loading={loading}
                  onPress={() => void sendInstructions()}
                />
              </View>
            </>
          )}
        </View>

        {!submitted && (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.replace("/login")}
            style={styles.backLink}
          >
            <Ionicons name="arrow-back" size={16} color={theme.primary} />
            <Text style={styles.backLinkText}>Voltar ao login</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
      marginBottom: spacing[2],
      textAlign: "center",
    },
    description: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      lineHeight: 21,
      marginBottom: spacing[4],
      textAlign: "center",
    },
    fields: { gap: spacing[3] },
    errorText: {
      color: theme.danger,
      fontSize: typography.size.xs,
      lineHeight: 18,
    },
    backLink: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      gap: spacing[2],
      marginTop: spacing[4],
      minHeight: 42,
      paddingHorizontal: spacing[3],
    },
    backLinkText: {
      color: theme.primary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.semibold,
    },
    confirmation: { alignItems: "center" },
    successIcon: {
      alignItems: "center",
      backgroundColor: theme.successSubtle,
      borderColor: theme.successBorder,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 56,
      justifyContent: "center",
      marginBottom: spacing[3],
      width: 56,
    },
    confirmButton: { alignSelf: "stretch", marginTop: spacing[1] },
  });
