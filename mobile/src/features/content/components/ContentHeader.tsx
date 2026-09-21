import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { spacing, typography } from "@/theme/tokens";
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => router.back()}
        style={styles.back}
      >
        <Ionicons name="arrow-back" size={22} color={theme.text} />
      </Pressable>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  back: { padding: spacing[1] },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  subtitle: { fontSize: typography.size.xs },
});
