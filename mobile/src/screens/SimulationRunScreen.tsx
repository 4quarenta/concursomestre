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

  const currentQuestion = seed.questions[currentIndex];
  const currentQuestionKey = currentQuestion ? getQuestionKey(currentQuestion, currentIndex) : '';
  const hasSelectedAnswer = currentQuestion ? answers[currentQuestionKey] !== undefined : false;
  const isLastQuestion = currentIndex === seed.questions.length - 1;
  const progressText = `${Math.min(currentIndex + 1, seed.questions.length)} / ${seed.questions.length}`;

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
          subjects: [],
          difficulty: 'All',
          timerEnabled: seed.config.timerEnabled,
          timerMinutes: seed.config.timerMinutes,
          feedbackMode: 'after_all',
          filters: {
            careers: [],
            agencies: [],
            years: [],
            organizations: [],
            roles: [],
            levels: [],
            topics: [],
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

      setResult({
        score,
        total: seed.questions.length,
        elapsedSeconds,
      });
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel finalizar o simulado.');
    } finally {
      setFinishing(false);
    }
  }, [answers, finishing, refreshProfile, result, seed, user?.id]);

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

      <View style={styles.optionsContainer}>
        {(currentQuestion.itens || []).map((item, optionIndex) => {
          const selected = answers[currentQuestionKey] === optionIndex;
          return (
            <Pressable
              key={`${currentQuestion.id}-${optionIndex}`}
              onPress={() => handleSelectOption(optionIndex)}
              style={[styles.optionButton, selected && styles.optionButtonSelected]}
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
});

export default SimulationRunScreen;
