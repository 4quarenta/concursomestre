import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import {
  useAppearance,
  type AppearanceAccent,
  type AppearanceFontSize,
  type AppearanceTheme,
} from "@/providers/AppearanceProvider";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const themes: Array<{
  id: AppearanceTheme;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: "light",
    label: "Claro",
    description: "Sempre claro",
    icon: "sunny-outline",
  },
  {
    id: "dark",
    label: "Escuro",
    description: "Sempre escuro, ideal para a noite",
    icon: "moon-outline",
  },
  {
    id: "system",
    label: "Sistema",
    description: "Segue as configurações do dispositivo",
    icon: "phone-portrait-outline",
  },
];

const accents: Array<{ id: AppearanceAccent; color: string }> = [
  { id: "blue", color: palette.brand.lavender },
  { id: "violet", color: "#8B5CF6" },
  { id: "emerald", color: "#22C55E" },
  { id: "rose", color: "#E11D48" },
  { id: "amber", color: "#F59E0B" },
];

const fontSizes: Array<{
  id: AppearanceFontSize;
  label: string;
  previewSize: number;
}> = [
  { id: "sm", label: "Pequeno", previewSize: typography.size.sm },
  { id: "md", label: "Médio", previewSize: typography.size.md },
  { id: "lg", label: "Grande", previewSize: typography.size.lg },
];

export function AppearanceSettingsScreen() {
  const theme = useAppTheme();
  const appearance = useAppearance();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title="Aparência" subtitle="Tema e personalização visual" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[12] + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            TEMA
          </Text>
          <View style={styles.themeList}>
            {themes.map((item) => {
              const selected = appearance.theme === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => appearance.setTheme(item.id)}
                  style={({ pressed }) => [
                    styles.themeOption,
                    {
                      backgroundColor: selected
                        ? theme.primarySubtle
                        : theme.surface,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.themeIcon,
                      {
                        backgroundColor: selected
                          ? theme.primary
                          : theme.surfaceSubtle,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={selected ? theme.onPrimary : theme.text}
                    />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[styles.optionDescription, { color: theme.textMuted }]}
                    >
                      {item.description}
                    </Text>
                  </View>
                  {selected && (
                    <View
                      style={[styles.check, { backgroundColor: theme.primary }]}
                    >
                      <Ionicons name="checkmark" size={15} color={theme.onPrimary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            COR DE DESTAQUE
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, shadowColor: theme.text },
            ]}
          >
            <View style={styles.accentList}>
              {accents.map((item) => {
                const selected = appearance.accent === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`Cor ${item.id}`}
                    accessibilityState={{ selected }}
                    onPress={() => appearance.setAccent(item.id)}
                    style={({ pressed }) => [
                      styles.accentButton,
                      { backgroundColor: item.color },
                      selected && { borderColor: theme.text },
                      pressed && styles.accentPressed,
                    ]}
                  >
                    {selected && (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
            TAMANHO DA FONTE
          </Text>
          <View
            style={[
              styles.card,
              styles.fontCard,
              { backgroundColor: theme.surface, shadowColor: theme.text },
            ]}
          >
            <View style={styles.fontSizeList}>
              {fontSizes.map((item) => {
                const selected = appearance.fontSize === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => appearance.setFontSize(item.id)}
                    style={({ pressed }) => [
                      styles.fontSizeOption,
                      {
                        backgroundColor: selected
                          ? theme.primarySubtle
                          : theme.surface,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fontSizeLabel,
                        { color: selected ? theme.primary : theme.textMuted },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View
              style={[styles.preview, { backgroundColor: theme.surfaceSubtle }]}
            >
              <Ionicons name="text-outline" size={17} color={theme.textMuted} />
              <Text
                style={[
                  styles.previewText,
                  { color: theme.text, fontSize: fontSizes.find((item) => item.id === appearance.fontSize)?.previewSize ?? typography.size.md },
                ]}
              >
                Esta é uma prévia do tamanho da fonte.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: spacing[6],
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[5],
    paddingBottom: spacing[12],
  },
  section: { gap: spacing[2] },
  sectionLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 1,
    paddingHorizontal: spacing[1],
  },
  themeList: { gap: spacing[2] },
  themeOption: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  themeIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  optionCopy: { flex: 1, gap: 2 },
  optionTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
  optionDescription: { fontSize: typography.size.xs, lineHeight: 17 },
  check: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  card: {
    borderRadius: radius.lg,
    elevation: 2,
    padding: spacing[5],
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },
  accentList: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
  },
  accentButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  accentPressed: { transform: [{ scale: 0.9 }] },
  fontCard: { gap: spacing[3], padding: spacing[4] },
  fontSizeList: { flexDirection: "row", gap: spacing[2] },
  fontSizeOption: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[2],
  },
  fontSizeLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  preview: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[4],
  },
  previewText: { flex: 1, lineHeight: 22 },
  pressed: { opacity: 0.86 },
});
