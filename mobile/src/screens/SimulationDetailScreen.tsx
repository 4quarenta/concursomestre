import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';
import { simulationsService } from '@/services/simulations/simulationsService';
import { colors } from '@/theme/colors';
import type { Question } from '@/types/questions';
import type { SimulationDetail } from '@/types/simulations';

type SimulationDetailRoute = RouteProp<AppStackParamList, 'SimulationDetail'>;
type ReviewFilter = 'all' | 'correct' | 'wrong' | 'blank';

const stripHtml = (value: string): string => (
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const formatAnswerLabel = (value?: number): string => {
  if (value === undefined || value < 0) return '--';
  return String.fromCharCode(65 + value);
};

const getQuestionKey = (question: Question, index: number): string => {
  if (question.id !== undefined && question.id !== null) {
    return String(question.id);
  }
  return `idx-${index}`;
};

const formatDateTime = (rawValue: number | string | undefined): string => {
  if (rawValue === undefined || rawValue === null) return '--';

  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue > 9999999999 ? numericValue : numericValue * 1000)
    : new Date(String(rawValue));

  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('pt-BR');
};

const formatDuration = (seconds?: number): string => {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`;
};

/**
 * Tela de detalhe de historico de simulado no mobile.
 * @since v1.0.0
 */
export const SimulationDetailScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<SimulationDetailRoute>();
  const { simulationId } = route.params;

  const [loading, setLoading] = React.useState(true);
  const [detail, setDetail] = React.useState<SimulationDetail | null>(null);
  const [reviewFilter, setReviewFilter] = React.useState<ReviewFilter>('all');
  const [expandedMap, setExpandedMap] = React.useState<Record<string, boolean>>({});

  const loadDetail = React.useCallback(async () => {
    setLoading(true);
    try {
      const row = await simulationsService.getDetail(simulationId);
      setDetail(row);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar o detalhe do simulado.');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [simulationId]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Detalhe indisponivel</Text>
          <Text style={styles.emptyText}>Nao encontramos os dados completos deste simulado.</Text>
        </View>
        <Pressable style={styles.mainButton} onPress={() => navigation.goBack()}>
          <Text style={styles.mainButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const questionResults = (detail.questions || []).map((question, index) => {
    const questionKey = getQuestionKey(question, index);
    const rawAnswer = detail.answers?.[questionKey];
    const selectedIndex = typeof rawAnswer === 'object'
      ? Number(rawAnswer?.index)
      : rawAnswer !== undefined
        ? Number(rawAnswer)
        : undefined;

    const normalizedSelectedIndex = selectedIndex !== undefined && Number.isFinite(selectedIndex)
      ? selectedIndex
      : undefined;
    const rawCorrectIndex = typeof rawAnswer === 'object'
      ? Number(rawAnswer?.correct_option_index ?? rawAnswer?.correctOptionIndex)
      : Number.NaN;
    const correctIndex = Number.isFinite(rawCorrectIndex) ? rawCorrectIndex : -1;
    const answered = normalizedSelectedIndex !== undefined;
    const canonicalIsCorrect = typeof rawAnswer === 'object'
      ? rawAnswer?.is_correct ?? rawAnswer?.isCorrect
      : undefined;
    const isCorrect = answered && (
      canonicalIsCorrect === true
      || canonicalIsCorrect === 1
      || canonicalIsCorrect === '1'
    );

    return {
      question,
      index,
      selectedIndex: normalizedSelectedIndex,
      answered,
      correctIndex,
      status: (isCorrect ? 'correct' : answered ? 'wrong' : 'blank') as Exclude<ReviewFilter, 'all'>,
    };
  });

  const totalQuestions = questionResults.length || Number(detail.questionCount || 0);
  const correctCount = questionResults.filter((item) => item.status === 'correct').length;
  const wrongCount = questionResults.filter((item) => item.status === 'wrong').length;
  const blankCount = questionResults.filter((item) => item.status === 'blank').length;
  const score = detail.score ?? correctCount;
  const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const elapsedSeconds = detail.startTime && detail.endTime
    ? Math.max(0, Math.round((detail.endTime - detail.startTime) / 1000))
    : undefined;
  const visibleRows = reviewFilter === 'all'
    ? questionResults
    : questionResults.filter((item) => item.status === reviewFilter);

  const filterOptions: Array<{ value: ReviewFilter; label: string; count: number }> = [
    { value: 'all', label: 'Todas', count: totalQuestions },
    { value: 'correct', label: 'Acertos', count: correctCount },
    { value: 'wrong', label: 'Erros', count: wrongCount },
    { value: 'blank', label: 'Em branco', count: blankCount },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.resultCard}>
        <Text style={styles.eyebrow}>{detail.source === 'local' ? 'Historico local' : 'Historico'}</Text>
        <Text style={styles.title}>{detail.name || `Simulado ${detail.id}`}</Text>
        <Text style={styles.score}>{score} / {totalQuestions || '--'}</Text>
        <Text style={styles.meta}>Aproveitamento: {accuracy}%</Text>
        <Text style={styles.meta}>Atualizado: {formatDateTime(detail.updatedAt || detail.createdAt)}</Text>
        {elapsedSeconds !== undefined ? (
          <Text style={styles.meta}>Tempo total: {formatDuration(elapsedSeconds)}</Text>
        ) : null}
      </View>

      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Revisao por questao</Text>
        <View style={styles.filtersRow}>
          {filterOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setReviewFilter(option.value)}
              style={[styles.filterChip, reviewFilter === option.value && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, reviewFilter === option.value && styles.filterTextActive]}>
                {option.label} ({option.count})
              </Text>
            </Pressable>
          ))}
        </View>

        {visibleRows.length === 0 ? (
          <View style={styles.emptyInlineCard}>
            <Text style={styles.emptyInlineText}>Nenhuma questao nesta visao.</Text>
          </View>
        ) : visibleRows.map((row) => {
          const rowKey = `${getQuestionKey(row.question, row.index)}-detail`;
          const isExpanded = Boolean(expandedMap[rowKey]);

          return (
            <View
              key={rowKey}
              style={[
                styles.reviewRow,
                row.status === 'correct' && styles.reviewRowCorrect,
                row.status === 'wrong' && styles.reviewRowWrong,
                row.status === 'blank' && styles.reviewRowBlank,
              ]}
            >
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>Questao {row.index + 1}</Text>
                <Text style={[
                  styles.rowStatus,
                  row.status === 'correct' && styles.rowStatusCorrect,
                  row.status !== 'correct' && styles.rowStatusWrong,
                ]}>
                  {row.status === 'correct' ? 'Correta' : row.status === 'wrong' ? 'Incorreta' : 'Em branco'}
                </Text>
              </View>
              <Text numberOfLines={isExpanded ? undefined : 3} style={styles.questionText}>
                {stripHtml(row.question.enunciado_clean || row.question.enunciado || 'Questao sem enunciado')}
              </Text>
              <View style={styles.answerRow}>
                <Text style={styles.answerText}>Sua resposta: {formatAnswerLabel(row.selectedIndex)}</Text>
                <Text style={styles.answerText}>Gabarito: {formatAnswerLabel(row.correctIndex)}</Text>
              </View>
              <Pressable
                onPress={() => setExpandedMap((previous) => ({ ...previous, [rowKey]: !previous[rowKey] }))}
                style={styles.expandButton}
              >
                <Text style={styles.expandText}>
                  {isExpanded ? 'Recolher alternativas' : 'Ver alternativas'}
                </Text>
              </Pressable>
              {isExpanded ? (
                <View style={styles.optionsList}>
                  {(row.question.itens || []).map((item, optionIndex) => {
                    const selected = row.selectedIndex === optionIndex;
                    const correct = row.correctIndex === optionIndex;
                    return (
                      <View
                        key={`${rowKey}-option-${optionIndex}`}
                        style={[
                          styles.optionRow,
                          correct && styles.optionRowCorrect,
                          selected && !correct && styles.optionRowWrong,
                        ]}
                      >
                        <Text style={styles.optionLabel}>{String.fromCharCode(65 + optionIndex)}</Text>
                        <Text style={styles.optionText}>
                          {stripHtml(item?.corpo_clean || item?.corpo || `Alternativa ${optionIndex + 1}`)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.mainButton} onPress={() => navigation.goBack()}>
        <Text style={styles.mainButtonText}>Voltar para simulados</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 12,
    gap: 10,
    paddingBottom: 24,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    gap: 6,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  score: {
    color: colors.primary,
    fontSize: 34,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  filterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  filterTextActive: {
    color: colors.primary,
  },
  reviewRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    gap: 8,
  },
  reviewRowCorrect: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  reviewRowWrong: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  reviewRowBlank: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  rowStatus: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  rowStatusCorrect: {
    color: colors.success,
  },
  rowStatusWrong: {
    color: colors.danger,
  },
  questionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  answerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  answerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  expandButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  expandText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  optionsList: {
    gap: 6,
  },
  optionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  optionRowCorrect: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  optionRowWrong: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  optionLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    width: 16,
  },
  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  emptyCard: {
    margin: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 16,
    gap: 6,
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyInlineCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  emptyInlineText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  mainButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

export default SimulationDetailScreen;
