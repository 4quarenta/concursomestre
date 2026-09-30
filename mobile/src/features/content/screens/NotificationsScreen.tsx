import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { MotionPressable } from "@/components/ui/Primitives";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";
import { radius, spacing, typography } from "@/theme/tokens";
import { getAssetUrl } from "@/services/api/client";
import notificationService from "@/services/notifications/notificationService";
import { assertAllowedExternalUrl } from "@/services/navigation/externalUrlService";
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

const getDayOffset = (timestamp?: string | number) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  return Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
};

const getDayGroupLabel = (timestamp?: string | number) => {
  const date = timestamp ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.getTime())) return "SEM DATA";
  const dayOffset = getDayOffset(timestamp);
  if (dayOffset === 0) return "HOJE";
  if (dayOffset === 1) return "ONTEM";
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).toUpperCase();
};

const formatNotificationTime = (timestamp?: string | number) => {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const dayOffset = getDayOffset(timestamp);
  if (dayOffset === 0) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (dayOffset === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
};

const iconForCategory = (
  category: Exclude<TabType, "all" | "trash">,
): keyof typeof Ionicons.glyphMap => {
  if (category === "social") return "chatbubble-ellipses-outline";
  if (category === "marketplace") return "bag-handle-outline";
  if (category === "report") return "shield-checkmark-outline";
  return "notifications-outline";
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
  const pageGroups = React.useMemo(() => {
    const groups: Array<{ label: string; items: MobileNotification[] }> = [];
    pageItems.forEach((item) => {
      const label = getDayGroupLabel(item.timestamp);
      const currentGroup = groups[groups.length - 1];
      if (currentGroup?.label === label) {
        currentGroup.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
    });
    return groups;
  }, [pageItems]);

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

  const showItemActions = (item: MobileNotification) => {
    const inTrash = Boolean(item.deletedAt);
    const actions = inTrash
      ? [
          {
            text: "Restaurar",
            onPress: () => void restore(item),
          },
          {
            text: "Excluir permanentemente",
            style: "destructive" as const,
            onPress: () => permanentDelete(item),
          },
        ]
      : [
          ...(!item.isRead
            ? [
                {
                  text: "Marcar como lida",
                  onPress: () => void markAsRead(item),
                },
              ]
            : []),
          {
            text: "Mover para a lixeira",
            style: "destructive" as const,
            onPress: () => moveToTrash(item),
          },
        ];

    Alert.alert(item.title, "Escolha uma ação", [
      ...actions,
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const openNotification = async (item: MobileNotification) => {
    await markAsRead(item);
    if (!item.link) return;
    if (/^https?:\/\//i.test(item.link)) {
      const safeUrl = assertAllowedExternalUrl(item.link);
      await Linking.openURL(safeUrl);
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
        <View style={styles.toolbar}>
          <Text style={[styles.unreadSummary, { color: theme.textMuted }]}>
            {unread > 0
              ? `${unread} ${unread === 1 ? "não lida" : "não lidas"}`
              : "Tudo em dia"}
          </Text>
          <View style={styles.headerActions}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Marcar todas como lidas"
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
          </MotionPressable>
          {activeTab !== "trash" && (
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="Mover todas para a lixeira"
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
            </MotionPressable>
          )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {(
            [
              ["all", "Geral"],
              ["system", "Sistema"],
              ["social", "Interações"],
              ["marketplace", "Loja"],
              ["report", "Suporte"],
              ["trash", "Lixeira"],
            ] as const
          ).map(([id, label]) => (
            <MotionPressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === id }}
              onPress={() => selectTab(id)}
              style={[
                styles.tab,
                activeTab === id ? styles.activeTab : styles.inactiveTab,
              ]}
            >
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
            </MotionPressable>
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
            <MotionPressable
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
            </MotionPressable>
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
          <View style={styles.groupList}>
            {pageGroups.map((group) => (
              <View key={group.label} style={styles.dayGroup}>
                <Text style={[styles.dayLabel, { color: theme.textMuted }]}>
                  {group.label}
                </Text>
                <View style={[styles.list, { backgroundColor: theme.surface }]}>
                  {group.items.map((item, index) => {
                    const typeColors = colorsForType(theme, item.type);
                    const inTrash = Boolean(item.deletedAt);
                    const category = resolveCategory(item);
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.notificationRow,
                          index < group.items.length - 1 && {
                            borderBottomColor: theme.border,
                            borderBottomWidth: StyleSheet.hairlineWidth,
                          },
                        ]}
                      >
                        <MotionPressable
                          accessibilityRole="button"
                          accessibilityLabel={`${item.title}. ${item.message}`}
                          onPress={() => void openNotification(item)}
                          style={styles.notificationPressable}
                        >
                          <View
                            style={[
                              styles.notificationIcon,
                              { backgroundColor: typeColors.background },
                            ]}
                          >
                            <Ionicons
                              name={inTrash ? "trash-outline" : iconForCategory(category)}
                              size={19}
                              color={typeColors.foreground}
                            />
                          </View>
                          <View style={styles.notificationBody}>
                            <View style={styles.titleRow}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.notificationTitle,
                                  {
                                    color: item.isRead
                                      ? theme.textMuted
                                      : theme.text,
                                    fontWeight: item.isRead
                                      ? typography.weight.medium
                                      : typography.weight.bold,
                                  },
                                ]}
                              >
                                {item.title}
                              </Text>
                              <Text
                                style={[styles.timeText, { color: theme.textMuted }]}
                              >
                                {formatNotificationTime(item.timestamp)}
                              </Text>
                            </View>
                            <Text
                              numberOfLines={2}
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
                                style={[
                                  styles.categoryTag,
                                  {
                                    backgroundColor: theme.surfaceSubtle,
                                    color: theme.textMuted,
                                  },
                                ]}
                              >
                                {CATEGORY_LABELS[category]}
                              </Text>
                              {!item.isRead && (
                                <View
                                  accessibilityLabel="Não lida"
                                  style={[
                                    styles.unreadDot,
                                    { backgroundColor: theme.primary },
                                  ]}
                                />
                              )}
                              {inTrash && (
                                <Text
                                  style={[
                                    styles.categoryTag,
                                    {
                                      backgroundColor: theme.warningSubtle,
                                      color: theme.warning,
                                    },
                                  ]}
                                >
                                  {getTrashDaysLeft(item.deletedAt || undefined)} dias restantes
                                </Text>
                              )}
                            </View>
                          </View>
                        </MotionPressable>
                        <MotionPressable
                          accessibilityRole="button"
                          accessibilityLabel={`Mais ações: ${item.title}`}
                          hitSlop={6}
                          onPress={() => showItemActions(item)}
                          style={styles.itemMenuButton}
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={19}
                            color={theme.textMuted}
                          />
                        </MotionPressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {totalPages > 1 && (
          <View style={styles.pagination}>
            <Text style={[styles.pageSummary, { color: theme.textMuted }]}>
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)} de{" "}
              {filteredItems.length} notificações
            </Text>
            <View style={styles.pageControls}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Página anterior"
                accessibilityState={{ disabled: currentPage === 1 }}
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                style={[
                  styles.pageButton,
                  { borderColor: theme.border },
                  currentPage === 1 && styles.disabledButton,
                ]}
              >
                <Ionicons name="chevron-back" size={17} color={theme.text} />
              </MotionPressable>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Próxima página"
                accessibilityState={{ disabled: currentPage === totalPages }}
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                style={[
                  styles.pageButton,
                  { borderColor: theme.border },
                  currentPage === totalPages && styles.disabledButton,
                ]}
              >
                <Ionicons name="chevron-forward" size={17} color={theme.text} />
              </MotionPressable>
            </View>
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
      paddingHorizontal: spacing[5],
      paddingTop: spacing[4],
      paddingBottom: spacing[12],
    },
    toolbar: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "space-between",
      minHeight: 36,
    },
    unreadSummary: {
      flex: 1,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.medium,
    },
    headerActions: {
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "flex-end",
      flexShrink: 0,
    },
    outlineButton: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing[1],
      height: 34,
      paddingHorizontal: spacing[2],
    },
    deleteButton: { borderColor: theme.border },
    disabledButton: { opacity: 0.45 },
    outlineButtonText: {
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    tabs: { gap: spacing[2], paddingRight: spacing[5] },
    tab: {
      alignItems: "center",
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing[4],
      paddingVertical: spacing[2],
    },
    activeTab: { backgroundColor: theme.primary, borderColor: theme.primary },
    inactiveTab: { backgroundColor: theme.surface, borderColor: theme.border },
    tabText: {
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    groupList: { gap: spacing[4] },
    dayGroup: { gap: spacing[2] },
    dayLabel: {
      ...typography.role.label,
      letterSpacing: 0.6,
    },
    list: {
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    notificationRow: { alignItems: "stretch", flexDirection: "row" },
    notificationPressable: {
      alignItems: "flex-start",
      flex: 1,
      flexDirection: "row",
      gap: spacing[3],
      minWidth: 0,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
    },
    notificationIcon: {
      alignItems: "center",
      borderRadius: radius.pill,
      flexShrink: 0,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    notificationBody: { flex: 1, gap: spacing[1], minWidth: 0 },
    titleRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
    notificationTitle: { flex: 1, fontSize: typography.size.sm },
    timeText: { ...typography.role.caption, flexShrink: 0 },
    notificationMessage: { fontSize: typography.role.body.fontSize, lineHeight: typography.role.body.lineHeight },
    unreadDot: { borderRadius: radius.pill, height: 7, width: 7 },
    evidence: {
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      height: 110,
      width: "100%",
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing[2],
    },
    categoryTag: {
      borderRadius: radius.pill,
      fontSize: typography.role.caption.fontSize,
      overflow: "hidden",
      paddingHorizontal: spacing[2],
      paddingVertical: 2,
    },
    itemMenuButton: { alignItems: "center", justifyContent: "center", width: 38 },
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
      justifyContent: "space-between",
      paddingTop: spacing[2],
    },
    pageSummary: { flex: 1, fontSize: typography.size.xs },
    pageControls: { flexDirection: "row", gap: spacing[2] },
    pageButton: {
      alignItems: "center",
      borderColor: theme.border,
      borderRadius: radius.sm,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
  });
