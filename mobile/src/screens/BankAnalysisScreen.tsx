import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ModulePlaceholderScreen } from '@/screens/ModulePlaceholderScreen';
import { questionService } from '@/services/questions/questionService';
import { bankAnalysisService } from '@/services/bank-analysis/bankAnalysisService';
import { useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme/colors';
import type { Question } from '@/types/questions';
import type { BankXrayPayload } from '@/types/bankAnalysis';

const getEntityLabel = (item?: { nome?: string; sigla?: string }): string => (
  String(item?.sigla || item?.nome || '').trim()
);

const getRoleLabel = (item?: { descricao?: string; nome?: string }): string => (
  String(item?.descricao || item?.nome || '').trim()
);

const getQuestionYear = (question: Question): string => {
  const value = Array.isArray(question.anos) && question.anos.length > 0 ? question.anos[0] : '';
  return String(value || '').trim();
};

const EMPTY_STATS: BankXrayPayload = {
  total: 0,
  textStyle: '',
  contextUsage: 0,
  difficultyData: [],
  subjectData: [],
  detailedBreakdown: [],
  examList: [],
  recommendation: '',
};

/**
 * Raio-X da banca no mobile.
 * @since v1.0.0
 */
export const BankAnalysisScreen: React.FC = () => {
  const { isFeatureEnabled } = useAuth();
  const canAccessXray = isFeatureEnabled('xRayEnabled');
  const [questionPool, setQuestionPool] = React.useState<Question[]>([]);
  const [loadingPool, setLoadingPool] = React.useState(true);
  const [selectedAgency, setSelectedAgency] = React.useState('');
  const [selectedRole, setSelectedRole] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState('all');
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [stats, setStats] = React.useState<BankXrayPayload>(EMPTY_STATS);
  const [hasStats, setHasStats] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canAccessXray) {
      setLoadingPool(false);
      return;
    }

    let mounted = true;
    const loadPool = async () => {
      try {
        const { rows } = await questionService.getQuestionPage({
          page: 1,
          limit: 300,
        });
        if (!mounted) return;
        setQuestionPool(rows);
      } catch {
        if (!mounted) return;
        setQuestionPool([]);
      } finally {
        if (mounted) setLoadingPool(false);
      }
    };

    void loadPool();

    return () => {
      mounted = false;
    };
  }, [canAccessXray]);

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

  const yearOptions = React.useMemo(() => {
    const values = new Set<string>();
    questionPool.forEach((question) => {
      const year = getQuestionYear(question);
      if (year) values.add(year);
    });

    return Array.from(values).sort((left, right) => Number(right) - Number(left));
  }, [questionPool]);

  const runAnalysis = async () => {
    const banca = selectedAgency.trim();
    if (!banca) {
      Alert.alert('Banca obrigatoria', 'Selecione ou informe a banca para iniciar o Raio-X.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const payload = await bankAnalysisService.getXrayStats({
        banca,
        cargo: selectedRole.trim() || undefined,
        ano: selectedYear !== 'all' ? selectedYear : undefined,
      });
      setStats(payload);
      setHasStats(true);
    } catch (loadError: any) {
      setHasStats(false);
      setStats(EMPTY_STATS);
      setError(loadError?.message || 'Nao foi possivel carregar o Raio-X da banca agora.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!canAccessXray) {
    return (
      <ModulePlaceholderScreen
        title="Raio-X da banca"
        cardTitle="Modulo indisponivel"
        description="O modulo Raio-X da banca esta desativado no momento para o seu perfil."
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Raio-X da banca</Text>
        <Text style={styles.title}>Inteligencia da prova</Text>
        <Text style={styles.description}>
          Analise tendencias de conteudo por banca para orientar revisao e priorizacao de estudo.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Filtros</Text>
          {loadingPool ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>

        <Text style={styles.inputLabel}>Banca</Text>
        <TextInput
          value={selectedAgency}
          onChangeText={setSelectedAgency}
          placeholder="Ex.: FGV, Cebraspe, FCC"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        {agencyOptions.length > 0 ? (
          <View style={styles.optionsRow}>
            {agencyOptions.slice(0, 24).map((agency) => {
              const selected = selectedAgency === agency;
              return (
                <Pressable
                  key={agency}
                  onPress={() => setSelectedAgency(agency)}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                    {agency}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Cargo (opcional)</Text>
        <TextInput
          value={selectedRole}
          onChangeText={setSelectedRole}
          placeholder="Ex.: Analista, Tecnico"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        {roleOptions.length > 0 ? (
          <View style={styles.optionsRow}>
            <Pressable
              onPress={() => setSelectedRole('')}
              style={[styles.optionChip, selectedRole === '' && styles.optionChipActive]}
            >
              <Text style={[styles.optionChipText, selectedRole === '' && styles.optionChipTextActive]}>
                Todos os cargos
              </Text>
            </Pressable>
            {roleOptions.slice(0, 20).map((role) => {
              const selected = selectedRole === role;
              return (
                <Pressable
                  key={role}
                  onPress={() => setSelectedRole(role)}
                  style={[styles.optionChip, selected && styles.optionChipActive]}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                    {role}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.inputLabel}>Periodo</Text>
        <View style={styles.optionsRow}>
          <Pressable
            onPress={() => setSelectedYear('all')}
            style={[styles.optionChip, selectedYear === 'all' && styles.optionChipActive]}
          >
            <Text style={[styles.optionChipText, selectedYear === 'all' && styles.optionChipTextActive]}>
              Todo o periodo
            </Text>
          </Pressable>
          {yearOptions.slice(0, 12).map((year) => {
            const selected = selectedYear === year;
            return (
              <Pressable
                key={year}
                onPress={() => setSelectedYear(year)}
                style={[styles.optionChip, selected && styles.optionChipActive]}
              >
                <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>
                  {year}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.mainButton, isAnalyzing && styles.mainButtonDisabled]}
          onPress={() => void runAnalysis()}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.mainButtonText}>Analisar banca</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {hasStats ? (
        <>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Questoes analisadas</Text>
              <Text style={styles.kpiValue}>{stats.total}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Contextualizacao</Text>
              <Text style={styles.kpiValue}>{stats.contextUsage}%</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Estilo dominante</Text>
              <Text style={styles.kpiMeta}>{stats.textStyle || '--'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Distribuicao por materia</Text>
            {stats.subjectData.length === 0 ? (
              <Text style={styles.emptyText}>Sem distribuicao por materia para esse filtro.</Text>
            ) : (
              <View style={styles.listBlock}>
                {stats.subjectData.map((row, index) => {
                  const percent = stats.total > 0 ? Math.round((row.value / stats.total) * 100) : 0;
                  return (
                    <View key={`${row.name}-${index}`} style={styles.rowItem}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowLabel}>{row.name}</Text>
                        <Text style={styles.rowValue}>{row.value} ({percent}%)</Text>
                      </View>
                      <View style={styles.rowTrack}>
                        <View style={[styles.rowFill, { width: `${Math.max(2, percent)}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nivel de dificuldade</Text>
            {stats.difficultyData.length === 0 ? (
              <Text style={styles.emptyText}>Sem distribuicao de dificuldade para esse filtro.</Text>
            ) : (
              <View style={styles.listBlock}>
                {stats.difficultyData.map((row, index) => {
                  const base = Math.max(...stats.difficultyData.map((item) => Number(item.value || 0)), 1);
                  const percent = Math.round((Number(row.value || 0) / base) * 100);
                  return (
                    <View key={`${row.name}-${index}`} style={styles.rowItem}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowLabel}>{row.name}</Text>
                        <Text style={styles.rowValue}>{row.value}</Text>
                      </View>
                      <View style={styles.rowTrack}>
                        <View style={[styles.rowFillSecondary, { width: `${Math.max(2, percent)}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Raio-X tematico</Text>
            {stats.detailedBreakdown.length === 0 ? (
              <Text style={styles.emptyText}>Sem detalhamento por topico para esse filtro.</Text>
            ) : (
              <View style={styles.listBlock}>
                {stats.detailedBreakdown.map((subject) => (
                  <View key={subject.subject} style={styles.subjectCard}>
                    <View style={styles.subjectHeader}>
                      <Text style={styles.subjectTitle}>{subject.subject}</Text>
                      <Text style={styles.subjectMeta}>{subject.total} questoes ({subject.percent}%)</Text>
                    </View>
                    {(subject.topics || []).slice(0, 8).map((topic) => (
                      <View key={`${subject.subject}-${topic.topic}`} style={styles.topicRow}>
                        <Text style={styles.topicLabel}>{topic.topic}</Text>
                        <Text style={styles.topicValue}>{topic.percent}%</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>

          {(stats.examList || []).length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Historico de provas</Text>
              <View style={styles.listBlock}>
                {stats.examList.slice(0, 24).map((exam) => (
                  <View key={String(exam.id)} style={styles.examRow}>
                    <Text style={styles.examYear}>{exam.year}</Text>
                    <Text style={styles.examName}>{exam.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {stats.recommendation ? (
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>Recomendacao estrategica</Text>
              <Text style={styles.recommendationText}>{stats.recommendation}</Text>
            </View>
          ) : null}
        </>
      ) : null}
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
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
    padding: 14,
    gap: 6,
  },
  eyebrow: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: '#78350F',
    fontSize: 22,
    fontWeight: '900',
  },
  description: {
    color: '#92400E',
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  inputLabel: {
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
  mainButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  mainButtonDisabled: {
    opacity: 0.7,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    minWidth: '31%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
    gap: 4,
  },
  kpiLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  kpiValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  kpiMeta: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  listBlock: {
    gap: 10,
  },
  rowItem: {
    gap: 5,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rowValue: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  rowTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  rowFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  rowFillSecondary: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 999,
  },
  subjectCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  subjectTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  subjectMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  topicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  topicLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  topicValue: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  examRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  examYear: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    minWidth: 40,
  },
  examName: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  recommendationCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    padding: 14,
    gap: 8,
  },
  recommendationTitle: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  recommendationText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
});

export default BankAnalysisScreen;
