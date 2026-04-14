import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';
import { questionService } from '@/services/questions/questionService';
import { colors } from '@/theme/colors';
import type { Question } from '@/types/questions';
import type { MobileSimulationDifficulty } from '@/types/simulation';

const QUESTION_COUNT_OPTIONS = [10, 20, 30];
const TIMER_MINUTES_OPTIONS = [10, 20, 30, 45, 60];
const PREVIEW_PAGE_SIZE = 40;
const DIFFICULTY_OPTIONS: MobileSimulationDifficulty[] = ['all', 'easy', 'medium', 'hard'];

const getDifficultyLabel = (value: MobileSimulationDifficulty): string => {
  if (value === 'easy') return 'Facil';
  if (value === 'medium') return 'Medio';
  if (value === 'hard') return 'Dificil';
  return 'Todas';
};

const getDifficultyParam = (value: MobileSimulationDifficulty): number | undefined => {
  if (value === 'easy') return 2;
  if (value === 'medium') return 3;
  if (value === 'hard') return 4;
  return undefined;
};

const shuffleQuestions = (rows: Question[]): Question[] => {
  const next = [...rows];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = temp;
  }
  return next;
};

/**
 * Tela de configuracao de simulado mobile.
 * @since v1.0.0
 */
export const SimulationConfigScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [questionCount, setQuestionCount] = React.useState(10);
  const [timerEnabled, setTimerEnabled] = React.useState(true);
  const [timerMinutes, setTimerMinutes] = React.useState(20);
  const [keyword, setKeyword] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<MobileSimulationDifficulty>('all');
  const [selectedSubject, setSelectedSubject] = React.useState('all');
  const [previewQuestions, setPreviewQuestions] = React.useState<Question[]>([]);
  const [previewTotal, setPreviewTotal] = React.useState(0);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  const subjectOptions = React.useMemo(() => {
    const values = new Set<string>();
    previewQuestions.forEach((question) => {
      (question.assuntos || []).forEach((subject) => {
        if (subject?.nome) values.add(subject.nome);
      });
    });

    if (selectedSubject !== 'all') {
      values.add(selectedSubject);
    }

    return ['all', ...Array.from(values).sort()].slice(0, 10);
  }, [previewQuestions, selectedSubject]);

  const buildQuestionFilters = React.useCallback((perPage: number) => {
    const filters: Record<string, any> = {
      page: 1,
      perPage,
    };

    if (keyword.trim()) filters.keyword = keyword.trim();
    if (selectedSubject !== 'all') filters.subject = selectedSubject;

    const difficultyParam = getDifficultyParam(difficulty);
    if (difficultyParam) filters.difficulty = difficultyParam;

    return filters;
  }, [difficulty, keyword, selectedSubject]);

  const loadPreview = React.useCallback(async () => {
    setLoadingPreview(true);
    try {
      const result = await questionService.getQuestionPage(buildQuestionFilters(PREVIEW_PAGE_SIZE));
      setPreviewQuestions(result.rows || []);
      setPreviewTotal(result.total);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar a amostra de questoes.');
      setPreviewQuestions([]);
      setPreviewTotal(0);
    } finally {
      setLoadingPreview(false);
    }
  }, [buildQuestionFilters]);

  React.useEffect(() => {
    const previewTimer = setTimeout(() => {
      void loadPreview();
    }, 350);

    return () => clearTimeout(previewTimer);
  }, [loadPreview]);

  const handleStartSimulation = async () => {
    setStarting(true);
    try {
      const result = await questionService.getQuestionPage({
        ...buildQuestionFilters(Math.max(questionCount * 3, questionCount)),
      });

      const randomized = shuffleQuestions(result.rows || []);
      const selected = randomized.slice(0, questionCount);
      if (selected.length === 0) {
        Alert.alert('Sem questoes', 'Nao encontramos questoes para iniciar o simulado com esses filtros.');
        return;
      }

      navigation.replace('SimulationRun', {
        seed: {
          config: {
            questionCount: selected.length,
            timerEnabled,
            timerMinutes,
            keyword: keyword.trim() || undefined,
            subject: selectedSubject,
            difficulty,
          },
          questions: selected,
          startedAt: Date.now(),
        },
      });
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel iniciar o simulado.');
    } finally {
      setStarting(false);
    }
  };

  const clearFilters = () => {
    setKeyword('');
    setDifficulty('all');
    setSelectedSubject('all');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Simulados</Text>
        <Text style={styles.title}>Novo simulado</Text>
        <Text style={styles.description}>Configure quantidade de questoes e tempo antes de iniciar.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quantidade de questoes</Text>
        <View style={styles.optionsRow}>
          {QUESTION_COUNT_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setQuestionCount(option)}
              style={[styles.optionChip, questionCount === option && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, questionCount === option && styles.optionChipTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Filtros da prova</Text>
          {loadingPreview ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.previewCount}>{previewTotal} questoes</Text>
          )}
        </View>

        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Buscar por palavra-chave"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <View style={styles.optionsRow}>
          {DIFFICULTY_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setDifficulty(option)}
              style={[styles.optionChip, difficulty === option && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, difficulty === option && styles.optionChipTextActive]}>
                {getDifficultyLabel(option)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.optionsRow}>
          {subjectOptions.map((subject) => (
            <Pressable
              key={subject}
              onPress={() => setSelectedSubject(subject)}
              style={[styles.optionChip, selectedSubject === subject && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, selectedSubject === subject && styles.optionChipTextActive]}>
                {subject === 'all' ? 'Todas materias' : subject}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.filterActions}>
          <Pressable style={styles.secondaryButton} onPress={() => void loadPreview()} disabled={loadingPreview}>
            <Text style={styles.secondaryButtonText}>Atualizar amostra</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={clearFilters}>
            <Text style={styles.secondaryButtonText}>Limpar</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchTextBlock}>
            <Text style={styles.cardTitle}>Timer</Text>
            <Text style={styles.switchDescription}>
              Ative para finalizar automaticamente quando o tempo acabar.
            </Text>
          </View>
          <Switch
            value={timerEnabled}
            onValueChange={setTimerEnabled}
            trackColor={{ false: '#CBD5E1', true: '#A5B4FC' }}
            thumbColor={timerEnabled ? colors.primary : '#FFFFFF'}
          />
        </View>

        {timerEnabled && (
          <View style={styles.optionsRow}>
            {TIMER_MINUTES_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setTimerMinutes(option)}
                style={[styles.optionChip, timerMinutes === option && styles.optionChipActive]}
              >
                <Text style={[styles.optionChipText, timerMinutes === option && styles.optionChipTextActive]}>
                  {option} min
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={[styles.mainButton, starting && styles.mainButtonDisabled]}
        onPress={() => void handleStartSimulation()}
        disabled={starting}
      >
        {starting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Text style={styles.mainButtonText}>Iniciar simulado</Text>
        )}
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
    paddingBottom: 20,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 6,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewCount: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  optionChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  optionChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  optionChipTextActive: {
    color: colors.primary,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  switchTextBlock: {
    flex: 1,
    gap: 3,
  },
  switchDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  mainButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonDisabled: {
    opacity: 0.7,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});

export default SimulationConfigScreen;
