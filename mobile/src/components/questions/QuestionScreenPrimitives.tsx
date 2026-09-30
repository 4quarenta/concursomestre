import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { radius, spacing, typography } from "@/theme/tokens";
import type { ResolvedAppTheme } from "@/theme/useAppTheme";
import { MotionPressable } from "@/components/ui/Primitives";
import { QuestionRichContent } from "@/components/questions/QuestionRichContent";
import type { QuestionAsset } from "@/types/questions";

export type QuestionMetadataItem = { label: string; value: string };

type QuestionHeaderProps = {
  index: number;
  total: number;
  progress: number;
  bookmarked: boolean;
  onBack: () => void;
  onToggleBookmark: () => void;
  onReport: () => void;
  reportPending?: boolean;
  theme: ResolvedAppTheme;
};

export const QuestionHeader: React.FC<QuestionHeaderProps> = ({
  index,
  total,
  progress,
  bookmarked,
  onBack,
  onToggleBookmark,
  onReport,
  reportPending = false,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerRow}>
        <MotionPressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </MotionPressable>
        <Text style={styles.headerTitle}>Praticar</Text>
        <View style={styles.headerActions}>
          <MotionPressable accessibilityRole="button" accessibilityLabel={bookmarked ? "Remover dos favoritos" : "Salvar questão"} onPress={onToggleBookmark} style={styles.iconButton}>
            <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={21} color={theme.primary} />
          </MotionPressable>
          <MotionPressable accessibilityRole="button" accessibilityLabel={reportPending ? "Denúncia pendente para esta questão" : "Reportar questão"} onPress={onReport} style={styles.iconButton}>
            <Ionicons name={reportPending ? "flag" : "flag-outline"} size={20} color={reportPending ? theme.danger : theme.textMuted} />
          </MotionPressable>
        </View>
      </View>
      <View style={styles.progressCaptionRow}>
        <Text style={styles.progressCaption}>Questão {index} de {total}</Text>
        <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
      </View>
      <View style={styles.progressTrack} accessibilityLabel={`Progresso da questão ${Math.round(progress)} por cento`}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: theme.primary }]} />
      </View>
    </View>
  );
};

type QuestionMetadataProps = {
  summary: string;
  items: QuestionMetadataItem[];
  expanded: boolean;
  onToggle: () => void;
  theme: ResolvedAppTheme;
};

export const QuestionMetadata: React.FC<QuestionMetadataProps> = ({
  summary,
  items,
  expanded,
  onToggle,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const extraItems = items.filter((item) => !["Matéria", "Banca", "Ano"].includes(item.label));

  const visibleItems = items.filter((item) => ["Matéria", "Banca", "Ano"].includes(item.label));
  return (
    <View style={styles.metadataBlock}>
      <View style={styles.metadataTopRow}>
        <View style={styles.metadataChips}>
          {(visibleItems.length ? visibleItems : [{ label: "Questão", value: summary || "Geral" }]).map((item) => (
            <View key={`${item.label}-${item.value}`} style={[styles.metadataChip, item.label === "Matéria" && styles.metadataChipPrimary]}>
              <Text numberOfLines={1} style={styles.metadataChipText}>{item.value}</Text>
            </View>
          ))}
        </View>
        {extraItems.length ? (
          <MotionPressable accessibilityRole="button" accessibilityLabel={expanded ? "Ocultar informações" : "Ver mais informações"} onPress={onToggle} style={styles.metadataToggle}>
            <Text style={styles.metadataToggleText}>{expanded ? "Menos" : "Mais"}</Text>
            <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={theme.primary} />
          </MotionPressable>
        ) : null}
      </View>
      {expanded ? (
        <View style={styles.metadataDetails}>
          {extraItems.map((item) => (
            <View key={`${item.label}-${item.value}`} style={styles.metadataDetailRow}>
              <Text style={styles.metadataDetailLabel}>{item.label}</Text>
              <Text style={styles.metadataDetailValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

type QuestionOptionProps = {
  letter: string;
  text: string;
  assets?: QuestionAsset[];
  selected: boolean;
  answered: boolean;
  correct: boolean;
  wrong: boolean;
  onPress: () => void;
  theme: ResolvedAppTheme;
};

export const QuestionOption: React.FC<QuestionOptionProps> = ({
  letter,
  text,
  assets,
  selected,
  answered,
  correct,
  wrong,
  onPress,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const stateStyle = correct
    ? styles.optionCorrect
    : wrong
      ? styles.optionWrong
      : selected
        ? styles.optionSelected
        : styles.optionNeutral;
  const badgeStyle = correct
    ? styles.badgeCorrect
    : wrong
      ? styles.badgeWrong
      : selected
        ? styles.badgeSelected
        : styles.badgeNeutral;

  return (
    <MotionPressable accessibilityRole="radio" accessibilityState={{ checked: selected }} disabled={answered} onPress={onPress} style={[styles.option, stateStyle]}>
      <View style={[styles.optionBadge, badgeStyle]}>
        {correct ? <Ionicons name="checkmark" size={19} color={theme.onPrimary} /> : wrong ? <Ionicons name="close" size={19} color={theme.onPrimary} /> : <Text style={[styles.optionLetter, selected && styles.optionLetterSelected]}>{letter}</Text>}
      </View>
      <View style={styles.optionText}><QuestionRichContent value={text} assets={assets} textStyle={{ color: theme.text, fontSize: typography.size.sm, lineHeight: 20 }} /></View>
    </MotionPressable>
  );
};

type QuestionTabsProps = {
  active: "explanation" | "teacher" | "stats" | "comments";
  onChange: (tab: "explanation" | "teacher" | "stats" | "comments") => void;
  theme: ResolvedAppTheme;
};

export const QuestionTabs: React.FC<QuestionTabsProps> = ({ active, onChange, theme }) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const tabs: Array<[QuestionTabsProps["active"], string]> = [
    ["explanation", "Gabarito"],
    ["teacher", "Professor"],
    ["stats", "Stats"],
    ["comments", "Discussão"],
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map(([value, label]) => (
        <MotionPressable key={value} accessibilityRole="tab" accessibilityState={{ selected: active === value }} onPress={() => onChange(value)} style={[styles.tab, active === value && styles.tabActive]}>
          <Text style={[styles.tabText, active === value && styles.tabTextActive]}>{label}</Text>
        </MotionPressable>
      ))}
    </View>
  );
};

type QuestionBottomActionsProps = {
  answered: boolean;
  selected: boolean;
  loading: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onConfirm: () => void;
  onPrevious: () => void;
  onNext: () => void;
  theme: ResolvedAppTheme;
};

export const QuestionBottomActions: React.FC<QuestionBottomActionsProps> = ({
  answered,
  selected,
  loading,
  canPrevious,
  canNext,
  onConfirm,
  onPrevious,
  onNext,
  theme,
}) => {
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.bottomActions}>
      <View style={styles.mainActions}>
        {answered ? (
          <>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Questão anterior" disabled={!canPrevious || loading} onPress={onPrevious} style={[styles.secondaryButton, styles.previousButton, (!canPrevious || loading) && styles.disabled]}>
              <Ionicons name="arrow-back" size={18} color={theme.text} />
              <Text style={styles.secondaryButtonText}>Anterior</Text>
            </MotionPressable>
            <MotionPressable accessibilityRole="button" disabled={!canNext || loading} onPress={onNext} style={[styles.primaryButton, (!canNext || loading) && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{loading ? "Carregando..." : "Próxima questão"}</Text>
              {!loading ? <Ionicons name="arrow-forward" size={18} color={theme.onPrimary} /> : null}
            </MotionPressable>
          </>
        ) : (
          <>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Questão anterior" disabled={!canPrevious || loading} onPress={onPrevious} hitSlop={8} style={[styles.arrowOnlyButton, (!canPrevious || loading) && styles.disabled]}>
              <Ionicons name="chevron-back" size={23} color={!canPrevious || loading ? theme.textSubtle : theme.text} />
            </MotionPressable>
            <MotionPressable accessibilityRole="button" disabled={!selected || loading} onPress={onConfirm} style={[styles.primaryButton, styles.confirmButton, (!selected || loading) && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{loading ? "Confirmando..." : "Confirmar resposta"}</Text>
            </MotionPressable>
            <MotionPressable accessibilityRole="button" accessibilityLabel="Próxima questão" disabled={!canNext || loading} onPress={onNext} hitSlop={8} style={[styles.arrowOnlyButton, (!canNext || loading) && styles.disabled]}>
              <Ionicons name="chevron-forward" size={23} color={!canNext || loading ? theme.textSubtle : theme.text} />
            </MotionPressable>
          </>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  headerBlock: { backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing[3] },
  headerRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], minHeight: 56, paddingHorizontal: spacing[4] },
  headerTitle: { color: theme.text, flex: 1, fontSize: typography.size.md, fontWeight: typography.weight.bold },
  headerActions: { alignItems: "center", flexDirection: "row" },
  iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 34 },
  progressCaptionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  progressCaption: { color: theme.text, fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
  progressPercent: { color: theme.textMuted, fontSize: 10, fontWeight: typography.weight.semibold },
  progressTrack: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.pill, height: 4, marginHorizontal: spacing[4], overflow: "hidden" },
  progressFill: { height: "100%" },
  metadataBlock: { gap: spacing[3] },
  metadataTopRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  metadataChips: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  metadataChip: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.pill, maxWidth: "55%", paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  metadataChipPrimary: { backgroundColor: theme.primarySubtle },
  metadataChipText: { color: theme.text, fontSize: 10, fontWeight: typography.weight.semibold },
  metadataToggle: { alignItems: "center", flexDirection: "row", gap: 2, minHeight: 36, paddingLeft: spacing[1] },
  metadataToggleText: { color: theme.primary, fontSize: 10, fontWeight: typography.weight.semibold },
  metadataDetails: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", flexWrap: "wrap", gap: spacing[3], padding: spacing[3] },
  metadataDetailRow: { minWidth: "44%" },
  metadataDetailLabel: { color: theme.textSubtle, fontSize: 10 },
  metadataDetailValue: { color: theme.text, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, marginTop: 2 },
  option: { alignItems: "flex-start", borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], minHeight: 60, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  optionNeutral: { backgroundColor: theme.surface, borderColor: theme.border },
  optionSelected: { backgroundColor: theme.primarySubtle, borderColor: theme.primary },
  optionCorrect: { backgroundColor: theme.successSubtle, borderColor: theme.success, borderWidth: 1 },
  optionWrong: { backgroundColor: theme.dangerSubtle, borderColor: theme.danger, borderWidth: 1 },
  optionBadge: { alignSelf: "center", alignItems: "center", borderRadius: radius.pill, height: 30, justifyContent: "center", width: 30 },
  badgeNeutral: { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderWidth: 1 },
  badgeSelected: { backgroundColor: theme.primary },
  badgeCorrect: { backgroundColor: theme.success },
  badgeWrong: { backgroundColor: theme.danger },
  optionLetter: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  optionLetterSelected: { color: theme.onPrimary },
  optionText: { color: theme.text, flex: 1, fontSize: typography.size.sm, lineHeight: 20, paddingTop: spacing[1] },
  tabs: { backgroundColor: theme.primarySubtle, borderRadius: radius.md, flexDirection: "row", padding: 3 },
  tab: { alignItems: "center", borderRadius: radius.sm, flex: 1, minHeight: 38, justifyContent: "center", paddingHorizontal: 3 },
  tabActive: { backgroundColor: theme.surface, elevation: 1 },
  tabText: { color: theme.textMuted, fontSize: 10, fontWeight: typography.weight.semibold },
  tabTextActive: { color: theme.primary },
  bottomActions: { backgroundColor: theme.surface, borderTopColor: theme.border, borderTopWidth: 1, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  mainActions: { alignItems: "center", flexDirection: "row", gap: spacing[3], width: "100%" },
  primaryButton: { alignItems: "center", backgroundColor: theme.primary, borderRadius: radius.button, flex: 1, flexDirection: "row", gap: spacing[2], justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[3] },
  confirmButton: { minHeight: 48 },
  primaryButtonText: { color: theme.onPrimary, fontSize: typography.role.button.fontSize, lineHeight: typography.role.button.lineHeight, fontWeight: typography.role.button.fontWeight },
  secondaryButton: { alignItems: "center", borderColor: theme.border, borderRadius: radius.button, borderWidth: 1, flexDirection: "row", gap: spacing[2], justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[3] },
  previousButton: { flex: 0.75 },
  secondaryButtonText: { color: theme.text, fontSize: typography.role.button.fontSize, lineHeight: typography.role.button.lineHeight, fontWeight: typography.weight.semibold },
  arrowOnlyButton: { alignItems: "center", borderColor: theme.border, borderRadius: radius.button, borderWidth: 1, height: 48, justifyContent: "center", width: 42 },
  disabled: { opacity: 0.5 },
});
