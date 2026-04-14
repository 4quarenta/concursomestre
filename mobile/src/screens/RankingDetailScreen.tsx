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
  View,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { AppStackParamList } from '@/navigation/types';
import { rankingsService } from '@/services/rankings/rankingsService';
import { colors } from '@/theme/colors';
import type { RankingEntry, RankingListItem } from '@/types/rankings';

type RankingDetailRoute = RouteProp<AppStackParamList, 'RankingDetail'>;

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
 * Detalhe mobile de ranking publico.
 * @since v1.0.0
 */
export const RankingDetailScreen: React.FC = () => {
  const route = useRoute<RankingDetailRoute>();
  const { rankingId } = route.params;
  const [ranking, setRanking] = React.useState<RankingListItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const entries = React.useMemo(() => sortRankingEntries(ranking?.entries).slice(0, 50), [ranking?.entries]);

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

  const openOfficialKey = async () => {
    const target = ranking?.officialKeyPdfUrl || ranking?.preliminaryKeyPdfUrl;
    if (!target || !/^https?:\/\//i.test(target)) {
      Alert.alert('Gabarito indisponivel', 'Este ranking ainda nao possui PDF de gabarito para abrir.');
      return;
    }

    await Linking.openURL(target);
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
                {ranking.institution || 'Instituicao nao informada'} | {formatNumber(ranking.totalQuestions)} questoes | {entries.length} participacoes.
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
