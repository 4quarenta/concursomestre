import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList, MainTabParamList } from '@/navigation/types';
import { marketplaceService } from '@/services/marketplace/marketplaceService';
import { colors } from '@/theme/colors';
import type { Material } from '@/types/materials';

type MarketplaceNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Marketplace'>,
  NativeStackNavigationProp<AppStackParamList>
>;

const formatCurrency = (value: number | string | undefined): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
};

const normalizeText = (value?: string): string => {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const formatDate = (rawValue: Material['createdAt']): string => {
  if (!rawValue) return '--';

  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue > 9999999999 ? numericValue : numericValue * 1000)
    : new Date(String(rawValue));

  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR');
};

const isRemoteImageUrl = (url?: string): boolean => {
  return Boolean(url && /^https?:\/\//i.test(url));
};

/**
 * Tela mobile de vitrine do marketplace.
 * @since v1.0.0
 */
export const MarketplaceScreen: React.FC = () => {
  const navigation = useNavigation<MarketplaceNavigation>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [materials, setMaterials] = React.useState<Material[]>([]);
  const [query, setQuery] = React.useState('');
  const [subjectDraft, setSubjectDraft] = React.useState('');
  const [subjectFilter, setSubjectFilter] = React.useState('');
  const [purchasingId, setPurchasingId] = React.useState<string | null>(null);

  const loadMaterials = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rows = await marketplaceService.listMaterials(
        subjectFilter ? { subject: subjectFilter } : {},
      );
      setMaterials(rows);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar materiais.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [subjectFilter]);

  React.useEffect(() => {
    void loadMaterials(false);
  }, [loadMaterials]);

  const visibleMaterials = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return materials;

    return materials.filter((material) => {
      const haystack = [
        material.title,
        material.description,
        material.subject,
        material.type,
        material.authorName,
      ].map((value) => String(value || '').toLowerCase()).join(' ');

      return haystack.includes(needle);
    });
  }, [materials, query]);

  const handleApplyFilters = () => {
    setSubjectFilter(subjectDraft.trim());
  };

  const handleClearFilters = () => {
    setQuery('');
    setSubjectDraft('');
    setSubjectFilter('');
  };

  const confirmPurchase = async (material: Material) => {
    if (!material.id) {
      Alert.alert('Material invalido', 'Nao foi possivel identificar este material.');
      return;
    }

    const materialKey = String(material.id);
    setPurchasingId(materialKey);

    try {
      const result = await marketplaceService.createMaterialPurchase(material.id);
      Alert.alert(
        'Compra registrada',
        result.transactionId
          ? `Transacao ${result.transactionId} criada com sucesso.`
          : 'A compra foi registrada pela plataforma.',
      );
    } catch (error: any) {
      Alert.alert('Erro na compra', error?.message || 'Nao foi possivel comprar este material.');
    } finally {
      setPurchasingId(null);
    }
  };

  const handlePurchase = (material: Material) => {
    Alert.alert(
      'Comprar material',
      `Confirmar compra de ${material.title || 'material selecionado'} por ${formatCurrency(material.price)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Comprar', onPress: () => void confirmPurchase(material) },
      ],
    );
  };

  const handleOpenDetail = (material: Material) => {
    if (!material.id) {
      Alert.alert('Material invalido', 'Nao foi possivel identificar este material.');
      return;
    }

    navigation.navigate('MaterialDetail', {
      materialId: String(material.id),
      material,
    });
  };

  const renderMaterial = ({ item }: { item: Material }) => {
    const materialKey = String(item.id);
    const isPurchasing = purchasingId === materialKey;
    const description = normalizeText(item.description);
    const coverUrl = isRemoteImageUrl(item.coverUrl) ? item.coverUrl : undefined;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>
                {(item.title || 'M').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle}>{item.title || 'Material sem titulo'}</Text>
            <Text style={styles.cardSubtitle}>
              {[item.type || 'Material', item.subject].filter(Boolean).join(' | ')}
            </Text>
          </View>
        </View>

        {!!description && (
          <Text style={styles.description} numberOfLines={3}>{description}</Text>
        )}

        <View style={styles.metaGrid}>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Preco</Text>
            <Text style={styles.metaValue}>{formatCurrency(item.price)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Avaliacao</Text>
            <Text style={styles.metaValue}>{Number(item.rating || 0).toFixed(1)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Vendas</Text>
            <Text style={styles.metaValue}>{item.salesCount ?? 0}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Publicado</Text>
            <Text style={styles.metaValue}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {!!item.authorName && (
          <Text style={styles.authorText}>Autor: {item.authorName}</Text>
        )}

        <View style={styles.cardActions}>
          <Pressable
            onPress={() => handleOpenDetail(item)}
            style={({ pressed }) => [
              styles.detailButton,
              pressed && styles.detailButtonPressed,
            ]}
          >
            <Text style={styles.detailButtonText}>Detalhes</Text>
          </Pressable>
          <Pressable
            onPress={() => handlePurchase(item)}
            disabled={isPurchasing}
            style={({ pressed }) => [
              styles.purchaseButton,
              pressed && !isPurchasing && styles.purchaseButtonPressed,
              isPurchasing && styles.purchaseButtonDisabled,
            ]}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.purchaseButtonText}>Comprar</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

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
        data={visibleMaterials}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderMaterial}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMaterials(true)}
            tintColor={colors.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>Marketplace</Text>
              <Text style={styles.title}>Materiais para estudar</Text>
              <Text style={styles.headerText}>Vitrine sincronizada com a plataforma.</Text>
            </View>

            <View style={styles.filtersCard}>
              <Text style={styles.filtersTitle}>Filtros</Text>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar por titulo, autor ou tipo"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={subjectDraft}
                onChangeText={setSubjectDraft}
                placeholder="Materia"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <View style={styles.filtersActions}>
                <Pressable onPress={handleApplyFilters} style={styles.applyButton}>
                  <Text style={styles.applyButtonText}>Aplicar</Text>
                </Pressable>
                <Pressable onPress={handleClearFilters} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Limpar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhum material encontrado</Text>
            <Text style={styles.emptyText}>Ajuste os filtros ou tente atualizar a vitrine.</Text>
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
  headerText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  filtersCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
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
  filtersActions: {
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
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clearButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  clearButtonText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  coverImage: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  coverPlaceholder: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  cardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    minWidth: '47%',
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 2,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  authorText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonPressed: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  detailButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  purchaseButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  purchaseButtonDisabled: {
    opacity: 0.65,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    textAlign: 'center',
  },
});

export default MarketplaceScreen;
