import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';
import type { Question, QuestionHistoryEntry } from '@/types/questions';

type QuestionHistoryPanelProps = {
  question: Question;
  history: QuestionHistoryEntry[];
  loading?: boolean;
};

const formatTimestamp = (timestamp?: number): string => {
  if (!timestamp) return 'Resolucao recente';

  try {
    return new Date(timestamp).toLocaleString('pt-BR');
  } catch {
    return 'Resolucao recente';
  }
};

const resolveOptionLabel = (question: Question, selectedOptionIndex: number): string => {
  const options = question.itens || [];
  const byIdIndex = options.findIndex((item) => Number(item?.id) === Number(selectedOptionIndex));
  const optionIndex = byIdIndex >= 0 ? byIdIndex : Number(selectedOptionIndex);
  const option = options[optionIndex];

  if (option?.rotulo) return option.rotulo;
  if (Number.isInteger(optionIndex) && optionIndex >= 0 && optionIndex < options.length) {
    return String.fromCharCode(65 + optionIndex);
  }

  return '?';
};

export const QuestionHistoryPanel: React.FC<QuestionHistoryPanelProps> = ({
  question,
  history,
  loading = false,
}) => {
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Historico de resolucoes</Text>
        <Text style={styles.summary}>{history.length} registro(s)</Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando historico</Text>
        </View>
      ) : history.length > 0 ? (
        <View style={styles.list}>
          {history.map((entry, index) => {
            const optionLabel = resolveOptionLabel(question, Number(entry.selectedOptionIndex));

            return (
              <View key={`${question.id || 'question'}-history-${index}`} style={styles.card}>
                <View style={styles.cardLeft}>
                  <View style={[styles.optionBadge, entry.isCorrect ? styles.optionBadgeSuccess : styles.optionBadgeDanger]}>
                    <Text style={[styles.optionBadgeText, entry.isCorrect ? styles.optionBadgeTextSuccess : styles.optionBadgeTextDanger]}>
                      {optionLabel}
                    </Text>
                  </View>
                  <View style={styles.cardTextBlock}>
                    <Text style={[styles.cardTitle, entry.isCorrect ? styles.cardTitleSuccess : styles.cardTitleDanger]}>
                      {entry.isCorrect ? 'Correta' : 'Incorreta'}
                    </Text>
                    <Text style={styles.cardMeta}>{formatTimestamp(entry.timestamp)}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nenhum historico encontrado</Text>
          <Text style={styles.emptyText}>Assim que voce resolver esta questao, os registros aparecem aqui.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    padding: 12,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  summary: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBadgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  optionBadgeDanger: {
    backgroundColor: '#FEE2E2',
  },
  optionBadgeText: {
    fontSize: 13,
    fontWeight: '900',
  },
  optionBadgeTextSuccess: {
    color: colors.success,
  },
  optionBadgeTextDanger: {
    color: colors.danger,
  },
  cardTextBlock: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  cardTitleSuccess: {
    color: colors.success,
  },
  cardTitleDanger: {
    color: colors.danger,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 6,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
});

export default QuestionHistoryPanel;
