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
import { QuestionCommentsPanel } from '@/components/questions/QuestionCommentsPanel';
import { QuestionHistoryPanel } from '@/components/questions/QuestionHistoryPanel';
import { QuestionInsightPanel } from '@/components/questions/QuestionInsightPanel';
import { QuestionNotePanel } from '@/components/questions/QuestionNotePanel';
import { QuestionStatsPanel } from '@/components/questions/QuestionStatsPanel';
import { useAuth } from '@/providers/AuthProvider';
import { commentsService } from '@/services/comments/commentsService';
import { questionNotesService } from '@/services/questions/questionNotesService';
import { questionService } from '@/services/questions/questionService';
import { colors } from '@/theme/colors';
import type { QuestionComment } from '@/types/comments';
import type { QuestionNote } from '@/types/notes';
import type { Question, QuestionHistoryEntry, QuestionStats } from '@/types/questions';

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';
type PracticeViewMode = 'card' | 'list';

const PAGE_SIZE = 10;

const mapDifficultyLabel = (value?: number): string => {
  if (value === 1 || value === 2) return 'Facil';
  if (value === 3) return 'Medio';
  if (value === 4 || value === 5) return 'Dificil';
  return 'Nao informado';
};

const normalizeQuestionText = (question: Question): string => (
  (question.enunciado_clean || question.enunciado || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
);

const normalizeItemText = (item?: { corpo?: string; corpo_clean?: string }): string => (
  (item?.corpo_clean || item?.corpo || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
);

const getEntityLabel = (item?: { nome?: string; sigla?: string }): string => (
  String(item?.sigla || item?.nome || '').trim()
);

const getRoleLabel = (item?: { descricao?: string; ['descrição']?: string; nome?: string }): string => (
  String(item?.descricao || item?.['descrição'] || item?.nome || '').trim()
);

const getQuestionYear = (question: Question): string => {
  const value = Array.isArray(question.anos) && question.anos.length > 0 ? question.anos[0] : '';
  return String(value || '').trim();
};

const getQuestionAccuracyRate = (stats?: QuestionStats | null): number => {
  const totalAttempts = Number(stats?.totalAttempts || 0);
  if (totalAttempts <= 0) return 0;

  return Math.round((Number(stats?.correctCount || 0) / totalAttempts) * 100);
};

const buildAnsweredMapFromQuestions = (rows: Question[]): Record<number, number> => {
  const map: Record<number, number> = {};

  rows.forEach((question) => {
    if (!question.id || question.userAnswer?.selectedOptionIndex === undefined || question.userAnswer?.selectedOptionIndex === null) {
      return;
    }

    map[question.id] = Number(question.userAnswer.selectedOptionIndex);
  });

  return map;
};

/**
 * Tela mobile de pratica com filtros locais reais sobre o pool oficial de questoes.
 * O app carrega a listagem completa paginada do backend, filtra no dispositivo e preserva modo foco/lista.
 * @since v1.0.0
 */
export const QuestionsScreen: React.FC = () => {
  const { user, refreshProfile, toggleSavedQuestion } = useAuth();
  const [questionPool, setQuestionPool] = React.useState<Question[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [keyword, setKeyword] = React.useState('');
  const [difficulty, setDifficulty] = React.useState<DifficultyFilter>('all');
  const [selectedSubject, setSelectedSubject] = React.useState<string>('all');
  const [selectedAgency, setSelectedAgency] = React.useState<string>('all');
  const [selectedOrganization, setSelectedOrganization] = React.useState<string>('all');
  const [selectedRole, setSelectedRole] = React.useState<string>('all');
  const [selectedYear, setSelectedYear] = React.useState<string>('all');
  const [onlySaved, setOnlySaved] = React.useState(false);
  const [onlyTeacherComment, setOnlyTeacherComment] = React.useState(false);
  const [onlyDetailedComment, setOnlyDetailedComment] = React.useState(false);
  const [excludeAnswered, setExcludeAnswered] = React.useState(false);
  const [answeringKey, setAnsweringKey] = React.useState<string | null>(null);
  const [answeredMap, setAnsweredMap] = React.useState<Record<number, number>>({});
  const [viewMode, setViewMode] = React.useState<PracticeViewMode>('card');
  const [currentQuestionIndex, setCurrentQuestionIndex] = React.useState(0);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [visibleCommentsMap, setVisibleCommentsMap] = React.useState<Record<string, boolean>>({});
  const [commentsByQuestion, setCommentsByQuestion] = React.useState<Record<string, QuestionComment[]>>({});
  const [commentsLoadingMap, setCommentsLoadingMap] = React.useState<Record<string, boolean>>({});
  const [commentDraftMap, setCommentDraftMap] = React.useState<Record<string, string>>({});
  const [commentSubmittingMap, setCommentSubmittingMap] = React.useState<Record<string, boolean>>({});
  const [visibleStatsMap, setVisibleStatsMap] = React.useState<Record<string, boolean>>({});
  const [statsByQuestion, setStatsByQuestion] = React.useState<Record<string, QuestionStats>>({});
  const [statsLoadingMap, setStatsLoadingMap] = React.useState<Record<string, boolean>>({});
  const [visibleHistoryMap, setVisibleHistoryMap] = React.useState<Record<string, boolean>>({});
  const [historyByQuestion, setHistoryByQuestion] = React.useState<Record<string, QuestionHistoryEntry[]>>({});
  const [historyLoadingMap, setHistoryLoadingMap] = React.useState<Record<string, boolean>>({});
  const [visibleTeacherCommentMap, setVisibleTeacherCommentMap] = React.useState<Record<string, boolean>>({});
  const [visibleDetailedCommentMap, setVisibleDetailedCommentMap] = React.useState<Record<string, boolean>>({});
  const [notesByQuestion, setNotesByQuestion] = React.useState<Record<string, QuestionNote>>({});
  const [noteDraftMap, setNoteDraftMap] = React.useState<Record<string, string>>({});
  const [visibleNotesMap, setVisibleNotesMap] = React.useState<Record<string, boolean>>({});
  const [notesLoading, setNotesLoading] = React.useState(false);
  const [noteSavingMap, setNoteSavingMap] = React.useState<Record<string, boolean>>({});

  const loadQuestions = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await questionService.getAllQuestions();
      setQuestionPool(rows);
      setAnsweredMap((previous) => ({
        ...buildAnsweredMapFromQuestions(rows),
        ...previous,
      }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar questoes.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const savedQuestionIdSet = React.useMemo(
    () => new Set((user?.savedQuestionIds || []).map((item) => String(item))),
    [user?.savedQuestionIds],
  );

  const getQuestionStateKey = React.useCallback((questionId?: string | number | null) => (
    questionId === undefined || questionId === null ? '' : String(questionId)
  ), []);

  const getQuestionHistoryFallback = React.useCallback((question: Question): QuestionHistoryEntry[] => {
    if (!question.id || question.userAnswer?.selectedOptionIndex === undefined || question.userAnswer?.selectedOptionIndex === null) {
      return [];
    }

    return [{
      questionId: Number(question.userAnswer.questionId || question.id),
      selectedOptionIndex: Number(question.userAnswer.selectedOptionIndex),
      isCorrect: Boolean(question.userAnswer.isCorrect),
      timestamp: Number(question.userAnswer.timestamp || Date.now()),
    }];
  }, []);

  const hydrateQuestionNotes = React.useCallback(async () => {
    if (!user?.id) {
      setNotesByQuestion({});
      setNoteDraftMap({});
      setVisibleNotesMap({});
      return;
    }

    setNotesLoading(true);
    try {
      const [remoteNotes, localNotes] = await Promise.all([
        questionNotesService.listRemoteNotes(user.id).catch(() => []),
        questionNotesService.listLocalNotes(user.id),
      ]);

      const mergedNotes = questionNotesService.mergeNotes(remoteNotes, localNotes);
      const nextNotesByQuestion: Record<string, QuestionNote> = {};
      const nextDraftMap: Record<string, string> = {};

      mergedNotes.forEach((note) => {
        const questionKey = getQuestionStateKey(note.questionId);
        if (!questionKey) return;

        nextNotesByQuestion[questionKey] = note;
        nextDraftMap[questionKey] = note.text;
      });

      setNotesByQuestion(nextNotesByQuestion);
      setNoteDraftMap(nextDraftMap);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar anotacoes.');
    } finally {
      setNotesLoading(false);
    }
  }, [getQuestionStateKey, user?.id]);

  React.useEffect(() => {
    void hydrateQuestionNotes();
  }, [hydrateQuestionNotes]);

  const subjectOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.assuntos || []).forEach((subject) => {
        if (subject?.materia && subject?.nome) values.add(subject.nome);
      });
    });

    return ['all', ...Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'))];
  }, [questionPool]);

  const agencyOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.bancas || []).forEach((agency) => {
        const label = getEntityLabel(agency);
        if (label) values.add(label);
      });
    });

    return ['all', ...Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'))];
  }, [questionPool]);

  const organizationOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.orgaos || []).forEach((organization) => {
        const label = getEntityLabel(organization);
        if (label) values.add(label);
      });
    });

    return ['all', ...Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'))];
  }, [questionPool]);

  const roleOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.cargos || []).forEach((role) => {
        const label = getRoleLabel(role);
        if (label) values.add(label);
      });
    });

    return ['all', ...Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'))];
  }, [questionPool]);

  const yearOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      const year = getQuestionYear(question);
      if (year) values.add(year);
    });

    return ['all', ...Array.from(values).sort((left, right) => Number(right) - Number(left))];
  }, [questionPool]);

  const filteredQuestions = React.useMemo(() => {
    const keywordNeedle = keyword.trim().toLowerCase();

    return questionPool.filter((question) => {
      const statement = normalizeQuestionText(question).toLowerCase();
      const matchesKeyword = keywordNeedle === '' || statement.includes(keywordNeedle);

      const matchesDifficulty = (
        difficulty === 'all'
        || (difficulty === 'easy' && [1, 2].includes(Number(question.dificuldade || 0)))
        || (difficulty === 'medium' && Number(question.dificuldade || 0) === 3)
        || (difficulty === 'hard' && [4, 5].includes(Number(question.dificuldade || 0)))
      );

      const matchesSubject = (
        selectedSubject === 'all'
        || (question.assuntos || []).some((subject) => subject?.materia && subject?.nome === selectedSubject)
      );

      const matchesAgency = (
        selectedAgency === 'all'
        || (question.bancas || []).some((agency) => getEntityLabel(agency) === selectedAgency)
      );

      const matchesOrganization = (
        selectedOrganization === 'all'
        || (question.orgaos || []).some((organization) => getEntityLabel(organization) === selectedOrganization)
      );

      const matchesRole = (
        selectedRole === 'all'
        || (question.cargos || []).some((role) => getRoleLabel(role) === selectedRole)
      );

      const matchesYear = selectedYear === 'all' || getQuestionYear(question) === selectedYear;
      const matchesSaved = !onlySaved || (question.id !== undefined && savedQuestionIdSet.has(String(question.id)));
      const matchesTeacherComment = !onlyTeacherComment || Boolean(question.hasTeacherComment || question.teacherComment);
      const matchesDetailedComment = !onlyDetailedComment || Boolean(question.hasDetailedComment || question.detailedComment);
      const matchesAnswered = !excludeAnswered || !question.id || answeredMap[question.id] === undefined;

      return (
        matchesKeyword
        && matchesDifficulty
        && matchesSubject
        && matchesAgency
        && matchesOrganization
        && matchesRole
        && matchesYear
        && matchesSaved
        && matchesTeacherComment
        && matchesDetailedComment
        && matchesAnswered
      );
    });
  }, [
    answeredMap,
    difficulty,
    excludeAnswered,
    keyword,
    onlySaved,
    onlyDetailedComment,
    onlyTeacherComment,
    questionPool,
    savedQuestionIdSet,
    selectedAgency,
    selectedOrganization,
    selectedRole,
    selectedSubject,
    selectedYear,
  ]);

  const currentQuestion = filteredQuestions[currentQuestionIndex] || null;
  const visibleListQuestions = React.useMemo(
    () => filteredQuestions.slice(0, visibleCount),
    [filteredQuestions, visibleCount],
  );

  React.useEffect(() => {
    if (currentQuestionIndex >= filteredQuestions.length && filteredQuestions.length > 0) {
      setCurrentQuestionIndex(filteredQuestions.length - 1);
    }

    if (filteredQuestions.length === 0) {
      setCurrentQuestionIndex(0);
    }
  }, [currentQuestionIndex, filteredQuestions.length]);

  const handleApplyFilters = () => {
    setCurrentQuestionIndex(0);
    setVisibleCount(PAGE_SIZE);
  };

  const handleClearFilters = () => {
    setKeyword('');
    setDifficulty('all');
    setSelectedSubject('all');
    setSelectedAgency('all');
    setSelectedOrganization('all');
    setSelectedRole('all');
    setSelectedYear('all');
    setOnlySaved(false);
    setOnlyTeacherComment(false);
    setOnlyDetailedComment(false);
    setExcludeAnswered(false);
    setCurrentQuestionIndex(0);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => {
    if (visibleCount >= filteredQuestions.length) return;
    setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredQuestions.length));
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex((current) => Math.min(filteredQuestions.length - 1, current + 1));
  };

  const handlePreviousQuestion = () => {
    setCurrentQuestionIndex((current) => Math.max(0, current - 1));
  };

  const handleToggleSavedQuestion = async (question: Question) => {
    if (!question.id) {
      Alert.alert('Questao indisponivel', 'Nao foi possivel identificar a questao para salvar.');
      return;
    }

    try {
      await toggleSavedQuestion(question.id);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel atualizar as questoes salvas.');
    }
  };

  const loadQuestionStats = React.useCallback(async (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    if (!questionKey || statsLoadingMap[questionKey] || statsByQuestion[questionKey] !== undefined) {
      return;
    }

    setStatsLoadingMap((previous) => ({ ...previous, [questionKey]: true }));
    try {
      const stats = await questionService.getQuestionStats(question.id);
      setStatsByQuestion((previous) => ({ ...previous, [questionKey]: stats }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar estatisticas.');
    } finally {
      setStatsLoadingMap((previous) => ({ ...previous, [questionKey]: false }));
    }
  }, [getQuestionStateKey, statsByQuestion, statsLoadingMap]);

  const handleToggleStats = async (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    const nextVisible = !visibleStatsMap[questionKey];
    setVisibleStatsMap((previous) => ({ ...previous, [questionKey]: nextVisible }));

    if (nextVisible) {
      await loadQuestionStats(question);
    }
  };

  const loadQuestionHistory = React.useCallback(async (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    if (!questionKey || historyLoadingMap[questionKey] || historyByQuestion[questionKey] !== undefined) {
      return;
    }

    setHistoryLoadingMap((previous) => ({ ...previous, [questionKey]: true }));
    try {
      const history = await questionService.getQuestionHistory(question.id, user?.id);
      setHistoryByQuestion((previous) => ({
        ...previous,
        [questionKey]: history.length > 0 ? history : getQuestionHistoryFallback(question),
      }));
    } catch (error: any) {
      const fallbackHistory = getQuestionHistoryFallback(question);
      if (fallbackHistory.length > 0) {
        setHistoryByQuestion((previous) => ({ ...previous, [questionKey]: fallbackHistory }));
      } else {
        Alert.alert('Erro', error?.message || 'Nao foi possivel carregar o historico.');
      }
    } finally {
      setHistoryLoadingMap((previous) => ({ ...previous, [questionKey]: false }));
    }
  }, [getQuestionHistoryFallback, getQuestionStateKey, historyByQuestion, historyLoadingMap, user?.id]);

  const handleToggleHistory = async (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    const nextVisible = !visibleHistoryMap[questionKey];
    setVisibleHistoryMap((previous) => ({ ...previous, [questionKey]: nextVisible }));

    if (nextVisible) {
      await loadQuestionHistory(question);
    }
  };

  const handleToggleTeacherComment = (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    const nextVisible = !visibleTeacherCommentMap[questionKey];

    setVisibleTeacherCommentMap((previous) => ({ ...previous, [questionKey]: nextVisible }));
    setVisibleDetailedCommentMap((previous) => ({ ...previous, [questionKey]: false }));
  };

  const handleToggleDetailedComment = (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    const nextVisible = !visibleDetailedCommentMap[questionKey];

    setVisibleDetailedCommentMap((previous) => ({ ...previous, [questionKey]: nextVisible }));
    setVisibleTeacherCommentMap((previous) => ({ ...previous, [questionKey]: false }));
  };

  const updateQuestionCommentsCount = React.useCallback((questionId: number, delta: number) => {
    if (delta === 0) return;

    setQuestionPool((previous) => previous.map((item) => (
      item.id === questionId
        ? { ...item, commentsCount: Math.max(0, Number(item.commentsCount || 0) + delta) }
        : item
    )));
  }, []);

  const loadQuestionComments = React.useCallback(async (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    if (!questionKey || commentsLoadingMap[questionKey] || commentsByQuestion[questionKey] !== undefined) {
      return;
    }

    setCommentsLoadingMap((previous) => ({ ...previous, [questionKey]: true }));
    try {
      const rows = await commentsService.getComments(questionKey, user?.id);
      setCommentsByQuestion((previous) => ({ ...previous, [questionKey]: rows }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar comentarios.');
    } finally {
      setCommentsLoadingMap((previous) => ({ ...previous, [questionKey]: false }));
    }
  }, [commentsByQuestion, commentsLoadingMap, getQuestionStateKey, user?.id]);

  const handleToggleComments = async (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    const nextVisible = !visibleCommentsMap[questionKey];
    setVisibleCommentsMap((previous) => ({ ...previous, [questionKey]: nextVisible }));

    if (nextVisible) {
      await loadQuestionComments(question);
    }
  };

  const handleSubmitComment = async (question: Question, content: string, parentId?: string) => {
    if (!question.id) {
      return;
    }

    if (!user?.id || !user.name) {
      Alert.alert('Login necessario', 'Entre na sua conta para comentar nesta questao.');
      return;
    }

    const nextContent = content.trim();
    if (!nextContent) {
      return;
    }

    const questionKey = getQuestionStateKey(question.id);
    setCommentSubmittingMap((previous) => ({ ...previous, [questionKey]: true }));

    try {
      const createdComment = await commentsService.addComment({
        questionId: questionKey,
        content: nextContent,
        userId: user.id,
        userName: user.name,
        parentId,
        targetType: 'question',
      });

      setCommentsByQuestion((previous) => {
        const currentComments = previous[questionKey] || [];
        const nextComments = parentId
          ? commentsService.addReplyToComments(currentComments, parentId, createdComment)
          : [createdComment, ...currentComments];

        return {
          ...previous,
          [questionKey]: nextComments,
        };
      });

      if (!parentId) {
        updateQuestionCommentsCount(question.id, 1);
      }

      setCommentDraftMap((previous) => ({ ...previous, [questionKey]: '' }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel publicar o comentario.');
    } finally {
      setCommentSubmittingMap((previous) => ({ ...previous, [questionKey]: false }));
    }
  };

  const handleLikeComment = async (question: Question, commentId: string) => {
    if (!question.id) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Login necessario', 'Entre na sua conta para curtir comentarios.');
      return;
    }

    const questionKey = getQuestionStateKey(question.id);
    try {
      await commentsService.likeComment(commentId, user.id);
      setCommentsByQuestion((previous) => ({
        ...previous,
        [questionKey]: commentsService.likeCommentInTree(previous[questionKey] || [], commentId),
      }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel curtir o comentario.');
    }
  };

  const handleToggleNote = (question: Question) => {
    if (!question.id) return;

    const questionKey = getQuestionStateKey(question.id);
    setVisibleNotesMap((previous) => ({ ...previous, [questionKey]: !previous[questionKey] }));
    setNoteDraftMap((previous) => ({
      ...previous,
      [questionKey]: previous[questionKey] ?? notesByQuestion[questionKey]?.text ?? '',
    }));
  };

  const handleSaveNote = async (question: Question) => {
    if (!question.id) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Login necessario', 'Entre na sua conta para anotar nesta questao.');
      return;
    }

    const questionKey = getQuestionStateKey(question.id);
    const trimmedNote = (noteDraftMap[questionKey] || '').trim();
    if (!trimmedNote) {
      Alert.alert('Anotacao vazia', 'Escreva algo antes de salvar.');
      return;
    }

    setNoteSavingMap((previous) => ({ ...previous, [questionKey]: true }));
    try {
      const previousNote = notesByQuestion[questionKey];
      const nextNote: QuestionNote = {
        id: previousNote?.id || `local-${user.id}-${question.id}`,
        questionId: question.id,
        text: trimmedNote,
        timestamp: Date.now(),
        remoteId: previousNote?.remoteId ?? null,
        source: previousNote?.remoteId ? 'local_override' : 'local',
      };

      await questionNotesService.upsertLocalNote(user.id, nextNote);
      setNotesByQuestion((previous) => ({ ...previous, [questionKey]: nextNote }));
      setNoteDraftMap((previous) => ({ ...previous, [questionKey]: trimmedNote }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel salvar a anotacao.');
    } finally {
      setNoteSavingMap((previous) => ({ ...previous, [questionKey]: false }));
    }
  };

  const handleClearNote = async (question: Question) => {
    if (!question.id) {
      return;
    }

    if (!user?.id) {
      Alert.alert('Login necessario', 'Entre na sua conta para gerenciar anotacoes.');
      return;
    }

    const questionKey = getQuestionStateKey(question.id);
    const currentNote = notesByQuestion[questionKey];

    setNoteSavingMap((previous) => ({ ...previous, [questionKey]: true }));
    try {
      if (currentNote?.remoteId) {
        await questionNotesService.deleteRemoteNote(currentNote.remoteId);
      }

      await questionNotesService.removeLocalNote(user.id, question.id);
      setNotesByQuestion((previous) => {
        const next = { ...previous };
        delete next[questionKey];
        return next;
      });
      setNoteDraftMap((previous) => ({ ...previous, [questionKey]: '' }));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel limpar a anotacao.');
    } finally {
      setNoteSavingMap((previous) => ({ ...previous, [questionKey]: false }));
    }
  };

  const handleSelectOption = async (question: Question, optionIndex: number) => {
    if (!user?.id || !question.id) {
      Alert.alert('Sessao invalida', 'Faca login novamente para responder questoes.');
      return;
    }

    if (answeredMap[question.id] !== undefined) {
      return;
    }

    const answerKey = `${question.id}:${optionIndex}`;
    const answeredTimestamp = Date.now();
    const nextUserAnswer = {
      questionId: question.id,
      selectedOptionIndex: optionIndex,
      isCorrect: false,
      timestamp: answeredTimestamp,
    };

    setAnsweringKey(answerKey);
    try {
      const result = await questionService.submitUserAnswer({
        questionId: question.id,
        selectedOptionIndex: optionIndex,
      });

      if (!result.success) {
        Alert.alert('Erro ao responder', result.message || 'Nao foi possivel salvar a resposta.');
        return;
      }

      const canonicalAnswer = result.answer;
      if (!canonicalAnswer) {
        Alert.alert('Erro ao responder', 'O servidor não devolveu a correção da resposta.');
        return;
      }
      const resolvedUserAnswer = {
        ...nextUserAnswer,
        selectedOptionIndex: canonicalAnswer.selectedOptionIndex,
        correctOptionIndex: canonicalAnswer.correctOptionIndex,
        isCorrect: canonicalAnswer.isCorrect,
      };
      setAnsweredMap((previous) => ({ ...previous, [question.id as number]: canonicalAnswer.selectedOptionIndex }));
      setQuestionPool((previous) => previous.map((item) => (
        item.id === question.id
          ? { ...item, userAnswer: resolvedUserAnswer }
          : item
      )));

      const questionKey = getQuestionStateKey(question.id);
      if (questionKey) {
        setHistoryByQuestion((previous) => {
          const currentHistory = previous[questionKey];
          if (!currentHistory) return previous;

          return {
            ...previous,
            [questionKey]: [resolvedUserAnswer, ...currentHistory],
          };
        });

        setStatsByQuestion((previous) => {
          const currentStats = previous[questionKey];
          if (!currentStats) return previous;

          const optionDistribution = {
            ...(currentStats.optionDistribution || {}),
            [String(canonicalAnswer.selectedOptionIndex)]: Number(currentStats.optionDistribution?.[String(canonicalAnswer.selectedOptionIndex)] || 0) + 1,
          };

          return {
            ...previous,
            [questionKey]: {
              ...currentStats,
              totalAttempts: Number(currentStats.totalAttempts || 0) + 1,
              correctCount: Number(currentStats.correctCount || 0) + (canonicalAnswer.isCorrect ? 1 : 0),
              wrongCount: Number(currentStats.wrongCount || 0) + (canonicalAnswer.isCorrect ? 0 : 1),
              optionDistribution,
            },
          };
        });
      }

      if (result.newXp || result.newLevel) {
        await refreshProfile();
      }
    } finally {
      setAnsweringKey(null);
    }
  };

  const renderFilterChips = (
    options: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
    allLabel: string,
  ) => (
    <View style={styles.inlineFilters}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          style={[styles.chip, selectedValue === option && styles.chipActive]}
        >
          <Text style={[styles.chipText, selectedValue === option && styles.chipTextActive]}>
            {option === 'all' ? allLabel : option}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const renderQuestion = ({ item, index }: { item: Question; index: number }) => {
    const questionId = item.id || index;
    const questionStateKey = getQuestionStateKey(item.id);
    const selected = item.id ? answeredMap[item.id] : undefined;
    const correctIndex = Number(item.userAnswer?.correctOptionIndex ?? -1);
    const isSaved = item.id !== undefined && savedQuestionIdSet.has(String(item.id));
    const currentNote = notesByQuestion[questionStateKey];
    const noteVisible = Boolean(visibleNotesMap[questionStateKey]);
    const noteDraft = noteDraftMap[questionStateKey] ?? currentNote?.text ?? '';
    const noteSaving = Boolean(noteSavingMap[questionStateKey]);
    const comments = commentsByQuestion[questionStateKey] || [];
    const commentsVisible = Boolean(visibleCommentsMap[questionStateKey]);
    const commentsLoading = Boolean(commentsLoadingMap[questionStateKey]);
    const commentDraft = commentDraftMap[questionStateKey] || '';
    const commentsSubmitting = Boolean(commentSubmittingMap[questionStateKey]);
    const commentsCount = commentsByQuestion[questionStateKey] !== undefined
      ? comments.length
      : Number(item.commentsCount || 0);
    const statsVisible = Boolean(visibleStatsMap[questionStateKey]);
    const questionStats = statsByQuestion[questionStateKey] || item.stats || null;
    const statsLoading = Boolean(statsLoadingMap[questionStateKey]);
    const historyVisible = Boolean(visibleHistoryMap[questionStateKey]);
    const history = historyByQuestion[questionStateKey] || [];
    const historyLoading = Boolean(historyLoadingMap[questionStateKey]);
    const teacherCommentVisible = Boolean(visibleTeacherCommentMap[questionStateKey]);
    const detailedCommentVisible = Boolean(visibleDetailedCommentMap[questionStateKey]);
    const accuracyRate = getQuestionAccuracyRate(questionStats);
    const metaParts = [
      (item.bancas || []).map((agency) => getEntityLabel(agency)).filter(Boolean)[0],
      (item.orgaos || []).map((organization) => getEntityLabel(organization)).filter(Boolean)[0],
      (item.cargos || []).map((role) => getRoleLabel(role)).filter(Boolean)[0],
      getQuestionYear(item),
    ].filter(Boolean);

    return (
      <View style={styles.questionCard}>
        <View style={styles.questionHeader}>
          <View style={styles.questionHeaderText}>
            <Text style={styles.questionTag}>Questao #{questionId}</Text>
            <Text style={styles.questionDifficulty}>{mapDifficultyLabel(item.dificuldade)}</Text>
          </View>
          <Pressable
            onPress={() => void handleToggleSavedQuestion(item)}
            style={[styles.saveButton, isSaved && styles.saveButtonActive]}
          >
            <Text style={[styles.saveButtonText, isSaved && styles.saveButtonTextActive]}>
              {isSaved ? 'Salva' : 'Salvar'}
            </Text>
          </Pressable>
        </View>

        {metaParts.length > 0 ? (
          <Text style={styles.questionMeta}>{metaParts.join(' | ')}</Text>
        ) : null}

        {Number(questionStats?.totalAttempts || 0) > 0 ? (
          <Text style={styles.questionStatsSummary}>
            {accuracyRate}% de acerto em {Number(questionStats?.totalAttempts || 0)} respostas
          </Text>
        ) : null}

        <Text style={styles.questionText}>{normalizeQuestionText(item) || 'Questao sem enunciado.'}</Text>

        <View style={styles.badgeRow}>
          {item.hasTeacherComment ? (
            <View style={[styles.infoBadge, styles.teacherBadge]}>
              <Text style={[styles.infoBadgeText, styles.teacherBadgeText]}>Professor</Text>
            </View>
          ) : null}
          {item.hasDetailedComment ? (
            <View style={[styles.infoBadge, styles.detailBadge]}>
              <Text style={[styles.infoBadgeText, styles.detailBadgeText]}>Analise detalhada</Text>
            </View>
          ) : null}
          {selected !== undefined ? (
            <View style={[styles.infoBadge, styles.answeredBadge]}>
              <Text style={[styles.infoBadgeText, styles.answeredBadgeText]}>Respondida</Text>
            </View>
          ) : null}
          {isSaved ? (
            <View style={[styles.infoBadge, styles.savedBadge]}>
              <Text style={[styles.infoBadgeText, styles.savedBadgeText]}>Salva</Text>
            </View>
          ) : null}
          {currentNote?.text ? (
            <View style={[styles.infoBadge, styles.noteBadge]}>
              <Text style={[styles.infoBadgeText, styles.noteBadgeText]}>Anotada</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.questionActionsRow}>
          {(item.hasTeacherComment || item.teacherComment) ? (
            <Pressable
              onPress={() => handleToggleTeacherComment(item)}
              style={[styles.secondaryActionButton, teacherCommentVisible && styles.secondaryActionButtonActive]}
            >
              <Text style={[styles.secondaryActionButtonText, teacherCommentVisible && styles.secondaryActionButtonTextActive]}>
                Professor
              </Text>
            </Pressable>
          ) : null}
          {(item.hasDetailedComment || item.detailedComment) ? (
            <Pressable
              onPress={() => handleToggleDetailedComment(item)}
              style={[styles.secondaryActionButton, detailedCommentVisible && styles.secondaryActionButtonActive]}
            >
              <Text style={[styles.secondaryActionButtonText, detailedCommentVisible && styles.secondaryActionButtonTextActive]}>
                Analise
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => void handleToggleComments(item)}
            style={[styles.secondaryActionButton, commentsVisible && styles.secondaryActionButtonActive]}
          >
            <Text style={[styles.secondaryActionButtonText, commentsVisible && styles.secondaryActionButtonTextActive]}>
              {commentsVisible ? `Ocultar comentarios (${commentsCount})` : `Comentarios (${commentsCount})`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleToggleNote(item)}
            style={[styles.secondaryActionButton, noteVisible && styles.secondaryActionButtonActive]}
          >
            <Text style={[styles.secondaryActionButtonText, noteVisible && styles.secondaryActionButtonTextActive]}>
              {currentNote?.text ? 'Anotacao' : 'Anotar'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void handleToggleStats(item)}
            style={[styles.secondaryActionButton, statsVisible && styles.secondaryActionButtonActive]}
          >
            <Text style={[styles.secondaryActionButtonText, statsVisible && styles.secondaryActionButtonTextActive]}>
              Estatisticas
            </Text>
          </Pressable>
          {selected !== undefined ? (
            <Pressable
              onPress={() => void handleToggleHistory(item)}
              style={[styles.secondaryActionButton, historyVisible && styles.secondaryActionButtonActive]}
            >
              <Text style={[styles.secondaryActionButtonText, historyVisible && styles.secondaryActionButtonTextActive]}>
                Historico
              </Text>
            </Pressable>
          ) : null}
        </View>

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

        {statsVisible ? (
          <QuestionStatsPanel
            question={item}
            stats={questionStats}
            loading={statsLoading}
          />
        ) : null}

        {teacherCommentVisible ? (
          <QuestionInsightPanel
            title="Comentario do professor"
            content={item.teacherComment}
            emptyText="Comentario do professor ainda nao disponivel para esta questao."
            variant="teacher"
          />
        ) : null}

        {detailedCommentVisible ? (
          <QuestionInsightPanel
            title="Analise detalhada"
            content={item.detailedComment}
            emptyText="Analise detalhada ainda nao disponivel para esta questao."
            variant="detailed"
          />
        ) : null}

        {historyVisible ? (
          <QuestionHistoryPanel
            question={item}
            history={history}
            loading={historyLoading}
          />
        ) : null}

        {commentsVisible ? (
          <QuestionCommentsPanel
            comments={comments}
            loading={commentsLoading}
            draft={commentDraft}
            submitting={commentsSubmitting}
            onChangeDraft={(value) => setCommentDraftMap((previous) => ({ ...previous, [questionStateKey]: value }))}
            onSubmitComment={(content, parentId) => handleSubmitComment(item, content, parentId)}
            onLikeComment={(commentId) => handleLikeComment(item, commentId)}
          />
        ) : null}

        {noteVisible ? (
          <QuestionNotePanel
            note={currentNote}
            draft={noteDraft}
            loading={notesLoading}
            saving={noteSaving}
            onChangeDraft={(value) => setNoteDraftMap((previous) => ({ ...previous, [questionStateKey]: value }))}
            onSave={() => handleSaveNote(item)}
            onClear={() => handleClearNote(item)}
          />
        ) : null}
      </View>
    );
  };

  const activeFilterCount = [
    keyword.trim() !== '',
    difficulty !== 'all',
    selectedSubject !== 'all',
    selectedAgency !== 'all',
    selectedOrganization !== 'all',
    selectedRole !== 'all',
    selectedYear !== 'all',
    onlySaved,
    onlyTeacherComment,
    onlyDetailedComment,
    excludeAnswered,
  ].filter(Boolean).length;

  return (
    <View style={styles.screen}>
      <View style={styles.filtersCard}>
        <View style={styles.filtersHeaderRow}>
          <Text style={styles.filtersTitle}>Filtros</Text>
          <Text style={styles.filtersSummary}>
            {filteredQuestions.length} de {questionPool.length}
          </Text>
        </View>

        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Buscar no enunciado"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        {renderFilterChips(
          ['all', 'easy', 'medium', 'hard'],
          difficulty,
          (value) => setDifficulty(value as DifficultyFilter),
          'Todas',
        )}

        <Text style={styles.filterLabel}>Materia</Text>
        {renderFilterChips(subjectOptions, selectedSubject, setSelectedSubject, 'Todas materias')}

        <Text style={styles.filterLabel}>Banca</Text>
        {renderFilterChips(agencyOptions, selectedAgency, setSelectedAgency, 'Todas bancas')}

        <Text style={styles.filterLabel}>Orgao</Text>
        {renderFilterChips(organizationOptions, selectedOrganization, setSelectedOrganization, 'Todos orgaos')}

        <Text style={styles.filterLabel}>Cargo</Text>
        {renderFilterChips(roleOptions, selectedRole, setSelectedRole, 'Todos cargos')}

        <Text style={styles.filterLabel}>Ano</Text>
        {renderFilterChips(yearOptions, selectedYear, setSelectedYear, 'Todos anos')}

        <Text style={styles.filterLabel}>Recursos</Text>
        <View style={styles.inlineFilters}>
          <Pressable
            onPress={() => setOnlySaved((current) => !current)}
            style={[styles.chip, onlySaved && styles.chipActive]}
          >
            <Text style={[styles.chipText, onlySaved && styles.chipTextActive]}>Salvas</Text>
          </Pressable>
          <Pressable
            onPress={() => setOnlyTeacherComment((current) => !current)}
            style={[styles.chip, onlyTeacherComment && styles.chipActive]}
          >
            <Text style={[styles.chipText, onlyTeacherComment && styles.chipTextActive]}>Professor</Text>
          </Pressable>
          <Pressable
            onPress={() => setOnlyDetailedComment((current) => !current)}
            style={[styles.chip, onlyDetailedComment && styles.chipActive]}
          >
            <Text style={[styles.chipText, onlyDetailedComment && styles.chipTextActive]}>Analise detalhada</Text>
          </Pressable>
          <Pressable
            onPress={() => setExcludeAnswered((current) => !current)}
            style={[styles.chip, excludeAnswered && styles.chipActive]}
          >
            <Text style={[styles.chipText, excludeAnswered && styles.chipTextActive]}>Ocultar respondidas</Text>
          </Pressable>
        </View>

        <View style={styles.modeToggleRow}>
          {(['card', 'list'] as PracticeViewMode[]).map((option) => (
            <Pressable
              key={option}
              onPress={() => setViewMode(option)}
              style={[styles.modeButton, viewMode === option && styles.modeButtonActive]}
            >
              <Text style={[styles.modeButtonText, viewMode === option && styles.modeButtonTextActive]}>
                {option === 'card' ? 'Modo foco' : 'Lista'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.filterActionsRow}>
          <Pressable onPress={handleApplyFilters} style={styles.applyButton}>
            <Text style={styles.applyButtonText}>
              {activeFilterCount > 0 ? `Aplicar (${activeFilterCount})` : 'Aplicar filtros'}
            </Text>
          </Pressable>
          <Pressable onPress={handleClearFilters} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Limpar</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loaderBlock}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={viewMode === 'card' ? (currentQuestion ? [currentQuestion] : []) : visibleListQuestions}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={renderQuestion}
          contentContainerStyle={styles.listContent}
          onEndReached={viewMode === 'list' ? handleLoadMore : undefined}
          onEndReachedThreshold={0.35}
          ListFooterComponent={viewMode === 'card' && filteredQuestions.length > 0 ? (
            <View style={styles.focusFooter}>
              <Text style={styles.focusProgress}>
                {filteredQuestions.length > 0 ? currentQuestionIndex + 1 : 0} / {filteredQuestions.length}
              </Text>
              <View style={styles.focusActions}>
                <Pressable
                  style={[styles.focusButton, currentQuestionIndex === 0 && styles.focusButtonDisabled]}
                  onPress={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                >
                  <Text style={styles.focusButtonText}>Anterior</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.focusButton,
                    styles.focusButtonPrimary,
                    currentQuestionIndex >= filteredQuestions.length - 1 && styles.focusButtonDisabled,
                  ]}
                  onPress={handleNextQuestion}
                  disabled={currentQuestionIndex >= filteredQuestions.length - 1}
                >
                  <Text style={[styles.focusButtonText, styles.focusButtonPrimaryText]}>Proxima</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            viewMode === 'list' && visibleListQuestions.length < filteredQuestions.length
              ? <ActivityIndicator size="small" color={colors.primary} />
              : null
          )}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nenhuma questao encontrada</Text>
              <Text style={styles.emptyText}>Ajuste os filtros e tente novamente.</Text>
              <Pressable style={styles.retryOutlineButton} onPress={handleClearFilters}>
                <Text style={styles.retryOutlineButtonText}>Limpar filtros</Text>
              </Pressable>
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
  filtersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  filtersTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: colors.muted,
    letterSpacing: 0,
  },
  filtersSummary: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 10,
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
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  modeButtonTextActive: {
    color: colors.primary,
  },
  filterActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  applyButton: {
    flex: 1,
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
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  clearButton: {
    minWidth: 96,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0,
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
  focusFooter: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 12,
    gap: 10,
  },
  focusProgress: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  focusActions: {
    flexDirection: 'row',
    gap: 8,
  },
  focusButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusButtonPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  focusButtonDisabled: {
    opacity: 0.55,
  },
  focusButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  focusButtonPrimaryText: {
    color: '#FFFFFF',
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
  questionHeaderText: {
    flex: 1,
    gap: 4,
  },
  questionTag: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
    color: colors.muted,
  },
  questionDifficulty: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  saveButton: {
    minWidth: 76,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  saveButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  saveButtonTextActive: {
    color: '#047857',
  },
  questionMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  questionStatsSummary: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  questionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  infoBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  infoBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  teacherBadge: {
    backgroundColor: '#FEF3C7',
  },
  teacherBadgeText: {
    color: '#B45309',
  },
  detailBadge: {
    backgroundColor: '#EDE9FE',
  },
  detailBadgeText: {
    color: '#6D28D9',
  },
  answeredBadge: {
    backgroundColor: '#ECFDF5',
  },
  answeredBadgeText: {
    color: colors.success,
  },
  savedBadge: {
    backgroundColor: '#ECFDF5',
  },
  savedBadgeText: {
    color: '#047857',
  },
  noteBadge: {
    backgroundColor: '#FEF3C7',
  },
  noteBadgeText: {
    color: '#92400E',
  },
  questionActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryActionButton: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  secondaryActionButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textAlign: 'center',
  },
  secondaryActionButtonTextActive: {
    color: colors.primary,
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
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
  },
  retryOutlineButton: {
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryOutlineButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

export default QuestionsScreen;
