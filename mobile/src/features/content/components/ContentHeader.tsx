import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppText, MotionPressable } from "@/components/ui/Primitives";
import { borders, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export const ContentHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: theme.border, backgroundColor: theme.surface },
      ]}
    >
      <MotionPressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </MotionPressable>
      <View style={styles.copy}>
        <AppText variant="screenTitle">{title}</AppText>
        <AppText variant="screenDescription" tone="muted">
          {subtitle}
        </AppText>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomWidth: borders.hairline,
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    minHeight: 76,
    paddingVertical: spacing[3],
  },
  back: { alignItems: "center", borderRadius: 8, height: 44, justifyContent: "center", width: 44 },
  pressed: { opacity: 0.78 },
  copy: { flex: 1, gap: 2 },
});
