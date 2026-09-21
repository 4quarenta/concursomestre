import React from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
import { getAssetUrl } from "@/services/api/client";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme, type ResolvedAppTheme } from "@/theme/useAppTheme";

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  path?: string;
  accent?: boolean;
};

const menuSections: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: "Estudo",
    items: [
      {
        icon: "diamond-outline",
        label: "Meu plano",
        description: "Gratuito",
        path: "/planos",
        accent: true,
      },
    ],
  },
  {
    title: "Configurações",
    items: [
      {
        icon: "notifications-outline",
        label: "Notificações",
        description: "Lembretes e alertas",
        path: "/configuracoes/notificacoes",
      },
      {
        icon: "moon-outline",
        label: "Aparência",
        description: "Tema e fonte",
        path: "/configuracoes/aparencia",
      },
      {
        icon: "shield-outline",
        label: "Privacidade",
        description: "Dados e segurança",
        path: "/configuracoes/privacidade",
      },
      {
        icon: "settings-outline",
        label: "Conta",
        description: "Email e senha",
        path: "/configuracoes/conta",
      },
    ],
  },
  {
    title: "Outros",
    items: [
      {
        icon: "star-outline",
        label: "Avaliar o app",
        description: "Sua opinião importa",
      },
      {
        icon: "share-social-outline",
        label: "Indicar para amigos",
        description: "Ganhe 30 dias Premium",
        path: "/indicar",
      },
      {
        icon: "help-circle-outline",
        label: "Ajuda e suporte",
        description: "FAQ e contato",
        path: "/ajuda",
      },
    ],
  },
];

export const ProfileScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { user, logout } = useAuth();
  const isPreview = user?.id === "visual-preview-user";
  const name = user?.name || "Aluno ConcursoMestre";
  const email = user?.email || "--";
  const plan = user?.plan || user?.subscription?.plan?.name || "Gratuito";
  const photoUri = user?.photoUrl ? getAssetUrl(user.photoUrl) : "";

  const handleMenuPress = (item: MenuItem) => {
    if (item.path) {
      router.push(item.path as never);
      return;
    }
    Alert.alert(
      "Avaliar o app",
      "Obrigado por ajudar a melhorar o ConcursoMestre.",
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.profileHeader, { paddingTop: spacing[3] }]}>
          <View style={styles.avatar}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={28} color={theme.onPrimary} />
            )}
          </View>
          <View style={styles.headerCopy}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={styles.name}
            >
              {name}
            </Text>
            <Text style={styles.email}>{email}</Text>
            <View style={styles.streak}>
              <Ionicons name="flame" size={13} color={theme.warning} />
              <Text style={styles.streakText}>
                {isPreview ? "12 dias de streak" : "Sequência de estudos"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/perfil/editar")}
            style={styles.editButton}
          >
            <Text style={styles.editText}>Editar</Text>
          </Pressable>
        </View>

        <View style={styles.stats}>
          {[
            {
              label: "Questões",
              value: isPreview ? "1.248" : "--",
              icon: "book-outline" as const,
            },
            {
              label: "Acerto",
              value: isPreview ? "78%" : "--",
              icon: "locate-outline" as const,
            },
            {
              label: "Horas",
              value: isPreview ? "86h" : "--",
              icon: "time-outline" as const,
            },
          ].map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Ionicons name={stat.icon} size={16} color={theme.primary} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menu}>
              {section.items.map((item, index) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={() => handleMenuPress(item)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    index > 0 && styles.menuItemBorder,
                    pressed && styles.menuItemPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      item.accent && styles.menuIconAccent,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={17}
                      color={item.accent ? theme.onPrimary : theme.text}
                    />
                  </View>
                  <View style={styles.menuCopy}>
                    <Text style={styles.itemTitle}>{item.label}</Text>
                    <Text style={styles.itemDescription}>
                      {item.description === "Gratuito"
                        ? plan
                        : item.description}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={theme.textMuted}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              "Sair da conta?",
              "Sua sessão neste aparelho será encerrada.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Sair",
                  style: "destructive",
                  onPress: () => void logout(),
                },
              ],
            )
          }
          style={({ pressed }) => [
            styles.logout,
            pressed && styles.logoutPressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
        <Text style={styles.version}>
          Versão 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme: ResolvedAppTheme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: { paddingBottom: spacing[12] },
    profileHeader: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderBottomColor: theme.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      paddingBottom: spacing[5],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[6],
    },
    avatar: {
      alignItems: "center",
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      height: 64,
      justifyContent: "center",
      overflow: "hidden",
      width: 64,
    },
    avatarImage: { height: "100%", width: "100%" },
    headerCopy: { flex: 1 },
    name: {
      color: theme.text,
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
    },
    email: {
      color: theme.textMuted,
      fontSize: typography.size.sm,
      marginTop: 2,
    },
    streak: {
      alignSelf: "flex-start",
      backgroundColor: theme.warningSubtle,
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: 4,
      marginTop: spacing[2],
      paddingHorizontal: spacing[2],
      paddingVertical: 4,
    },
    streakText: {
      color: theme.warning,
      fontSize: 10,
      fontWeight: typography.weight.medium,
    },
    editButton: {
      borderColor: theme.border,
      borderRadius: radius.md,
      borderWidth: 1,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
    },
    editText: {
      color: theme.text,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.semibold,
    },
    stats: { flexDirection: "row", gap: spacing[3], padding: spacing[5] },
    stat: {
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      flex: 1,
      gap: 3,
      padding: spacing[3],
    },
    statValue: {
      color: theme.text,
      fontSize: typography.size.lg,
      fontWeight: typography.weight.bold,
    },
    statLabel: { color: theme.textMuted, fontSize: 10 },
    section: {
      gap: spacing[2],
      marginBottom: spacing[5],
      paddingHorizontal: spacing[5],
    },
    sectionTitle: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      fontWeight: typography.weight.bold,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    menu: {
      backgroundColor: theme.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
    },
    menuItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      padding: spacing[4],
    },
    menuItemBorder: { borderTopColor: theme.border, borderTopWidth: 1 },
    menuItemPressed: { backgroundColor: theme.surfaceSubtle },
    menuIcon: {
      alignItems: "center",
      backgroundColor: theme.surfaceSubtle,
      borderRadius: radius.sm,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    menuIconAccent: { backgroundColor: theme.primary },
    menuCopy: { flex: 1 },
    itemTitle: {
      color: theme.text,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.medium,
    },
    itemDescription: {
      color: theme.textMuted,
      fontSize: typography.size.xs,
      marginTop: 2,
    },
    logout: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[3],
      marginHorizontal: spacing[5],
      paddingVertical: spacing[3],
    },
    logoutPressed: { opacity: 0.7 },
    logoutText: {
      color: theme.danger,
      fontSize: typography.size.sm,
      fontWeight: typography.weight.bold,
    },
    version: {
      color: theme.textMuted,
      fontSize: 10,
      paddingTop: spacing[2],
      textAlign: "center",
    },
  });

export default ProfileScreen;
