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

const normalizeQuestionText = (question: Question): string => (
  String(question.enunciado_clean || question.enunciado || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
);

const getEntityLabel = (item?: { nome?: string; sigla?: string }): string => (
  String(item?.sigla || item?.nome || '').trim()
);

const getRoleLabel = (item?: { descricao?: string; ['descriÃ§Ã£o']?: string; nome?: string }): string => (
  String(item?.descricao || item?.['descriÃ§Ã£o'] || item?.nome || '').trim()
);

const getQuestionYear = (question: Question): string => {
  const value = Array.isArray(question.anos) && question.anos.length > 0 ? question.anos[0] : '';
  return String(value || '').trim();
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
  const [questionPool, setQuestionPool] = React.useState<Question[]>([]);
  const [loadingPool, setLoadingPool] = React.useState(true);
  const [selectedSubjects, setSelectedSubjects] = React.useState<string[]>([]);
  const [selectedAgencies, setSelectedAgencies] = React.useState<string[]>([]);
  const [selectedYears, setSelectedYears] = React.useState<string[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = React.useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [starting, setStarting] = React.useState(false);

  const toggleSelection = React.useCallback((values: string[], value: string): string[] => (
    values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value]
  ), []);

  const loadQuestionPool = React.useCallback(async () => {
    setLoadingPool(true);
    try {
      const rows = await questionService.getAllQuestions();
      setQuestionPool(rows);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar a base de questoes do simulado.');
      setQuestionPool([]);
    } finally {
      setLoadingPool(false);
    }
  }, []);

  React.useEffect(() => {
    void loadQuestionPool();
  }, [loadQuestionPool]);

  const subjectOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.assuntos || []).forEach((subject) => {
        if (subject?.materia && subject?.nome) values.add(subject.nome);
      });
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [questionPool]);

  const agencyOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.bancas || []).forEach((agency) => {
        const label = getEntityLabel(agency);
        if (label) values.add(label);
      });
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [questionPool]);

  const yearOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      const year = getQuestionYear(question);
      if (year) values.add(year);
    });

    return Array.from(values).sort((left, right) => Number(right) - Number(left));
  }, [questionPool]);

  const organizationOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.orgaos || []).forEach((organization) => {
        const label = getEntityLabel(organization);
        if (label) values.add(label);
      });
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [questionPool]);

  const roleOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      (question.cargos || []).forEach((role) => {
        const label = getRoleLabel(role);
        if (label) values.add(label);
      });
    });

    return Array.from(values).sort((left, right) => left.localeCompare(right, 'pt-BR'));
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
        selectedSubjects.length === 0
        || (question.assuntos || []).some((subject) => subject?.materia && subject?.nome && selectedSubjects.includes(subject.nome))
      );
      const matchesAgency = (
        selectedAgencies.length === 0
        || (question.bancas || []).some((agency) => selectedAgencies.includes(getEntityLabel(agency)))
      );
      const matchesYear = selectedYears.length === 0 || selectedYears.includes(getQuestionYear(question));
      const matchesOrganization = (
        selectedOrganizations.length === 0
        || (question.orgaos || []).some((organization) => selectedOrganizations.includes(getEntityLabel(organization)))
      );
      const matchesRole = (
        selectedRoles.length === 0
        || (question.cargos || []).some((role) => selectedRoles.includes(getRoleLabel(role)))
      );

      return (
        matchesKeyword
        && matchesDifficulty
        && matchesSubject
        && matchesAgency
        && matchesYear
        && matchesOrganization
        && matchesRole
      );
    });
  }, [
    difficulty,
    keyword,
    questionPool,
    selectedAgencies,
    selectedOrganizations,
    selectedRoles,
    selectedSubjects,
    selectedYears,
  ]);

  const previewQuestions = React.useMemo(
    () => filteredQuestions.slice(0, PREVIEW_PAGE_SIZE),
    [filteredQuestions],
  );

  const renderMultiSelectChips = (
    options: string[],
    selectedValues: string[],
    onChange: (values: string[]) => void,
    allLabel: string,
  ) => (
    <View style={styles.optionsRow}>
      <Pressable
        onPress={() => onChange([])}
        style={[styles.optionChip, selectedValues.length === 0 && styles.optionChipActive]}
      >
        <Text style={[styles.optionChipText, selectedValues.length === 0 && styles.optionChipTextActive]}>
          {allLabel}
        </Text>
      </Pressable>
      {options.map((option) => {
        const selected = selectedValues.includes(option);
        return (
          <Pressable
            key={option}
            onPress={() => onChange(toggleSelection(selectedValues, option))}
            style={[styles.optionChip, selected && styles.optionChipActive]}
          >
            <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const handleStartSimulation = () => {
    setStarting(true);
    try {
      const randomized = shuffleQuestions(filteredQuestions);
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
            difficulty,
            subjects: selectedSubjects,
            agencies: selectedAgencies,
            years: selectedYears,
            organizations: selectedOrganizations,
            roles: selectedRoles,
          },
          questions: selected,
          startedAt: Date.now(),
        },
      });
    } finally {
      setStarting(false);
    }
  };

  const clearFilters = () => {
    setKeyword('');
    setDifficulty('all');
    setSelectedSubjects([]);
    setSelectedAgencies([]);
    setSelectedYears([]);
    setSelectedOrganizations([]);
    setSelectedRoles([]);
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
          {loadingPool ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.previewCount}>{filteredQuestions.length} questoes</Text>
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

        <Text style={styles.filterLabel}>Materias</Text>
        {renderMultiSelectChips(subjectOptions, selectedSubjects, setSelectedSubjects, 'Todas materias')}

        <Text style={styles.filterLabel}>Bancas</Text>
        {renderMultiSelectChips(agencyOptions, selectedAgencies, setSelectedAgencies, 'Todas bancas')}

        <Text style={styles.filterLabel}>Anos</Text>
        {renderMultiSelectChips(yearOptions, selectedYears, setSelectedYears, 'Todos os anos')}

        <Text style={styles.filterLabel}>Orgaos</Text>
        {renderMultiSelectChips(organizationOptions, selectedOrganizations, setSelectedOrganizations, 'Todos os orgaos')}

        <Text style={styles.filterLabel}>Cargos</Text>
        {renderMultiSelectChips(roleOptions, selectedRoles, setSelectedRoles, 'Todos os cargos')}

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>
            Amostra local: {previewQuestions.length} de {filteredQuestions.length} questoes elegiveis
          </Text>
          <Text style={styles.previewText}>
            O configurador usa o pool oficial completo no app para aplicar materia, banca, ano, orgao e cargo sem depender dos filtros do endpoint legado.
          </Text>
          {filteredQuestions.length > 0 && filteredQuestions.length < questionCount ? (
            <Text style={styles.previewNotice}>
              Ha menos questoes do que o total pedido; o simulado vai iniciar com {filteredQuestions.length}.
            </Text>
          ) : null}
        </View>

        <View style={styles.filterActions}>
          <Pressable style={styles.secondaryButton} onPress={clearFilters}>
            <Text style={styles.secondaryButtonText}>Limpar filtros</Text>
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
        style={[styles.mainButton, (starting || loadingPool || filteredQuestions.length === 0) && styles.mainButtonDisabled]}
        onPress={handleStartSimulation}
        disabled={starting || loadingPool || filteredQuestions.length === 0}
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
  previewCard: {
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#EEF2FF',
    gap: 6,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  previewText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  previewNotice: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
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
