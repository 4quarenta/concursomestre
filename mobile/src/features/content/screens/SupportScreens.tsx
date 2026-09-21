import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { radius, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useAuth } from "@/providers/AuthProvider";
import { getAssetUrl } from "@/services/api/client";
import { accountService } from "@/services/auth/accountService";
import { authFlowService } from "@/services/auth/authFlowService";
import {
  formatCheckoutProfileFields,
  getMissingCheckoutProfileFields,
} from "@/services/plans/checkoutRequirements";
import type { CheckoutProfileField } from "@/services/plans/checkoutRequirements";

const faqs = [
  [
    "Como cancelar minha assinatura?",
    "Vá em Perfil → Meu plano → Gerenciar assinatura → Cancelar. Você pode cancelar a qualquer momento sem multa.",
  ],
  [
    "Posso usar offline?",
    "Algumas funcionalidades estão disponíveis offline no plano Premium. Baixe os conteúdos enquanto estiver conectado.",
  ],
  [
    "Como mudar meu concurso alvo?",
    "Vá em Perfil → Editar → Foco de estudo e selecione o desejado.",
  ],
  [
    "Como funciona o ranking?",
    "Você ganha XP a cada questão respondida. O ranking é atualizado semanalmente toda segunda-feira.",
  ],
  [
    "Esqueci minha senha, e agora?",
    "Na tela de login, clique em 'Esqueci minha senha' e siga as instruções enviadas por email.",
  ],
] as const;

const digitsOnly = (value: string): string => value.replace(/\D/g, "");

const formatCpf = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const formatCep = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, "$1-$2");
};

export function HelpScreen() {
  const theme = useAppTheme();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState<number | null>(null);
  const filtered = faqs.filter(([question, answer]) =>
    `${question} ${answer}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Ajuda e suporte"
        subtitle="Encontre respostas e fale com a equipe"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              "Tutorial",
              "O tutorial guiado será exibido novamente na próxima abertura.",
            )
          }
          style={[
            styles.tutorialCard,
            { backgroundColor: theme.primarySubtle },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: theme.primary }]}>
            <Ionicons
              name="sparkles-outline"
              size={20}
              color={theme.onPrimary}
            />
          </View>
          <View style={styles.flex}>
            <Text style={[styles.itemTitle, { color: theme.text }]}>
              Ver tutorial novamente
            </Text>
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              Aprenda como usar o app em 30s
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </Pressable>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ajuda..."
            placeholderTextColor={theme.textSubtle}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
        {!search && (
          <View style={styles.categoryGrid}>
            {[
              ["book-outline", "Como usar o app", "12 artigos"],
              [
                "chatbubble-ellipses-outline",
                "Conta e assinatura",
                "8 artigos",
              ],
              ["card-outline", "Pagamentos", "6 artigos"],
              ["mail-outline", "Suporte técnico", "9 artigos"],
            ].map(([icon, label, count]) => (
              <Pressable
                key={label}
                accessibilityRole="button"
                style={[styles.category, { backgroundColor: theme.surface }]}
              >
                <View
                  style={[
                    styles.smallIcon,
                    { backgroundColor: theme.primarySubtle },
                  ]}
                >
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={19}
                    color={theme.primary}
                  />
                </View>
                <Text style={[styles.itemTitle, { color: theme.text }]}>
                  {label}
                </Text>
                <Text style={[styles.caption, { color: theme.textMuted }]}>
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={[styles.overline, { color: theme.textMuted }]}>
          PERGUNTAS FREQUENTES
        </Text>
        <View style={styles.list}>
          {filtered.map(([question, answer], index) => (
            <Pressable
              key={question}
              accessibilityRole="button"
              onPress={() => setOpen(open === index ? null : index)}
              style={[styles.faq, { backgroundColor: theme.surface }]}
            >
              <View style={styles.rowBetween}>
                <Text
                  style={[styles.itemTitle, { color: theme.text, flex: 1 }]}
                >
                  {question}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={theme.textMuted}
                  style={
                    open === index
                      ? { transform: [{ rotate: "90deg" }] }
                      : undefined
                  }
                />
              </View>
              {open === index && (
                <Text style={[styles.caption, { color: theme.textMuted }]}>
                  {answer}
                </Text>
              )}
            </Pressable>
          ))}
          {filtered.length === 0 && (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              Nenhum resultado encontrado
            </Text>
          )}
        </View>
        <View
          style={[styles.contact, { backgroundColor: theme.primarySubtle }]}
        >
          <Text style={[styles.itemTitle, { color: theme.text }]}>
            Não encontrou o que procurava?
          </Text>
          <Text style={[styles.caption, { color: theme.textMuted }]}>
            Nossa equipe responde em até 24h
          </Text>
          <View style={styles.contactActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert(
                  "Email",
                  "Envie sua dúvida para suporte@concursomestre.com",
                )
              }
              style={[
                styles.outlineButton,
                { borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            >
              <Ionicons name="mail-outline" size={16} color={theme.text} />
              <Text style={[styles.buttonText, { color: theme.text }]}>
                Email
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                Alert.alert("Chat", "O atendimento será iniciado em breve.")
              }
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={16}
                color={theme.onPrimary}
              />
              <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
                Chat
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function InviteScreen() {
  const theme = useAppTheme();
  const [copied, setCopied] = React.useState(false);
  const code = "MARIA2024";
  const share = async () => {
    await Share.share({
      message: `Use meu código ${code} no ConcursoMestre e ganhe 30 dias Premium: https://concursomestre.com/r/${code}`,
    });
  };
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Indicar amigos"
        subtitle="Compartilhe e ganhe Premium"
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.inviteHero, { backgroundColor: theme.primary }]}>
          <View style={styles.giftIcon}>
            <Ionicons name="gift-outline" size={31} color={theme.warning} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.onPrimary }]}>
            Ganhe 30 dias Premium
          </Text>
          <Text
            style={[styles.heroSubtitle, { color: "rgba(255,255,255,0.82)" }]}
          >
            A cada amigo que se cadastrar com seu código, vocês dois ganham 30
            dias grátis!
          </Text>
        </View>
        <View style={[styles.codeCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.overline, { color: theme.textMuted }]}>
            SEU CÓDIGO
          </Text>
          <View style={styles.codeRow}>
            <View
              style={[
                styles.codeBox,
                {
                  backgroundColor: theme.primarySubtle,
                  borderColor: theme.primaryBorder,
                },
              ]}
            >
              <Text style={[styles.code, { color: theme.primary }]}>
                {code}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              style={[styles.copyButton, { borderColor: theme.border }]}
            >
              <Ionicons
                name={copied ? "checkmark" : "copy-outline"}
                size={18}
                color={copied ? theme.success : theme.text}
              />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void share()}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Ionicons
              name="share-social-outline"
              size={17}
              color={theme.onPrimary}
            />
            <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
              Compartilhar convite
            </Text>
          </Pressable>
        </View>
        <View style={styles.statsGrid}>
          {[
            ["people-outline", "3", "Convidados"],
            ["checkmark", "2", "Cadastrados"],
            ["gift-outline", "30 dias", "Premium ganho"],
          ].map(([icon, value, label]) => (
            <View
              key={label}
              style={[styles.statCard, { backgroundColor: theme.surface }]}
            >
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={17}
                color={theme.primary}
              />
              <Text style={[styles.statValue, { color: theme.text }]}>
                {value}
              </Text>
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.overline, { color: theme.textMuted }]}>
          COMO FUNCIONA
        </Text>
        <View style={[styles.steps, { backgroundColor: theme.surface }]}>
          {[
            "Compartilhe seu código com amigos",
            "Eles se cadastram usando seu código",
            "Vocês dois ganham 30 dias Premium grátis",
          ].map((step, index) => (
            <View
              key={step}
              style={[
                styles.step,
                index > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: 1,
                },
              ]}
            >
              <View
                style={[styles.stepNumber, { backgroundColor: theme.primary }]}
              >
                <Text
                  style={{
                    color: theme.onPrimary,
                    fontWeight: typography.weight.bold,
                  }}
                >
                  {index + 1}
                </Text>
              </View>
              <Text style={[styles.itemTitle, { color: theme.text }]}>
                {step}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export function ProfileScreen() {
  const theme = useAppTheme();
  const { user, logout } = useAuth();
  const sections = [
    {
      title: "ESTUDO",
      items: [["star", "Meu plano", user?.plan || "Gratuito", "/planos", true]],
    },
    {
      title: "CONFIGURAÇÕES",
      items: [
        [
          "notifications-outline",
          "Notificações",
          "Lembretes e alertas",
          "/configuracoes/notificacoes",
          false,
        ],
        [
          "moon-outline",
          "Aparência",
          "Tema e fonte",
          "/configuracoes/aparencia",
          false,
        ],
        [
          "shield-outline",
          "Privacidade",
          "Dados e segurança",
          "/configuracoes/privacidade",
          false,
        ],
        ["settings-outline", "Conta", "Email e senha", "/conta", false],
      ],
    },
    {
      title: "OUTROS",
      items: [
        ["star-outline", "Avaliar o app", "Sua opinião importa", "", false],
        [
          "share-social-outline",
          "Indicar para amigos",
          "Ganhe 30 dias Premium",
          "/indicar",
          false,
        ],
        [
          "help-circle-outline",
          "Ajuda e suporte",
          "FAQ e contato",
          "/ajuda",
          false,
        ],
      ],
    },
  ] as const;
  return (
    <View style={[profileStyles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={profileStyles.content}>
        <View
          style={[
            profileStyles.profileHeader,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <View
            style={[profileStyles.avatar, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="person" size={28} color={theme.onPrimary} />
          </View>
          <View style={profileStyles.flex}>
            <Text style={[profileStyles.name, { color: theme.text }]}>
              {user?.name || "Aluno ConcursoMestre"}
            </Text>
            <Text style={[profileStyles.email, { color: theme.textMuted }]}>
              {user?.email || "--"}
            </Text>
            <View
              style={[
                profileStyles.streak,
                { backgroundColor: theme.warningSubtle },
              ]}
            >
              <Ionicons name="flame" size={13} color={theme.warning} />
              <Text
                style={[profileStyles.streakText, { color: theme.warning }]}
              >
                Sequência de estudos
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/perfil/editar")}
            style={[profileStyles.editButton, { borderColor: theme.border }]}
          >
            <Text style={[profileStyles.editText, { color: theme.text }]}>
              Editar
            </Text>
          </Pressable>
        </View>
        <View style={profileStyles.stats}>
          {[
            ["book-outline", user?.xp ? `${user.xp}` : "--", "XP"],
            ["locate-outline", `Nível ${user?.level || 1}`, "progresso"],
            [
              "time-outline",
              user?.subscription?.plan?.name || "Gratuito",
              "plano",
            ],
          ].map(([icon, value, label]) => (
            <View
              key={label}
              style={[profileStyles.stat, { backgroundColor: theme.surface }]}
            >
              <Ionicons
                name={icon as keyof typeof Ionicons.glyphMap}
                size={17}
                color={theme.primary}
              />
              <Text style={[profileStyles.statValue, { color: theme.text }]}>
                {value}
              </Text>
              <Text
                style={[profileStyles.statLabel, { color: theme.textMuted }]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
        {sections.map((section) => (
          <View key={section.title} style={profileStyles.section}>
            <Text style={[profileStyles.overline, { color: theme.textMuted }]}>
              {section.title}
            </Text>
            <View
              style={[profileStyles.menu, { backgroundColor: theme.surface }]}
            >
              {section.items.map(([icon, label, description, path, accent]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  onPress={() =>
                    path
                      ? router.push(path as never)
                      : Alert.alert(
                          label,
                          "Obrigado por avaliar o ConcursoMestre.",
                        )
                  }
                  style={[
                    profileStyles.menuItem,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View
                    style={[
                      profileStyles.menuIcon,
                      {
                        backgroundColor: accent
                          ? theme.primary
                          : theme.surfaceSubtle,
                      },
                    ]}
                  >
                    <Ionicons
                      name={icon as keyof typeof Ionicons.glyphMap}
                      size={17}
                      color={accent ? theme.onPrimary : theme.text}
                    />
                  </View>
                  <View style={profileStyles.flex}>
                    <Text
                      style={[profileStyles.itemTitle, { color: theme.text }]}
                    >
                      {label}
                    </Text>
                    <Text
                      style={[profileStyles.email, { color: theme.textMuted }]}
                    >
                      {description}
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
          style={profileStyles.logout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.danger} />
          <Text style={[profileStyles.logoutText, { color: theme.danger }]}>
            Sair da conta
          </Text>
        </Pressable>
        <Text style={[profileStyles.version, { color: theme.textMuted }]}>
          Versão 1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

type SettingsSection =
  "estudo" | "metas" | "notificacoes";
const settingsContent: Record<
  SettingsSection,
  { title: string; subtitle: string; options: string[] }
> = {
  estudo: {
    title: "Preferências de estudo",
    subtitle: "Matérias e nível",
    options: ["Concurso alvo", "Matérias favoritas", "Nível de dificuldade"],
  },
  metas: {
    title: "Metas diárias",
    subtitle: "30 questões por dia",
    options: ["Questões por dia", "Dias de estudo", "Horário preferido"],
  },
  notificacoes: {
    title: "Notificações",
    subtitle: "Lembretes e alertas",
    options: ["Lembrete de estudo", "Novos conteúdos"],
  },
};

export function SettingsScreen({ section }: { section: SettingsSection }) {
  const theme = useAppTheme();
  const content = settingsContent[section];
  const [values, setValues] = React.useState<Record<string, boolean>>({});
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader title={content.title} subtitle={content.subtitle} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.settingsCard, { backgroundColor: theme.surface }]}>
          {content.options.map((option, index) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() =>
                setValues({ ...values, [option]: !values[option] })
              }
              style={[
                styles.settingRow,
                index > 0 && {
                  borderTopColor: theme.border,
                  borderTopWidth: 1,
                },
              ]}
            >
              <View style={styles.flex}>
                <Text style={[styles.itemTitle, { color: theme.text }]}>
                  {option}
                </Text>
                <Text style={[styles.caption, { color: theme.textMuted }]}>
                  {values[option] ? "Ativado" : "Toque para configurar"}
                </Text>
              </View>
              <Ionicons
                name={values[option] ? "checkmark-circle" : "chevron-forward"}
                size={21}
                color={values[option] ? theme.success : theme.textMuted}
              />
            </Pressable>
          ))}
        </View>
        <Text style={[styles.helper, { color: theme.textMuted }]}>
          As preferências são salvas neste aparelho e sincronizadas quando sua
          conta estiver conectada.
        </Text>
      </ScrollView>
    </View>
  );
}

function FocusPickerModal({
  visible,
  value,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  options: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const theme = useAppTheme();
  const [search, setSearch] = React.useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredOptions = options
    .filter(
      (option) =>
        !normalizedSearch ||
        option.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  React.useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.focusModalBackdrop}>
        <View style={[styles.focusModal, { backgroundColor: theme.surface }]}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={[styles.focusModalTitle, { color: theme.text }]}>
                Escolha seu foco
              </Text>
              <Text style={[styles.caption, { color: theme.textMuted }]}>
                Selecione um foco cadastrado na plataforma.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              onPress={onClose}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={21} color={theme.textMuted} />
            </Pressable>
          </View>

          <View
            style={[
              styles.focusSearch,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="search-outline" size={17} color={theme.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar foco"
              placeholderTextColor={theme.textSubtle}
              style={[styles.focusSearchInput, { color: theme.text }]}
              autoCapitalize="none"
            />
          </View>

          <ScrollView
            style={styles.focusList}
            contentContainerStyle={styles.focusListContent}
            keyboardShouldPersistTaps="handled"
          >
            {filteredOptions.map((option) => {
              const selected = option.name === value;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  onPress={() => onSelect(option.name)}
                  style={[
                    styles.focusOption,
                    {
                      backgroundColor: selected
                        ? theme.primarySubtle
                        : theme.surfaceSubtle,
                      borderColor: selected ? theme.primary : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.focusOptionText,
                      { color: selected ? theme.primary : theme.text },
                    ]}
                  >
                    {option.name}
                  </Text>
                  <Ionicons
                    name={selected ? "checkmark-circle" : "chevron-forward"}
                    size={19}
                    color={selected ? theme.primary : theme.textMuted}
                  />
                </Pressable>
              );
            })}
            {!filteredOptions.length && (
              <Text style={[styles.empty, { color: theme.textMuted }]}>
                Nenhum foco corresponde à busca.
              </Text>
            )}
          </ScrollView>

          <Text style={[styles.focusModalFooter, { color: theme.textMuted }]}>
            O foco personaliza suas recomendações e rankings.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export function EditProfileScreen() {
  const theme = useAppTheme();
  const { user, updateUser, refreshProfile, systemSettings } = useAuth();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const isCheckoutFlow = checkout === "1";
  const [name, setName] = React.useState(user?.name || "");
  const [focus, setFocus] = React.useState(user?.targetExam || "");
  const [photoUrl, setPhotoUrl] = React.useState(user?.photoUrl || "");
  const [cpf, setCpf] = React.useState(user?.cpf || "");
  const [zipCode, setZipCode] = React.useState(user?.address?.zipCode || "");
  const [street, setStreet] = React.useState(user?.address?.street || "");
  const [addressNumber, setAddressNumber] = React.useState(
    user?.address?.number || "",
  );
  const [complement, setComplement] = React.useState(
    user?.address?.complement || "",
  );
  const [neighborhood, setNeighborhood] = React.useState(
    user?.address?.neighborhood || "",
  );
  const [city, setCity] = React.useState(user?.address?.city || "");
  const [state, setState] = React.useState(user?.address?.state || "");
  const [focusPickerVisible, setFocusPickerVisible] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPhotoBusy, setIsPhotoBusy] = React.useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] =
    React.useState(false);
  const [invalidFields, setInvalidFields] = React.useState<
    CheckoutProfileField[]
  >([]);
  const scrollViewRef = React.useRef<ScrollView | null>(null);
  const editCardYRef = React.useRef(0);
  const fieldYRef = React.useRef<
    Partial<Record<CheckoutProfileField, number>>
  >({});

  const photoUri = photoUrl ? getAssetUrl(photoUrl) : "";
  const isPreview = user?.id === "visual-preview-user";

  React.useEffect(() => {
    setName(user?.name || "");
    setFocus(user?.targetExam || "");
    setPhotoUrl(user?.photoUrl || "");
    setCpf(user?.cpf || "");
    setZipCode(user?.address?.zipCode || "");
    setStreet(user?.address?.street || "");
    setAddressNumber(user?.address?.number || "");
    setComplement(user?.address?.complement || "");
    setNeighborhood(user?.address?.neighborhood || "");
    setCity(user?.address?.city || "");
    setState(user?.address?.state || "");
  }, [
    user?.name,
    user?.targetExam,
    user?.photoUrl,
    user?.cpf,
    user?.address?.zipCode,
    user?.address?.street,
    user?.address?.number,
    user?.address?.complement,
    user?.address?.neighborhood,
    user?.address?.city,
    user?.address?.state,
  ]);

  const missingCheckoutFields = React.useMemo(
    () => getMissingCheckoutProfileFields(user),
    [user],
  );

  const isFieldInvalid = (field: CheckoutProfileField): boolean =>
    invalidFields.includes(field);

  const invalidInputStyle = (field: CheckoutProfileField) =>
    isFieldInvalid(field)
      ? {
          backgroundColor: theme.dangerSubtle,
          borderColor: theme.danger,
          borderWidth: 2,
        }
      : null;

  const invalidLabelStyle = (field: CheckoutProfileField) =>
    isFieldInvalid(field) ? { color: theme.danger } : null;

  const clearInvalidField = (field: CheckoutProfileField) => {
    setInvalidFields((current) =>
      current.filter((invalidField) => invalidField !== field),
    );
  };

  const rememberFieldPosition = (
    field: CheckoutProfileField,
    y: number,
  ) => {
    fieldYRef.current[field] = y;
  };

  const scrollToFirstInvalidField = (fields: CheckoutProfileField[]) => {
    const firstPosition = fields
      .map((field) => fieldYRef.current[field])
      .filter((position): position is number => typeof position === "number")
      .sort((left, right) => left - right)[0];

    if (firstPosition === undefined) return;
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(editCardYRef.current + firstPosition - 24, 0),
        animated: true,
      });
    });
  };

  const resendEmailConfirmation = async () => {
    if (!user?.email || isResendingConfirmation) return;
    setIsResendingConfirmation(true);
    try {
      const message = await authFlowService.resendConfirmation(user.email);
      Alert.alert("Confirmação de e-mail", message);
    } catch (error) {
      Alert.alert(
        "Confirmação de e-mail",
        error instanceof Error
          ? error.message
          : "Não foi possível reenviar o e-mail agora.",
      );
    } finally {
      setIsResendingConfirmation(false);
    }
  };

  const pickPhoto = async () => {
    if (isPreview) {
      Alert.alert(
        "Foto de perfil",
        "A edição de foto fica disponível após entrar com uma conta real.",
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita o acesso às fotos para escolher uma imagem de perfil.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setIsPhotoBusy(true);
    try {
      const uploaded = await accountService.uploadProfilePhoto(
        asset.uri,
        asset.mimeType || "image/jpeg",
        asset.fileName || "profile-photo.jpg",
      );
      if (uploaded.photoUrl) setPhotoUrl(uploaded.photoUrl);
      await refreshProfile();
      Alert.alert("Foto de perfil", uploaded.message);
    } catch (error) {
      Alert.alert(
        "Foto de perfil",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar sua foto.",
      );
    } finally {
      setIsPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert(
      "Remover foto?",
      "A foto será removida do seu perfil em todos os dispositivos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsPhotoBusy(true);
              try {
                const removed = await accountService.removeProfilePhoto();
                setPhotoUrl("");
                await refreshProfile();
                Alert.alert("Foto de perfil", removed.message);
              } catch (error) {
                Alert.alert(
                  "Foto de perfil",
                  error instanceof Error
                    ? error.message
                    : "Não foi possível remover sua foto.",
                );
              } finally {
                setIsPhotoBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const save = async () => {
    const nextName = name.trim();
    const nextCpf = cpf.trim();
    const nextAddress = {
      zipCode: zipCode.trim(),
      street: street.trim(),
      number: addressNumber.trim(),
      complement: complement.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
    };
    const hasAddressInput = Object.values(nextAddress).some(Boolean);
    const profileForValidation = {
      ...user,
      name: nextName,
      cpf: nextCpf,
      address: nextAddress,
      emailVerified: user?.emailVerified,
    };

    if (isCheckoutFlow) {
      const missingFormFields = getMissingCheckoutProfileFields(
        profileForValidation,
      );

      if (missingFormFields.length > 0) {
        setInvalidFields(missingFormFields);
        scrollToFirstInvalidField(missingFormFields);
        Alert.alert(
          "Complete seu perfil",
          `Para iniciar o checkout, preencha ou corrija: ${formatCheckoutProfileFields(
            missingFormFields,
          )}.`,
        );
        return;
      }
    } else if (!nextName) {
      const missingName: CheckoutProfileField[] = ["name"];
      setInvalidFields(missingName);
      scrollToFirstInvalidField(missingName);
      Alert.alert("Perfil", "Informe seu nome.");
      return;
    }

    setInvalidFields([]);
    setIsSaving(true);
    try {
      const payload: Parameters<typeof updateUser>[0] = {
        name: nextName,
        targetExam: focus.trim(),
      };
      if (nextCpf) payload.cpf = nextCpf;
      if (hasAddressInput) payload.address = nextAddress;

      await updateUser(payload);
      Alert.alert("Perfil", "Dados atualizados.");
      router.back();
    } catch (error) {
      Alert.alert(
        "Perfil",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar os dados.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ContentHeader
        title="Editar perfil"
        subtitle="Atualize seus dados pessoais"
      />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {isCheckoutFlow ? (
          <View
            style={[
              styles.checkoutGuide,
              {
                backgroundColor: theme.warningSubtle,
                borderColor: theme.warningBorder,
              },
            ]}
          >
            <View style={styles.checkoutGuideHeader}>
              <Ionicons name="card-outline" size={22} color={theme.warning} />
              <Text style={[styles.checkoutGuideTitle, { color: theme.text }]}>
                Complete seu perfil para assinar
              </Text>
            </View>
            <Text style={[styles.checkoutGuideText, { color: theme.textMuted }]}>
              O checkout precisa dos dados de cobrança abaixo. Preencha os
              campos obrigatórios e confirme o e-mail da conta; depois salve e
              volte à página de planos para tentar novamente.
            </Text>
            {missingCheckoutFields.length > 0 ? (
              <Text style={[styles.checkoutMissingText, { color: theme.text }]}>
                Ainda falta: {formatCheckoutProfileFields(missingCheckoutFields)}.
              </Text>
            ) : (
              <Text style={[styles.checkoutMissingText, { color: theme.success }]}>
                Dados do perfil preenchidos. Falta apenas salvar, se necessário.
              </Text>
            )}
            {!user?.emailVerified ? (
              <Pressable
                accessibilityRole="button"
                disabled={isResendingConfirmation}
                onPress={() => void resendEmailConfirmation()}
                style={[styles.secondaryButton, { borderColor: theme.warning }]}
              >
                {isResendingConfirmation ? (
                  <ActivityIndicator color={theme.warning} />
                ) : (
                  <Text
                    style={[styles.secondaryButtonText, { color: theme.warning }]}
                  >
                    Reenviar confirmação de e-mail
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View
          onLayout={(event) => {
            editCardYRef.current = event.nativeEvent.layout.y;
          }}
          style={[styles.editCard, { backgroundColor: theme.surface }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
            disabled={isPhotoBusy}
            onPress={() => void pickPhoto()}
            style={[
              styles.profileAvatar,
              { backgroundColor: theme.primary },
              isPhotoBusy && { opacity: 0.7 },
            ]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person" size={30} color={theme.onPrimary} />
            )}
            <View style={styles.photoOverlay}>
              <Ionicons name="camera-outline" size={17} color="#FFFFFF" />
            </View>
            {isPhotoBusy && (
              <ActivityIndicator color="#FFFFFF" style={styles.photoLoader} />
            )}
          </Pressable>
          <Text style={[styles.photoHint, { color: theme.textMuted }]}>
            {isPhotoBusy ? "Atualizando foto..." : "Toque para alterar a foto"}
          </Text>
          {photoUrl ? (
            <Pressable
              accessibilityRole="button"
              disabled={isPhotoBusy}
              onPress={removePhoto}
              style={styles.removePhotoButton}
            >
              <Ionicons name="trash-outline" size={15} color={theme.danger} />
              <Text style={[styles.removePhotoText, { color: theme.danger }]}>
                Remover foto
              </Text>
            </Pressable>
          ) : null}
          <Text
            onLayout={(event) =>
              rememberFieldPosition("name", event.nativeEvent.layout.y)
            }
            style={[styles.label, { color: theme.textMuted }, invalidLabelStyle("name")]}
          >
            Nome
          </Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              clearInvalidField("name");
            }}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("name"),
            ]}
            placeholder="Seu nome"
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("emailVerified", event.nativeEvent.layout.y)
            }
            style={[
              styles.label,
              { color: theme.textMuted },
              invalidLabelStyle("emailVerified"),
            ]}
          >
            Email
          </Text>
          <TextInput
            value={user?.email || ""}
            editable={false}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.textMuted,
              },
              invalidInputStyle("emailVerified"),
            ]}
          />
          {isFieldInvalid("emailVerified") ? (
            <Text style={[styles.fieldError, { color: theme.danger }]}>
              Confirme o e-mail para continuar com a assinatura.
            </Text>
          ) : null}
          <Text
            onLayout={(event) =>
              rememberFieldPosition("cpf", event.nativeEvent.layout.y)
            }
            style={[styles.label, { color: theme.textMuted }, invalidLabelStyle("cpf")]}
          >
            CPF
          </Text>
          <TextInput
            value={formatCpf(cpf)}
            onChangeText={(value) => {
              setCpf(formatCpf(value));
              clearInvalidField("cpf");
            }}
            keyboardType="number-pad"
            maxLength={14}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("cpf"),
            ]}
            placeholder="000.000.000-00"
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("zipCode", event.nativeEvent.layout.y)
            }
            style={[
              styles.label,
              { color: theme.textMuted },
              invalidLabelStyle("zipCode"),
            ]}
          >
            CEP
          </Text>
          <TextInput
            value={formatCep(zipCode)}
            onChangeText={(value) => {
              setZipCode(formatCep(value));
              clearInvalidField("zipCode");
            }}
            keyboardType="number-pad"
            maxLength={9}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("zipCode"),
            ]}
            placeholder="00000-000"
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("street", event.nativeEvent.layout.y)
            }
            style={[styles.label, { color: theme.textMuted }, invalidLabelStyle("street")]}
          >
            Logradouro
          </Text>
          <TextInput
            value={street}
            onChangeText={(value) => {
              setStreet(value);
              clearInvalidField("street");
            }}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("street"),
            ]}
            placeholder="Rua, avenida..."
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("number", event.nativeEvent.layout.y)
            }
            style={[styles.label, { color: theme.textMuted }, invalidLabelStyle("number")]}
          >
            Número
          </Text>
          <TextInput
            value={addressNumber}
            onChangeText={(value) => {
              setAddressNumber(value);
              clearInvalidField("number");
            }}
            keyboardType="number-pad"
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("number"),
            ]}
            placeholder="Número"
            placeholderTextColor={theme.textSubtle}
          />
          <Text style={[styles.label, { color: theme.textMuted }]}>Complemento (opcional)</Text>
          <TextInput
            value={complement}
            onChangeText={setComplement}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="Apartamento, sala..."
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("neighborhood", event.nativeEvent.layout.y)
            }
            style={[
              styles.label,
              { color: theme.textMuted },
              invalidLabelStyle("neighborhood"),
            ]}
          >
            Bairro
          </Text>
          <TextInput
            value={neighborhood}
            onChangeText={(value) => {
              setNeighborhood(value);
              clearInvalidField("neighborhood");
            }}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("neighborhood"),
            ]}
            placeholder="Bairro"
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("city", event.nativeEvent.layout.y)
            }
            style={[styles.label, { color: theme.textMuted }, invalidLabelStyle("city")]}
          >
            Cidade
          </Text>
          <TextInput
            value={city}
            onChangeText={(value) => {
              setCity(value);
              clearInvalidField("city");
            }}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("city"),
            ]}
            placeholder="Cidade"
            placeholderTextColor={theme.textSubtle}
          />
          <Text
            onLayout={(event) =>
              rememberFieldPosition("state", event.nativeEvent.layout.y)
            }
            style={[styles.label, { color: theme.textMuted }, invalidLabelStyle("state")]}
          >
            UF
          </Text>
          <TextInput
            value={state}
            onChangeText={(value) => {
              setState(value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase());
              clearInvalidField("state");
            }}
            autoCapitalize="characters"
            maxLength={2}
            style={[
              styles.input,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
                color: theme.text,
              },
              invalidInputStyle("state"),
            ]}
            placeholder="SP"
            placeholderTextColor={theme.textSubtle}
          />
          <Text style={[styles.label, { color: theme.textMuted }]}>Foco de estudo</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selecionar foco de estudo"
            onPress={() => setFocusPickerVisible(true)}
            style={[
              styles.focusField,
              {
                backgroundColor: theme.surfaceSubtle,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.focusFieldText,
                { color: focus ? theme.text : theme.textSubtle },
              ]}
            >
              {focus || "Selecione seu foco"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.textMuted}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void save()}
          style={[
            styles.primaryButton,
            { backgroundColor: theme.primary },
            isSaving && { opacity: 0.65 },
          ]}
        >
          <Text style={[styles.buttonText, { color: theme.onPrimary }]}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Text>
        </Pressable>
      </ScrollView>
      <FocusPickerModal
        visible={focusPickerVisible}
        value={focus}
        options={systemSettings.taxonomies.careers}
        onClose={() => setFocusPickerVisible(false)}
        onSelect={(value) => {
          setFocus(value);
          setFocusPickerVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing[4], padding: spacing[5], paddingBottom: spacing[12] },
  flex: { flex: 1, gap: 2 },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
  },
  tutorialCard: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  iconBox: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  itemTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  caption: { fontSize: typography.size.xs, lineHeight: 17 },
  searchBox: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  searchInput: { flex: 1, fontSize: typography.size.sm, minHeight: 48 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  category: {
    borderRadius: radius.md,
    gap: spacing[1],
    padding: spacing[4],
    width: "48%",
  },
  smallIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 40,
    justifyContent: "center",
    marginBottom: spacing[2],
    width: 40,
  },
  overline: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  list: { gap: spacing[2] },
  faq: { borderRadius: radius.md, gap: spacing[2], padding: spacing[4] },
  empty: { padding: spacing[5], textAlign: "center" },
  contact: { borderRadius: radius.md, gap: spacing[2], padding: spacing[5] },
  contactActions: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[2],
  },
  outlineButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 46,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[4],
  },
  buttonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  inviteHero: {
    alignItems: "center",
    borderRadius: radius.lg,
    gap: spacing[2],
    padding: spacing[6],
  },
  giftIcon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF2E",
    borderRadius: radius.lg,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  heroTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
  heroSubtitle: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  codeCard: { borderRadius: radius.md, gap: spacing[3], padding: spacing[5] },
  codeRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  codeBox: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing[3],
  },
  code: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    letterSpacing: 3,
  },
  copyButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  statsGrid: { flexDirection: "row", gap: spacing[2] },
  statCard: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    gap: 3,
    padding: spacing[3],
  },
  statValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  steps: { borderRadius: radius.md, overflow: "hidden" },
  step: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  stepNumber: {
    alignItems: "center",
    borderRadius: 20,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  settingsCard: { borderRadius: radius.md, overflow: "hidden" },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  helper: { fontSize: typography.size.xs, lineHeight: 18 },
  editCard: {
    alignItems: "stretch",
    borderRadius: radius.md,
    gap: spacing[3],
    padding: spacing[5],
  },
  checkoutGuide: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[4],
  },
  checkoutGuideHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
  },
  checkoutGuideTitle: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.bold,
  },
  checkoutGuideText: {
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  checkoutMissingText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    lineHeight: 20,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[3],
  },
  secondaryButtonText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
  },
  profileAvatar: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 48,
    height: 80,
    justifyContent: "center",
    marginBottom: spacing[2],
    overflow: "hidden",
    position: "relative",
    width: 80,
  },
  profileImage: { height: "100%", width: "100%" },
  photoOverlay: {
    alignItems: "center",
    backgroundColor: "#00000080",
    bottom: 0,
    height: 28,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  photoLoader: { left: 0, position: "absolute", right: 0 },
  photoHint: {
    alignSelf: "center",
    fontSize: typography.size.xs,
    marginTop: -spacing[2],
  },
  removePhotoButton: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: spacing[1],
    paddingVertical: spacing[1],
  },
  removePhotoText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: spacing[2],
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  fieldError: {
    fontSize: typography.size.xs,
    marginTop: -spacing[2],
  },
  focusModalBackdrop: {
    alignItems: "center",
    backgroundColor: "#00000099",
    flex: 1,
    justifyContent: "flex-end",
  },
  focusModal: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: "88%",
    padding: spacing[5],
    width: "100%",
  },
  focusModalTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  modalClose: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  focusSearch: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[4],
    paddingHorizontal: spacing[3],
  },
  focusSearchInput: { flex: 1, fontSize: typography.size.sm, minHeight: 48 },
  focusList: { marginTop: spacing[3] },
  focusListContent: { gap: spacing[2], paddingBottom: spacing[3] },
  focusOption: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    padding: spacing[4],
  },
  focusOptionText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  focusModalFooter: {
    fontSize: 10,
    paddingTop: spacing[2],
    textAlign: "center",
    textTransform: "uppercase",
  },
  focusField: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  focusFieldText: { flex: 1, fontSize: typography.size.sm },
});

const profileStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: spacing[12] },
  flex: { flex: 1 },
  profileHeader: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
  },
  avatar: {
    alignItems: "center",
    borderRadius: radius.lg,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  name: { fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  email: { fontSize: typography.size.xs, marginTop: 2 },
  streak: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 4,
    marginTop: spacing[2],
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  streakText: { fontSize: 10, fontWeight: typography.weight.medium },
  editButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  editText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  stats: { flexDirection: "row", gap: spacing[2], padding: spacing[5] },
  stat: {
    alignItems: "center",
    borderRadius: radius.md,
    flex: 1,
    gap: 3,
    padding: spacing[3],
  },
  statValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    textAlign: "center",
  },
  statLabel: { fontSize: 10, textAlign: "center" },
  section: {
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  overline: {
    fontSize: 11,
    fontWeight: typography.weight.bold,
    letterSpacing: 1,
  },
  menu: { borderRadius: radius.md, overflow: "hidden" },
  menuItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4],
  },
  menuIcon: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  itemTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  logout: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    marginHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  logoutText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
  version: { fontSize: 10, paddingTop: spacing[2], textAlign: "center" },
});
