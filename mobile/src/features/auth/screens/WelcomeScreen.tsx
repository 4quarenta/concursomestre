import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { palette, radius, spacing, typography } from "@/theme/tokens";

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { continueAsGuest } = useAuth();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing[6]) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Image
          accessibilityLabel="Logo oficial ConcursoMestre"
          resizeMode="contain"
          source={require("../../../../assets/brand-mark.png")}
          style={styles.logo}
        />

        <View style={styles.intro}>
          <Text style={styles.title}>Sua preparação começa aqui.</Text>
          <Text style={styles.description}>
            Acesse questões e simulados. Entre para responder e acompanhar seu progresso.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/login")}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>Entrar na minha conta</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void continueAsGuest().then(() => router.replace("/inicio"));
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryLabel}>Continuar como visitante</Text>
          </Pressable>

          <Text style={styles.guestNote}>
            Como visitante, você pode visualizar o conteúdo.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/cadastro")}
          style={({ pressed }) => [styles.signup, pressed && styles.pressed]}
        >
          <Text style={styles.signupPrompt}>Novo por aqui? </Text>
          <Text style={styles.signupLink}>Criar conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.slate[50],
    flex: 1,
  },
  content: {
    alignItems: "stretch",
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[12],
  },
  logo: {
    alignSelf: "center",
    height: 104,
    marginBottom: 62,
    width: 104,
  },
  intro: {
    alignItems: "center",
    gap: spacing[5],
  },
  title: {
    color: palette.brand.navy,
    fontSize: 32,
    fontWeight: typography.weight.extrabold,
    letterSpacing: -0.8,
    lineHeight: 39,
    maxWidth: 340,
    textAlign: "center",
  },
  description: {
    color: palette.slate[500],
    fontSize: 17,
    fontWeight: typography.weight.regular,
    lineHeight: 25,
    textAlign: "center",
  },
  actions: {
    gap: spacing[3],
    marginTop: 62,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: palette.brand.lavender,
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing[4],
  },
  primaryLabel: {
    color: palette.white,
    fontSize: 16,
    fontWeight: typography.weight.bold,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.slate[200],
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing[4],
  },
  secondaryLabel: {
    color: palette.brand.navy,
    fontSize: 16,
    fontWeight: typography.weight.bold,
  },
  guestNote: {
    color: palette.slate[500],
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing[1],
    textAlign: "center",
  },
  signup: {
    alignSelf: "center",
    flexDirection: "row",
    marginTop: 46,
    paddingVertical: spacing[2],
  },
  signupPrompt: {
    color: palette.slate[500],
    fontSize: 15,
    lineHeight: 22,
  },
  signupLink: {
    color: palette.brand.lavender,
    fontSize: 15,
    fontWeight: typography.weight.bold,
    lineHeight: 22,
    textDecorationLine: "underline",
  },
  pressed: {
    opacity: 0.78,
  },
});
