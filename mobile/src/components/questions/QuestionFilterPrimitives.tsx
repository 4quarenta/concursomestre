import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { radius, spacing, typography } from "@/theme/tokens";
import type { ResolvedAppTheme } from "@/theme/useAppTheme";
import { AppText, MotionPressable } from "@/components/ui/Primitives";

type HeroProps = { theme: ResolvedAppTheme };

export const QuestionFilterHero: React.FC<HeroProps> = ({ theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.hero}><AppText variant="screenTitle" tone="onPrimary" style={styles.heroTitle}>Questões</AppText><AppText variant="screenDescription" tone="onPrimary" style={styles.heroSubtitle}>Milhares de itens para você treinar</AppText></View>;
};

type QuickStartProps = { onPress: () => void; theme: ResolvedAppTheme };

export const QuestionQuickStart: React.FC<QuickStartProps> = ({ onPress, theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <MotionPressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickStart, pressed && styles.pressed]}><View style={styles.quickIcon}><Ionicons name="sparkles-outline" size={25} color={theme.primary} /></View><View style={styles.quickCopy}><AppText variant="sectionTitle" style={styles.quickTitle}>Início rápido</AppText><AppText variant="caption" tone="muted" style={styles.quickDescription}>Resolva questões aleatórias de todas as matérias</AppText></View><Ionicons name="chevron-forward" size={22} color={theme.textMuted} /></MotionPressable>;
};

type FilterRowProps = { label: string; icon: keyof typeof Ionicons.glyphMap; values: string[]; onPress: () => void; theme: ResolvedAppTheme; disabled?: boolean; disabledValue?: string };

export const QuestionFilterRow: React.FC<FilterRowProps> = ({ label, icon, values, onPress, theme, disabled = false, disabledValue = "Todos" }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const value = values.length === 0 ? (disabled ? disabledValue : "Todos") : values.length === 1 ? values[0] : "";
  const accessibilityValue = values.length > 1 ? `${values.length} selecionados` : value;
  return <MotionPressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={disabled ? `${label}: selecione uma disciplina primeiro` : `Selecionar ${label}${values.length ? `: ${accessibilityValue}` : ""}`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.filterRow, pressed && styles.pressed, disabled && styles.rowDisabled]}><View style={styles.rowIcon}><Ionicons name={icon} size={21} color={disabled ? theme.textSubtle : theme.primary} /></View><AppText variant="bodyStrong" style={[styles.rowLabel, disabled && styles.rowTextDisabled]} numberOfLines={1}>{label}</AppText>{values.length > 1 ? <View style={styles.rowCount}><AppText variant="label" tone="primary" style={styles.rowCountText}>{values.length}</AppText></View> : <AppText variant="body" tone="muted" style={[styles.rowValue, disabled && styles.rowTextDisabled]} numberOfLines={1}>{value}</AppText>}<Ionicons name="chevron-forward" size={21} color={disabled ? theme.textSubtle : theme.textMuted} /></MotionPressable>;
};

type ChipProps = { label: string; active: boolean; onPress: () => void; theme: ResolvedAppTheme };

export const QuestionFilterChip: React.FC<ChipProps> = ({ label, active, onPress, theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <MotionPressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}><AppText variant="label" tone={active ? "primary" : "muted"} style={[styles.chipText, active && styles.chipTextActive]}>{label}</AppText></MotionPressable>;
};

type ToggleProps = { label: string; active: boolean; onPress: () => void; theme: ResolvedAppTheme };

export const QuestionFilterToggle: React.FC<ToggleProps> = ({ label, active, onPress, theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  return <MotionPressable accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={onPress} style={({ pressed }) => [styles.toggle, active && styles.toggleActive, pressed && styles.pressed]}><View style={[styles.checkbox, active && styles.checkboxActive]}>{active ? <Ionicons name="checkmark" size={16} color={theme.onPrimary} /> : null}</View><AppText variant="body" tone={active ? "primary" : "muted"} style={[styles.toggleText, active && styles.toggleTextActive]}>{label}</AppText></MotionPressable>;
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  hero: { backgroundColor: theme.primary, paddingBottom: spacing[8], paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  heroTitle: {},
  heroSubtitle: { opacity: 0.82, marginTop: 3 },
  quickStart: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, elevation: 3, flexDirection: "row", gap: spacing[3], marginHorizontal: spacing[5], marginTop: -spacing[5], padding: spacing[4], shadowColor: theme.text, shadowOpacity: 0.08, shadowRadius: 8, zIndex: 2 },
  quickIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.md, height: 58, justifyContent: "center", width: 58 },
  quickCopy: { flex: 1, gap: 3 },
  quickTitle: {},
  quickDescription: {},
  filterRow: { alignItems: "center", borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing[3], minHeight: 56, paddingHorizontal: spacing[3] },
  rowDisabled: { opacity: 0.62 },
  rowTextDisabled: { color: theme.textSubtle },
  rowIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.md, height: 44, justifyContent: "center", width: 44 },
  rowLabel: { flex: 1 },
  rowValue: { maxWidth: "36%", textAlign: "right" },
  rowCount: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.pill, height: 28, justifyContent: "center", minWidth: 28, paddingHorizontal: spacing[2] },
  rowCountText: {},
  chip: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  chipActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primary },
  chipText: {},
  chipTextActive: { color: theme.primary, fontWeight: typography.weight.bold },
  toggle: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[3], minHeight: 52, paddingHorizontal: spacing[4], width: "100%" },
  toggleActive: { backgroundColor: theme.primarySubtle, borderColor: theme.primary },
  checkbox: { alignItems: "center", borderColor: theme.borderStrong, borderRadius: radius.sm, borderWidth: 2, height: 24, justifyContent: "center", width: 24 },
  checkboxActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  toggleText: { flexShrink: 1 },
  toggleTextActive: { color: theme.primary, fontWeight: typography.weight.semibold },
  pressed: { opacity: 0.94 },
});
