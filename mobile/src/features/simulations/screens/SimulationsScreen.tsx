import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { simulationsService } from '@/services/simulations/simulationsService';
import { AppStackParamList } from '@/navigation/types';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme, type ResolvedAppTheme } from '@/theme/useAppTheme';
import type { SimulationListItem } from '@/types/simulations';

const formatDate = (rawValue: number | string | undefined): string => {
  if (rawValue === undefined || rawValue === null) return '--';

  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue > 9999999999 ? numericValue : numericValue * 1000)
    : new Date(String(rawValue));

  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
};

/**
 * Listagem de simulados no formato de feature.
 * O carregamento manual sera substituido por TanStack Query assim que o
 * upgrade da fundacao estiver consolidado no lockfile.
 */
export const SimulationsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [items, setItems] = React.useState<SimulationListItem[]>([]);

  const loadItems = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rows = await simulationsService.list();
      setItems(rows);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar simulados.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadItems(false);
  }, [loadItems]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.id || index)}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadItems(true)}
            tintColor={theme.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>Simulados</Text>
              <Text style={styles.title}>Historico de simulados</Text>
              <Text style={styles.description}>Lista sincronizada com sua conta e fallback local do app.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
              onPress={() => navigation.navigate('SimulationConfig')}
            >
              <Text style={styles.startButtonText}>Novo simulado</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem simulados no momento</Text>
            <Text style={styles.emptyText}>Quando voce iniciar simulados, eles aparecem aqui.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate('SimulationDetail', {
              simulationId: String(item.id),
            })}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{item.name || `Simulado ${item.id}`}</Text>
              {item.source === 'local' ? (
                <View style={styles.localBadge}>
                  <Text style={styles.localBadgeText}>Local</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status: </Text>
              <Text style={styles.metaValue}>{item.status || 'nao informado'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Pontuacao: </Text>
              <Text style={styles.metaValue}>{item.score ?? '--'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Atualizado: </Text>
              <Text style={styles.metaValue}>{formatDate(item.updatedAt || item.createdAt)}</Text>
            </View>
            {item.questionCount ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Questoes: </Text>
                <Text style={styles.metaValue}>{item.questionCount}</Text>
              </View>
            ) : null}
            <Text style={styles.detailHint}>Toque para abrir o detalhe</Text>
          </Pressable>
        )}
      />
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing[4],
    gap: spacing[3],
  },
  headerBlock: {
    gap: spacing[3],
  },
  headerCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    padding: spacing[4],
    backgroundColor: theme.surface,
    gap: spacing[2],
  },
  eyebrow: {
    color: theme.textMuted,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  title: {
    color: theme.text,
    fontSize: typography.size['2xl'],
    fontWeight: typography.weight.black,
  },
  description: {
    color: theme.textMuted,
    fontSize: typography.size.sm,
    lineHeight: 20,
    fontWeight: typography.weight.semibold,
  },
  startButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  startButtonPressed: {
    backgroundColor: theme.primaryPressed,
  },
  startButtonText: {
    color: theme.onPrimary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    padding: spacing[4],
    backgroundColor: theme.surface,
    gap: spacing[2],
  },
  cardPressed: {
    borderColor: theme.primaryBorder,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  cardTitle: {
    flex: 1,
    color: theme.text,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.extrabold,
  },
  localBadge: {
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    borderRadius: radius.pill,
    backgroundColor: theme.primarySubtle,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  localBadgeText: {
    color: theme.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaLabel: {
    color: theme.textMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  metaValue: {
    color: theme.text,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  detailHint: {
    color: theme.primary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.lg,
    padding: spacing[5],
    backgroundColor: theme.surface,
    alignItems: 'center',
    gap: spacing[1],
  },
  emptyTitle: {
    color: theme.text,
    fontSize: typography.size.md,
    fontWeight: typography.weight.extrabold,
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});

export default SimulationsScreen;
