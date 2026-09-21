import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextField } from "@/components/ui/TextField";
import { PUBLIC_LINKS } from "@/config/publicLinks";
import { useAuth } from "@/providers/AuthProvider";
import { colors } from "@/theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const openPublicLink = (url: string) => {
  void Linking.openURL(url).catch(() => {
    Alert.alert(
      "Link indisponivel",
      "Nao foi possivel abrir esta pagina agora.",
    );
  });
};

export const RegisterScreen: React.FC = () => {
  const { register, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Campos obrigatorios", "Preencha nome, e-mail e senha.");
      return;
    }

    try {
      await register({ name, email, password });
      // O Stack.Protected troca automaticamente para o grupo privado.
    } catch (error: any) {
      Alert.alert(
        "Falha no cadastro",
        error?.message || "Nao foi possivel criar a conta.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.screen,
        { paddingTop: 20, paddingBottom: insets.bottom + 20 },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>ConcursoMestre</Text>
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>
          Comece gratis e acompanhe sua evolucao.
        </Text>

        <View style={styles.form}>
          <TextField
            label="Nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="Seu nome completo"
          />
          <TextField
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="voce@exemplo.com"
          />
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Crie uma senha"
          />
          <Text style={styles.legalNotice}>
            Ao criar a conta, voce declara que leu e concorda com os Termos de
            Uso e a Politica de Privacidade publicados pelo ConcursoMestre.
          </Text>
          <View style={styles.legalLinks}>
            <Pressable
              accessibilityRole="link"
              onPress={() => openPublicLink(PUBLIC_LINKS.terms)}
            >
              <Text style={styles.legalLink}>Ler Termos de Uso</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => openPublicLink(PUBLIC_LINKS.privacy)}
            >
              <Text style={styles.legalLink}>Ler Politica de Privacidade</Text>
            </Pressable>
          </View>
          <PrimaryButton
            label="Criar conta"
            onPress={handleRegister}
            loading={isLoading}
          />
        </View>

        <PrimaryButton
          label="Ja tenho conta"
          onPress={() => router.back()}
          disabled={isLoading}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 12,
  },
  brand: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  form: {
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  legalNotice: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  legalLinks: {
    gap: 6,
  },
  legalLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
