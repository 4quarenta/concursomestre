import React from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { AppButton, AppSurface, AppText, MotionPressable } from "@/components/ui/Primitives";
import { AnimatedModal } from "@/components/ui/AnimatedModal";
import { ContentHeader } from "@/features/content/components/ContentHeader";
import { borders, darkTheme, layout, radius, shadows, spacing, typography } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/providers/AuthProvider";
import { readApiErrorMessage } from "@/services/api/response";
import { supportService } from "@/services/support/supportService";
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
    "Na página Perfil, toque em Foco de estudo e escolha uma das áreas disponíveis.",
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
  const insets = useSafeAreaInsets();
  const helpStyles = React.useMemo(() => createHelpStyles(theme), [theme]);
  const { user, isLoading: authLoading } = useAuth();
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState<number | null>(null);
  const [supportModalVisible, setSupportModalVisible] = React.useState(false);
  const [supportSubject, setSupportSubject] = React.useState("");
  const [supportDetails, setSupportDetails] = React.useState("");
  const [supportSubmitting, setSupportSubmitting] = React.useState(false);
  const [supportError, setSupportError] = React.useState("");
  const [supportSuccess, setSupportSuccess] = React.useState("");
  const filtered = faqs.filter(([question, answer]) =>
    `${question} ${answer}`.toLowerCase().includes(search.toLowerCase()),
  );

  const closeSupportModal = () => {
    if (supportSubmitting) return;
    setSupportModalVisible(false);
    setSupportSubject("");
    setSupportDetails("");
    setSupportError("");
    setSupportSuccess("");
  };

  const submitSupportRequest = async () => {
    setSupportError("");
    if (!user) {
      setSupportError("Entre na sua conta para enviar uma solicitação ao suporte.");
      return;
    }
    if (!supportSubject.trim()) {
      setSupportError("Preencha um resumo curto para o chamado.");
      return;
    }
    if (!supportDetails.trim()) {
      setSupportError("Descreva o contexto da sua solicitação.");
      return;
    }

    setSupportSubmitting(true);
    try {
      const result = await supportService.createSupportRequest({
        subject: supportSubject.trim(),
        details: supportDetails.trim(),
      });
      setSupportSuccess(result.message);
    } catch (error) {
      setSupportError(readApiErrorMessage(error, "Não foi possível enviar sua solicitação."));
    } finally {
      setSupportSubmitting(false);
    }
  };

  return (
    <View style={helpStyles.screen}>
      <ContentHeader
        title="Ajuda e suporte"
        subtitle="Encontre respostas e fale com a equipe"
      />
      <ScrollView
        contentContainerStyle={[helpStyles.content, { paddingBottom: spacing[8] + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MotionPressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              "Tutorial",
              "O tutorial guiado será exibido novamente na próxima abertura.",
            )
          }
        >
          <AppSurface variant="outlined" style={helpStyles.tutorialCard}>
            <View style={helpStyles.tutorialIcon}>
              <Ionicons name="sparkles-outline" size={19} color={theme.primary} />
            </View>
            <View style={helpStyles.flex}>
              <AppText variant="bodyStrong">Ver tutorial novamente</AppText>
              <AppText variant="caption" tone="muted">Aprenda como usar o app em 30s</AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </AppSurface>
        </MotionPressable>
        <View style={helpStyles.searchBox}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ajuda..."
            placeholderTextColor={theme.textSubtle}
            style={helpStyles.searchInput}
            returnKeyType="search"
          />
        </View>
        {!search && (
          <View style={helpStyles.categoryGrid}>
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
              <AppSurface
                key={label}
                variant="outlined"
                style={helpStyles.category}
              >
                <View style={helpStyles.categoryIcon}>
                  <Ionicons
                    name={icon as keyof typeof Ionicons.glyphMap}
                    size={19}
                    color={theme.primary}
                  />
                </View>
                <AppText variant="bodyStrong">{label}</AppText>
                <AppText variant="caption" tone="muted">{count}</AppText>
              </AppSurface>
            ))}
          </View>
        )}
        <AppText variant="sectionTitle">Perguntas frequentes</AppText>
        <View style={helpStyles.list}>
          {filtered.map(([question, answer], index) => (
            <AppSurface
              key={question}
              variant="outlined"
              style={helpStyles.faq}
            >
              <MotionPressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open === index }}
                onPress={() => setOpen(open === index ? null : index)}
                style={helpStyles.faqPressable}
              >
                <View style={helpStyles.faqQuestion}>
                  <AppText variant="bodyStrong" style={helpStyles.flex}>
                    {question}
                  </AppText>
                  <Ionicons
                    name={open === index ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={theme.textMuted}
                  />
                </View>
                {open === index ? (
                  <AppText variant="body" tone="muted" style={helpStyles.answer}>
                    {answer}
                  </AppText>
                ) : null}
              </MotionPressable>
            </AppSurface>
          ))}
          {filtered.length === 0 && (
            <AppSurface variant="outlined" style={helpStyles.empty}>
              <AppText variant="body" tone="muted">Nenhum resultado encontrado</AppText>
            </AppSurface>
          )}
        </View>
        <AppSurface variant="outlined" style={helpStyles.contact}>
          <AppText variant="sectionTitle">Não encontrou o que procurava?</AppText>
          <AppText variant="body" tone="muted">Nossa equipe responde em até 24h</AppText>
          <View style={helpStyles.contactActions}>
            <AppButton
              label="Email"
              variant="secondary"
              leading={<Ionicons name="mail-outline" size={16} color={theme.text} />}
              onPress={() => Alert.alert("Email", "Envie sua dúvida para suporte@concursomestre.com")}
              style={helpStyles.contactButton}
            />
            <AppButton
              label="Suporte"
              leading={<Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.onPrimary} />}
              onPress={() => {
                setSupportError("");
                setSupportSuccess("");
                setSupportModalVisible(true);
              }}
              style={helpStyles.contactButton}
            />
          </View>
        </AppSurface>
      </ScrollView>

      <AnimatedModal
        mode="sheet"
        onRequestClose={closeSupportModal}
        transparent
        visible={supportModalVisible}
      >
        <View style={helpStyles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar formulário de suporte"
            disabled={supportSubmitting}
            onPress={closeSupportModal}
            style={helpStyles.modalBackdropDismiss}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={helpStyles.modalKeyboard}
          >
            <View style={[helpStyles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing[4]) + spacing[2] }]}>
              <View style={helpStyles.modalHandle} />
              <AppText variant="sectionTitle">Fale com o suporte</AppText>
              <AppText variant="body" tone="muted">
                Envie sua dúvida sobre conta, assinatura, cobrança ou uso da plataforma.
              </AppText>

              {!user ? (
                <View style={helpStyles.guestSupport}>
                  <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
                  <AppText variant="body" tone="muted">
                    {authLoading ? "Verificando sua sessão…" : "Faça login para enviar e acompanhar sua solicitação."}
                  </AppText>
                </View>
              ) : supportSuccess ? (
                <View style={helpStyles.supportSuccess}>
                  <Ionicons name="checkmark-circle-outline" size={34} color={theme.success} />
                  <AppText variant="bodyStrong">Solicitação enviada</AppText>
                  <AppText variant="body" tone="muted">{supportSuccess}</AppText>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={helpStyles.modalForm}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                >
                  <View style={helpStyles.supportGuidance}>
                    <AppText variant="label" tone="muted">ANTES DE ENVIAR</AppText>
                    <AppText variant="caption" tone="muted">
                      Informe o assunto e descreva o que aconteceu. Quanto mais contexto, melhor poderemos ajudar.
                    </AppText>
                  </View>
                  <AppText variant="label">Assunto <AppText variant="label" tone="danger">*</AppText></AppText>
                  <TextInput
                    accessibilityLabel="Assunto da solicitação"
                    autoCapitalize="sentences"
                    editable={!supportSubmitting}
                    maxLength={255}
                    onChangeText={setSupportSubject}
                    placeholder="Ex.: dúvida sobre renovação"
                    placeholderTextColor={theme.textSubtle}
                    returnKeyType="next"
                    style={helpStyles.supportSubjectInput}
                    value={supportSubject}
                  />
                  <AppText variant="label">Descrição <AppText variant="label" tone="danger">*</AppText></AppText>
                  <TextInput
                    accessibilityLabel="Descrição da solicitação"
                    autoCapitalize="sentences"
                    editable={!supportSubmitting}
                    maxLength={5000}
                    multiline
                    onChangeText={setSupportDetails}
                    placeholder="Explique sua dúvida ou o problema com o máximo de contexto."
                    placeholderTextColor={theme.textSubtle}
                    style={helpStyles.supportDetailsInput}
                    textAlignVertical="top"
                    value={supportDetails}
                  />
                  {supportError ? <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{supportError}</AppText> : null}
                </ScrollView>
              )}

              <View style={helpStyles.modalFooter}>
                {user && supportSuccess ? (
                  <AppButton label="Fechar" variant="secondary" onPress={closeSupportModal} style={helpStyles.modalButton} />
                ) : user ? (
                  <>
                    <AppButton label="Cancelar" variant="secondary" disabled={supportSubmitting} onPress={closeSupportModal} style={helpStyles.modalButton} />
                    <AppButton
                      label="Enviar solicitação"
                      loading={supportSubmitting}
                      disabled={!supportSubject.trim() || !supportDetails.trim()}
                      onPress={() => void submitSupportRequest()}
                      style={helpStyles.modalButton}
                    />
                  </>
                ) : (
                  <>
                    <AppButton label="Cancelar" variant="secondary" onPress={closeSupportModal} style={helpStyles.modalButton} />
                    <AppButton
                      label={authLoading ? "Aguarde" : "Fazer login"}
                      disabled={authLoading}
                      onPress={() => {
                        closeSupportModal();
                        router.push("/login" as never);
                      }}
                      style={helpStyles.modalButton}
                    />
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </AnimatedModal>
    </View>
  );
}

const createHelpStyles = (theme: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  screen: { backgroundColor: theme.background, flex: 1 },
  content: { gap: spacing[4], paddingHorizontal: spacing[5], paddingTop: spacing[5] },
  flex: { flex: 1 },
  tutorialCard: { alignItems: "center", borderWidth: borders.subtle, flexDirection: "row", gap: spacing[3], minHeight: 76 },
  tutorialIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.button, height: 40, justifyContent: "center", width: 40 },
  searchBox: { alignItems: "center", backgroundColor: theme.surface, borderColor: theme.border, borderRadius: radius.field, borderWidth: borders.subtle, flexDirection: "row", gap: spacing[2], minHeight: layout.controlHeight, paddingHorizontal: spacing[3] },
  searchInput: { color: theme.text, flex: 1, fontSize: typography.role.body.fontSize, minHeight: layout.controlHeight },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  category: { borderWidth: borders.subtle, flexBasis: "47%", flexGrow: 1, gap: spacing[2], minHeight: 132 },
  categoryIcon: { alignItems: "center", backgroundColor: theme.primarySubtle, borderRadius: radius.button, height: 40, justifyContent: "center", marginBottom: spacing[1], width: 40 },
  list: { gap: spacing[2] },
  faq: { borderWidth: borders.subtle, padding: 0 },
  faqPressable: { gap: spacing[3], padding: spacing[4] },
  faqQuestion: { alignItems: "center", flexDirection: "row", gap: spacing[3] },
  answer: { borderTopColor: theme.border, borderTopWidth: borders.hairline, paddingTop: spacing[3] },
  empty: { alignItems: "center", borderWidth: borders.subtle, padding: spacing[4] },
  contact: { borderWidth: borders.subtle, gap: spacing[2] },
  contactActions: { flexDirection: "row", gap: spacing[2], marginTop: spacing[2] },
  contactButton: { flex: 1 },
  modalBackdrop: { backgroundColor: "rgba(10,10,35,0.56)", flex: 1, justifyContent: "flex-end" },
  modalBackdropDismiss: { ...StyleSheet.absoluteFill },
  modalKeyboard: { flex: 1, justifyContent: "flex-end", width: "100%" },
  modalSheet: { ...(theme === darkTheme ? shadows.modalDark : shadows.modal), backgroundColor: theme.surface, borderTopLeftRadius: radius.dialog, borderTopRightRadius: radius.dialog, gap: spacing[3], height: "88%", paddingHorizontal: spacing[5], paddingTop: spacing[3], width: "100%" },
  modalHandle: { alignSelf: "center", backgroundColor: theme.borderStrong, borderRadius: radius.pill, height: 4, marginBottom: spacing[1], width: 40 },
  guestSupport: { alignItems: "flex-start", borderColor: theme.border, borderRadius: radius.card, borderWidth: borders.subtle, gap: spacing[3], padding: spacing[4] },
  supportSuccess: { alignItems: "center", flex: 1, gap: spacing[3], justifyContent: "center", padding: spacing[5] },
  modalForm: { gap: spacing[2], paddingBottom: spacing[3] },
  supportGuidance: { backgroundColor: theme.surfaceSubtle, borderColor: theme.border, borderRadius: radius.field, borderWidth: borders.subtle, gap: spacing[2], marginBottom: spacing[2], padding: spacing[3] },
  supportSubjectInput: { backgroundColor: theme.background, borderColor: theme.border, borderRadius: radius.field, borderWidth: borders.subtle, color: theme.text, fontSize: typography.role.body.fontSize, minHeight: layout.controlHeight, paddingHorizontal: spacing[3] },
  supportDetailsInput: { backgroundColor: theme.background, borderColor: theme.border, borderRadius: radius.field, borderWidth: borders.subtle, color: theme.text, fontSize: typography.role.body.fontSize, lineHeight: typography.role.body.lineHeight, minHeight: 136, padding: spacing[3] },
  modalFooter: { borderTopColor: theme.border, borderTopWidth: borders.hairline, flexDirection: "row", gap: spacing[3], paddingTop: spacing[3] },
  modalButton: { flex: 1 },
});

export function EditProfileScreen() {
  const theme = useAppTheme();
  const { user, updateUser, refreshProfile } = useAuth();
  const { checkout } = useLocalSearchParams<{ checkout?: string }>();
  const isCheckoutFlow = checkout === "1";
  const [name, setName] = React.useState(user?.name || "");
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
          style={[
            styles.editCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
            disabled={isPhotoBusy}
            onPress={() => void pickPhoto()}
            style={[
              styles.profileAvatar,
              {
                backgroundColor: theme.primarySubtle,
                borderColor: theme.primaryBorder,
              },
              isPhotoBusy && { opacity: 0.7 },
            ]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person" size={32} color={theme.primary} />
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
          <View style={styles.formSectionHeading}>
            <View
              style={[
                styles.formSectionIcon,
                { backgroundColor: theme.primarySubtle },
              ]}
            >
              <Ionicons name="person-outline" size={16} color={theme.primary} />
            </View>
            <View style={styles.formSectionCopy}>
              <AppText variant="sectionTitle">Dados pessoais</AppText>
              <AppText variant="caption" tone="muted">
                Informações usadas na sua conta
              </AppText>
            </View>
          </View>
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
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
          <View style={styles.formSectionHeading}>
            <View
              style={[
                styles.formSectionIcon,
                { backgroundColor: theme.primarySubtle },
              ]}
            >
              <Ionicons name="location-outline" size={16} color={theme.primary} />
            </View>
            <View style={styles.formSectionCopy}>
              <AppText variant="sectionTitle">Endereço de cobrança</AppText>
              <AppText variant="caption" tone="muted">
                Necessário para concluir uma assinatura
              </AppText>
            </View>
          </View>
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
        </View>
        <AppButton
          label="Salvar alterações"
          onPress={() => void save()}
          loading={isSaving}
          disabled={isSaving}
          leading={!isSaving ? <Ionicons name="checkmark" size={18} color={theme.onPrimary} /> : undefined}
          style={styles.saveButton}
        />
      </ScrollView>
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
  editCard: {
    alignItems: "stretch",
    borderRadius: radius.card,
    borderWidth: borders.subtle,
    gap: spacing[3],
    padding: spacing[5],
  },
  formSectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[2],
    marginBottom: spacing[1],
  },
  formSectionIcon: {
    alignItems: "center",
    borderRadius: radius.md,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  formSectionCopy: { flex: 1, gap: 2 },
  sectionDivider: { height: borders.hairline, marginVertical: spacing[2] },
  saveButton: { alignSelf: "stretch" },
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
    borderColor: "transparent",
    borderWidth: 2,
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
});
