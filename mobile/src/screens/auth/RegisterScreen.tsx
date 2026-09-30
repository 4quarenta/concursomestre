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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthField, AuthHero, AuthSubmitButton } from "@/screens/auth/AuthVisualPrimitives";
import { PUBLIC_LINKS } from "@/config/publicLinks";
import { assertAllowedExternalUrl } from "@/services/navigation/externalUrlService";
import { useAuth } from "@/providers/AuthProvider";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

const openPublicLink = (url: string) => {
  let safeUrl: string;
  try {
    safeUrl = assertAllowedExternalUrl(url);
  } catch {
    Alert.alert("Link indisponível", "Não foi possível abrir esta página agora.");
    return;
  }

  void Linking.openURL(safeUrl).catch(() => {
    Alert.alert("Link indisponível", "Não foi possível abrir esta página agora.");
  });
};

export const RegisterScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { register, isLoading } = useAuth();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Campos obrigatórios", "Preencha nome, e-mail e senha.");
      return;
    }

    try {
      await register({ name: name.trim(), email: email.trim(), password });
    } catch (error: any) {
      Alert.alert("Falha no cadastro", error?.message || "Não foi possível criar a conta.");
    } finally {
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
          title="Sua preparação começa com você."
          subtitle="Crie sua conta e organize sua jornada."
        />

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Crie seu acesso</Text>
          <View style={styles.fields}>
            <AuthField
              label="Nome completo"
              icon="person-outline"
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="Seu nome"
              textContentType="name"
              value={name}
            />
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
            <Text style={styles.legalNotice}>
              Ao criar sua conta, você concorda com os{" "}
              <Text
                accessibilityRole="link"
                onPress={() => openPublicLink(PUBLIC_LINKS.terms)}
                style={styles.legalLink}
              >
                Termos de Uso
              </Text>{" "}
              e a{" "}
              <Text
                accessibilityRole="link"
                onPress={() => openPublicLink(PUBLIC_LINKS.privacy)}
                style={styles.legalLink}
              >
                Política de Privacidade
              </Text>
              .
            </Text>
            <AuthSubmitButton
              label="Criar conta"
              busyLabel="Criando..."
              loading={isLoading}
              onPress={() => void handleRegister()}
            />
          </View>
        </View>

        <Text style={styles.footer}>
          Já tem uma conta?{" "}
          <Text onPress={() => router.replace("/login")} style={styles.linkText}>
            Entrar
          </Text>
        </Text>
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
    legalNotice: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      lineHeight: 17,
    },
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
