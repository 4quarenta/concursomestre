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
import { useAuth } from '@/providers/AuthProvider';
import { questionService } from '@/services/questions/questionService';
import { simulationsService } from '@/services/simulations/simulationsService';
import { AppStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import type { Question } from '@/types/questions';
import type { MobileSimulationResult } from '@/types/simulation';

type SimulationRunRoute = RouteProp<AppStackParamList, 'SimulationRun'>;

const stripHtml = (value: string): string => {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatRemainingTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`;
};

const getCorrectIndex = (question: Question): number => {
  const options = question.itens || [];
  const answerId = Number(question.resposta || -1);

  const byIdIndex = options.findIndex((item) => Number(item?.id) === answerId);
  if (byIdIndex >= 0) return byIdIndex;

  if (answerId >= 0 && answerId < options.length) return answerId;
  return -1;
};

const getQuestionKey = (question: Question, index: number): string => {
  if (question.id !== undefined && question.id !== null) {
    return String(question.id);
  }
  return `idx-${index}`;
};

const formatAnswerLabel = (value?: number): string => {
  if (value === undefined || value < 0) return '--';
  return String.fromCharCode(65 + value);
};

const mapSimulationDifficulty = (value?: string): string => {
  if (value === 'easy') return 'Facil';
  if (value === 'medium') return 'Medio';
  if (value === 'hard') return 'Dificil';
  return 'All';
};

type ReviewFilter = 'all' | 'correct' | 'wrong' | 'blank';

const getReviewStatus = (
  entry: MobileSimulationResult['questionResults'][number],
): Exclude<ReviewFilter, 'all'> => {
  if (entry.isCorrect) return 'correct';
  if (entry.answered) return 'wrong';
  return 'blank';
};

const getQuestionSubjectLabel = (question: Question): string => {
  const subject = (question.assuntos || []).find((item) => item?.materia && item?.nome);
  return subject?.nome || 'Geral';
};

const getQuestionTopicLabel = (question: Question): string => {
  const topic = (question.assuntos || []).find((item) => !item?.materia && item?.nome);
  return topic?.nome || 'Topico geral';
};

/**
 * Tela mobile de execucao do simulado.
 * @since v1.0.0
 */
export const SimulationRunScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<SimulationRunRoute>();
  const { user, refreshProfile } = useAuth();
  const { seed } = route.params;

  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [remainingSeconds, setRemainingSeconds] = React.useState(
    seed.config.timerEnabled ? seed.config.timerMinutes * 60 : 0,
  );
  const [finishing, setFinishing] = React.useState(false);
  const [result, setResult] = React.useState<MobileSimulationResult | null>(null);
  const [reviewFilter, setReviewFilter] = React.useState<ReviewFilter>('all');
  const [expandedReviewMap, setExpandedReviewMap] = React.useState<Record<string, boolean>>({});

  const currentQuestion = seed.questions[currentIndex];
  const currentQuestionKey = currentQuestion ? getQuestionKey(currentQuestion, currentIndex) : '';
  const feedbackMode = seed.config.feedbackMode || 'after_all';
  const isInstantFeedback = feedbackMode === 'instant';
  const hasSelectedAnswer = currentQuestion ? answers[currentQuestionKey] !== undefined : false;
  const isLastQuestion = currentIndex === seed.questions.length - 1;
  const progressText = `${Math.min(currentIndex + 1, seed.questions.length)} / ${seed.questions.length}`;
  const currentCorrectIndex = currentQuestion ? getCorrectIndex(currentQuestion) : -1;
  const currentSelectedIndex = currentQuestion ? answers[currentQuestionKey] : undefined;
  const currentAnswerIsCorrect = currentSelectedIndex !== undefined && currentSelectedIndex === currentCorrectIndex;

  const handleFinishSimulation = React.useCallback(async () => {
    if (finishing || result) return;

    setFinishing(true);
    try {
      const endedAt = Date.now();
      const elapsedSeconds = Math.max(0, Math.round((endedAt - seed.startedAt) / 1000));

      const questionResults = seed.questions.map((question, index) => {
        const questionKey = getQuestionKey(question, index);
        const selectedIndex = answers[questionKey];
        const correctIndex = getCorrectIndex(question);
        const answered = selectedIndex !== undefined;
        return {
          question,
          selectedIndex,
          answered,
          isCorrect: answered && selectedIndex === correctIndex,
          correctIndex,
        };
      });

      const score = questionResults.filter((entry) => entry.isCorrect).length;

      if (user?.id) {
        await Promise.allSettled(
          questionResults
            .filter((entry) => entry.answered && entry.question.id !== undefined && entry.question.id !== null)
            .map((entry) => questionService.submitUserAnswer(user.id, {
              questionId: Number(entry.question.id),
              selectedOptionIndex: Number(entry.selectedIndex),
              isCorrect: entry.isCorrect,
              timeTaken: 0,
            })),
        );
      }

      await simulationsService.saveSimulation({
        id: `sim-mobile-${endedAt}`,
        config: {
          id: 'mobile',
          name: 'Simulado mobile',
          questionCount: seed.questions.length,
          subjects: seed.config.subjects || [],
          difficulty: mapSimulationDifficulty(seed.config.difficulty),
          timerEnabled: seed.config.timerEnabled,
          timerMinutes: seed.config.timerMinutes,
          feedbackMode,
          filters: {
            careers: [],
            agencies: seed.config.agencies || [],
            years: seed.config.years || [],
            organizations: seed.config.organizations || [],
            roles: seed.config.roles || [],
            levels: [],
            topics: seed.config.topics || [],
            keyword: seed.config.keyword || undefined,
          },
        },
        questions: seed.questions,
        answers,
        startTime: seed.startedAt,
        endTime: endedAt,
        status: 'completed',
        score,
      });

      if (user?.id) {
        await refreshProfile();
      }

      setReviewFilter('all');
      setExpandedReviewMap({});
      setResult({
        score,
        total: seed.questions.length,
        elapsedSeconds,
        questionResults,
      });
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel finalizar o simulado.');
    } finally {
      setFinishing(false);
    }
  }, [answers, feedbackMode, finishing, refreshProfile, result, seed, user?.id]);

  React.useEffect(() => {
    if (!seed.config.timerEnabled || result) return;
    if (remainingSeconds <= 0) {
      void handleFinishSimulation();
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((current) => current - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [handleFinishSimulation, remainingSeconds, result, seed.config.timerEnabled]);

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion) return;
    if (isInstantFeedback && hasSelectedAnswer) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestionKey]: optionIndex,
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      void handleFinishSimulation();
      return;
    }
    setCurrentIndex((current) => Math.min(seed.questions.length - 1, current + 1));
  };

  const handleLeave = () => {
    navigation.replace('MainTabs');
  };

  if (result) {
    const accuracy = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
    const reviewRows = result.questionResults.map((entry, index) => ({
      entry,
      index,
      status: getReviewStatus(entry),
    }));
    const correctCount = reviewRows.filter((row) => row.status === 'correct').length;
    const wrongCount = reviewRows.filter((row) => row.status === 'wrong').length;
    const blankCount = reviewRows.filter((row) => row.status === 'blank').length;
    const visibleReviewRows = reviewFilter === 'all'
      ? reviewRows
      : reviewRows.filter((row) => row.status === reviewFilter);
    const reviewFilterOptions: Array<{ value: ReviewFilter; label: string; count: number }> = [
      { value: 'all', label: 'Todas', count: result.total },
      { value: 'correct', label: 'Acertos', count: correctCount },
      { value: 'wrong', label: 'Erros', count: wrongCount },
      { value: 'blank', label: 'Em branco', count: blankCount },
    ];

    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.resultCard}>
          <Text style={styles.eyebrow}>Resultado</Text>
          <Text style={styles.resultTitle}>Simulado finalizado</Text>
          <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
          <Text style={styles.resultMeta}>Aproveitamento: {accuracy}%</Text>
          <Text style={styles.resultMeta}>
            Tempo total: {formatRemainingTime(result.elapsedSeconds)}
          </Text>
          <View style={styles.resultStatsRow}>
            <View style={[styles.resultStatBadge, styles.resultStatBadgeCorrect]}>
              <Text style={[styles.resultStatText, styles.resultStatTextCorrect]}>{correctCount} acertos</Text>
            </View>
            <View style={[styles.resultStatBadge, styles.resultStatBadgeWrong]}>
              <Text style={[styles.resultStatText, styles.resultStatTextWrong]}>{wrongCount} erros</Text>
            </View>
            <View style={[styles.resultStatBadge, styles.resultStatBadgeBlank]}>
              <Text style={[styles.resultStatText, styles.resultStatTextBlank]}>{blankCount} em branco</Text>
            </View>
          </View>
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.reviewTitle}>Revisao por questao</Text>
          <Text style={styles.reviewDescription}>Confira onde acertou, errou ou deixou em branco.</Text>
          <View style={styles.reviewFiltersRow}>
            {reviewFilterOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setReviewFilter(option.value)}
                style={[styles.reviewFilterChip, reviewFilter === option.value && styles.reviewFilterChipActive]}
              >
                <Text style={[styles.reviewFilterText, reviewFilter === option.value && styles.reviewFilterTextActive]}>
                  {option.label} ({option.count})
                </Text>
              </Pressable>
            ))}
          </View>

          {visibleReviewRows.length === 0 ? (
            <View style={styles.reviewEmptyCard}>
              <Text style={styles.reviewEmptyText}>Nenhuma questao nesta visao.</Text>
            </View>
          ) : visibleReviewRows.map(({ entry, index, status }) => {
            const reviewKey = `${getQuestionKey(entry.question, index)}-review`;
            const isExpanded = Boolean(expandedReviewMap[reviewKey]);

            return (
              <Pressable
                key={reviewKey}
                onPress={() => setExpandedReviewMap((previous) => ({
                  ...previous,
                  [reviewKey]: !previous[reviewKey],
                }))}
                style={[
                  styles.reviewRow,
                  status === 'correct' && styles.reviewRowCorrect,
                  status === 'wrong' && styles.reviewRowWrong,
                  status === 'blank' && styles.reviewRowBlank,
                ]}
              >
                <View style={styles.reviewRowHeader}>
                  <Text style={styles.reviewQuestionNumber}>Questao {index + 1}</Text>
                  <Text style={[
                    styles.reviewStatus,
                    status === 'correct' && styles.reviewStatusCorrect,
                    status !== 'correct' && styles.reviewStatusWrong,
                  ]}>
                    {status === 'correct' ? 'Correta' : status === 'wrong' ? 'Incorreta' : 'Em branco'}
                  </Text>
                </View>
                <Text style={styles.reviewMeta}>
                  {getQuestionSubjectLabel(entry.question)} | {getQuestionTopicLabel(entry.question)}
                </Text>
                <Text numberOfLines={isExpanded ? undefined : 3} style={styles.reviewQuestionText}>
                  {stripHtml(entry.question.enunciado_clean || entry.question.enunciado || 'Questao sem enunciado')}
                </Text>
                <View style={styles.reviewAnswerRow}>
                  <Text style={styles.reviewAnswerText}>Sua resposta: {formatAnswerLabel(entry.selectedIndex)}</Text>
                  <Text style={styles.reviewAnswerText}>Gabarito: {formatAnswerLabel(entry.correctIndex)}</Text>
                </View>
                <Text style={styles.reviewExpandHint}>
                  {isExpanded ? 'Toque para recolher alternativas' : 'Toque para ver alternativas'}
                </Text>

                {isExpanded ? (
                  <View style={styles.reviewOptionsList}>
                    {(entry.question.itens || []).map((item, optionIndex) => {
                      const selected = entry.selectedIndex === optionIndex;
                      const correct = entry.correctIndex === optionIndex;

                      return (
                        <View
                          key={`${reviewKey}-option-${optionIndex}`}
                          style={[
                            styles.reviewOptionRow,
                            correct && styles.reviewOptionRowCorrect,
                            selected && !correct && styles.reviewOptionRowWrong,
                          ]}
                        >
                          <Text style={styles.reviewOptionLabel}>{String.fromCharCode(65 + optionIndex)}</Text>
                          <Text style={styles.reviewOptionText}>
                            {stripHtml(item?.corpo_clean || item?.corpo || `Alternativa ${optionIndex + 1}`)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.mainButton} onPress={handleLeave}>
          <Text style={styles.mainButtonText}>Voltar para simulados</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topCard}>
        <View style={styles.topRow}>
          <Text style={styles.progressText}>Questao {progressText}</Text>
          {seed.config.timerEnabled && (
            <Text style={styles.timerText}>{formatRemainingTime(remainingSeconds)}</Text>
          )}
        </View>
        <Text style={styles.questionText}>
          {stripHtml(currentQuestion.enunciado_clean || currentQuestion.enunciado || 'Questao sem enunciado')}
        </Text>
      </View>

      {isInstantFeedback && hasSelectedAnswer ? (
        <View style={[styles.feedbackCard, currentAnswerIsCorrect ? styles.feedbackCardCorrect : styles.feedbackCardWrong]}>
          <Text style={[styles.feedbackTitle, currentAnswerIsCorrect ? styles.feedbackTitleCorrect : styles.feedbackTitleWrong]}>
            {currentAnswerIsCorrect ? 'Resposta correta' : 'Resposta incorreta'}
          </Text>
          <Text style={styles.feedbackText}>
            Sua resposta: {formatAnswerLabel(currentSelectedIndex)} | Gabarito: {formatAnswerLabel(currentCorrectIndex)}
          </Text>
        </View>
      ) : null}

      <View style={styles.optionsContainer}>
        {(currentQuestion.itens || []).map((item, optionIndex) => {
          const selected = currentSelectedIndex === optionIndex;
          const showInstantResult = isInstantFeedback && hasSelectedAnswer;
          const isCorrectOption = showInstantResult && currentCorrectIndex === optionIndex;
          const isWrongSelected = showInstantResult && selected && currentCorrectIndex !== optionIndex;
          return (
            <Pressable
              key={`${currentQuestion.id}-${optionIndex}`}
              onPress={() => handleSelectOption(optionIndex)}
              disabled={finishing || (isInstantFeedback && hasSelectedAnswer)}
              style={[
                styles.optionButton,
                selected && styles.optionButtonSelected,
                isCorrectOption && styles.optionButtonCorrect,
                isWrongSelected && styles.optionButtonWrong,
                (finishing || (isInstantFeedback && hasSelectedAnswer)) && styles.optionButtonLocked,
              ]}
            >
              <Text style={styles.optionLabel}>{String.fromCharCode(65 + optionIndex)}</Text>
              <Text style={styles.optionText}>
                {stripHtml(item?.corpo_clean || item?.corpo || `Alternativa ${optionIndex + 1}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.secondaryButton, currentIndex === 0 && styles.buttonDisabled]}
          onPress={() => setCurrentIndex((current) => Math.max(0, current - 1))}
          disabled={currentIndex === 0}
        >
          <Text style={styles.secondaryButtonText}>Anterior</Text>
        </Pressable>

        <Pressable
          style={[styles.mainButton, (!hasSelectedAnswer || finishing) && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!hasSelectedAnswer || finishing}
        >
          {finishing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.mainButtonText}>{isLastQuestion ? 'Finalizar' : 'Proxima'}</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.exitButton} onPress={handleLeave} disabled={finishing}>
        <Text style={styles.exitButtonText}>Sair do simulado</Text>
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
  topCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  timerText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  questionText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  feedbackCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  feedbackCardCorrect: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  feedbackCardWrong: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  feedbackTitleCorrect: {
    color: colors.success,
  },
  feedbackTitleWrong: {
    color: colors.danger,
  },
  feedbackText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  optionButtonCorrect: {
    borderColor: colors.success,
    backgroundColor: '#ECFDF5',
  },
  optionButtonWrong: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  optionButtonLocked: {
    opacity: 0.94,
  },
  optionLabel: {
    width: 24,
    height: 24,
    borderRadius: 999,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  optionText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mainButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  exitButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitButtonText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 16,
    gap: 6,
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  resultScore: {
    color: colors.primary,
    fontSize: 36,
    fontWeight: '900',
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  resultStatsRow: {
    marginTop: 8,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  resultStatBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  resultStatBadgeCorrect: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  resultStatBadgeWrong: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  resultStatBadgeBlank: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  resultStatText: {
    fontSize: 11,
    fontWeight: '900',
  },
  resultStatTextCorrect: {
    color: colors.success,
  },
  resultStatTextWrong: {
    color: colors.danger,
  },
  resultStatTextBlank: {
    color: colors.muted,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  reviewFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewFilterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  reviewFilterChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  reviewFilterText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  reviewFilterTextActive: {
    color: colors.primary,
  },
  reviewEmptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  reviewEmptyText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  reviewDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
  reviewRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  reviewQuestionNumber: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  reviewStatus: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  reviewStatusCorrect: {
    color: colors.success,
  },
  reviewStatusWrong: {
    color: colors.danger,
  },
  reviewQuestionText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  reviewMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  reviewAnswerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewAnswerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  reviewExpandHint: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  reviewOptionsList: {
    gap: 6,
  },
  reviewOptionRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 8,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  reviewOptionRowCorrect: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  reviewOptionRowWrong: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  reviewOptionLabel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
    width: 16,
  },
  reviewOptionText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});

export default SimulationRunScreen;
