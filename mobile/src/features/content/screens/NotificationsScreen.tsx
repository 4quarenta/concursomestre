import React from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { radius, spacing, typography } from "@/theme/tokens";
import { getAssetUrl } from "@/services/api/client";
import notificationService from "@/services/notifications/notificationService";
import type { MobileNotification } from "@/types/notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabType = "all" | "system" | "social" | "marketplace" | "report" | "trash";

const TRASH_RETENTION_DAYS = 30;
const ITEMS_PER_PAGE = 7;
const CATEGORY_LABELS: Record<Exclude<TabType, "all" | "trash">, string> = {
  system: "Sistema",
  social: "Interações",
  marketplace: "Loja",
  report: "Suporte",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const resolveCategory = (
  notification: MobileNotification,
): Exclude<TabType, "all" | "trash"> => {
  const rawCategory = String(notification.category || "").toLowerCase();
  const haystack = normalizeText(
    [
      rawCategory,
      notification.title,
      notification.message,
      notification.link || "",
    ].join(" "),
  );

  if (
    /(pagamento|assinatura|plano|checkout|compra|cartao|fatura|loja|marketplace|material|cortesia|voucher)/.test(
      haystack,
    )
  ) {
    return "marketplace";
  }
  if (
    /(suporte|atendimento|denuncia|denuncias|report|reembolso|feedback|avaliacao|moderacao|moderar|erro|bug|cancelamento)/.test(
      haystack,
    )
  ) {
    return "report";
  }
  if (
    /(comentario|resposta|curtiu|like|favorito|salvo|anotacao|social|ranking|xp|sequencia|estudo)/.test(
      haystack,
    )
  ) {
    return "social";
  }
  if (rawCategory === "marketplace") return "marketplace";
  if (rawCategory === "report") return "report";
  if (rawCategory === "social") return "social";
  return "system";
};

const formatDateTime = (timestamp?: string | number) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const iconForType = (type: string): keyof typeof Ionicons.glyphMap => {
  if (type === "success") return "checkmark-circle-outline";
  if (type === "warning") return "warning-outline";
  if (type === "error") return "close-circle-outline";
  return "information-circle-outline";
};

const colorsForType = (theme: ResolvedAppTheme, type: string) => {
  if (type === "success") {
    return { foreground: theme.success, background: theme.successSubtle };
  }
  if (type === "warning") {
    return { foreground: theme.warning, background: theme.warningSubtle };
  }
  if (type === "error") {
    return { foreground: theme.danger, background: theme.dangerSubtle };
  }
  return { foreground: theme.primary, background: theme.primarySubtle };
};

const getTrashDaysLeft = (deletedAt: string | number | undefined) => {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const deletedTime = new Date(deletedAt).getTime();
  if (Number.isNaN(deletedTime)) return TRASH_RETENTION_DAYS;
  return Math.max(
    0,
    TRASH_RETENTION_DAYS - Math.floor((Date.now() - deletedTime) / 86400000),
  );
};

const normalizeLink = (link: string) =>
  link.replace(/^concursomestre:\/\//i, "/");

export function NotificationsScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = React.useState<MobileNotification[]>([]);
  const [activeTab, setActiveTab] = React.useState<TabType>("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");

  const loadNotifications = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      setItems(await notificationService.list());
    } catch {
      setError("Não foi possível carregar suas notificações.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unread = items.filter((item) => !item.deletedAt && !item.isRead).length;
  const filteredItems = React.useMemo(() => {
    if (activeTab === "trash") return items.filter((item) => item.deletedAt);
    const visible = items.filter((item) => !item.deletedAt);
    if (activeTab === "all") return visible;
    return visible.filter((item) => resolveCategory(item) === activeTab);
  }, [activeTab, items]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE),
  );
  const pageItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const selectTab = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const updateItem = (
    id: string,
    updater: (item: MobileNotification) => MobileNotification,
  ) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? updater(item) : item)),
    );
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch {
      Alert.alert("Não foi possível concluir", "Tente novamente em instantes.");
    }
  };

  const markAsRead = async (item: MobileNotification) => {
    if (item.isRead) return;
    try {
      await notificationService.markAsRead(item.id);
      updateItem(item.id, (current) => ({ ...current, isRead: true }));
    } catch {
      Alert.alert("Não foi possível concluir", "Tente novamente em instantes.");
    }
  };

  const moveToTrash = (item: MobileNotification) => {
    Alert.alert(
      "Mover para a lixeira?",
      "Essa notificação ficará disponível na lixeira por 30 dias.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Mover",
          style: "destructive",
          onPress: async () => {
            try {
              await notificationService.deleteNotification(item.id);
              updateItem(item.id, (current) => ({
                ...current,
                deletedAt: Date.now(),
              }));
            } catch {
              Alert.alert(
                "Não foi possível concluir",
                "Tente novamente em instantes.",
              );
            }
          },
        },
      ],
    );
  };

  const clearAll = () => {
    Alert.alert(
      "Mover notificações para a lixeira?",
      "Todas as notificações visíveis serão movidas para a lixeira.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Mover para lixeira",
          style: "destructive",
          onPress: async () => {
            try {
              await notificationService.clearAll();
              setItems((current) =>
                current.map((item) =>
                  item.deletedAt ? item : { ...item, deletedAt: Date.now() },
                ),
              );
              setActiveTab("trash");
              setCurrentPage(1);
            } catch {
              Alert.alert(
                "Não foi possível concluir",
                "Tente novamente em instantes.",
              );
            }
          },
        },
      ],
    );
  };

  const restore = async (item: MobileNotification) => {
    try {
      await notificationService.restoreNotification(item.id);
      updateItem(item.id, (current) => ({ ...current, deletedAt: null }));
    } catch {
      Alert.alert(
        "Não foi possível restaurar",
        "Tente novamente em instantes.",
      );
    }
  };

  const permanentDelete = (item: MobileNotification) => {
    Alert.alert(
      "Excluir permanentemente?",
      "Essa ação remove a notificação e não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await notificationService.permanentDeleteNotification(item.id);
              setItems((current) =>
                current.filter((currentItem) => currentItem.id !== item.id),
              );
            } catch {
              Alert.alert(
                "Não foi possível excluir",
                "Tente novamente em instantes.",
              );
            }
          },
        },
      ],
    );
  };

  const openNotification = async (item: MobileNotification) => {
    await markAsRead(item);
    if (!item.link) return;
    if (/^https?:\/\//i.test(item.link)) {
      await Linking.openURL(item.link);
      return;
    }
    router.push(normalizeLink(item.link).split("#")[0] as never);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Notificações"
        subtitle="Acompanhe suas novidades e alertas do sistema."
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[12] + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadNotifications(true)}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            disabled={unread === 0}
            onPress={() => void markAllAsRead()}
            style={[
              styles.outlineButton,
              unread === 0 && styles.disabledButton,
            ]}
          >
            <Ionicons
              name="mail-open-outline"
              size={14}
              color={theme.primary}
            />
            <Text style={[styles.outlineButtonText, { color: theme.primary }]}>
              Ler todas
            </Text>
          </Pressable>
          {activeTab !== "trash" && (
            <Pressable
              accessibilityRole="button"
              disabled={!items.some((item) => !item.deletedAt)}
              onPress={clearAll}
              style={[
                styles.outlineButton,
                styles.deleteButton,
                !items.some((item) => !item.deletedAt) && styles.disabledButton,
              ]}
            >
              <Ionicons name="trash-outline" size={14} color={theme.danger} />
              <Text style={[styles.outlineButtonText, { color: theme.danger }]}>
                Limpar
              </Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {(
            [
              ["all", "Geral", "file-tray-full-outline"],
              ["system", "Sistema", "information-circle-outline"],
              ["social", "Interações", "chatbubble-ellipses-outline"],
              ["marketplace", "Loja", "bag-handle-outline"],
              ["report", "Suporte", "shield-checkmark-outline"],
              ["trash", "Lixeira", "trash-outline"],
            ] as const
          ).map(([id, label, icon]) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              onPress={() => selectTab(id)}
              style={[
                styles.tab,
                activeTab === id ? styles.activeTab : styles.inactiveTab,
              ]}
            >
              <Ionicons
                name={icon}
                size={14}
                color={activeTab === id ? theme.onPrimary : theme.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === id ? theme.onPrimary : theme.textMuted,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="cloud-offline-outline"
              size={42}
              color={theme.textMuted}
            />
            <Text style={[styles.stateText, { color: theme.textMuted }]}>
              {error}
            </Text>
            <Pressable
              onPress={() => void loadNotifications()}
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
            >
              <Text
                style={{
                  color: theme.onPrimary,
                  fontWeight: typography.weight.bold,
                }}
              >
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : pageItems.length === 0 ? (
          <View style={styles.stateCard}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: theme.surfaceSubtle },
              ]}
            >
              <Ionicons
                name="file-tray-outline"
                size={48}
                color={theme.textMuted}
              />
            </View>
            <Text style={[styles.stateText, { color: theme.textMuted }]}>
              Nenhuma notificação nesta categoria.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {pageItems.map((item) => {
              const typeColors = colorsForType(theme, item.type);
              const inTrash = Boolean(item.deletedAt);
              const category = resolveCategory(item);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => void openNotification(item)}
                  style={[
                    styles.notificationCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: item.isRead
                        ? theme.border
                        : theme.primarySubtle,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.notificationIcon,
                      { backgroundColor: typeColors.background },
                    ]}
                  >
                    <Ionicons
                      name={iconForType(item.type)}
                      size={24}
                      color={typeColors.foreground}
                    />
                  </View>
                  <View style={styles.notificationBody}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.notificationTitle,
                          {
                            color: item.isRead
                              ? theme.textMuted
                              : theme.primary,
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                      {!item.isRead && (
                        <View
                          style={[
                            styles.unreadDot,
                            { backgroundColor: theme.primary },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.notificationMessage,
                        { color: theme.textMuted },
                      ]}
                    >
                      {item.message}
                    </Text>
                    {item.evidenceUrl ? (
                      <Image
                        source={{ uri: getAssetUrl(item.evidenceUrl) }}
                        style={styles.evidence}
                        resizeMode="contain"
                      />
                    ) : null}
                    <View style={styles.metaRow}>
                      <Text
                        style={[styles.metaText, { color: theme.textMuted }]}
                      >
                        {formatDateTime(item.timestamp)}
                      </Text>
                      {item.link ? (
                        <Text
                          style={[
                            styles.tag,
                            {
                              backgroundColor: theme.primarySubtle,
                              color: theme.primary,
                            },
                          ]}
                        >
                          Ver conteúdo ›
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.tag,
                          {
                            backgroundColor: theme.surfaceSubtle,
                            color: theme.textMuted,
                          },
                        ]}
                      >
                        {CATEGORY_LABELS[category]}
                      </Text>
                      {inTrash ? (
                        <Text
                          style={[
                            styles.tag,
                            {
                              backgroundColor: theme.warningSubtle,
                              color: theme.warning,
                            },
                          ]}
                        >
                          {getTrashDaysLeft(item.deletedAt || undefined)} dias
                          p/ excluir
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.actionRow}>
                      {inTrash ? (
                        <>
                          <Pressable
                            accessibilityLabel="Restaurar"
                            onPress={() => void restore(item)}
                            style={styles.actionButton}
                          >
                            <Ionicons
                              name="refresh-outline"
                              size={19}
                              color={theme.success}
                            />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Excluir permanentemente"
                            onPress={() => permanentDelete(item)}
                            style={styles.actionButton}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={19}
                              color={theme.danger}
                            />
                          </Pressable>
                        </>
                      ) : (
                        <>
                          {!item.isRead && (
                            <Pressable
                              accessibilityLabel="Marcar como lida"
                              onPress={() => void markAsRead(item)}
                              style={styles.actionButton}
                            >
                              <Ionicons
                                name="checkmark"
                                size={19}
                                color={theme.primary}
                              />
                            </Pressable>
                          )}
                          <Pressable
                            accessibilityLabel="Mover para a lixeira"
                            onPress={() => moveToTrash(item)}
                            style={styles.actionButton}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={19}
                              color={theme.textMuted}
                            />
                          </Pressable>
                        </>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {totalPages > 1 && (
          <View style={styles.pagination}>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <Pressable
                  key={page}
                  onPress={() => setCurrentPage(page)}
                  style={[
                    styles.pageButton,
                    page === currentPage && { backgroundColor: theme.primary },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        page === currentPage
                          ? theme.onPrimary
                          : theme.textMuted,
                      fontWeight: typography.weight.bold,
                    }}
                  >
                    {page}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: {
      gap: spacing[4],
      padding: spacing[5],
      paddingBottom: spacing[12],
    },
    headerActions: {
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "flex-end",
    },
    outlineButton: {
      alignItems: "center",
      borderColor: theme.primarySubtle,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    deleteButton: { borderColor: theme.border },
    disabledButton: { opacity: 0.45 },
    outlineButtonText: {
      fontSize: 10,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase",
    },
    tabs: { gap: spacing[2], paddingRight: spacing[5] },
    tab: {
      alignItems: "center",
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    activeTab: { backgroundColor: theme.primary, elevation: 2 },
    inactiveTab: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderWidth: 1,
    },
    tabText: {
      fontSize: 10,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase",
    },
    list: { gap: spacing[4] },
    notificationCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      elevation: 1,
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[4],
      shadowColor: theme.text,
      shadowOpacity: 0.04,
      shadowRadius: 5,
    },
    notificationIcon: {
      alignItems: "center",
      borderRadius: radius.md,
      flexShrink: 0,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    notificationBody: { flex: 1, gap: spacing[2], minWidth: 0 },
    titleRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
    notificationTitle: {
      flex: 1,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    notificationMessage: { fontSize: typography.size.xs, lineHeight: 18 },
    unreadDot: { borderRadius: radius.pill, height: 8, width: 8 },
    evidence: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      height: 140,
      width: "100%",
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[2],
    },
    metaText: {
      fontSize: 10,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase",
    },
    tag: {
      borderRadius: radius.sm,
      fontSize: 9,
      fontWeight: typography.weight.bold,
      overflow: "hidden",
      paddingHorizontal: spacing[2],
      paddingVertical: 3,
      textTransform: "uppercase",
    },
    actionRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[1],
      justifyContent: "flex-end",
    },
    actionButton: {
      alignItems: "center",
      borderRadius: radius.sm,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    stateCard: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.md,
      borderStyle: "dashed",
      borderWidth: 1,
      gap: spacing[3],
      justifyContent: "center",
      minHeight: 220,
      padding: spacing[6],
    },
    emptyIcon: {
      alignItems: "center",
      borderRadius: radius.pill,
      justifyContent: "center",
      padding: spacing[5],
    },
    stateText: {
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
      textAlign: "center",
    },
    retryButton: {
      borderRadius: radius.md,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[3],
    },
    pagination: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      paddingTop: spacing[2],
    },
    pageButton: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
  });
