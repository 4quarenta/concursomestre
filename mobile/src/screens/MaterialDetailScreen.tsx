import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { getAssetUrl } from '@/services/api/client';
import { marketplaceService } from '@/services/marketplace/marketplaceService';
import { transactionsService } from '@/services/transactions/transactionsService';
import { colors } from '@/theme/colors';
import type { Material } from '@/types/materials';
import type { MobileTransaction } from '@/types/transactions';

type MaterialDetailRoute = RouteProp<AppStackParamList, 'MaterialDetail'>;
type MaterialDetailNavigation = NativeStackNavigationProp<AppStackParamList, 'MaterialDetail'>;

const formatCurrency = (value: number | string | undefined): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
};

const normalizeText = (value?: string): string => {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const isRemoteImageUrl = (url?: string): boolean => Boolean(url && /^https?:\/\//i.test(url));

const getTransactionMaterialId = (transaction: MobileTransaction): string => (
  String(transaction.materialId ?? transaction.material_id ?? '').trim()
);

const getTransactionBuyerId = (transaction: MobileTransaction): string => (
  String(transaction.buyerId ?? transaction.buyer_id ?? '').trim()
);

const isApprovedTransaction = (transaction: MobileTransaction): boolean => {
  const status = String(transaction.status || '').toLowerCase();
  return status === 'completed' || status === 'approved' || status === 'paid';
};

/**
 * Detalhe mobile de material do marketplace.
 * A tela reutiliza a vitrine oficial, confirma acesso por transacao/autor/admin e abre o arquivo em visualizador externo.
 * @since v1.0.0
 */
export const MaterialDetailScreen: React.FC = () => {
  const route = useRoute<MaterialDetailRoute>();
  const navigation = useNavigation<MaterialDetailNavigation>();
  const { user } = useAuth();
  const { materialId, material: routeMaterial } = route.params;
  const [material, setMaterial] = React.useState<Material | null>(routeMaterial || null);
  const [transactions, setTransactions] = React.useState<MobileTransaction[]>([]);
  const [loading, setLoading] = React.useState(!routeMaterial);
  const [refreshing, setRefreshing] = React.useState(false);
  const [purchasing, setPurchasing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextMaterial, nextTransactions] = await Promise.all([
        marketplaceService.getMaterialById(materialId),
        user?.id ? transactionsService.list({ userId: user.id, scope: 'buyer', limit: 100 }) : Promise.resolve([]),
      ]);

      setMaterial(nextMaterial || routeMaterial || null);
      setTransactions(nextTransactions);
      setError(nextMaterial || routeMaterial ? null : 'Material nao encontrado.');
    } catch (loadError: any) {
      setError(loadError?.message || 'Nao foi possivel carregar este material.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [materialId, routeMaterial, user?.id]);

  React.useEffect(() => {
    void loadDetail(false);
  }, [loadDetail]);

  const hasReaderAccess = React.useMemo(() => {
    if (!material || !user) return false;

    const isAuthor = String(material.authorId || '') === String(user.id);
    const isAdmin = Boolean(user.isAdmin || user.role === 'admin');
    const hasTransaction = transactions.some((transaction) => {
      const transactionMaterialId = getTransactionMaterialId(transaction);
      const transactionBuyerId = getTransactionBuyerId(transaction);

      return transactionMaterialId === String(material.id)
        && (!transactionBuyerId || transactionBuyerId === String(user.id))
        && isApprovedTransaction(transaction);
    });

    return isAuthor || isAdmin || hasTransaction;
  }, [material, transactions, user]);

  const handlePurchase = async () => {
    if (!material?.id) {
      Alert.alert('Material invalido', 'Nao foi possivel identificar este material.');
      return;
    }

    setPurchasing(true);
    try {
      const result = await marketplaceService.createMaterialPurchase(material.id);
      Alert.alert(
        'Compra registrada',
        result.transactionId
          ? `Transacao ${result.transactionId} criada com sucesso.`
          : 'A compra foi registrada pela plataforma.',
      );
      await loadDetail(true);
    } catch (purchaseError: any) {
      Alert.alert('Erro na compra', purchaseError?.message || 'Nao foi possivel comprar este material.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleOpenMaterial = async () => {
    const fileUrl = getAssetUrl(material?.fileUrl || '');
    if (!fileUrl) {
      Alert.alert('Arquivo indisponivel', 'O arquivo deste material nao esta disponivel.');
      return;
    }

    if (!hasReaderAccess) {
      Alert.alert('Acesso pendente', 'Compre o material para liberar a abertura do arquivo.');
      return;
    }

    const canOpen = await Linking.canOpenURL(fileUrl);
    if (!canOpen) {
      Alert.alert('Nao foi possivel abrir', 'O dispositivo nao reconheceu a URL deste arquivo.');
      return;
    }

    await Linking.openURL(fileUrl);
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !material) {
    return (
      <View style={styles.loaderContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Material indisponivel</Text>
          <Text style={styles.errorText}>{error || 'O material solicitado nao esta disponivel agora.'}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadDetail(true)}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const description = normalizeText(material.description || material.details);
  const coverUrl = isRemoteImageUrl(material.coverUrl) ? material.coverUrl : undefined;
  const subjectLabel = material.subject || material.subjectText || 'Materia nao informada';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDetail(true)}
          tintColor={colors.primary}
        />
      )}
    >
      <View style={styles.heroCard}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>{(material.title || 'M').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.heroTextBlock}>
          <Text style={styles.eyebrow}>Material publico</Text>
          <Text style={styles.title}>{material.title || 'Material sem titulo'}</Text>
          <Text style={styles.subtitle}>{[material.type || 'Material', subjectLabel].filter(Boolean).join(' | ')}</Text>
        </View>
      </View>

      <View style={styles.priceCard}>
        <View>
          <Text style={styles.priceLabel}>Preco</Text>
          <Text style={styles.priceValue}>{formatCurrency(material.price)}</Text>
        </View>
        <View style={[styles.accessPill, hasReaderAccess && styles.accessPillActive]}>
          <Text style={[styles.accessText, hasReaderAccess && styles.accessTextActive]}>
            {hasReaderAccess ? 'Liberado' : 'Aguardando compra'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Descricao</Text>
        <Text style={styles.description}>{description || 'Sem descricao adicional.'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <View style={styles.metaGrid}>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Materia</Text>
            <Text style={styles.metaValue}>{subjectLabel}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Topico</Text>
            <Text style={styles.metaValue}>{material.topic || 'Nao informado'}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Autor</Text>
            <Text style={styles.metaValue}>{material.authorName || 'Nao informado'}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Avaliacao</Text>
            <Text style={styles.metaValue}>{Number(material.rating || 0).toFixed(1)}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Vendas</Text>
            <Text style={styles.metaValue}>{material.salesCount ?? 0}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaLabel}>Arquivo</Text>
            <Text style={styles.metaValue}>{material.fileUrl ? 'Disponivel' : 'Pendente'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={hasReaderAccess
            ? () => navigation.navigate('Reader', { materialId: String(material.id) })
            : handlePurchase}
          disabled={purchasing}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !purchasing && styles.primaryButtonPressed,
            purchasing && styles.disabledButton,
          ]}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {hasReaderAccess ? 'Abrir no leitor' : 'Comprar material'}
            </Text>
          )}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleOpenMaterial}>
          <Text style={styles.secondaryButtonText}>
            {hasReaderAccess ? 'Abrir direto' : 'Verificar acesso'}
          </Text>
        </Pressable>
      </View>
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
    paddingBottom: 24,
    gap: 10,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  coverImage: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  coverPlaceholder: {
    width: 82,
    height: 82,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '900',
  },
  heroTextBlock: {
    flex: 1,
    gap: 5,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  priceCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  priceLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  priceValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  accessPill: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  accessPillActive: {
    borderColor: colors.success,
    backgroundColor: '#ECFDF5',
  },
  accessText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  accessTextActive: {
    color: colors.success,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
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
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  actions: {
    gap: 8,
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  secondaryButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  disabledButton: {
    opacity: 0.65,
  },
  errorCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    padding: 16,
    gap: 8,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '900',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  retryButton: {
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

export default MaterialDetailScreen;
