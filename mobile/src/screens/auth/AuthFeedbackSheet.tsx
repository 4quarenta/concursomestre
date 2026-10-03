import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "@/components/ui/Primitives";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { darkTheme, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export type AuthFeedbackAction = {
  label: string;
  onPress: () => void;
};

type AuthFeedbackSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  action?: AuthFeedbackAction;
  onDismiss: () => void;
};

export function AuthFeedbackSheet({
  visible,
  title,
  message,
  action,
  onDismiss,
}: AuthFeedbackSheetProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  const runAction = () => {
    const callback = action?.onPress;
    onDismiss();
    if (callback) requestAnimationFrame(callback);
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
          accessibilityLabel="Fechar mensagem"
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
          <View style={[styles.iconWrap, { backgroundColor: theme.dangerSubtle }]}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.danger} />
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
          {action ? (
            <>
              <AppButton label={action.label} onPress={runAction} style={styles.button} />
              <AppButton label="Agora não" onPress={onDismiss} variant="secondary" style={styles.button} />
            </>
          ) : (
            <AppButton label="Entendi" onPress={onDismiss} style={styles.button} />
          )}
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
  message: { fontSize: typography.size.sm, lineHeight: 21, marginBottom: spacing[1] },
  button: { alignSelf: "stretch" },
});
