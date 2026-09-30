import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/Primitives";
import { palette, radius, spacing, typography } from "@/theme/tokens";

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
  const styles = React.useMemo(() => createStyles(), []);

  return (
    <View style={styles.header}>
      <AppText variant="screenTitle" style={styles.title}>{title}</AppText>
      <AppText variant="screenDescription" tone="onPrimary" style={styles.subtitle}>{subtitle}</AppText>
      {stats?.length ? (
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Ionicons name={stat.icon} size={16} color="rgba(255,255,255,0.75)" />
              <AppText variant="bodyStrong" style={styles.statValue}>{stat.value}</AppText>
              <AppText variant="label" style={styles.statLabel}>{stat.label}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    header: {
      backgroundColor: palette.brand.navy,
      paddingBottom: spacing[8],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[3],
    },
    title: { color: palette.white },
    subtitle: { color: palette.brand.onNavyMuted, marginTop: spacing[1] },
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
      color: palette.white,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    statLabel: {
      color: "rgba(255,255,255,0.7)",
      fontSize: typography.role.label.fontSize,
      lineHeight: typography.role.label.lineHeight,
    },
  });

export default StandardSectionHeader;
