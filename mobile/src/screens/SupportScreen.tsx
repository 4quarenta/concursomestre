import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/providers/AuthProvider';
import { supportService } from '@/services/support/supportService';
import { readApiErrorMessage } from '@/services/api/response';
import { colors } from '@/theme/colors';
import type { SupportReply, SupportThread, SupportThreadStatus } from '@/types/support';

type SupportTab = 'bug' | 'feedback' | 'info' | 'donation';

type SupportCategory = {
  id: SupportTab;
  label: string;
  type: string | null;
  title: string;
  description: string;
  subjectPlaceholder: string;
  detailPlaceholder: string;
};

const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: 'bug',
    label: 'Problema',
    type: 'bug',
    title: 'Reportar problema',
    description: 'Descreva erro, travamento ou comportamento inesperado.',
    subjectPlaceholder: 'Ex: erro ao salvar questao',
    detailPlaceholder: 'Conte o que aconteceu e o passo a passo.',
  },
  {
    id: 'feedback',
    label: 'Sugestao',
    type: 'suggestion',
    title: 'Enviar sugestao',
    description: 'Compartilhe melhorias para evoluir seu fluxo de estudo.',
    subjectPlaceholder: 'Ex: melhorar filtros de questoes',
    detailPlaceholder: 'Explique o ganho da sugestao no uso real.',
  },
  {
    id: 'info',
    label: 'Ajuda',
    type: 'support',
    title: 'Solicitar ajuda',
    description: 'Use para duvidas sobre assinatura, acesso e conta.',
    subjectPlaceholder: 'Ex: duvida sobre renovacao',
    detailPlaceholder: 'Explique sua duvida com contexto.',
  },
  {
    id: 'donation',
    label: 'Doacao',
    type: null,
    title: 'Apoiar o projeto',
    description: 'Contribua para manter a plataforma evoluindo continuamente.',
    subjectPlaceholder: '',
    detailPlaceholder: '',
  },
];

const DEFAULT_SUPPORT_CATEGORY = SUPPORT_CATEGORIES[0];

const STATUS_META: Record<SupportThreadStatus, { label: string; color: string; bg: string }> = {
  new: {
    label: 'Aberto',
    color: '#B45309',
    bg: '#FFFBEB',
  },
  read: {
    label: 'Em analise',
    color: '#0369A1',
    bg: '#F0F9FF',
  },
  resolved: {
    label: 'Resolvido',
    color: '#047857',
    bg: '#ECFDF3',
  },
};

const filterThreadsByTab = (threads: SupportThread[], tab: SupportTab): SupportThread[] => {
  if (tab === 'bug') {
    return threads.filter((thread) => thread.type === 'bug');
  }

  if (tab === 'feedback') {
    return threads.filter((thread) => thread.type === 'suggestion' || thread.type === 'other');
  }

  if (tab === 'donation') {
    return threads;
  }

  return threads.filter((thread) => thread.type === 'support');
};

/**
 * Central mobile de suporte/feedback com historico e resposta em thread.
 * @since v1.0.0
 */
export const SupportScreen: React.FC = () => {
  const { user, systemSettings } = useAuth();
  const [activeTab, setActiveTab] = React.useState<SupportTab>('bug');
  const [subject, setSubject] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [threads, setThreads] = React.useState<SupportThread[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedThreadId, setExpandedThreadId] = React.useState<number | null>(null);
  const [repliesByThread, setRepliesByThread] = React.useState<Record<number, SupportReply[]>>({});
  const [loadingRepliesId, setLoadingRepliesId] = React.useState<number | null>(null);
  const [sendingReplyId, setSendingReplyId] = React.useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = React.useState<Record<number, string>>({});
  const pixKey = React.useMemo(
    () => String(systemSettings.pixKey || '').trim() || 'pix@concursomestre.com.br',
    [systemSettings.pixKey],
  );

  const activeCategory = React.useMemo(
    () => SUPPORT_CATEGORIES.find((category) => category.id === activeTab) ?? DEFAULT_SUPPORT_CATEGORY,
    [activeTab],
  );
  const isDonationTab = activeTab === 'donation';

  const loadThreads = React.useCallback(async (useRefresh = false) => {
    if (useRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const rows = await supportService.listThreads();
      setThreads(rows);
      setError(null);
    } catch (loadError: any) {
      setError(readApiErrorMessage(loadError, 'Nao foi possivel carregar seu historico agora.'));
    } finally {
      if (useRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadThreads(false);
    }, [loadThreads]),
  );

  const visibleThreads = React.useMemo(
    () => filterThreadsByTab(threads, activeTab),
    [activeTab, threads],
  );

  const supportStats = React.useMemo(() => ({
    total: threads.length,
    open: threads.filter((thread) => thread.status === 'new').length,
    inProgress: threads.filter((thread) => thread.status === 'read').length,
    resolved: threads.filter((thread) => thread.status === 'resolved').length,
  }), [threads]);

  const handleSubmit = async () => {
    if (!activeCategory.type) {
      setError('A aba de doacao nao abre chamado. Use as categorias de suporte para enviar solicitacao.');
      return;
    }

    if (!subject.trim()) {
      setError('Preencha um resumo curto para o chamado.');
      return;
    }

    if (!details.trim()) {
      setError('Descreva melhor o contexto antes de enviar.');
      return;
    }

    setSubmitting(true);
    try {
      const normalizedSubject = subject.trim();
      const normalizedDetails = details.trim();

      const created = await supportService.createThread({
        type: activeCategory.type,
        reason: normalizedSubject,
        details: normalizedDetails,
      });

      if (created.id > 0) {
        const localThread: SupportThread = {
          id: created.id,
          type: created.type || activeCategory.type,
          reason: normalizedSubject,
          details: normalizedDetails,
          status: 'new',
          created_at: new Date().toISOString(),
          reply_count: 0,
        };
        setThreads((current) => [localThread, ...current]);
      }

      setSubject('');
      setDetails('');
      setError(null);
      await loadThreads(false);
    } catch (submitError: any) {
      setError(readApiErrorMessage(submitError, 'Nao foi possivel enviar sua solicitacao.'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleThread = async (thread: SupportThread) => {
    const nextId = thread.id;
    if (expandedThreadId === nextId) {
      setExpandedThreadId(null);
      return;
    }

    setExpandedThreadId(nextId);

    if (repliesByThread[nextId]) return;

    setLoadingRepliesId(nextId);
    try {
      const replies = await supportService.listReplies(nextId);
      setRepliesByThread((current) => ({ ...current, [nextId]: replies }));
    } catch (replyError: any) {
      setError(readApiErrorMessage(replyError, 'Nao foi possivel carregar a conversa completa.'));
    } finally {
      setLoadingRepliesId(null);
    }
  };

  const handleReplySubmit = async (thread: SupportThread) => {
    const draft = String(replyDrafts[thread.id] || '').trim();
    if (!draft) {
      return;
    }

    setSendingReplyId(thread.id);
    try {
      await supportService.replyToThread(thread.id, thread.type, draft);
      const replies = await supportService.listReplies(thread.id);
      setRepliesByThread((current) => ({ ...current, [thread.id]: replies }));
      setReplyDrafts((current) => ({ ...current, [thread.id]: '' }));
      await loadThreads(false);
    } catch (sendError: any) {
      setError(readApiErrorMessage(sendError, 'Nao foi possivel enviar sua resposta.'));
    } finally {
      setSendingReplyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          onRefresh={() => void loadThreads(true)}
          tintColor={colors.primary}
        />
      )}
    >
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>Central do usuario</Text>
        <Text style={styles.heroTitle}>Suporte e feedback</Text>
        <Text style={styles.heroText}>
          Abra chamados, envie sugestoes e acompanhe respostas da equipe em um unico fluxo.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Chamados</Text>
          <Text style={styles.statValue}>{supportStats.total}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Abertos</Text>
          <Text style={styles.statValue}>{supportStats.open}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Em analise</Text>
          <Text style={styles.statValue}>{supportStats.inProgress}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statLabel}>Resolvidos</Text>
          <Text style={styles.statValue}>{supportStats.resolved}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{isDonationTab ? 'Apoio ao projeto' : 'Nova solicitacao'}</Text>
        <View style={styles.tabsRow}>
          {SUPPORT_CATEGORIES.map((category) => {
            const selected = activeCategory.id === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => setActiveTab(category.id)}
                style={[styles.tabChip, selected && styles.tabChipActive]}
              >
                <Text style={[styles.tabChipText, selected && styles.tabChipTextActive]}>
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isDonationTab ? (
          <View style={styles.donationCard}>
            <Text style={styles.donationTitle}>Apoie o ConcursoMestre</Text>
            <Text style={styles.donationDescription}>
              Sua contribuicao ajuda na infraestrutura, manutencao de bugs e evolucao continua da plataforma.
            </Text>
            <View style={styles.pixBox}>
              <Text style={styles.pixLabel}>PIX oficial</Text>
              <Text selectable style={styles.pixValue}>{pixKey}</Text>
            </View>
            <View style={styles.donationList}>
              <Text style={styles.donationItem}>Infraestrutura e custo de servidor.</Text>
              <Text style={styles.donationItem}>Correcao de bugs e manutencao critica.</Text>
              <Text style={styles.donationItem}>Melhorias continuas no produto.</Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.formTitle}>{activeCategory.title}</Text>
            <Text style={styles.formDescription}>{activeCategory.description}</Text>

            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={activeCategory.subjectPlaceholder}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={activeCategory.detailPlaceholder}
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.mainButton, submitting && styles.mainButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.mainButtonText}>Enviar solicitacao</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {!!error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Historico</Text>
        {visibleThreads.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma conversa nesta categoria ainda.</Text>
        ) : (
          <View style={styles.threadsList}>
            {visibleThreads.map((thread) => {
              const statusMeta = STATUS_META[thread.status];
              const isExpanded = expandedThreadId === thread.id;
              const replies = repliesByThread[thread.id] || [];

              return (
                <View key={thread.id} style={styles.threadCard}>
                  <Pressable onPress={() => void toggleThread(thread)} style={styles.threadHeader}>
                    <View style={styles.threadHeaderTop}>
                      <Text style={[styles.statusBadge, { color: statusMeta.color, backgroundColor: statusMeta.bg }]}>
                        {statusMeta.label}
                      </Text>
                      <Text style={styles.threadDate}>
                        {new Date(thread.created_at).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <Text style={styles.threadReason}>{thread.reason || 'Sem resumo'}</Text>
                    <Text style={styles.threadDetails}>{thread.details}</Text>
                    <Text style={styles.threadMeta}>
                      {thread.reply_count || 0} resposta(s) - {isExpanded ? 'Ocultar conversa' : 'Abrir conversa'}
                    </Text>
                  </Pressable>

                  {isExpanded ? (
                    <View style={styles.threadBody}>
                      {loadingRepliesId === thread.id ? (
                        <View style={styles.inlineLoader}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={styles.loaderText}>Carregando respostas...</Text>
                        </View>
                      ) : replies.length > 0 ? (
                        <View style={styles.replyList}>
                          {replies.map((reply) => {
                            const isUserReply = String(reply.user_id || '') === String(user?.id || '');
                            return (
                              <View
                                key={reply.id}
                                style={[styles.replyCard, isUserReply ? styles.replyCardUser : styles.replyCardSupport]}
                              >
                                <View style={styles.replyHeader}>
                                  <Text style={styles.replyAuthor}>{isUserReply ? 'Voce' : 'Suporte'}</Text>
                                  <Text style={styles.replyDate}>
                                    {new Date(reply.created_at).toLocaleString('pt-BR')}
                                  </Text>
                                </View>
                                <Text style={styles.replyText}>{reply.details}</Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.emptyText}>Nenhuma resposta ainda.</Text>
                      )}

                      <View style={styles.replyComposer}>
                        <TextInput
                          value={replyDrafts[thread.id] || ''}
                          onChangeText={(value) => setReplyDrafts((current) => ({ ...current, [thread.id]: value }))}
                          placeholder="Escreva sua resposta..."
                          placeholderTextColor={colors.muted}
                          style={[styles.input, styles.replyInput]}
                        />
                        <Pressable
                          style={[
                            styles.replyButton,
                            (sendingReplyId === thread.id || !String(replyDrafts[thread.id] || '').trim()) && styles.replyButtonDisabled,
                          ]}
                          onPress={() => void handleReplySubmit(thread)}
                          disabled={sendingReplyId === thread.id || !String(replyDrafts[thread.id] || '').trim()}
                        >
                          {sendingReplyId === thread.id ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={styles.replyButtonText}>Responder</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
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
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  heroText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    minWidth: '23%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: 10,
    gap: 2,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
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
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  tabChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  tabChipTextActive: {
    color: colors.primary,
  },
  formTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  formDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  donationCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 12,
    gap: 10,
  },
  donationTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  donationDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  pixBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#34D399',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 4,
  },
  pixLabel: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  pixValue: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
  },
  donationList: {
    gap: 4,
  },
  donationItem: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
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
    fontWeight: '700',
  },
  textArea: {
    height: 120,
    paddingTop: 10,
  },
  mainButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonDisabled: {
    opacity: 0.7,
  },
  mainButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  errorCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  threadsList: {
    gap: 8,
  },
  threadCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  threadHeader: {
    padding: 12,
    gap: 6,
  },
  threadHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    overflow: 'hidden',
  },
  threadDate: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
  },
  threadReason: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  threadDetails: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  threadMeta: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  threadBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loaderText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  replyList: {
    gap: 8,
  },
  replyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  replyCardUser: {
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  replyCardSupport: {
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  replyAuthor: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  replyDate: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  replyText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyInput: {
    flex: 1,
  },
  replyButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyButtonDisabled: {
    opacity: 0.65,
  },
  replyButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});

export default SupportScreen;
