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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppStackParamList, MainTabParamList } from '@/navigation/types';
import { notificationService } from '@/services/notifications/notificationService';
import { colors } from '@/theme/colors';
import type { MobileNotification } from '@/types/notifications';

type NotificationsNavigation = NativeStackNavigationProp<AppStackParamList, 'Notifications'>;
type MainTabRoute = keyof MainTabParamList;
type AppStackRoute = keyof Pick<AppStackParamList, 'BankAnalysis' | 'Support' | 'Concursos'>;

const parseDate = (rawValue?: number | string): Date | null => {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  const numericValue = Number(rawValue);
  const date = Number.isFinite(numericValue) && numericValue > 0
    ? new Date(numericValue > 9999999999 ? numericValue : numericValue * 1000)
    : new Date(String(rawValue));

  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateTime = (rawValue?: number | string): string => {
  const date = parseDate(rawValue);
  if (!date) return '--';
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

const normalizeTargetPath = (target?: string): string => {
  const rawTarget = String(target || '').trim();
  if (!rawTarget) return '';

  try {
    const url = new URL(rawTarget);
    return (url.pathname || `/${url.host || ''}`).toLowerCase();
  } catch {
    return rawTarget.toLowerCase();
  }
};

const resolveMainTabTarget = (target?: string): MainTabRoute | null => {
  const path = normalizeTargetPath(target);
  if (!path) return null;

  if (path.includes('quest') || path.includes('practice')) return 'Questoes';
  if (path.includes('simulado')) return 'Simulados';
  if (path.includes('ranking')) return 'Ranking';
  if (path.includes('plano') || path.includes('checkout') || path.includes('assinatura')) return 'Planos';
  if (path.includes('marketplace') || path.includes('materiais') || path.includes('material')) return 'Marketplace';
  if (path.includes('perfil') || path.includes('profile')) return 'Perfil';
  if (path.includes('dashboard') || path === '/' || path === '') return 'Dashboard';

  return null;
};

const resolveStackTarget = (target?: string): AppStackRoute | null => {
  const path = normalizeTargetPath(target);
  if (!path) return null;

  if (path.includes('x-ray') || path.includes('raio-x') || path.includes('raiox')) return 'BankAnalysis';
  if (path.includes('suporte') || path.includes('support') || path.includes('feedback')) return 'Support';
  if (path.includes('concurso') || path.includes('edital')) return 'Concursos';

  return null;
};

const resolveMaterialReaderId = (target?: string): string | null => {
  const path = normalizeTargetPath(target);
  if (!path) return null;

  const match = path.match(/(?:^|\/)read\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]);
};

const resolveMaterialDetailId = (target?: string): string | null => {
  const path = normalizeTargetPath(target);
  if (!path) return null;

  const match = path.match(/(?:^|\/)(?:material|materiais)\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1]);
};

const resolveTypeColor = (type: string): string => {
  const normalized = type.toLowerCase();
  if (normalized === 'success') return colors.success;
  if (normalized === 'warning') return '#D97706';
  if (normalized === 'error') return colors.danger;
  return colors.primary;
};

/**
 * Central mobile de notificacoes do usuario.
 * @since v1.0.0
 */
export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NotificationsNavigation>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [notifications, setNotifications] = React.useState<MobileNotification[]>([]);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const unreadCount = React.useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  );

  const loadNotifications = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rows = await notificationService.list();
      setNotifications(rows);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel carregar notificacoes.');
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  const markLocalAsRead = (notificationId: string) => {
    setNotifications((current) => current.map((item) => (
      item.id === notificationId ? { ...item, isRead: true } : item
    )));
  };

  const handleMarkAsRead = async (notificationId: string) => {
    setBusyKey(notificationId);
    try {
      await notificationService.markAsRead(notificationId);
      markLocalAsRead(notificationId);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel marcar como lida.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setBusyKey('mark-all');
    try {
      await notificationService.markAllAsRead();
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel marcar todas como lidas.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (notificationId: string) => {
    setBusyKey(`delete:${notificationId}`);
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((current) => current.filter((item) => item.id !== notificationId));
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Nao foi possivel remover esta notificacao.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Limpar notificacoes',
      'Deseja remover todas as notificacoes da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => {
            setBusyKey('clear-all');
            void notificationService.clearAll()
              .then(() => setNotifications([]))
              .catch((error: any) => {
                Alert.alert('Erro', error?.message || 'Nao foi possivel limpar notificacoes.');
              })
              .finally(() => setBusyKey(null));
          },
        },
      ],
    );
  };

  const openNotificationTarget = async (notification: MobileNotification) => {
    const target = notification.link;
    const readerMaterialId = resolveMaterialReaderId(target);
    if (readerMaterialId) {
      navigation.navigate('Reader', { materialId: readerMaterialId });
      return;
    }

    const materialDetailId = resolveMaterialDetailId(target);
    if (materialDetailId) {
      navigation.navigate('MaterialDetail', { materialId: materialDetailId });
      return;
    }

    const stackTarget = resolveStackTarget(target);
    const tabTarget = resolveMainTabTarget(target);

    if (stackTarget) {
      navigation.navigate(stackTarget);
      return;
    }

    if (tabTarget) {
      navigation.navigate('MainTabs', { screen: tabTarget });
      return;
    }

    if (target && /^https?:\/\//i.test(target)) {
      await Linking.openURL(target);
    }
  };

  const handleOpenNotification = async (notification: MobileNotification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    try {
      await openNotificationTarget(notification);
    } catch {
      Alert.alert('Destino indisponivel', 'Nao foi possivel abrir o destino desta notificacao.');
    }
  };

  const renderNotification = ({ item }: { item: MobileNotification }) => {
    const typeColor = resolveTypeColor(item.type);
    const isBusy = busyKey === item.id || busyKey === `delete:${item.id}`;

    return (
      <Pressable
        onPress={() => void handleOpenNotification(item)}
        style={({ pressed }) => [
          styles.card,
          !item.isRead && styles.unreadCard,
          pressed && styles.cardPressed,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleBlock}>
            <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
            <Text style={styles.cardTitle}>{item.title || 'Notificacao'}</Text>
          </View>
          {!item.isRead && <Text style={styles.unreadBadge}>Nova</Text>}
        </View>

        {!!item.message && (
          <Text style={styles.cardMessage}>{item.message}</Text>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.category || 'system'}</Text>
          <Text style={styles.metaText}>{formatDateTime(item.timestamp)}</Text>
        </View>

        <View style={styles.cardActions}>
          {!item.isRead && (
            <Pressable
              onPress={() => void handleMarkAsRead(item.id)}
              disabled={isBusy}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Marcar lida</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => void handleDelete(item.id)}
            disabled={isBusy}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Remover</Text>
          </Pressable>
          {isBusy && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </Pressable>
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
        data={notifications}
        keyExtractor={(item, index) => String(item.id || index)}
        renderItem={renderNotification}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadNotifications(true)}
            tintColor={colors.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View style={styles.headerBlock}>
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>Notificacoes</Text>
              <Text style={styles.title}>{unreadCount} nao lidas</Text>
              <Text style={styles.headerText}>Avisos da plataforma, compras, moderacao e atividades importantes.</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => void handleMarkAllAsRead()}
                disabled={unreadCount === 0 || busyKey === 'mark-all'}
                style={[styles.primaryButton, unreadCount === 0 && styles.buttonDisabled]}
              >
                <Text style={styles.primaryButtonText}>Marcar todas</Text>
              </Pressable>
              <Pressable
                onPress={handleClearAll}
                disabled={notifications.length === 0 || busyKey === 'clear-all'}
                style={[styles.clearButton, notifications.length === 0 && styles.buttonDisabled]}
              >
                <Text style={styles.clearButtonText}>Limpar</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Sem notificacoes</Text>
            <Text style={styles.emptyText}>Quando houver novidades importantes, elas aparecem aqui.</Text>
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clearButton: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  unreadCard: {
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  cardTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  unreadBadge: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButton: {
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default NotificationsScreen;
