import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "@/components/ui/Primitives";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useAuth } from "@/providers/AuthProvider";

type GuestAccessSheetProps = {
  visible: boolean;
  description: string;
  onDismiss: () => void;
};

export function GuestAccessSheet({ visible, description, onDismiss }: GuestAccessSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { startAuthentication } = useAuth();

  const openAuthRoute = (path: "/login" | "/cadastro") => {
    onDismiss();
    void startAuthentication().then(() => requestAnimationFrame(() => router.push(path)));
  };

  return (
    <AnimatedModal
      mode="sheet"
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Fechar aviso de acesso"
          accessibilityRole="button"
          onPress={onDismiss}
          style={styles.scrim}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              ...(theme === darkTheme ? shadows.modalDark : shadows.modal),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View style={[styles.iconWrap, { backgroundColor: theme.primarySubtle }]}>
            <Ionicons name="person-outline" size={21} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>Entre para continuar</Text>
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
          <AppButton label="Entrar" onPress={() => openAuthRoute("/login")} style={styles.button} />
          <AppButton label="Criar conta" variant="secondary" onPress={() => openAuthRoute("/cadastro")} style={styles.button} />
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismiss}>
            <Text style={[styles.dismissText, { color: theme.textMuted }]}>Agora não</Text>
          </Pressable>
        </View>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(11,12,29,0.56)" },
  sheet: {
    borderColor: "transparent",
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  handle: { alignSelf: "center", borderRadius: radius.pill, height: 4, marginBottom: spacing[2], width: 40 },
  iconWrap: { alignItems: "center", borderRadius: radius.md, height: 44, justifyContent: "center", width: 44 },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  description: { fontSize: typography.size.sm, lineHeight: 21, marginBottom: spacing[1] },
  button: { alignSelf: "stretch" },
  dismiss: { alignItems: "center", justifyContent: "center", minHeight: 42 },
  dismissText: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
});
