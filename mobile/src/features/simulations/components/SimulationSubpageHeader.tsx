import React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, MotionPressable } from "@/components/ui/Primitives";
import { spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

type Props = {
  title: string;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
};

export const SimulationSubpageHeader: React.FC<Props> = ({
  title,
  onBack,
  actionLabel,
  onAction,
}) => {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={8}
        onPress={onBack ?? (() => router.back())}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </MotionPressable>
      <AppText variant="screenTitle" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <MotionPressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <AppText variant="link" tone="primary" style={styles.actionText}>
            {actionLabel}
          </AppText>
        </MotionPressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[4],
  },
  backButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  title: { flex: 1 },
  action: { alignItems: "center", justifyContent: "center", minHeight: 40, paddingLeft: spacing[2] },
  actionText: {},
});
