import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { rankingsService } from '@/services/rankings/rankingsService';
import { colors } from '@/theme/colors';
import type { RankingEntry, RankingListItem } from '@/types/rankings';

type RankingDetailRoute = RouteProp<AppStackParamList, 'RankingDetail'>;
type RankingCategory = 'AC' | 'Afro' | 'PCD';

const CATEGORY_OPTIONS: RankingCategory[] = ['AC', 'Afro', 'PCD'];

/**
 * Converte datas unix/string usadas pelo ranking para objeto Date seguro.
 * @since v1.0.0
 */
const parseDate = (rawValue?: number | string): Date | null => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue > 9999999999 ? numericValue : numericValue * 1000)
    : new Date(String(rawValue));

  if (Number.isNaN(date.getTime())) return null;
  return date;
};

/**
 * Formata datas de ranking no fuso de operacao principal do produto.
 * @since v1.0.0
 */
const formatDate = (rawValue?: number | string): string => {
  const date = parseDate(rawValue);
  if (!date) return '--';
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Normaliza numeros opcionais vindos do backend para exibicao mobile.
 * @since v1.0.0
 */
const formatNumber = (value?: number): string => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return '0';
  return String(numericValue);
};

/**
 * Traduz o estado tecnico do gabarito para o texto usado no app mobile.
 * @since v1.0.0
 */
const formatKeyStatus = (status?: string): string => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'official') return 'Gabarito oficial';
  if (normalized === 'pending') return 'Gabarito pendente';
  return status || 'Status nao informado';
};

/**
 * Ordena participacoes pelo score antes de renderizar o top publico.
 * @since v1.0.0
 */
const sortRankingEntries = (entries?: RankingEntry[]): RankingEntry[] => {
  return [...(entries || [])].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
};

/**
 * Mantem somente alternativas validas para o cartao-resposta mobile.
 * @since v1.0.0
 */
const sanitizeAnswers = (value: string, totalQuestions?: number): string => {
  const normalized = String(value || '').toUpperCase().replace(/[^A-E]/g, '');
  const limit = Number(totalQuestions || 0);
  return limit > 0 ? normalized.slice(0, limit) : normalized;
};

/**
 * Calcula o gabarito colaborativo usado quando o oficial ainda esta pendente.
 * @since v1.0.0
 */
const buildConsensusKey = (entries: RankingEntry[], totalQuestions?: number): string => {
  const limit = Number(totalQuestions || 0);
  let consensusKey = '';

  for (let index = 0; index < limit; index += 1) {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

    entries.forEach((entry) => {
      const answer = String(entry.userAnswers || '')[index];
      if (counts[answer] !== undefined) {
        counts[answer] += 1;
      }
    });

    let maxAnswer = 'X';
    let maxCount = -1;
    Object.entries(counts).forEach(([answer, count]) => {
      if (count > maxCount) {
        maxAnswer = answer;
        maxCount = count;
        return;
      }

      if (count === maxCount && count > 0) {
        maxAnswer = 'X';
      }
    });

    consensusKey += maxCount > 0 ? maxAnswer : 'X';
  }

  return consensusKey;
};

const resolveActiveKey = (ranking: RankingListItem): string => {
  if (String(ranking.keyStatus || '').toLowerCase() === 'official') {
    return String(ranking.correctKey || '').toUpperCase();
  }

  return buildConsensusKey(ranking.entries || [], ranking.totalQuestions);
};

const calculateScore = (key: string, userAnswers: string): number => {
  let score = 0;

  for (let index = 0; index < Math.min(key.length, userAnswers.length); index += 1) {
    if (key[index] !== 'X' && key[index] === userAnswers[index]) {
      score += 1;
    }
  }

  return score;
};

/**
 * Detalhe mobile de ranking publico.
 * @since v1.0.0
 */
export const RankingDetailScreen: React.FC = () => {
  const route = useRoute<RankingDetailRoute>();
  const { user } = useAuth();
  const { rankingId } = route.params;
  const [ranking, setRanking] = React.useState<RankingListItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [registration, setRegistration] = React.useState('');
  const [examType, setExamType] = React.useState('');
  const [category, setCategory] = React.useState<RankingCategory>('AC');
  const [answers, setAnswers] = React.useState('');
  const [discursiveScore, setDiscursiveScore] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const questionTotal = Number(ranking?.totalQuestions || 0);
  const rankingEntries = React.useMemo(() => ranking?.entries || [], [ranking?.entries]);
  const activeKey = React.useMemo(() => ranking ? resolveActiveKey(ranking) : '', [ranking]);
  const currentUserEntry = React.useMemo(
    () => rankingEntries.find((entry) => String(entry.userId || '') === String(user?.id || '')) || null,
    [rankingEntries, user?.id],
  );
  const examTypeOptions = React.useMemo(() => {
    const options = (ranking?.examTypes || []).map(String).filter(Boolean);
    return options.length ? options : ['Geral'];
  }, [ranking?.examTypes]);
  const entries = React.useMemo(() => {
    const scoredEntries = rankingEntries.map((entry) => ({
      ...entry,
      score: activeKey ? calculateScore(activeKey, String(entry.userAnswers || '')) : Number(entry.score || 0),
    }));

    return sortRankingEntries(scoredEntries).slice(0, 50);
  }, [activeKey, rankingEntries]);

  const loadRanking = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const payload = await rankingsService.getById(rankingId);
      setRanking(payload);
      if (!payload) {
        Alert.alert('Ranking indisponivel', 'Nao foi possivel encontrar este ranking.');
      }
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar o ranking.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [rankingId]);

  React.useEffect(() => {
    void loadRanking(false);
  }, [loadRanking]);

  React.useEffect(() => {
    if (!ranking) return;

    if (currentUserEntry) {
      setRegistration(currentUserEntry.registrationNumber || '');
      setExamType(currentUserEntry.examType || examTypeOptions[0] || 'Geral');
      setCategory(CATEGORY_OPTIONS.includes(currentUserEntry.category as RankingCategory)
        ? currentUserEntry.category as RankingCategory
        : 'AC');
      setAnswers(sanitizeAnswers(currentUserEntry.userAnswers || '', ranking.totalQuestions));
      setDiscursiveScore(currentUserEntry.discursiveScore !== undefined ? String(currentUserEntry.discursiveScore) : '');
      return;
    }

    setRegistration('');
    setExamType(examTypeOptions[0] || 'Geral');
    setCategory('AC');
    setAnswers('');
    setDiscursiveScore('');
  }, [currentUserEntry, examTypeOptions, ranking]);

  const openOfficialKey = async () => {
    const target = ranking?.officialKeyPdfUrl || ranking?.preliminaryKeyPdfUrl;
    if (!target || !/^https?:\/\//i.test(target)) {
      Alert.alert('Gabarito indisponivel', 'Este ranking ainda nao possui PDF de gabarito para abrir.');
      return;
    }

    await Linking.openURL(target);
  };

  const handleAnswersChange = (value: string) => {
    setAnswers(sanitizeAnswers(value, ranking?.totalQuestions));
  };

  const upsertEntry = (entriesToUpdate: RankingEntry[], entry: RankingEntry): RankingEntry[] => {
    const entryUserId = String(entry.userId || '');
    const exists = entriesToUpdate.some((item) => String(item.userId || '') === entryUserId);

    if (exists) {
      return entriesToUpdate.map((item) => String(item.userId || '') === entryUserId ? entry : item);
    }

    return [...entriesToUpdate, entry];
  };

  const handleSubmitAnswers = async () => {
    if (!ranking) return;

    if (!user?.id) {
      Alert.alert('Faca login', 'Entre na sua conta para registrar sua nota no ranking.');
      return;
    }

    const registrationNumber = registration.trim();
    const normalizedAnswers = sanitizeAnswers(answers, ranking.totalQuestions);
    const finalExamType = examType.trim() || examTypeOptions[0] || 'Geral';

    if (!registrationNumber) {
      Alert.alert('Inscricao obrigatoria', 'Informe seu numero de inscricao antes de enviar.');
      return;
    }

    if (questionTotal > 0 && normalizedAnswers.length !== questionTotal) {
      Alert.alert('Cartao incompleto', `Informe ${questionTotal} respostas antes de enviar.`);
      return;
    }

    if (!normalizedAnswers) {
      Alert.alert('Cartao vazio', 'Informe ao menos uma resposta antes de enviar.');
      return;
    }

    const normalizedDiscursiveScore = discursiveScore.replace(',', '.').trim();
    const parsedDiscursiveScore = normalizedDiscursiveScore ? Number(normalizedDiscursiveScore) : 0;
    if (ranking.hasDiscursive && !Number.isFinite(parsedDiscursiveScore)) {
      Alert.alert('Nota discursiva invalida', 'Informe uma nota discursiva numerica.');
      return;
    }

    const entry: RankingEntry = {
      id: currentUserEntry?.id || `u-${Date.now()}`,
      userId: user.id,
      userName: user.name || user.email || 'Candidato',
      registrationNumber,
      examType: finalExamType,
      category,
      userAnswers: normalizedAnswers,
      score: activeKey ? calculateScore(activeKey, normalizedAnswers) : 0,
      discursiveScore: ranking.hasDiscursive ? parsedDiscursiveScore : undefined,
      timestamp: Date.now(),
      status: 'active',
    };

    setSubmitting(true);
    try {
      const entryId = await rankingsService.join(ranking.id, user.id, entry);
      const savedEntry = { ...entry, id: entryId || entry.id };

      setRanking((current) => {
        if (!current || String(current.id) !== String(ranking.id)) return current;
        return {
          ...current,
          entries: upsertEntry(current.entries || [], savedEntry),
        };
      });
      setAnswers(normalizedAnswers);
      setExamType(finalExamType);
      Alert.alert('Gabarito enviado', 'Sua participacao foi registrada no ranking.');
    } catch (error: any) {
      Alert.alert('Erro ao enviar', error?.message || 'Nao foi possivel enviar seu gabarito.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderEntry = ({ item, index }: { item: RankingEntry; index: number }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryPosition}>
        <Text style={styles.entryPositionText}>#{index + 1}</Text>
      </View>
      <View style={styles.entryContent}>
        <Text style={styles.entryName}>{item.userName || 'Participante'}</Text>
        <Text style={styles.entryMeta}>
          {[item.category || 'AC', item.examType || 'Padrao', item.status || 'active'].join(' | ')}
        </Text>
        <View style={styles.entryScoreRow}>
          <Text style={styles.entryScoreLabel}>Nota objetiva</Text>
          <Text style={styles.entryScoreValue}>{formatNumber(Number(item.score || 0))}</Text>
        </View>
        {item.discursiveScore !== undefined && (
          <View style={styles.entryScoreRow}>
            <Text style={styles.entryScoreLabel}>Discursiva</Text>
            <Text style={styles.entryScoreValue}>{formatNumber(Number(item.discursiveScore || 0))}</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!ranking) {
    return (
      <View style={styles.screen}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Ranking nao encontrado</Text>
          <Text style={styles.emptyText}>Atualize a lista ou tente abrir outro ranking.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={entries}
        keyExtractor={(item, index) => String(item.id || `${item.userName || 'entry'}-${index}`)}
        renderItem={renderEntry}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRanking(true)}
            tintColor={colors.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Ranking publico</Text>
              <Text style={styles.title}>{ranking.name || 'Ranking sem nome'}</Text>
              <Text style={styles.description}>
                {ranking.institution || 'Instituicao nao informada'} | {formatNumber(ranking.totalQuestions)} questoes | {rankingEntries.length} participacoes.
              </Text>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Gabarito</Text>
                <Text style={styles.summaryValue}>{formatKeyStatus(ranking.keyStatus)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Discursiva</Text>
                <Text style={styles.summaryValue}>{ranking.hasDiscursive ? 'Sim' : 'Nao'}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Criado em</Text>
                <Text style={styles.summaryValue}>{formatDate(ranking.createdAt)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Divulgacao</Text>
                <Text style={styles.summaryValue}>{formatDate(ranking.officialKeyReleaseDate)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Vagas</Text>
              <View style={styles.vacancyRow}>
                <Text style={styles.vacancyLabel}>Ampla concorrencia</Text>
                <Text style={styles.vacancyValue}>{formatNumber(ranking.vacanciesAc)}</Text>
              </View>
              <View style={styles.vacancyRow}>
                <Text style={styles.vacancyLabel}>Cotas raciais</Text>
                <Text style={styles.vacancyValue}>{formatNumber(ranking.vacanciesAfro)}</Text>
              </View>
              <View style={styles.vacancyRow}>
                <Text style={styles.vacancyLabel}>PCD</Text>
                <Text style={styles.vacancyValue}>{formatNumber(ranking.vacanciesPcd)}</Text>
              </View>
              <View style={styles.vacancyRow}>
                <Text style={styles.vacancyLabel}>Cadastro reserva</Text>
                <Text style={styles.vacancyValue}>{formatNumber(ranking.reserveLimit)}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tipos de prova</Text>
              <Text style={styles.description}>
                {ranking.examTypes?.length ? ranking.examTypes.join(', ') : 'Tipo padrao'}
              </Text>
              <Pressable style={styles.secondaryAction} onPress={() => void openOfficialKey()}>
                <Text style={styles.secondaryActionText}>Abrir PDF do gabarito</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{currentUserEntry ? 'Atualizar participacao' : 'Participar do ranking'}</Text>
              <Text style={styles.description}>
                Envie seu cartao-resposta para calcular a nota objetiva e entrar nas colocacoes publicas.
              </Text>
              {!!currentUserEntry && (
                <Text style={styles.helperText}>Suas respostas anteriores foram carregadas para edicao.</Text>
              )}

              <TextInput
                value={registration}
                onChangeText={setRegistration}
                placeholder="Numero de inscricao"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <TextInput
                value={examType}
                onChangeText={setExamType}
                placeholder="Caderno ou tipo de prova"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <View style={styles.inlineChips}>
                {examTypeOptions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setExamType(option)}
                    style={[styles.chip, examType === option && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, examType === option && styles.chipTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.inlineChips}>
                {CATEGORY_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={[styles.categoryChip, category === option && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, category === option && styles.categoryChipTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {ranking.hasDiscursive && (
                <TextInput
                  value={discursiveScore}
                  onChangeText={setDiscursiveScore}
                  placeholder="Nota discursiva"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              )}

              <TextInput
                value={answers}
                onChangeText={handleAnswersChange}
                placeholder="Exemplo: ABCDEABCDE"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={questionTotal > 0 ? questionTotal : undefined}
                style={[styles.input, styles.answersInput]}
              />
              <Text style={styles.answerCounter}>
                {answers.length} / {questionTotal > 0 ? questionTotal : 'sem limite'} respostas
              </Text>

              <Pressable
                style={[styles.primaryAction, submitting && styles.buttonDisabled]}
                onPress={() => void handleSubmitAnswers()}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionText}>Enviar gabarito</Text>
                )}
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>Top colocacoes</Text>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Sem participacoes ainda</Text>
            <Text style={styles.emptyText}>As primeiras colocacoes aparecem aqui quando o ranking receber respostas.</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  headerBlock: {
    gap: 10,
  },
  heroCard: {
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
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryCard: {
    width: '48.8%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 3,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  vacancyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  vacancyLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  vacancyValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryAction: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  secondaryActionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  helperText: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
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
  answersInput: {
    letterSpacing: 0,
  },
  inlineChips: {
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
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  chipTextActive: {
    color: colors.primary,
  },
  categoryChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  categoryChipText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  answerCounter: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  primaryAction: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  entryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    flexDirection: 'row',
    gap: 12,
  },
  entryPosition: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryPositionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  entryContent: {
    flex: 1,
    gap: 5,
  },
  entryName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  entryMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  entryScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryScoreLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  entryScoreValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default RankingDetailScreen;
