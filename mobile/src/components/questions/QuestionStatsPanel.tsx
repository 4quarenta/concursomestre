import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/theme/colors';
import type { Question, QuestionStats } from '@/types/questions';

type QuestionStatsPanelProps = {
  question: Question;
  stats?: QuestionStats | null;
  loading?: boolean;
};

const getAccuracyRate = (stats?: QuestionStats | null): number => {
  const totalAttempts = Number(stats?.totalAttempts || 0);
  if (totalAttempts <= 0) return 0;

  return Math.round((Number(stats?.correctCount || 0) / totalAttempts) * 100);
};

const getDistributionCount = (
  distribution: Record<string, number> | undefined,
  optionId: string | number | undefined,
  optionIndex: number,
): number => {
  if (!distribution) return 0;

  const candidateKeys = Array.from(new Set([
    optionId === undefined || optionId === null ? '' : String(optionId),
    String(optionIndex),
  ].filter(Boolean)));

  return candidateKeys.reduce((sum, key) => sum + Number(distribution[key] || 0), 0);
};

export const QuestionStatsPanel: React.FC<QuestionStatsPanelProps> = ({
  question,
  stats,
  loading = false,
}) => {
  const totalAttempts = Number(stats?.totalAttempts || 0);
  const correctCount = Number(stats?.correctCount || 0);
  const wrongCount = Number(stats?.wrongCount || 0);
  const accuracyRate = getAccuracyRate(stats);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>Estatisticas da questao</Text>
        <Text style={styles.summary}>{totalAttempts} respostas</Text>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando estatisticas</Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{totalAttempts}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Acertos</Text>
              <Text style={[styles.summaryValue, styles.summaryValueSuccess]}>{correctCount}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Erros</Text>
              <Text style={[styles.summaryValue, styles.summaryValueDanger]}>{wrongCount}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Taxa</Text>
              <Text style={styles.summaryValue}>{accuracyRate}%</Text>
            </View>
          </View>

          <View style={styles.distributionBlock}>
            <Text style={styles.sectionTitle}>Distribuicao por alternativa</Text>

            {(question.itens || []).length > 0 ? (
              <View style={styles.distributionList}>
                {(question.itens || []).map((option, index) => {
                  const count = getDistributionCount(stats?.optionDistribution, option.id, index);
                  const percentage = totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;
                  const label = option.rotulo || String.fromCharCode(65 + index);

                  return (
                    <View key={`${question.id || 'question'}-stats-${index}`} style={styles.distributionRow}>
                      <View style={styles.distributionLeft}>
                        <View style={styles.optionBadge}>
                          <Text style={styles.optionBadgeText}>{label}</Text>
                        </View>
                        <View style={styles.distributionTextBlock}>
                          <Text style={styles.distributionText}>{count} respostas</Text>
                          <Text style={styles.distributionHint}>
                            {option.corpo_clean || option.corpo || `Alternativa ${index + 1}`}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.distributionPercentage}>{percentage}%</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.emptyText}>As alternativas desta questao nao estao disponiveis no payload atual.</Text>
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.primarySubtle,
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
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  summaryValueSuccess: {
    color: colors.success,
  },
  summaryValueDanger: {
    color: colors.danger,
  },
  distributionBlock: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  distributionList: {
    gap: 8,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
  },
  distributionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySubtle,
  },
  optionBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  distributionTextBlock: {
    flex: 1,
    gap: 2,
  },
  distributionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  distributionHint: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  distributionPercentage: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
});

export default QuestionStatsPanel;
