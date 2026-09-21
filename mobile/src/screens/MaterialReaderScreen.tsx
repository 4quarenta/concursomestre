import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
import type { AppStackParamList } from '@/navigation/types';
import { useAuth } from '@/providers/AuthProvider';
import { getAssetUrl } from '@/services/api/client';
import { marketplaceService } from '@/services/marketplace/marketplaceService';
import { transactionsService } from '@/services/transactions/transactionsService';
import { colors } from '@/theme/colors';
import type { Material } from '@/types/materials';
import type { MobileTransaction } from '@/types/transactions';

type ReaderRoute = RouteProp<AppStackParamList, 'Reader'>;
type ReaderNavigation = NativeStackNavigationProp<AppStackParamList, 'Reader'>;

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

const resolveReaderAccess = (
  material: Material | null,
  transactions: MobileTransaction[],
  userId?: string | number,
  role?: string,
  isAdmin?: boolean,
): boolean => {
  if (!material || !userId) return false;

  const normalizedUserId = String(userId);
  const authorId = String(material.authorId || '');
  const userIsAdmin = Boolean(isAdmin || role === 'admin');

  const hasTransaction = transactions.some((transaction) => (
    getTransactionMaterialId(transaction) === String(material.id)
    && (!getTransactionBuyerId(transaction) || getTransactionBuyerId(transaction) === normalizedUserId)
    && isApprovedTransaction(transaction)
  ));

  return userIsAdmin || authorId === normalizedUserId || hasTransaction;
};

/**
 * Leitor mobile de material com gate de acesso por compra/autor/admin.
 * @since v1.0.0
 */
export const MaterialReaderScreen: React.FC = () => {
  const route = useRoute<ReaderRoute>();
  const navigation = useNavigation<ReaderNavigation>();
  const { user } = useAuth();
  const { materialId } = route.params;
  const [material, setMaterial] = React.useState<Material | null>(null);
  const [transactions, setTransactions] = React.useState<MobileTransaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [opening, setOpening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadReaderContext = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [nextMaterial, nextTransactions] = await Promise.all([
        marketplaceService.getMaterialById(materialId),
        user?.id
          ? transactionsService.list({ userId: String(user.id), scope: 'buyer', limit: 100 })
          : Promise.resolve([]),
      ]);

      if (!nextMaterial) {
        setError('Material nao encontrado.');
      } else {
        setError(null);
      }

      setMaterial(nextMaterial || null);
      setTransactions(nextTransactions);
    } catch (loadError: any) {
      setError(loadError?.message || 'Nao foi possivel carregar o leitor agora.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [materialId, user?.id]);

  React.useEffect(() => {
    void loadReaderContext(false);
  }, [loadReaderContext]);

  const hasAccess = React.useMemo(
    () => resolveReaderAccess(material, transactions, user?.id, user?.role, user?.isAdmin),
    [material, transactions, user?.id, user?.isAdmin, user?.role],
  );

  const assetUrl = React.useMemo(
    () => getAssetUrl(material?.fileUrl || ''),
    [material?.fileUrl],
  );

  const openReader = async () => {
    if (!material) {
      Alert.alert('Material indisponivel', 'Nao foi possivel carregar os dados do material.');
      return;
    }

    if (!assetUrl) {
      Alert.alert('Arquivo indisponivel', 'O arquivo deste material nao esta disponivel no momento.');
      return;
    }

    if (!hasAccess) {
      Alert.alert('Acesso pendente', 'Compre o material para liberar o leitor.');
      return;
    }

    setOpening(true);
    try {
      const canOpen = await Linking.canOpenURL(assetUrl);
      if (!canOpen) {
        Alert.alert('Leitor indisponivel', 'O dispositivo nao conseguiu abrir este arquivo.');
        return;
      }

      await Linking.openURL(assetUrl);
    } finally {
      setOpening(false);
    }
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
          <Text style={styles.errorTitle}>Leitor indisponivel</Text>
          <Text style={styles.errorText}>{error || 'Nao foi possivel abrir este material.'}</Text>
          <Pressable style={styles.primaryButton} onPress={() => void loadReaderContext(true)}>
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadReaderContext(true)}
          tintColor={colors.primary}
        />
      )}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Leitor</Text>
        <Text style={styles.heroTitle}>{material.title || 'Material'}</Text>
        <Text style={styles.heroText}>
          Fluxo de leitura protegido por compra, autor ou permissao administrativa.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Status de acesso</Text>
        <Text style={styles.statusValue}>
          {hasAccess ? 'Acesso liberado' : 'Aguardando compra'}
        </Text>
        <Text style={styles.statusHint}>
          {hasAccess
            ? 'Seu acesso foi validado. O arquivo abre no leitor externo do dispositivo.'
            : 'Compre o material para liberar o leitor.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Dados do arquivo</Text>
        <Text style={styles.metaText}>Tipo: {material.type || 'Material'}</Text>
        <Text style={styles.metaText}>Materia: {material.subject || material.subjectText || 'Nao informada'}</Text>
        <Text style={styles.metaText}>Arquivo: {assetUrl ? 'Disponivel' : 'Nao disponivel'}</Text>
        {!!material.pdfPassword && (
          <Text style={styles.metaText}>PDF protegido por senha</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => void openReader()}
          disabled={opening || !hasAccess || !assetUrl}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && !opening && hasAccess && !!assetUrl && styles.primaryButtonPressed,
            (opening || !hasAccess || !assetUrl) && styles.disabledButton,
          ]}
        >
          {opening ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Abrir arquivo</Text>
          )}
        </Pressable>

        {!hasAccess ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('MaterialDetail', { materialId: String(material.id), material })}
          >
            <Text style={styles.secondaryButtonText}>Ir para compra</Text>
          </Pressable>
        ) : null}
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
    gap: 10,
    paddingBottom: 24,
  },
  loaderContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    padding: 14,
    gap: 6,
  },
  heroEyebrow: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  statusCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  statusValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  statusHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 14,
    gap: 6,
  },
  metaText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
});

export default MaterialReaderScreen;
