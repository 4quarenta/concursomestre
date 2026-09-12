import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Question } from '@/types/questions';

const stripHtml = (value?: string): string => (
  String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
);

const getEntityLabel = (item?: { nome?: string; sigla?: string }): string => (
  String(item?.sigla || item?.nome || '').trim()
);

const getRoleLabel = (item?: { descricao?: string; ['descrição']?: string; nome?: string }): string => (
  String(item?.descricao || item?.['descrição'] || item?.nome || '').trim()
);

const resolveCorrectOptionIndex = (question: Question): number | undefined => {
  if (Number.isInteger(question.correctOptionIndex)) {
    return Number(question.correctOptionIndex);
  }

  if (Number.isInteger(question.resposta)) {
    const legacyOneBased = Number(question.resposta);
    return legacyOneBased > 0 ? legacyOneBased - 1 : legacyOneBased;
  }

  return undefined;
};

type QuestionCardProps = {
  question: Question;
  isSaved: boolean;
  answeringOptionIndex?: number;
  onAnswer: (question: Question, optionIndex: number) => void;
  onToggleSaved: (question: Question) => void;
};

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  isSaved,
  answeringOptionIndex,
  onAnswer,
  onToggleSaved,
}) => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const selectedOptionIndex = question.userAnswer?.selectedOptionIndex;
  const correctOptionIndex = selectedOptionIndex !== undefined
    ? resolveCorrectOptionIndex(question)
    : undefined;
  const answered = selectedOptionIndex !== undefined;
  const metadata = [
    question.bancas?.map(getEntityLabel).filter(Boolean)[0],
    question.orgaos?.map(getEntityLabel).filter(Boolean)[0],
    question.cargos?.map(getRoleLabel).filter(Boolean)[0],
    question.anos?.[0] ? String(question.anos[0]) : '',
  ].filter(Boolean);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Questao #{question.id ?? '-'}</Text>
          {metadata.length > 0 ? <Text style={styles.metadata}>{metadata.join(' · ')}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Remover questao dos salvos' : 'Salvar questao'}
          onPress={() => onToggleSaved(question)}
          style={({ pressed }) => [
            styles.saveButton,
            isSaved && styles.saveButtonActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>
            {isSaved ? 'Salva' : 'Salvar'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.statement}>
        {stripHtml(question.enunciado_clean || question.enunciado) || 'Questao sem enunciado.'}
      </Text>

      <View style={styles.options}>
        {(question.itens || []).map((option, optionIndex) => {
          const isSelected = selectedOptionIndex === optionIndex;
          const isCorrect = answered && correctOptionIndex === optionIndex;
          const isWrongSelection = answered && isSelected && correctOptionIndex !== optionIndex;
          const isAnswering = answeringOptionIndex === optionIndex;

          return (
            <Pressable
              key={`${question.id ?? 'question'}-${option.id ?? optionIndex}`}
              accessibilityRole="button"
              disabled={answered || answeringOptionIndex !== undefined}
              onPress={() => onAnswer(question, optionIndex)}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                isCorrect && styles.optionCorrect,
                isWrongSelection && styles.optionWrong,
                pressed && !answered && styles.pressed,
              ]}
            >
              <Text style={styles.optionLabel}>{String.fromCharCode(65 + optionIndex)}</Text>
              <Text style={styles.optionText}>{stripHtml(option.corpo_clean || option.corpo)}</Text>
              {isAnswering ? <ActivityIndicator size="small" color={theme.primary} /> : null}
            </Pressable>
          );
        })}
      </View>

      {answered ? (
        <Text style={[styles.feedback, question.userAnswer?.isCorrect ? styles.success : styles.danger]}>
          {question.userAnswer?.isCorrect ? 'Resposta correta.' : 'Resposta incorreta.'}
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[4],
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing[1],
  },
  eyebrow: {
    color: theme.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  metadata: {
    color: theme.textMuted,
    fontSize: typography.size.xs,
  },
  saveButton: {
    borderColor: theme.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  saveButtonActive: {
    backgroundColor: theme.primarySubtle,
    borderColor: theme.primaryBorder,
  },
  saveButtonText: {
    color: theme.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  saveButtonTextActive: {
    color: theme.primary,
  },
  statement: {
    color: theme.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    lineHeight: 24,
  },
  options: {
    gap: spacing[2],
  },
  option: {
    alignItems: 'center',
    backgroundColor: theme.surfaceSubtle,
    borderColor: theme.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing[3],
    minHeight: 52,
    padding: spacing[3],
  },
  optionSelected: {
    borderColor: theme.primary,
  },
  optionCorrect: {
    backgroundColor: theme.successSubtle,
    borderColor: theme.success,
  },
  optionWrong: {
    backgroundColor: theme.dangerSubtle,
    borderColor: theme.danger,
  },
  optionLabel: {
    color: theme.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    width: 20,
  },
  optionText: {
    color: theme.text,
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  feedback: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  success: {
    color: theme.success,
  },
  danger: {
    color: theme.danger,
  },
  pressed: {
    opacity: 0.72,
  },
});

export default QuestionCard;
