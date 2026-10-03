import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { AppButton } from "@/components/ui/Primitives";
import { AnimatedModal } from "@/components/ui/AnimatedModal";

type LogoutConfirmationSheetProps = {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationSheet({
  visible,
  onDismiss,
  onConfirm,
}: LogoutConfirmationSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <AnimatedModal
      mode="sheet"
      onRequestClose={onDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Fechar confirmação de saída"
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
              paddingBottom: Math.max(insets.bottom, spacing[4]),
              ...(theme === darkTheme ? shadows.modalDark : shadows.modal),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.dangerSubtle },
            ]}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>
            Sair da sua conta?
          </Text>
          <Text style={[styles.description, { color: theme.textMuted }]}>
            Você poderá entrar novamente com seu e-mail e senha quando quiser.
          </Text>
          <AppButton label="Continuar conectado" onPress={onDismiss} style={styles.keepButton} />
          <AppButton label="Sair da conta" onPress={onConfirm} variant="dangerQuiet" style={styles.logoutButton} />
        </View>
      </View>
    </AnimatedModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11, 12, 29, 0.56)",
  },
  sheet: {
    borderTopLeftRadius: radius.dialog,
    borderTopRightRadius: radius.dialog,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
  },
  handle: {
    alignSelf: "center",
    borderRadius: radius.pill,
    height: 4,
    marginBottom: spacing[5],
    width: 38,
  },
  iconContainer: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    marginBottom: spacing[3],
    width: 44,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: typography.size.xs,
    lineHeight: 19,
    marginBottom: spacing[4],
    maxWidth: 300,
  },
  keepButton: {
    minHeight: 46,
  },
  logoutButton: {
    minHeight: 44,
    marginTop: spacing[1],
  },
});
