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
import { colors } from '@/theme/colors';
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
 * Tela mobile de listagem de simulados.
 * @since v1.0.0
 */
export const SimulationsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
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
        <ActivityIndicator size="large" color={colors.primary} />
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
            tintColor={colors.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>Simulados</Text>
              <Text style={styles.title}>Historico de simulados</Text>
              <Text style={styles.description}>Lista sincronizada com sua conta na plataforma.</Text>
            </View>
            <Pressable
              style={styles.startButton}
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
          <Pressable style={styles.card}>
            <Text style={styles.cardTitle}>{item.name || `Simulado ${item.id}`}</Text>
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
          </Pressable>
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
  startButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 2,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
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
    fontWeight: '600',
  },
});

export default SimulationsScreen;
