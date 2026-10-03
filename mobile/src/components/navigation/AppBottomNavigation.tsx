import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MotionPressable } from "@/components/ui/Primitives";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

export type AppBottomNavigationRoute =
  | "inicio"
  | "questoes"
  | "simulados"
  | "desempenho"
  | "perfil";

const items: Array<{
  route: AppBottomNavigationRoute;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}> = [
  { route: "inicio", label: "Início", icon: "home-outline" },
  { route: "questoes", label: "Questões", icon: "create-outline" },
  { route: "simulados", label: "Simulados", icon: "clipboard-outline" },
  { route: "desempenho", label: "Desempenho", icon: "stats-chart-outline" },
  { route: "perfil", label: "Perfil", icon: "person-outline" },
];

export function AppBottomNavigation({
  activeRoute = null,
  bottomInset = 0,
  visible = true,
  onNavigate,
}: {
  activeRoute?: AppBottomNavigationRoute | null;
  bottomInset?: number;
  visible?: boolean;
  onNavigate: (route: AppBottomNavigationRoute) => void;
}) {
  const theme = useAppTheme();
  const bottomPadding = Math.max(spacing[2], bottomInset);

  return (
    <View
      style={[
        styles.container,
        {
          height: 64 + bottomPadding,
          paddingBottom: bottomPadding,
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          display: visible ? "flex" : "none",
        },
      ]}
    >
      {items.map((item) => {
        const selected = activeRoute === item.route;
        return (
          <MotionPressable
            key={item.route}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            onPress={() => onNavigate(item.route)}
            style={styles.item}
          >
            <View style={styles.iconSlot}>
              {selected ? <View style={[styles.indicator, { backgroundColor: theme.primary }]} /> : null}
              <View style={selected ? [styles.activeIcon, { backgroundColor: theme.primarySubtle }] : undefined}>
                <Ionicons name={item.icon} color={selected ? theme.text : theme.textMuted} size={21} />
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? theme.text : theme.textMuted },
                selected && styles.selectedLabel,
              ]}
            >
              {item.label}
            </Text>
          </MotionPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "stretch",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingTop: spacing[2],
    zIndex: 10,
  },
  item: {
    alignItems: "center",
    flex: 1,
    paddingTop: spacing[1],
  },
  iconSlot: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  activeIcon: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 28,
    justifyContent: "center",
    width: 36,
  },
  indicator: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    height: 3,
    position: "absolute",
    top: -spacing[3],
    width: 28,
  },
  label: {
    fontSize: typography.role.caption.fontSize,
    fontWeight: typography.weight.medium,
    lineHeight: typography.role.caption.lineHeight,
    marginTop: spacing[1],
  },
  selectedLabel: {
    fontWeight: typography.weight.semibold,
  },
});
