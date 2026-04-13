import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import { questionService } from '@/services/questions/questionService';
import type { Question } from '@/types/questions';

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

const PAGE_SIZE = 10;

const mapDifficultyLabel = (value?: number): string => {
  if (value === 1 || value === 2) return 'Fácil';
  if (value === 3) return 'Médio';
  if (value === 4 || value === 5) return 'Difícil';
  return 'Não informado';
};

const normalizeQuestionText = (question: Question): string => {
  return (question.enunciado_clean || question.enunciado || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const normalizeItemText = (item?: { corpo?: string; corpo_clean?: string }): string => {
  return (item?.corpo_clean || item?.corpo || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

export const QuestionsScreen: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<DifficultyFilter>('all');
  const [selectedSubject, setSelectedSubject] = React.useState<string>('all');
  const [answeringKey, setAnsweringKey] = React.useState<string | null>(null);
  const [answeredMap, setAnsweredMap] = React.useState<Record<number, number>>({});

  const subjectOptions = React.useMemo(() => {
    const values = new Set<string>();
    questions.forEach((question) => {
      (question.assuntos || []).forEach((subject) => {
        if (subject?.nome) values.add(subject.nome);
      });
    });

    return ['all', ...Array.from(values).sort()];
  }, [questions]);

  const buildFilters = React.useCallback((targetPage: number) => {
    const filters: Record<string, any> = {
      page: targetPage,
      perPage: PAGE_SIZE,
    };

    if (keyword.trim()) filters.keyword = keyword.trim();
    if (selectedSubject !== 'all') filters.subject = selectedSubject;

    if (difficulty === 'easy') filters.difficulty = 2;
    if (difficulty === 'medium') filters.difficulty = 3;
    if (difficulty === 'hard') filters.difficulty = 4;

    return filters;
  }, [difficulty, keyword, selectedSubject]);

  const fetchPage = React.useCallback(async (targetPage: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await questionService.getQuestionPage(buildFilters(targetPage));
      setTotal(result.total);
      setPage(targetPage);
      setQuestions((prev) => append ? [...prev, ...result.rows] : result.rows);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar questoes.');
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [buildFilters]);

  React.useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  const handleApplyFilters = () => {
    void fetchPage(1, false);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore) return;
    if (questions.length >= total) return;
    void fetchPage(page + 1, true);
  };

  const getCorrectIndex = (question: Question): number => {
    const options = question.itens || [];
    const answerId = Number(question.resposta || -1);

    const byIdIndex = options.findIndex((item) => Number(item?.id) === answerId);
    if (byIdIndex >= 0) return byIdIndex;

    if (answerId >= 0 && answerId < options.length) return answerId;
    return -1;
  };

  const handleSelectOption = async (question: Question, optionIndex: number) => {
    if (!user?.id || !question.id) {
      Alert.alert('Sessao invalida', 'Faca login novamente para responder questoes.');
      return;
    }

    if (answeredMap[question.id] !== undefined) {
      return;
    }

    const correctIndex = getCorrectIndex(question);
    const isCorrect = optionIndex === correctIndex;
    const answerKey = `${question.id}:${optionIndex}`;

    setAnsweringKey(answerKey);
    try {
      const result = await questionService.submitUserAnswer(user.id, {
        questionId: question.id,
        selectedOptionIndex: optionIndex,
        isCorrect,
      });

      if (!result.success) {
        Alert.alert('Erro ao responder', result.message || 'Nao foi possivel salvar a resposta.');
        return;
      }

      setAnsweredMap((prev) => ({ ...prev, [question.id as number]: optionIndex }));
      if (result.newXp || result.newLevel) {
        await refreshProfile();
      }
    } finally {
      setAnsweringKey(null);
    }
  };

  const renderQuestion = ({ item, index }: { item: Question; index: number }) => {
    const questionId = item.id || index;
    const selected = item.id ? answeredMap[item.id] : undefined;
    const correctIndex = getCorrectIndex(item);

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionTag}>Questão #{questionId}</Text>
          <Text style={styles.questionDifficulty}>{mapDifficultyLabel(item.dificuldade)}</Text>
        </View>

        <Text style={styles.questionText}>{normalizeQuestionText(item) || 'Questão sem enunciado.'}</Text>

        <View style={styles.optionsContainer}>
          {(item.itens || []).map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrectOption = selected !== undefined && correctIndex === optionIndex;
            const isWrongSelected = isSelected && correctIndex !== optionIndex;
            const isAnswering = answeringKey === `${item.id}:${optionIndex}`;

            return (
              <Pressable
                key={`${questionId}-${optionIndex}`}
                onPress={() => void handleSelectOption(item, optionIndex)}
                disabled={selected !== undefined || isAnswering}
                style={({ pressed }) => [
                  styles.optionButton,
                  isSelected && styles.optionSelected,
                  isCorrectOption && styles.optionCorrect,
                  isWrongSelected && styles.optionWrong,
                  pressed && selected === undefined && styles.optionPressed,
                ]}
              >
                <Text style={styles.optionLabel}>{String.fromCharCode(65 + optionIndex)}</Text>
                <Text style={styles.optionText}>{normalizeItemText(option) || `Alternativa ${optionIndex + 1}`}</Text>
                {isAnswering && <ActivityIndicator size="small" color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filtersCard}>
        <Text style={styles.filtersTitle}>Filtros</Text>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Buscar no enunciado"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <View style={styles.inlineFilters}>
          {(['all', 'easy', 'medium', 'hard'] as DifficultyFilter[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => setDifficulty(option)}
              style={[
                styles.chip,
                difficulty === option && styles.chipActive,
              ]}
            >
              <Text style={[styles.chipText, difficulty === option && styles.chipTextActive]}>
                {option === 'all' ? 'Todas' : option === 'easy' ? 'Fácil' : option === 'medium' ? 'Médio' : 'Difícil'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inlineFilters}>
          {subjectOptions.slice(0, 6).map((subject) => (
            <Pressable
              key={subject}
              onPress={() => setSelectedSubject(subject)}
              style={[
                styles.chip,
                selectedSubject === subject && styles.chipActive,
              ]}
            >
              <Text style={[styles.chipText, selectedSubject === subject && styles.chipTextActive]}>
                {subject === 'all' ? 'Todas matérias' : subject}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable onPress={handleApplyFilters} style={styles.applyButton}>
          <Text style={styles.applyButtonText}>Aplicar filtros</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderBlock}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={questions}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhuma questão encontrada</Text>
              <Text style={styles.emptyText}>Ajuste os filtros e tente novamente.</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  filtersCard: {
    margin: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  filtersTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
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
    fontWeight: '600',
  },
  inlineFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
  },
  chipTextActive: {
    color: colors.primary,
  },
  applyButton: {
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  loaderBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 10,
  },
  questionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questionTag: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.muted,
  },
  questionDifficulty: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  questionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    fontWeight: '600',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionPressed: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: '#ECFDF5',
  },
  optionWrong: {
    borderColor: colors.danger,
    backgroundColor: '#FEF2F2',
  },
  optionLabel: {
    width: 24,
    height: 24,
    borderRadius: 999,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  emptyCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
});
