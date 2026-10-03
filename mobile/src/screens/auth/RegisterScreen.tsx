import React from "react";
import {
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthField, AuthHero, AuthSubmitButton } from "@/screens/auth/AuthVisualPrimitives";
import { PUBLIC_LINKS } from "@/config/publicLinks";
import { assertAllowedExternalUrl } from "@/services/navigation/externalUrlService";
import { useAuth } from "@/providers/AuthProvider";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { isValidCpf } from "@/services/plans/checkoutRequirements";
import { PRIVACY_POLICY_VERSION, TERMS_OF_USE_VERSION } from "@/services/legal/legalDocumentVersion";
import { AuthFeedbackSheet } from "@/screens/auth/AuthFeedbackSheet";

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const formatCpf = (value: string) => digitsOnly(value)
  .slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2")
  .replace(/(\d{3})(\d)/, "$1.$2")
  .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const formatPhone = (value: string) => {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  const areaCode = `(${digits.slice(0, 2)}) `;
  const number = digits.slice(2);
  return number.length > 8
    ? `${areaCode}${number.slice(0, 5)}-${number.slice(5)}`
    : number.length > 4
      ? `${areaCode}${number.slice(0, 4)}-${number.slice(4)}`
      : `${areaCode}${number}`;
};

const openPublicLink = (url: string, onError: (title: string, message: string) => void) => {
  let safeUrl: string;
  try {
    safeUrl = assertAllowedExternalUrl(url);
  } catch {
    onError("Link indisponível", "Não foi possível abrir esta página agora.");
    return;
  }

  void Linking.openURL(safeUrl).catch(() => {
    onError("Link indisponível", "Não foi possível abrir esta página agora.");
  });
};

export const RegisterScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { register, registerWithGoogle, googleSignupDraft, clearGoogleSignupDraft, isLoading, user } = useAuth();
  const [name, setName] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ title: string; message: string } | null>(null);
  const [registrationCompleted, setRegistrationCompleted] = React.useState(false);

  React.useEffect(() => {
    if (!registrationCompleted || !user) return;
    setRegistrationCompleted(false);
    router.replace("/inicio");
  }, [registrationCompleted, user]);

  const handleRegister = async () => {
    const normalizedCpf = digitsOnly(cpf);
    const normalizedPhone = digitsOnly(phone);

    if ((!googleSignupDraft && (!name.trim() || !email.trim() || !password)) || !normalizedCpf || !normalizedPhone) {
      setFeedback({
        title: "Campos obrigatórios",
        message: googleSignupDraft
          ? "Preencha CPF e telefone com DDD para continuar."
          : "Preencha nome, CPF, telefone, e-mail e senha.",
      });
      return;
    }
    if (!isValidCpf(normalizedCpf)) {
      setFeedback({ title: "CPF inválido", message: "Confira os números e tente novamente." });
      return;
    }
    if (![10, 11].includes(normalizedPhone.length)) {
      setFeedback({ title: "Telefone inválido", message: "Informe DDD e número com 10 ou 11 dígitos." });
      return;
    }
    if (!googleSignupDraft && password.length < 6) {
      setFeedback({ title: "Senha inválida", message: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (!termsAccepted) {
      setFeedback({ title: "Aceite necessário", message: "Aceite os Termos de Uso e a Política de Privacidade para criar sua conta." });
      return;
    }

    try {
      if (googleSignupDraft) {
        await registerWithGoogle({
          ...(name.trim() ? { name: name.trim() } : {}),
          cpf: normalizedCpf,
          phone: normalizedPhone,
          termsAccepted: true,
          termsVersion: TERMS_OF_USE_VERSION,
          privacyAccepted: true,
          privacyVersion: PRIVACY_POLICY_VERSION,
        });
        setRegistrationCompleted(true);
        return;
      }
      await register({
        name: name.trim(),
        cpf: normalizedCpf,
        phone: normalizedPhone,
        email: email.trim(),
        password,
        termsAccepted: true,
        termsVersion: TERMS_OF_USE_VERSION,
        privacyAccepted: true,
        privacyVersion: PRIVACY_POLICY_VERSION,
      });
      setRegistrationCompleted(true);
    } catch (error: unknown) {
      setFeedback({
        title: "Falha no cadastro",
        message: error instanceof Error ? error.message : "Não foi possível criar a conta.",
      });
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
          title={googleSignupDraft ? "Só faltam alguns dados." : "Sua preparação começa com você."}
          subtitle={googleSignupDraft ? "Seu e-mail já foi validado pelo Google. Complete seu perfil para começar." : "Crie sua conta e organize sua jornada."}
        />

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>{googleSignupDraft ? "Complete seu cadastro" : "Crie seu acesso"}</Text>
          <View style={styles.fields}>
            {googleSignupDraft ? (
              <View style={styles.googleIdentity}>
                <View style={styles.googleIdentityIcon}>
                  <Ionicons name="logo-google" size={19} color={theme.primary} />
                </View>
                <View style={styles.googleIdentityCopy}>
                  {googleSignupDraft.name ? <Text style={styles.googleIdentityName}>{googleSignupDraft.name}</Text> : null}
                  <Text style={styles.googleIdentityEmail}>{googleSignupDraft.email}</Text>
                  <View style={styles.verifiedLabel}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.success} />
                    <Text style={styles.verifiedText}>E-mail verificado pelo Google</Text>
                  </View>
                </View>
              </View>
            ) : (
              <AuthField
                label="Nome completo"
                icon="person-outline"
                autoCapitalize="words"
                onChangeText={setName}
                placeholder="Seu nome"
                textContentType="name"
                value={name}
              />
            )}
            <AuthField
              label="CPF"
              icon="card-outline"
              keyboardType="number-pad"
              onChangeText={(value) => setCpf(formatCpf(value))}
              placeholder="000.000.000-00"
              value={cpf}
            />
            <AuthField
              label="Telefone com DDD"
              icon="call-outline"
              keyboardType="phone-pad"
              onChangeText={(value) => setPhone(formatPhone(value))}
              placeholder="(00) 00000-0000"
              value={phone}
            />
            {!googleSignupDraft ? <>
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
                placeholder="Crie uma senha"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
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
            </> : null}
            <Text style={styles.legalNotice}>
              Marque abaixo para confirmar seu aceite. Leia os documentos antes de continuar.
            </Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              onPress={() => setTermsAccepted((current) => !current)}
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, termsAccepted && styles.checkboxSelected]}>
                {termsAccepted ? <Ionicons name="checkmark" size={15} color={theme.onPrimary} /> : null}
              </View>
              <Text style={styles.consentLabel}>Li e aceito os Termos de Uso e a Política de Privacidade.</Text>
            </Pressable>
            <View style={styles.documentLinks}>
              <Text
                accessibilityRole="link"
                onPress={() => openPublicLink(PUBLIC_LINKS.terms, (title, message) => setFeedback({ title, message }))}
                style={styles.legalLink}
              >
                Ler Termos de Uso
              </Text>
              <Text style={styles.legalNotice}>·</Text>
              <Text
                accessibilityRole="link"
                onPress={() => openPublicLink(PUBLIC_LINKS.privacy, (title, message) => setFeedback({ title, message }))}
                style={styles.legalLink}
              >
                Ler Política de Privacidade
              </Text>
            </View>
            <AuthSubmitButton
              label={googleSignupDraft ? "Criar conta com Google" : "Criar conta"}
              busyLabel={googleSignupDraft ? "Validando e criando..." : "Criando..."}
              loading={isLoading}
              onPress={() => void handleRegister()}
            />
          </View>
        </View>

        <Text style={styles.footer}>
          {googleSignupDraft ? "Voltar ao login? " : "Já tem uma conta? "}
          <Text onPress={() => { clearGoogleSignupDraft(); router.replace("/login"); }} style={styles.linkText}>
            Entrar
          </Text>
        </Text>
      </ScrollView>
      <AuthFeedbackSheet
        message={feedback?.message || ""}
        onDismiss={() => setFeedback(null)}
        title={feedback?.title || ""}
        visible={Boolean(feedback)}
      />
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
    googleIdentity: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[3],
    },
    googleIdentityIcon: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.sm,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    googleIdentityCopy: { flex: 1, gap: 3 },
    googleIdentityName: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
    googleIdentityEmail: { color: theme.textMuted, fontSize: typography.size.xs },
    verifiedLabel: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 2 },
    verifiedText: { color: theme.success, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
    legalNotice: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      lineHeight: 17,
    },
    consentRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], paddingVertical: spacing[1] },
    checkbox: {
      alignItems: "center",
      borderColor: theme.borderStrong,
      borderRadius: 5,
      borderWidth: 1,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    checkboxSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
    consentLabel: { color: theme.text, flex: 1, fontSize: typography.size.xs, lineHeight: 18 },
    documentLinks: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
    legalLink: { color: theme.primary, fontWeight: typography.weight.bold },
    footer: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      marginBottom: spacing[2],
      marginTop: spacing[2],
      textAlign: "center",
    },
    linkText: { color: theme.primary, fontWeight: typography.weight.bold },
  });
