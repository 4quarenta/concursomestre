import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { palette, radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

export type StandardSectionHeaderStat = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type StandardSectionHeaderProps = {
  title: string;
  subtitle: string;
  stats?: StandardSectionHeaderStat[];
};

export const StandardSectionHeader: React.FC<StandardSectionHeaderProps> = ({
  title,
  subtitle,
  stats,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {stats?.length ? (
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon} size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    header: {
      backgroundColor: palette.brand.lavender,
      paddingBottom: spacing[8],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
    },
    title: {
      color: theme.onPrimary,
      fontSize: typography.size.xl,
      fontWeight: typography.weight.bold,
    },
    subtitle: {
      color: "rgba(255,255,255,0.8)",
      fontSize: typography.size.sm,
      marginTop: 2,
    },
    statsGrid: {
      flexDirection: "row",
      gap: spacing[2],
      marginTop: spacing[4],
    },
    statCard: {
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderRadius: radius.md,
      flex: 1,
      gap: 2,
      padding: spacing[2],
    },
    statValue: {
      color: theme.onPrimary,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10 },
  });

export default StandardSectionHeader;
