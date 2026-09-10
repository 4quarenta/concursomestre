import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type DifficultyGroup = 'all' | 'easy' | 'medium' | 'hard';

type QuestionsFiltersProps = {
  keyword: string;
  difficulty: DifficultyGroup;
  onlySaved: boolean;
  excludeAnswered: boolean;
  onKeywordChange: (value: string) => void;
  onDifficultyChange: (value: DifficultyGroup) => void;
  onOnlySavedChange: (value: boolean) => void;
  onExcludeAnsweredChange: (value: boolean) => void;
  onClear: () => void;
};

const difficultyOptions: Array<{ value: DifficultyGroup; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'easy', label: 'Faceis' },
  { value: 'medium', label: 'Medias' },
  { value: 'hard', label: 'Dificeis' },
];

export const QuestionsFilters: React.FC<QuestionsFiltersProps> = ({
  keyword,
  difficulty,
  onlySaved,
  excludeAnswered,
  onKeywordChange,
  onDifficultyChange,
  onOnlySavedChange,
  onExcludeAnsweredChange,
  onClear,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <TextInput
        accessibilityLabel="Buscar questoes"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onKeywordChange}
        placeholder="Buscar no enunciado ou pelo ID"
        placeholderTextColor={theme.textSubtle}
        style={styles.input}
        value={keyword}
      />

      <View style={styles.rowWrap}>
        {difficultyOptions.map((option) => {
          const active = difficulty === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onDifficultyChange(option.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.rowWrap}>
        <Pressable
          onPress={() => onOnlySavedChange(!onlySaved)}
          style={({ pressed }) => [
            styles.chip,
            onlySaved && styles.chipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipText, onlySaved && styles.chipTextActive]}>Somente salvas</Text>
        </Pressable>

        <Pressable
          onPress={() => onExcludeAnsweredChange(!excludeAnswered)}
          style={({ pressed }) => [
            styles.chip,
            excludeAnswered && styles.chipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipText, excludeAnswered && styles.chipTextActive]}>Nao respondidas</Text>
        </Pressable>

        <Pressable onPress={onClear} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
          <Text style={styles.clearText}>Limpar</Text>
        </Pressable>
      </View>
    </View>
  );
};

export type { DifficultyGroup };

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  input: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: theme.text,
    fontSize: typography.size.sm,
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  chip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  chipActive: {
    backgroundColor: theme.primarySubtle,
    borderColor: theme.primaryBorder,
  },
  chipText: {
    color: theme.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  chipTextActive: {
    color: theme.primary,
  },
  clearButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  clearText: {
    color: theme.danger,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  pressed: {
    opacity: 0.72,
  },
});

export default QuestionsFilters;
