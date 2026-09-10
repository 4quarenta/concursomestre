import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { QuestionCard } from '@/features/questions/components/QuestionCard';
import {
  QuestionsFilters,
  type DifficultyGroup,
} from '@/features/questions/components/QuestionsFilters';
import { questionQueryKeys } from '@/features/questions/api/queryKeys';
import { useAnswerQuestionMutation } from '@/features/questions/api/useAnswerQuestionMutation';
import { useInfiniteQuestionsQuery } from '@/features/questions/api/useInfiniteQuestionsQuery';
import { useAuth } from '@/providers/AuthProvider';
import { spacing, typography } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { Question, QuestionListFilters } from '@/types/questions';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const difficultyToApi: Record<DifficultyGroup, string[] | undefined> = {
  all: undefined,
  easy: ['Muito facil', 'Facil'],
  medium: ['Medio'],
  hard: ['Dificil', 'Muito dificil'],
};

/**
 * Implementacao F3 da pratica mobile.
 * Usa filtros/paginacao no servidor e TanStack Query em vez de baixar todo o banco.
 * A tela legada permanece no repositorio ate a migracao dos paineis secundarios.
 */
export const QuestionsScreenV2: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { user, refreshProfile, toggleSavedQuestion } = useAuth();
  const [keywordInput, setKeywordInput] = React.useState('');
  const [debouncedKeyword, setDebouncedKeyword] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<DifficultyGroup>('all');
  const [onlySaved, setOnlySaved] = React.useState(false);
  const [excludeAnswered, setExcludeAnswered] = React.useState(false);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [keywordInput]);

  const filters = React.useMemo<QuestionListFilters>(() => ({
    keyword: debouncedKeyword || undefined,
    difficulty: difficultyToApi[difficulty],
    onlySaved: onlySaved || undefined,
    excludeAnswered: excludeAnswered || undefined,
    excludeCanceled: true,
    excludeOutdated: true,
  }), [debouncedKeyword, difficulty, excludeAnswered, onlySaved]);

  const questionsQuery = useInfiniteQuestionsQuery(filters, PAGE_SIZE);
  const answerMutation = useAnswerQuestionMutation(user?.id);
  const savedQuestionIds = React.useMemo(
    () => new Set((user?.savedQuestionIds || []).map(String)),
    [user?.savedQuestionIds],
  );

  const handleClearFilters = React.useCallback(() => {
    setKeywordInput('');
    setDebouncedKeyword('');
    setDifficulty('all');
    setOnlySaved(false);
    setExcludeAnswered(false);
  }, []);

  const handleAnswer = React.useCallback(async (question: Question, optionIndex: number) => {
    if (!question.id) {
      Alert.alert('Questao indisponivel', 'Nao foi possivel identificar esta questao.');
      return;
    }

    try {
      const { result } = await answerMutation.mutateAsync({
        questionId: question.id,
        selectedOptionIndex: optionIndex,
      });

      if (result.newXp !== undefined || result.newLevel !== undefined) {
        await refreshProfile();
      }
    } catch (error: any) {
      Alert.alert('Erro ao responder', error?.message || 'Nao foi possivel registrar a resposta.');
    }
  }, [answerMutation, refreshProfile]);

  const handleToggleSaved = React.useCallback(async (question: Question) => {
    if (!question.id) return;

    try {
      await toggleSavedQuestion(question.id);
      await queryClient.invalidateQueries({ queryKey: questionQueryKeys.lists() });
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel atualizar as questoes salvas.');
    }
  }, [queryClient, toggleSavedQuestion]);

  const handleEndReached = React.useCallback(() => {
    if (questionsQuery.hasNextPage && !questionsQuery.isFetchingNextPage) {
      void questionsQuery.fetchNextPage();
    }
  }, [questionsQuery]);

  const renderQuestion = React.useCallback(({ item }: { item: Question }) => {
    const pendingVariables = answerMutation.isPending ? answerMutation.variables : undefined;
    const answeringOptionIndex = pendingVariables && pendingVariables.questionId === item.id
      ? pendingVariables.selectedOptionIndex
      : undefined;

    return (
      <QuestionCard
        answeringOptionIndex={answeringOptionIndex}
        isSaved={item.id !== undefined && savedQuestionIds.has(String(item.id))}
        onAnswer={(question, optionIndex) => void handleAnswer(question, optionIndex)}
        onToggleSaved={(question) => void handleToggleSaved(question)}
        question={item}
      />
    );
  }, [answerMutation.isPending, answerMutation.variables, handleAnswer, handleToggleSaved, savedQuestionIds]);

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={questionsQuery.questions}
      keyExtractor={(item, index) => String(item.id ?? `question-${index}`)}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={(
        <RefreshControl
          refreshing={questionsQuery.isRefetching && !questionsQuery.isFetchingNextPage}
          onRefresh={() => void questionsQuery.refetch()}
          tintColor={theme.primary}
        />
      )}
      renderItem={renderQuestion}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={(
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Questoes</Text>
            <Text style={styles.subtitle}>
              {questionsQuery.total > 0
                ? `${questionsQuery.total} questoes encontradas`
                : 'Pratica conectada ao banco oficial'}
            </Text>
          </View>

          <QuestionsFilters
            difficulty={difficulty}
            excludeAnswered={excludeAnswered}
            keyword={keywordInput}
            onClear={handleClearFilters}
            onDifficultyChange={setDifficulty}
            onExcludeAnsweredChange={setExcludeAnswered}
            onKeywordChange={setKeywordInput}
            onOnlySavedChange={setOnlySaved}
            onlySaved={onlySaved}
          />

          {questionsQuery.isLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.primary} />
              <Text style={styles.stateText}>Carregando questoes...</Text>
            </View>
          ) : null}

          {questionsQuery.isError ? (
            <View style={styles.centerState}>
              <Text style={styles.errorText}>Nao foi possivel carregar as questoes.</Text>
            </View>
          ) : null}
        </View>
      )}
      ListEmptyComponent={
        !questionsQuery.isLoading && !questionsQuery.isError
          ? <Text style={styles.emptyText}>Nenhuma questao encontrada com estes filtros.</Text>
          : null
      }
      ListFooterComponent={
        questionsQuery.isFetchingNextPage
          ? <ActivityIndicator style={styles.footerLoader} color={theme.primary} />
          : <View style={styles.footerSpace} />
      }
    />
  );
};

const createStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  content: {
    backgroundColor: theme.background,
    flexGrow: 1,
    padding: spacing[4],
  },
  header: {
    gap: spacing[5],
    marginBottom: spacing[5],
  },
  titleBlock: {
    gap: spacing[1],
  },
  title: {
    color: theme.text,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.extrabold,
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: typography.size.sm,
  },
  separator: {
    height: spacing[3],
  },
  centerState: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[6],
  },
  stateText: {
    color: theme.textMuted,
    fontSize: typography.size.sm,
  },
  errorText: {
    color: theme.danger,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: typography.size.sm,
    paddingVertical: spacing[8],
    textAlign: 'center',
  },
  footerLoader: {
    marginVertical: spacing[6],
  },
  footerSpace: {
    height: spacing[8],
  },
});

export default QuestionsScreenV2;
