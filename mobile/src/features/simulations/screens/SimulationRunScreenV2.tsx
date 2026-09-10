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
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { simulationQueryKeys } from '@/features/simulations/api/queryKeys';
import { simulationsService } from '@/services/simulations/simulationsService';
import { useSimulationRunStore } from '@/state/simulationRunStore';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Question } from '@/types/questions';
import type { MobileSimulationResult } from '@/types/simulation';
import type { SimulationAnswerResult } from '@/types/simulations';

const stripHtml = (value?: string): string => (
  String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
);

const formatRemainingTime = (seconds: number): string => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
};

const questionKey = (question: Question, index: number): string => String(question.id ?? `idx-${index}`);

export const SimulationRunScreenV2: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const seed = useSimulationRunStore((state) => state.seed);
  const answers = useSimulationRunStore((state) => state.answers);
  const currentIndex = useSimulationRunStore((state) => state.currentIndex);
  const setAnswer = useSimulationRunStore((state) => state.setAnswer);
  const setCurrentIndex = useSimulationRunStore((state) => state.setCurrentIndex);
  const clearSeed = useSimulationRunStore((state) => state.clearSeed);
  const [hydrated, setHydrated] = React.useState(() => useSimulationRunStore.persist.hasHydrated());
  const [serverResults, setServerResults] = React.useState<Record<string, SimulationAnswerResult>>({});
  const [result, setResult] = React.useState<MobileSimulationResult | null>(null);
  const [finishing, setFinishing] = React.useState(false);
  const [savingAnswer, setSavingAnswer] = React.useState(false);
  const [showPalette, setShowPalette] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);

  React.useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useSimulationRunStore.persist.onFinishHydration(() => setHydrated(true));
    if (useSimulationRunStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);

  React.useEffect(() => {
    if (!seed?.config.timerEnabled || result) {
      setRemainingSeconds(0);
      return;
    }

    const update = () => {
      const deadline = seed.startedAt + seed.config.timerMinutes * 60 * 1000;
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [result, seed]);

  const simulationId = React.useMemo(
    () => seed?.id || (seed ? `sim-mobile-${seed.startedAt}` : ''),
    [seed],
  );
  const currentQuestion = seed?.questions[currentIndex];
  const currentKey = currentQuestion ? questionKey(currentQuestion, currentIndex) : '';
  const currentSelected = currentKey ? answers[currentKey] : undefined;
  const currentServerResult = currentQuestion?.id !== undefined
    ? serverResults[String(currentQuestion.id)]
    : undefined;
  const instantFeedback = seed?.config.feedbackMode === 'instant';

  const buildPayload = React.useCallback((status: 'in_progress' | 'completed', nextAnswers = answers) => {
    if (!seed) return null;
    const endTime = Date.now();
    return {
      id: simulationId,
      config: {
        ...seed.config,
        id: 'mobile',
        name: 'Simulado mobile',
        questionIds: seed.questions.map((question) => question.id).filter(Boolean),
      },
      questions: seed.questions.map((question) => ({ id: question.id })),
      answers: Object.fromEntries(
        Object.entries(nextAnswers).map(([id, index]) => [id, { index, time_taken: 0 }]),
      ),
      startTime: seed.startedAt,
      endTime,
      status,
    };
  }, [answers, seed, simulationId]);

  const persistSnapshot = React.useCallback(async (
    status: 'in_progress' | 'completed',
    nextAnswers = answers,
  ) => {
    const payload = buildPayload(status, nextAnswers);
    if (!payload) throw new Error('Simulado ativo nao encontrado.');
    return simulationsService.saveSimulation(payload);
  }, [answers, buildPayload]);

  const finish = React.useCallback(async () => {
    if (!seed || finishing || result) return;

    setFinishing(true);
    try {
      const saved = await persistSnapshot('completed');
      const authoritative = saved.results;
      setServerResults(authoritative);

      const questionResults = seed.questions.map((question, index) => {
        const key = questionKey(question, index);
        const selectedIndex = answers[key];
        const server = question.id !== undefined ? authoritative[String(question.id)] : undefined;
        return {
          question: server ? {
            ...question,
            correctOptionIndex: server.correctOptionIndex,
            userAnswer: {
              questionId: question.id,
              selectedOptionIndex: server.selectedOptionIndex,
              isCorrect: server.isCorrect,
              timestamp: Date.now(),
            },
          } : question,
          selectedIndex,
          answered: selectedIndex !== undefined,
          isCorrect: Boolean(server?.isCorrect),
          correctIndex: server?.correctOptionIndex ?? -1,
        };
      });

      setResult({
        score: saved.score,
        total: seed.questions.length,
        elapsedSeconds: Math.max(0, Math.round((Date.now() - seed.startedAt) / 1000)),
        questionResults,
      });
      clearSeed();
      await queryClient.invalidateQueries({ queryKey: simulationQueryKeys.all });
    } catch (error: any) {
      Alert.alert('Simulado', error?.message || 'Nao foi possivel finalizar o simulado.');
    } finally {
      setFinishing(false);
    }
  }, [answers, clearSeed, finishing, persistSnapshot, queryClient, result, seed]);

  React.useEffect(() => {
    if (!seed?.config.timerEnabled || result || finishing) return;
    if (remainingSeconds === 0 && Date.now() > seed.startedAt + seed.config.timerMinutes * 60 * 1000) {
      void finish();
    }
  }, [finish, finishing, remainingSeconds, result, seed]);

  const selectOption = React.useCallback(async (optionIndex: number) => {
    if (!currentQuestion || !seed) return;
    if (instantFeedback && currentServerResult) return;

    const key = questionKey(currentQuestion, currentIndex);
    const nextAnswers = { ...answers, [key]: optionIndex };
    setAnswer(key, optionIndex);

    if (!instantFeedback || currentQuestion.id === undefined) return;

    setSavingAnswer(true);
    try {
      const saved = await persistSnapshot('in_progress', nextAnswers);
      setServerResults(saved.results);
      await queryClient.invalidateQueries({ queryKey: simulationQueryKeys.all });
    } catch (error: any) {
      Alert.alert('Simulado', error?.message || 'Nao foi possivel validar esta resposta.');
    } finally {
      setSavingAnswer(false);
    }
  }, [answers, currentIndex, currentQuestion, currentServerResult, instantFeedback, persistSnapshot, queryClient, seed, setAnswer]);

  const requestFinish = () => {
    Alert.alert(
      'Finalizar simulado?',
      'Respostas em branco serao mantidas como nao respondidas.',
      [
        { text: 'Continuar', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: () => void finish() },
      ],
    );
  };

  if (!hydrated) {
    return <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>;
  }

  if (result) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.resultCard}>
          <Text style={styles.eyebrow}>Resultado</Text>
          <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
          <Text style={styles.muted}>Pontuacao calculada pelo servidor.</Text>
        </View>

        {result.questionResults.map((entry, index) => (
          <View key={questionKey(entry.question, index)} style={styles.reviewCard}>
            <Text style={entry.isCorrect ? styles.correctText : styles.wrongText}>
              {entry.answered ? (entry.isCorrect ? 'Acerto' : 'Erro') : 'Em branco'}
            </Text>
            <Text style={styles.questionText}>{stripHtml(entry.question.enunciado_clean || entry.question.enunciado)}</Text>
            <Text style={styles.muted}>
              Sua resposta: {entry.selectedIndex === undefined ? '--' : String.fromCharCode(65 + entry.selectedIndex)} · Gabarito: {entry.correctIndex < 0 ? '--' : String.fromCharCode(65 + entry.correctIndex)}
            </Text>
          </View>
        ))}

        <Pressable onPress={() => router.replace('/simulados')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Voltar aos simulados</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!seed || !currentQuestion) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Nenhum simulado ativo</Text>
        <Text style={styles.muted}>Crie um novo simulado para iniciar.</Text>
        <Pressable onPress={() => router.replace('/simulados/novo')} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Novo simulado</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>Simulado</Text>
          <Text style={styles.title}>Questao {currentIndex + 1} de {seed.questions.length}</Text>
        </View>
        {seed.config.timerEnabled ? <Text style={styles.timer}>{formatRemainingTime(remainingSeconds)}</Text> : null}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIndex + 1) / seed.questions.length) * 100}%` }]} />
      </View>

      <Pressable onPress={() => setShowPalette((value) => !value)} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{showPalette ? 'Ocultar navegacao' : 'Navegar pelas questoes'}</Text>
      </Pressable>

      {showPalette ? (
        <View style={styles.palette}>
          {seed.questions.map((question, index) => {
            const key = questionKey(question, index);
            const answered = answers[key] !== undefined;
            const active = index === currentIndex;
            return (
              <Pressable
                key={key}
                onPress={() => { setCurrentIndex(index); setShowPalette(false); }}
                style={[styles.paletteItem, answered && styles.paletteAnswered, active && styles.paletteActive]}
              >
                <Text style={[styles.paletteText, (answered || active) && styles.paletteTextActive]}>{index + 1}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.questionCard}>
        <Text style={styles.questionText}>{stripHtml(currentQuestion.enunciado_clean || currentQuestion.enunciado) || 'Questao sem enunciado.'}</Text>

        <View style={styles.options}>
          {(currentQuestion.itens || []).map((option, optionIndex) => {
            const selected = currentSelected === optionIndex;
            const correct = Boolean(currentServerResult) && currentServerResult.correctOptionIndex === optionIndex;
            const wrong = selected && Boolean(currentServerResult) && !currentServerResult.isCorrect;
            return (
              <Pressable
                key={String(option.id ?? optionIndex)}
                disabled={savingAnswer || (instantFeedback && Boolean(currentServerResult))}
                onPress={() => void selectOption(optionIndex)}
                style={[styles.option, selected && styles.optionSelected, correct && styles.optionCorrect, wrong && styles.optionWrong]}
              >
                <Text style={styles.optionLetter}>{String.fromCharCode(65 + optionIndex)}</Text>
                <Text style={styles.optionText}>{stripHtml(option.corpo_clean || option.corpo) || `Alternativa ${optionIndex + 1}`}</Text>
                {savingAnswer && selected ? <ActivityIndicator size="small" color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {instantFeedback && currentServerResult ? (
          <Text style={currentServerResult.isCorrect ? styles.correctText : styles.wrongText}>
            {currentServerResult.isCorrect ? 'Resposta correta.' : `Resposta incorreta. Gabarito ${String.fromCharCode(65 + currentServerResult.correctOptionIndex)}.`}
          </Text>
        ) : null}
      </View>

      <View style={styles.navigationRow}>
        <Pressable
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          style={[styles.secondaryButton, styles.flexButton, currentIndex === 0 && styles.disabled]}
        >
          <Text style={styles.secondaryButtonText}>Anterior</Text>
        </Pressable>
        {currentIndex < seed.questions.length - 1 ? (
          <Pressable onPress={() => setCurrentIndex(currentIndex + 1)} style={[styles.primaryButton, styles.flexButton]}>
            <Text style={styles.primaryButtonText}>Proxima</Text>
          </Pressable>
        ) : (
          <Pressable onPress={requestFinish} style={[styles.primaryButton, styles.flexButton]}>
            <Text style={styles.primaryButtonText}>{finishing ? 'Finalizando...' : 'Finalizar'}</Text>
          </Pressable>
        )}
      </View>

      {currentIndex < seed.questions.length - 1 ? (
        <Pressable onPress={requestFinish} style={styles.finishLink}>
          <Text style={styles.wrongText}>Finalizar antes do fim</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[4], padding: spacing[4], paddingBottom: spacing[10] },
  center: { alignItems: 'center', backgroundColor: theme.background, flex: 1, gap: spacing[3], justifyContent: 'center', padding: spacing[6] },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.bold, textTransform: 'uppercase' },
  title: { color: theme.text, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
  timer: { color: theme.primary, fontSize: typography.size.xl, fontWeight: typography.weight.black },
  progressTrack: { backgroundColor: theme.surfaceSubtle, borderRadius: radius.pill, height: 6, overflow: 'hidden' },
  progressFill: { backgroundColor: theme.primary, height: '100%' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  paletteItem: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.sm, borderWidth: 1, height: 38, justifyContent: 'center', width: 38 },
  paletteAnswered: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder },
  paletteActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  paletteText: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  paletteTextActive: { color: theme.onPrimary },
  questionCard: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[4], padding: spacing[4] },
  questionText: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.semibold, lineHeight: 24 },
  options: { gap: spacing[2] },
  option: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing[3], minHeight: 52, padding: spacing[3] },
  optionSelected: { backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder },
  optionCorrect: { backgroundColor: theme.successSubtle, borderColor: theme.success },
  optionWrong: { backgroundColor: theme.dangerSubtle, borderColor: theme.danger },
  optionLetter: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.black },
  optionText: { color: theme.text, flex: 1, fontSize: typography.size.sm, lineHeight: 20 },
  navigationRow: { flexDirection: 'row', gap: spacing[3] },
  flexButton: { flex: 1 },
  primaryButton: { alignItems: 'center', backgroundColor: theme.primary, borderRadius: radius.md, justifyContent: 'center', minHeight: 46, paddingHorizontal: spacing[4] },
  primaryButtonText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  secondaryButton: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.md, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing[4] },
  secondaryButtonText: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  disabled: { opacity: 0.4 },
  finishLink: { alignItems: 'center', paddingVertical: spacing[2] },
  correctText: { color: theme.success, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  wrongText: { color: theme.danger, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  resultCard: { alignItems: 'center', backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[2], padding: spacing[6] },
  resultScore: { color: theme.primary, fontSize: typography.size['3xl'], fontWeight: typography.weight.black },
  reviewCard: { backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.lg, borderWidth: 1, gap: spacing[2], padding: spacing[4] },
  muted: { color: theme.textMuted, fontSize: typography.size.sm, textAlign: 'center' },
  emptyTitle: { color: theme.text, fontSize: typography.size.xl, fontWeight: typography.weight.extrabold },
});

export default SimulationRunScreenV2;
