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
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PUBLIC_LINKS } from "@/config/publicLinks";
import { useAuth } from "@/providers/AuthProvider";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

const openPublicLink = (url: string) => {
  void Linking.openURL(url).catch(() => {
    Alert.alert(
      "Link indisponivel",
      "Nao foi possivel abrir esta pagina agora.",
    );
  });
};

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
    if (!email || !password) {
      Alert.alert("Campos obrigatorios", "Preencha e-mail e senha.");
      return;
    }

    try {
      const result = await login({ email, password });
      if (result.requiresTwoFactor) {
        setTwoFactorEmail(result.email || email);
      }
      // O Stack.Protected troca automaticamente o grupo de auth pelo grupo privado.
    } catch (error: any) {
      Alert.alert(
        "Falha no login",
        error?.message || "Nao foi possivel realizar o login.",
      );
    }
  };

  const handleTwoFactor = async () => {
    if (!twoFactorEmail || !twoFactorCode.trim()) {
      Alert.alert("Codigo obrigatorio", "Informe o codigo de seguranca.");
      return;
    }

    try {
      await verifyTwoFactor(twoFactorEmail, twoFactorCode.trim());
    } catch (error: any) {
      Alert.alert("Falha na verificacao", error?.message || "Nao foi possivel validar o codigo.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing[3], paddingBottom: spacing[8] + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => (router.canGoBack() ? router.back() : undefined)}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={21} color={theme.text} />
        </Pressable>

        <View style={styles.hero}>
          <LinearGradient
            colors={[palette.brand.lavender, palette.brand.navy]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logo}
          >
            <Ionicons name="sparkles" size={31} color={theme.onPrimary} />
          </LinearGradient>
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.subtitle}>Continue de onde parou</Text>
        </View>

        <View style={styles.form}>
          {twoFactorEmail ? (
            <>
              <Text style={styles.twoFactorHint}>Informe o codigo enviado para {twoFactorEmail}.</Text>
              <View style={styles.field}>
                <Ionicons name="shield-checkmark-outline" size={17} color={theme.textMuted} style={styles.fieldIcon} />
                <TextInput
                  accessibilityLabel="Codigo de seguranca"
                  autoCapitalize="none"
                  keyboardType="number-pad"
                  maxLength={8}
                  onChangeText={setTwoFactorCode}
                  placeholder="Codigo de seguranca"
                  placeholderTextColor={theme.textMuted}
                  style={styles.input}
                  value={twoFactorCode}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => void handleTwoFactor()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed, isLoading && styles.disabled]}
              >
                <Text style={styles.primaryButtonText}>{isLoading ? "Validando..." : "Validar codigo"}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setTwoFactorEmail(null); setTwoFactorCode(""); }}>
                <Text style={styles.forgotText}>Voltar ao login</Text>
              </Pressable>
            </>
          ) : (
            <>
          <View style={styles.field}>
            <Ionicons
              name="mail-outline"
              size={17}
              color={theme.textMuted}
              style={styles.fieldIcon}
            />
            <TextInput
              accessibilityLabel="E-mail"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={theme.textMuted}
              style={styles.input}
              value={email}
            />
          </View>
          <View style={styles.field}>
            <Ionicons
              name="lock-closed-outline"
              size={17}
              color={theme.textMuted}
              style={styles.fieldIcon}
            />
            <TextInput
              accessibilityLabel="Senha"
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              style={[styles.input, styles.passwordInput]}
              value={password}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPassword ? "Ocultar senha" : "Mostrar senha"
              }
              onPress={() => setShowPassword((value) => !value)}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={theme.textMuted}
              />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              Alert.alert(
                "Recuperar senha",
                "O fluxo de recuperação será conectado ao serviço de autenticação nesta próxima etapa.",
              )
            }
            style={styles.forgotButton}
          >
            <Text style={styles.forgotText}>Esqueci minha senha</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isLoading, disabled: isLoading }}
            disabled={isLoading}
            onPress={() => void handleLogin()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              isLoading && styles.disabled,
            ]}
          >
            {isLoading ? (
              <Text style={styles.primaryButtonText}>Entrando...</Text>
            ) : (
              <Text style={styles.primaryButtonText}>Entrar</Text>
            )}
          </Pressable>
            </>
          )}
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>ou continue com</Text>
          <View style={styles.divider} />
        </View>
        <View style={styles.socialRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                "Google",
                "O login com Google ainda não está conectado ao backend mobile.",
              )
            }
            style={({ pressed }) => [
              styles.socialButton,
              pressed && styles.socialButtonPressed,
            ]}
          >
            <Text style={styles.socialText}>Google</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                "Apple",
                "O login com Apple ainda não está conectado ao backend mobile.",
              )
            }
            style={({ pressed }) => [
              styles.socialButton,
              pressed && styles.socialButtonPressed,
            ]}
          >
            <Text style={styles.socialText}>Apple</Text>
          </Pressable>
        </View>
        <Text style={styles.signupText}>
          Novo por aqui?{" "}
          <Text
            onPress={() => router.push("/cadastro")}
            style={styles.signupLink}
          >
            Crie sua conta
          </Text>
        </Text>

        <View style={styles.legalLinks} accessibilityRole="text">
          <Pressable
            accessibilityRole="link"
            onPress={() => openPublicLink(PUBLIC_LINKS.privacy)}
          >
            <Text style={styles.legalLink}>Privacidade</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => openPublicLink(PUBLIC_LINKS.terms)}
          >
            <Text style={styles.legalLink}>Termos</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>•</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => openPublicLink(PUBLIC_LINKS.support)}
          >
            <Text style={styles.legalLink}>Suporte</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { backgroundColor: theme.background, flex: 1 },
    content: {
      flexGrow: 1,
      paddingBottom: spacing[8],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[6],
    },
    backButton: {
      alignItems: "center",
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    hero: {
      alignItems: "center",
      marginBottom: spacing[8],
      marginTop: spacing[4],
    },
    logo: {
      alignItems: "center",
      borderRadius: radius.lg,
      elevation: 5,
      height: 64,
      justifyContent: "center",
      marginBottom: spacing[4],
      shadowColor: theme.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      width: 64,
    },
    title: {
      color: theme.text,
      fontSize: typography.size["2xl"],
      fontWeight: typography.weight.bold,
      textAlign: "center",
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      marginTop: spacing[1],
      textAlign: "center",
    },
    form: { gap: spacing[3] },
    twoFactorHint: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20 },
    field: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 54,
    },
    fieldIcon: { marginLeft: spacing[3] },
    input: {
      color: theme.text,
      flex: 1,
      fontSize: typography.size.sm,
      minHeight: 52,
      paddingHorizontal: spacing[3],
    },
    passwordInput: { paddingRight: 0 },
    eyeButton: {
      alignItems: "center",
      height: 52,
      justifyContent: "center",
      width: 44,
    },
    forgotButton: { alignSelf: "flex-end", paddingVertical: spacing[1] },
    forgotText: {
      color: theme.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      justifyContent: "center",
      minHeight: 52,
      marginTop: spacing[1],
    },
    primaryButtonPressed: { backgroundColor: theme.primaryPressed },
    primaryButtonText: {
      color: theme.onPrimary,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    disabled: { opacity: 0.6 },
    dividerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      marginVertical: spacing[6],
    },
    divider: { backgroundColor: theme.border, flex: 1, height: 1 },
    dividerText: { color: theme.textMuted, fontSize: typography.size.xs },
    socialRow: { flexDirection: "row", gap: spacing[2] },
    socialButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 48,
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
      marginTop: spacing[8],
      textAlign: "center",
    },
    signupLink: { color: theme.primary, fontWeight: typography.weight.bold },
    legalLinks: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[2],
      justifyContent: "center",
      marginTop: spacing[8],
    },
    legalLink: {
      color: theme.primary,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
    },
    legalSeparator: { color: theme.textMuted, fontSize: typography.size.xs },
  });
