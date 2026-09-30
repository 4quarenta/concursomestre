import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { AppSurface, AppText, MotionPressable } from "@/components/ui/Primitives";
import { useAppearance, type AppearanceTheme } from "@/providers/AppearanceProvider";
import { radius, spacing } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const themeOptions: Array<{
  id: AppearanceTheme;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: "light", title: "Claro", description: "Usar sempre o tema claro", icon: "sunny-outline" },
  { id: "dark", title: "Escuro", description: "Usar sempre o tema escuro", icon: "moon-outline" },
  { id: "system", title: "Sistema", description: "Acompanhar o tema do aparelho", icon: "phone-portrait-outline" },
];

export function AppearanceSettingsScreen() {
  const theme = useAppTheme();
  const appearance = useAppearance();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.screen}>
      <ContentHeader title="Aparência" subtitle="Escolha como o app será exibido" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing[6] + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="body" tone="muted">
          A preferência é salva neste aparelho e pode ser alterada quando quiser.
        </AppText>
        <View style={styles.options}>
          {themeOptions.map((option) => {
            const selected = appearance.theme === option.id;
            return (
              <MotionPressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => appearance.setTheme(option.id)}
              >
                <AppSurface variant="outlined" style={[styles.option, selected && styles.optionSelected]}>
                  <View style={[styles.icon, selected && styles.iconSelected]}>
                    <Ionicons name={option.icon} size={19} color={selected ? theme.onPrimary : theme.textMuted} />
                  </View>
                  <View style={styles.copy}>
                    <AppText variant="bodyStrong">{option.title}</AppText>
                    <AppText variant="caption" tone="muted">{option.description}</AppText>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={21} color={theme.primary} /> : null}
                </AppSurface>
              </MotionPressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[4], padding: spacing[5] },
  options: { gap: spacing[3] },
  option: { alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 76 },
  optionSelected: { borderColor: theme.primary },
  icon: { alignItems: "center", backgroundColor: theme.surfaceSubtle, borderRadius: radius.button, height: 40, justifyContent: "center", width: 40 },
  iconSelected: { backgroundColor: theme.primary },
  copy: { flex: 1, gap: spacing[1] },
});

export default AppearanceSettingsScreen;
