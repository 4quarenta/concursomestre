import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSimulationsQuery } from '@/features/simulations/api/useSimulationsQuery';
import { useSimulationRunStore } from '@/state/simulationRunStore';
import { radius, spacing, typography } from '@/theme/tokens';
import { useAppTheme, type ResolvedAppTheme } from '@/theme/useAppTheme';

const formatDate = (rawValue: number | string | undefined): string => {
  if (rawValue === undefined || rawValue === null) return '--';

  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue > 9999999999 ? numericValue : numericValue * 1000)
    : new Date(String(rawValue));

  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
};

export const SimulationsScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const simulationsQuery = useSimulationsQuery();
  const activeSeed = useSimulationRunStore((state) => state.seed);
  const activeAnswers = useSimulationRunStore((state) => state.answers);
  const items = simulationsQuery.data ?? [];
  const activeAnsweredCount = Object.keys(activeAnswers).length;

  if (simulationsQuery.isPending) {
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
            refreshing={simulationsQuery.isRefetching}
            onRefresh={() => void simulationsQuery.refetch()}
            tintColor={theme.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>Simulados</Text>
              <Text style={styles.title}>Historico de simulados</Text>
              <Text style={styles.description}>Tentativas sincronizadas com sua conta e cache local do app.</Text>
            </View>

            {activeSeed ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/SimulationRun')}
                style={({ pressed }) => [styles.resumeCard, pressed && styles.cardPressed]}
              >
                <View style={styles.resumeText}>
                  <Text style={styles.resumeEyebrow}>Em andamento</Text>
                  <Text style={styles.resumeTitle}>Continuar simulado</Text>
                  <Text style={styles.resumeDescription}>
                    {activeAnsweredCount} de {activeSeed.questions.length} questoes respondidas
                  </Text>
                </View>
                <Text style={styles.resumeAction}>Continuar</Text>
              </Pressable>
            ) : null}

            {simulationsQuery.isError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Nao foi possivel atualizar o historico</Text>
                <Text style={styles.errorText}>
                  {simulationsQuery.error instanceof Error
                    ? simulationsQuery.error.message
                    : 'Tente novamente em instantes.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.retryButton, pressed && styles.startButtonPressed]}
                  onPress={() => void simulationsQuery.refetch()}
                >
                  <Text style={styles.startButtonText}>Tentar novamente</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
              onPress={() => router.push('/simulados/novo')}
            >
              <Text style={styles.startButtonText}>Novo simulado</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={simulationsQuery.isError ? null : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem simulados no momento</Text>
            <Text style={styles.emptyText}>Quando voce iniciar simulados, eles aparecem aqui.</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push({
              pathname: '/simulados/historico/[simulationId]',
              params: { simulationId: String(item.id) },
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
  screen: { flex: 1, backgroundColor: theme.background },
  loaderContainer: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing[4], gap: spacing[3] },
  headerBlock: { gap: spacing[3] },
  headerCard: { borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, padding: spacing[4], backgroundColor: theme.surface, gap: spacing[2] },
  eyebrow: { color: theme.textMuted, fontSize: typography.size.xs, fontWeight: typography.weight.extrabold, textTransform: 'uppercase', letterSpacing: 0.7 },
  title: { color: theme.text, fontSize: typography.size['2xl'], fontWeight: typography.weight.black },
  description: { color: theme.textMuted, fontSize: typography.size.sm, lineHeight: 20, fontWeight: typography.weight.semibold },
  resumeCard: { alignItems: 'center', backgroundColor: theme.primarySubtle, borderColor: theme.primaryBorder, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing[3], justifyContent: 'space-between', padding: spacing[4] },
  resumeText: { flex: 1, gap: spacing[1] },
  resumeEyebrow: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.bold, textTransform: 'uppercase' },
  resumeTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.extrabold },
  resumeDescription: { color: theme.textMuted, fontSize: typography.size.xs },
  resumeAction: { color: theme.primary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  startButton: { minHeight: 48, borderRadius: radius.lg, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[4] },
  retryButton: { minHeight: 44, borderRadius: radius.lg, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[4], alignSelf: 'flex-start' },
  startButtonPressed: { backgroundColor: theme.primaryPressed },
  startButtonText: { color: theme.onPrimary, fontSize: typography.size.sm, fontWeight: typography.weight.bold },
  card: { borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, padding: spacing[4], backgroundColor: theme.surface, gap: spacing[2] },
  cardPressed: { borderColor: theme.primaryBorder },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  cardTitle: { flex: 1, color: theme.text, fontSize: typography.size.lg, fontWeight: typography.weight.extrabold },
  localBadge: { borderWidth: 1, borderColor: theme.primaryBorder, borderRadius: radius.pill, backgroundColor: theme.primarySubtle, paddingHorizontal: spacing[2], paddingVertical: spacing[1] },
  localBadgeText: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaLabel: { color: theme.textMuted, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  metaValue: { color: theme.text, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  detailHint: { color: theme.primary, fontSize: typography.size.xs, fontWeight: typography.weight.bold },
  emptyCard: { borderWidth: 1, borderColor: theme.border, borderRadius: radius.lg, padding: spacing[5], backgroundColor: theme.surface, alignItems: 'center', gap: spacing[1] },
  emptyTitle: { color: theme.text, fontSize: typography.size.md, fontWeight: typography.weight.extrabold },
  emptyText: { color: theme.textMuted, fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  errorCard: { borderWidth: 1, borderColor: theme.dangerBorder, borderRadius: radius.lg, padding: spacing[4], backgroundColor: theme.dangerSubtle, gap: spacing[2] },
  errorTitle: { color: theme.danger, fontSize: typography.size.md, fontWeight: typography.weight.extrabold },
  errorText: { color: theme.text, fontSize: typography.size.sm, lineHeight: 20 },
});

export default SimulationsScreen;
