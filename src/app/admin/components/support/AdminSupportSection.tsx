/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, LifeBuoy, Loader2, MessageSquareText, Shield, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@providers/ToastProvider';
import type {
  ErrorReport,
  LawArticle,
  LawDetail,
  LawSummary,
  LegalArticleEditorialSnapshot,
  LegalRichContentBlock,
  TeacherComment,
} from '@types';
import {
  adminService,
  type AdminCommentModerationCounts,
  type AdminCommentModerationStatus,
} from '@services/admin/adminService';
import { clientLog } from '@services/monitoring/clientLog';
import { aiService } from '@services/questions/aiService';
import { questionService } from '@services/questions/questionService';
import { legalCommentaryApiService } from '@services/legal-commentary/legalCommentaryApiService';
import { marketplaceService } from '@services/marketplace/marketplaceService';
import { parseEditorialRequestDetails } from '@services/support';
import { AdminFeedback } from './AdminFeedback';
import AdminCommentsModerationSection from './AdminCommentsModerationSection';
import ContextualReportModerationModal from './ContextualReportModerationModal';
import {
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SEGMENTED_TABS_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
import AdminReportsSection from '../reports/AdminReportsSection';
import {
  getQuickReportResolutionReason,
  getReportModerationTemplates,
  getReportTargetId,
  getReportTargetBadgeClass,
  getReportTargetLabel,
  groupPendingReports,
  type GroupedReport,
  type ReportModerationAction,
  type ReportModerationTemplate,
  type ReportTargetModerationAction,
} from '../reports/reportModeration';
import type { AdminSupportSection as AdminSupportSectionKey } from '../shared/useAdminPageController';

interface AdminSupportSectionProps {
  initialSection?: AdminSupportSectionKey;
  onSectionChange?: (section: AdminSupportSectionKey) => void;
  allReports?: ErrorReport[];
  pendingFeedbackCount?: number;
  pendingSupportThreadsCount?: number;
  onPendingFeedbackCountChange?: (count: number) => void;
  onPendingSupportThreadsCountChange?: (count: number) => void;
  onPendingCommentsCountChange?: (count: number) => void;
  onResolveReport?: (report: ErrorReport) => Promise<unknown> | unknown;
  standaloneSection?: boolean;
}

const SUPPORT_SECTIONS: Array<{
  key: AdminSupportSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'feedback',
    label: 'Feedback e avaliações',
    description: 'Triagem de avaliações da plataforma, bugs, sugestões e opiniões dos usuários.',
  },
  {
    key: 'comments',
    label: 'Comentários',
    description: 'Caixa de entrada única para moderar comentários de questões, materiais e leis.',
  },
  {
    key: 'reports',
    label: 'Denúncias',
    description: 'Fila oficial de denúncias com atalho para a área responsável.',
  },
  {
    key: 'threads',
    label: 'Solicitações',
    description: 'Acompanhe conversas abertas, pedidos editoriais e retornos do suporte.',
  },
];

const renderSupportHeader = (label: string) => (
  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
    {label}
  </th>
);

const COMMENT_STATUS_BY_TARGET_ACTION: Partial<Record<ReportTargetModerationAction, AdminCommentModerationStatus>> = {
  comment_approved: 'approved',
  comment_pending: 'pending',
  comment_spam: 'spam',
  comment_trash: 'trash',
};

const createLegalModerationId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizeSearchToken = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const getLawSlugFromUrl = (value: unknown) => {
  const rawUrl = String(value || '').trim();
  if (!rawUrl) return '';

  try {
    const pathname = new URL(rawUrl).pathname;
    const match = pathname.match(/\/lei-comentada\/([^/?#]+)/i);
    return decodeURIComponent(match?.[1] || '').trim();
  } catch {
    const match = rawUrl.match(/\/lei-comentada\/([^/?#]+)/i);
    return decodeURIComponent(match?.[1] || '').trim();
  }
};

const getLawTitleFromDetails = (details: unknown) => {
  const match = String(details || '').match(/(?:^|\n)\s*Lei\s*:\s*([^\n]+)/i);
  return match?.[1]?.trim() || '';
};

const getLawTargetParts = (report: ErrorReport) => {
  const editorialDetails = parseEditorialRequestDetails(report.details);
  const rawTarget = String(editorialDetails?.targetId || getReportTargetId(report) || '').trim();
  const parts = rawTarget.split(':').map((part) => part.trim()).filter(Boolean);

  if (editorialDetails) {
    return {
      lawId: editorialDetails.lawId || '',
      sectionId: editorialDetails.sectionId || '',
      articleId: parts[0] && parts[0] !== 'section' ? parts[0] : '',
      blockId: parts[1] || '',
      targetLabel: editorialDetails.linkedItem || editorialDetails.article || '',
    };
  }

  return {
    lawId: '',
    sectionId: parts[0] || '',
    articleId: parts[1] && parts[1] !== 'section' ? parts[1] : '',
    blockId: parts[2] || '',
    targetLabel: report.targetLabel || '',
  };
};

const resolveLawFromReport = async (report: ErrorReport): Promise<LawDetail> => {
  const targetParts = getLawTargetParts(report);

  if (targetParts.lawId) {
    const detail = await legalCommentaryApiService.getAdminDetail(targetParts.lawId);
    if (detail.law) {
      return detail.law;
    }
  }

  const slug = getLawSlugFromUrl(report.targetUrl || report.evidenceUrl);
  const detailBySlug = slug ? await legalCommentaryApiService.getAdminDetail(slug) : null;
  if (detailBySlug?.law) {
    return detailBySlug.law;
  }

  const list = await legalCommentaryApiService.getAdminList('');
  const title = getLawTitleFromDetails(report.details);
  const normalizedTitle = normalizeSearchToken(title);
  const lawSummary = (list.laws || []).find((item: LawSummary) => (
    Boolean(slug && (String(item.slug || '') === slug || String(item.id || '') === slug))
    || Boolean(normalizedTitle && [
      item.title,
      item.shortTitle,
      item.nome,
      item.number,
    ].some((value) => normalizeSearchToken(value).includes(normalizedTitle) || normalizedTitle.includes(normalizeSearchToken(value))))
  ));

  if (!lawSummary?.id) {
    throw new Error('Não foi possível identificar a lei vinculada a esta denúncia.');
  }

  const detail = await legalCommentaryApiService.getAdminDetail(String(lawSummary.id));
  if (!detail.law) {
    throw new Error('A lei vinculada à denúncia não foi encontrada no acervo administrativo.');
  }

  return detail.law;
};

const findLawArticleFromReport = (law: LawDetail, report: ErrorReport) => {
  const targetParts = getLawTargetParts(report);
  const details = String(report.details || '');
  const articleMatch = details.match(/(?:^|\n)\s*Artigo\s*:\s*Art\.?\s*([^\n]+)/i);
  const articleNumberFromDetails = articleMatch?.[1]?.trim() || '';
  const normalizedTargetLabel = normalizeSearchToken(targetParts.targetLabel);

  const article = (law.articles || []).find((item) => (
    Boolean(targetParts.articleId && String(item.id) === targetParts.articleId)
    || Boolean(articleNumberFromDetails && normalizeSearchToken(item.number) === normalizeSearchToken(articleNumberFromDetails))
    || Boolean(normalizedTargetLabel && normalizeSearchToken(`art ${item.number}`).includes(normalizedTargetLabel))
  ));

  if (!article) {
    throw new Error('Não foi possível identificar o artigo/item específico da Lei Comentada. Se a denúncia for da seção inteira, abra o editor da lei para tratar manualmente.');
  }

  const block = targetParts.blockId
    ? (article.blocks || []).find((item, index) => (
      String(item.id || '') === targetParts.blockId
      || String(item.blockUid || '') === targetParts.blockId
      || `${article.id}-block-${index}` === targetParts.blockId
    ))
    : undefined;

  return { article, block };
};

const getTeacherCommentTarget = (comment: Partial<TeacherComment>): LegalRichContentBlock['target'] | undefined => (
  comment.richBlocks?.find((block) => block.target)?.target
  || comment.blocks?.find((block) => block.target)?.target
);

const getLegalEditorialTargetKey = (target?: LegalRichContentBlock['target'] | null) => {
  if (!target) return '';
  const blockId = String(target.blockId || '').trim();
  if (blockId) return `block:${blockId}`;
  return normalizeSearchToken(`${target.kind || ''}:${target.label || ''}`);
};

const mergeTeacherCommentsByTarget = (existing: TeacherComment[], generated: TeacherComment[]) => {
  if (generated.length === 0) return existing;

  const next = [...existing];
  generated.forEach((comment) => {
    const targetKey = getLegalEditorialTargetKey(getTeacherCommentTarget(comment));
    const generatedId = String(comment.id || '').trim();
    const bodySignature = normalizeSearchToken(`${comment.title || ''} ${comment.body || comment.texto || ''}`);
    const replaceIndex = next.findIndex((item) => {
      if (generatedId && item.id === generatedId) return true;
      const itemTargetKey = getLegalEditorialTargetKey(getTeacherCommentTarget(item));
      if (targetKey) return itemTargetKey === targetKey;
      return bodySignature && normalizeSearchToken(`${item.title || ''} ${item.body || item.texto || ''}`) === bodySignature;
    });

    if (replaceIndex >= 0) {
      next[replaceIndex] = comment;
    } else {
      next.push(comment);
    }
  });

  return next;
};

const buildLawArticleEditorialSnapshot = (law: LawDetail, article: LawArticle): LegalArticleEditorialSnapshot => ({
  articleId: article.id,
  articleNumber: article.number,
  teacherComments: (law.teacherComments || []).filter((item) => item.articleId === article.id).length > 0
    ? (law.teacherComments || []).filter((item) => item.articleId === article.id)
    : (article.comentarios || []),
  examTips: (law.examTips || []).filter((item) => item.articleId === article.id),
  doctrine: article.doctrine || article.doutrina || [],
  jurisprudenceNotes: article.jurisprudenceNotes || [],
  jurisprudence: (law.jurisprudence || []).filter((item) => item.articleId === article.id).length > 0
    ? (law.jurisprudence || []).filter((item) => item.articleId === article.id)
    : (article.jurisprudencia || []),
  sumulas: (law.sumulas || []).filter((item) => item.articleId === article.id).length > 0
    ? (law.sumulas || []).filter((item) => item.articleId === article.id)
    : (article.sumulas || article.syllabi || []),
});

const generateLawTeacherCommentFromReport = async (report: ErrorReport) => {
  const law = await resolveLawFromReport(report);
  const { article, block } = findLawArticleFromReport(law, report);
  const target: LegalRichContentBlock['target'] | null = block
    ? {
      kind: block.kind,
      label: block.label,
      blockId: block.id,
    }
    : null;

  const result = await legalCommentaryApiService.generateAdminEditorial({
    scope: 'field-comment',
    lawId: String(law.id || ''),
    articleId: article.id,
    law,
    article,
    existingEditorial: buildLawArticleEditorialSnapshot(law, article),
    previewOnly: true,
    target,
  });

  const generatedComments = (result.editorial.teacherComments || []).map((comment) => ({
    ...comment,
    id: comment.id || createLegalModerationId('teacher'),
    articleId: article.id,
  }));

  if (generatedComments.length === 0) {
    throw new Error('A IA não retornou comentário do professor para este item da Lei Comentada.');
  }

  const existingForArticle = (law.teacherComments || []).filter((item) => item.articleId === article.id).length > 0
    ? (law.teacherComments || []).filter((item) => item.articleId === article.id)
    : (article.comentarios || []);
  const nextCommentsForArticle = mergeTeacherCommentsByTarget(existingForArticle, generatedComments);
  const nextLaw: LawDetail = {
    ...law,
    teacherComments: [
      ...(law.teacherComments || []).filter((item) => item.articleId !== article.id),
      ...nextCommentsForArticle,
    ],
    articles: (law.articles || []).map((item) => item.id === article.id ? {
      ...item,
      comentarios: nextCommentsForArticle,
    } : item),
  };

  await legalCommentaryApiService.saveAdminLaw(nextLaw as LawDetail & Record<string, unknown>);

  return `Comentário do professor gerado e salvo na Lei Comentada (${article.number || article.title || article.id}).`;
};

/**
 * Consolida a área de suporte em feedback, denúncias e threads.
 * Denúncias saiu da operação e passa a centralizar a triagem de atendimento.
 *
 * @since 1.0.0
 */
const AdminSupportSection = ({
  initialSection = 'feedback',
  onSectionChange,
  allReports = [],
  pendingFeedbackCount = 0,
  pendingSupportThreadsCount = 0,
  onPendingFeedbackCountChange,
  onPendingSupportThreadsCountChange,
  onPendingCommentsCountChange,
  onResolveReport,
  standaloneSection = false,
}: AdminSupportSectionProps) => {
  const { addToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [resolvingReportId, setResolvingReportId] = useState<string | number | null>(null);
  const [moderatingReport, setModeratingReport] = useState<ErrorReport | null>(null);
  const [moderatingReportGroup, setModeratingReportGroup] = useState<GroupedReport | null>(null);
  const [moderationAction, setModerationAction] = useState<ReportModerationAction>('resolved');
  const [moderationResolution, setModerationResolution] = useState('');
  const [moderationUserResponse, setModerationUserResponse] = useState('');
  const [moderationInternalNote, setModerationInternalNote] = useState('');
  const [moderationResultPreview, setModerationResultPreview] = useState('');
  const [moderationContentAfter, setModerationContentAfter] = useState('');
  const [selectedModerationTemplateId, setSelectedModerationTemplateId] = useState('');
  const [targetModerationAction, setTargetModerationAction] = useState<ReportTargetModerationAction>('none');
  const [targetActionFeedback, setTargetActionFeedback] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [commentsLiveCounts, setCommentsLiveCounts] = useState<AdminCommentModerationCounts>({
    all: 0,
    pending: 0,
    approved: 0,
    spam: 0,
    trash: 0,
  });
  const activeSection = initialSection;
  const onPendingCommentsCountChangeRef = useRef(onPendingCommentsCountChange);

  useEffect(() => {
    onPendingCommentsCountChangeRef.current = onPendingCommentsCountChange;
  }, [onPendingCommentsCountChange]);

  const moderationCountsQuery = useQuery({
    queryKey: ['admin', 'comments-moderation-counts'],
    queryFn: async () => {
      const response = await adminService.getModerationComments({
        status: 'pending',
        page: 1,
        perPage: 1,
      });

      return response.counts;
    },
    enabled: activeSection !== 'comments',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const moderationCounts = useMemo<AdminCommentModerationCounts>(() => {
    if (activeSection === 'comments') {
      return commentsLiveCounts;
    }

    if (moderationCountsQuery.data) {
      return moderationCountsQuery.data;
    }

    return commentsLiveCounts;
  }, [activeSection, commentsLiveCounts, moderationCountsQuery.data]);

  useEffect(() => {
    onPendingCommentsCountChangeRef.current?.(Number(moderationCounts.pending || 0));
  }, [moderationCounts.pending]);

  const handleModerationCountsChange = useCallback((counts: AdminCommentModerationCounts) => {
    setCommentsLiveCounts(counts);
  }, []);

  const groupedReports = useMemo(
    () => groupPendingReports(allReports),
    [allReports],
  );
  const filteredGroupedReports = useMemo(() => {
    const normalizedSearch = reportSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return groupedReports;
    }

    return groupedReports.filter((group) => {
      const haystack = [
        group.targetId,
        group.targetType,
        group.lastReport.reason,
        group.lastReport.details,
        group.lastReport.userName,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [groupedReports, reportSearch]);
  const pendingReportsCount = useMemo(
    () => groupedReports.reduce((total, group) => total + group.reports.length, 0),
    [groupedReports],
  );
  const filteredReportsCount = useMemo(
    () => filteredGroupedReports.reduce((total, group) => total + group.reports.length, 0),
    [filteredGroupedReports],
  );
  const safePendingFeedbackCount = Math.max(0, Number(pendingFeedbackCount || 0));
  const safePendingSupportThreadsCount = Math.max(0, Number(pendingSupportThreadsCount || 0));
  const openRelationshipAlertsCount = (
    pendingReportsCount
    + safePendingFeedbackCount
    + safePendingSupportThreadsCount
    + Number(moderationCounts.pending || 0)
  );

  const getSectionBadgeCount = (section: AdminSupportSectionKey) => {
    if (section === 'feedback') {
      return safePendingFeedbackCount;
    }

    if (section === 'reports') {
      return pendingReportsCount;
    }

    if (section === 'threads') {
      return safePendingSupportThreadsCount;
    }

    if (section === 'comments') {
      return moderationCounts.pending;
    }

    return 0;
  };

  const changeSection = (section: AdminSupportSectionKey) => {
    onSectionChange?.(section);
  };

  const applyModerationTemplate = (template: ReportModerationTemplate) => {
    setSelectedModerationTemplateId(template.id);
    setModerationAction(template.action);
    setModerationResolution(template.message);
    setModerationUserResponse(template.userResponse);
    setModerationInternalNote(template.internalNote);
    setModerationResultPreview(template.resultPreview);
    setModerationContentAfter(template.contentAfter || '');
    setTargetModerationAction(template.targetAction || 'none');
    setTargetActionFeedback(template.helper || '');
  };

  const resetReportModerationState = () => {
    setModeratingReport(null);
    setModeratingReportGroup(null);
    setModerationAction('resolved');
    setModerationResolution('');
    setModerationUserResponse('');
    setModerationInternalNote('');
    setModerationResultPreview('');
    setModerationContentAfter('');
    setSelectedModerationTemplateId('');
    setTargetModerationAction('none');
    setTargetActionFeedback('');
  };

  const resolveReportGroup = async (
    group: GroupedReport,
    resolution: string,
    action: ReportModerationAction = 'resolved',
    options: {
      userResponse?: string;
      internalNote?: string;
      moderationAction?: string;
    } = {},
  ) => {
    if (!onResolveReport) {
      return;
    }

    await Promise.all(group.reports.map((report) => onResolveReport({
      ...report,
      moderationAction: action,
      resolution,
      userResponse: options.userResponse,
      internalNote: options.internalNote,
      moderationActionApplied: options.moderationAction,
    } as ErrorReport & {
      moderationAction: ReportModerationAction;
      userResponse?: string;
      internalNote?: string;
      moderationActionApplied?: string;
    })));
  };

  const handleResolveReport = async (group: GroupedReport) => {
    if (!onResolveReport) {
      return;
    }

    setResolvingReportId(group.id);
    try {
      const resolution = getQuickReportResolutionReason(group.lastReport);
      await resolveReportGroup(group, resolution, 'resolved', {
        userResponse: 'Olá, sua denúncia foi analisada pela equipe ConcursoMestre e recebeu tratamento da moderação. Agradecemos pela colaboração.',
        internalNote: resolution,
        moderationAction: 'quick_resolved',
      });
      addToast(
        group.reports.length > 1
          ? `${group.reports.length} denúncias resolvidas com sucesso.`
          : 'Denúncia resolvida com sucesso.',
        'success',
      );
    } catch (error) {
      clientLog.warn('Error resolving report from support:', error);
      addToast('Não foi possível resolver a denúncia.', 'error');
    } finally {
      setResolvingReportId(null);
    }
  };

  const openReportModerationModal = (group: GroupedReport) => {
    setModeratingReportGroup(group);
    setModeratingReport(group.lastReport);
    const firstTemplate = getReportModerationTemplates(group.lastReport)[0];
    if (firstTemplate) {
      applyModerationTemplate(firstTemplate);
    } else {
      setModerationAction('resolved');
      setModerationResolution(getQuickReportResolutionReason(group.lastReport));
      setModerationUserResponse('Olá, sua solicitação foi analisada pela equipe ConcursoMestre e recebeu tratamento da moderação. Agradecemos pela colaboração.');
      setModerationInternalNote('Denúncia analisada pela equipe administrativa.');
      setModerationResultPreview('A denúncia será encerrada com registro administrativo.');
      setModerationContentAfter('');
      setSelectedModerationTemplateId('');
      setTargetModerationAction('none');
      setTargetActionFeedback('');
    }
  };

  const closeReportModerationModal = () => {
    if (resolvingReportId) return;

    resetReportModerationState();
  };

  const applyReportTargetAction = async (
    report: ErrorReport,
    targetAction: ReportTargetModerationAction,
  ): Promise<string | null> => {
    if (targetAction === 'none') {
      return null;
    }

    const targetId = getReportTargetId(report);
    if (!targetId) {
      throw new Error('Não foi possível identificar o alvo denunciado para executar a ação.');
    }

    const commentStatus = COMMENT_STATUS_BY_TARGET_ACTION[targetAction];
    if (commentStatus) {
      await adminService.updateModerationComment(String(targetId), commentStatus);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'comments-moderation'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'comments-moderation-counts'] });

      const statusLabel: Record<AdminCommentModerationStatus, string> = {
        approved: 'mantido como aprovado',
        pending: 'colocado em revisão',
        spam: 'marcado como spam',
        trash: 'movido para a lixeira',
      };

      return `Comentário ${statusLabel[commentStatus]}.`;
    }

    if (targetAction === 'question_teacher_comment' || targetAction === 'question_detailed_analysis') {
      const question = await questionService.getQuestionForAdminEdit(targetId);
      const generated = targetAction === 'question_teacher_comment'
        ? await aiService.generateTeacherComment(question)
        : await aiService.generateDetailedAnalysis(question);

      const field = targetAction === 'question_teacher_comment' ? 'teacherComment' : 'detailedComment';
      const result = await questionService.updateQuestion(String(question.id || targetId), {
        ...question,
        [field]: generated,
      });

      if (!result.success) {
        throw new Error('A geração foi concluída, mas não foi possível salvar a questão.');
      }

      return targetAction === 'question_teacher_comment'
        ? 'Comentário do professor gerado e salvo na questão.'
        : 'Análise detalhada gerada e salva na questão.';
    }

    if (targetAction === 'law_teacher_comment') {
      return generateLawTeacherCommentFromReport(report);
    }

    if (targetAction === 'material_approved' || targetAction === 'material_hidden' || targetAction === 'material_blocked') {
      const resolution = moderationResolution.trim() || getQuickReportResolutionReason(report);
      const status = targetAction === 'material_approved' ? 'approved' : 'rejected';
      const reason = targetAction === 'material_blocked'
        ? `[CONTEÚDO BLOQUEADO] ${resolution}`
        : resolution;

      await marketplaceService.moderateMaterial(String(targetId), status, reason, report.evidenceUrl || undefined);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      await queryClient.invalidateQueries({ queryKey: ['marketplace'] });

      if (targetAction === 'material_approved') {
        return 'Material mantido como aprovado/publicado.';
      }

      return targetAction === 'material_hidden'
        ? 'Material ocultado da vitrine pública.'
        : 'Material bloqueado para correção do autor.';
    }

    return null;
  };

  const confirmReportModeration = async () => {
    if (!moderatingReport || !moderatingReportGroup || !onResolveReport) {
      return;
    }

    const resolution = moderationResolution.trim();
    if (!resolution) {
      addToast('Informe a decisão da moderação antes de concluir.', 'warning');
      return;
    }

    const userResponse = moderationUserResponse.trim();
    if (!userResponse) {
      addToast('Informe a resposta que será enviada ao usuário antes de concluir.', 'warning');
      return;
    }

    setResolvingReportId(moderatingReportGroup.id);
    try {
      const actionResult = await applyReportTargetAction(moderatingReport, targetModerationAction);
      if (actionResult) {
        setTargetActionFeedback(actionResult);
      }

      const internalParts = [
        resolution,
        moderationInternalNote.trim() ? `Observação interna: ${moderationInternalNote.trim()}` : '',
        moderationResultPreview.trim() ? `Resultado previsto: ${moderationResultPreview.trim()}` : '',
        moderationContentAfter.trim() ? `Conteúdo novo/proposto: ${moderationContentAfter.trim()}` : '',
        actionResult ? `Ação aplicada ao alvo: ${actionResult}` : '',
      ].filter(Boolean);
      const finalResolution = internalParts.join('\n\n');

      await resolveReportGroup(moderatingReportGroup, finalResolution, moderationAction, {
        userResponse,
        internalNote: moderationInternalNote.trim(),
        moderationAction: selectedModerationTemplateId || targetModerationAction,
      });
      const plural = moderatingReportGroup.reports.length > 1;
      addToast(
        moderationAction === 'ignored'
          ? plural ? `${moderatingReportGroup.reports.length} denúncias ignoradas com sucesso.` : 'Denúncia ignorada com sucesso.'
          : plural ? `${moderatingReportGroup.reports.length} denúncias resolvidas com sucesso.` : 'Denúncia resolvida com sucesso.',
        'success',
      );
      resetReportModerationState();
    } catch (error) {
      clientLog.warn('Error moderating report from support:', error);
      addToast(error instanceof Error ? error.message : 'Não foi possível moderar a denúncia.', 'error');
    } finally {
      setResolvingReportId(null);
    }
  };

  const activeSectionMeta = SUPPORT_SECTIONS.find((section) => section.key === activeSection);

  return (
    <div className="space-y-6">
      {standaloneSection ? null : (
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Suporte organizado
              </p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                Solicitações separadas por contexto
              </p>
            </div>

            <div className={`${ADMIN_SEGMENTED_TABS_CLASS} max-w-full`}>
              {SUPPORT_SECTIONS.map((section) => {
                const badgeCount = getSectionBadgeCount(section.key);

                return (
                  <button
                    key={section.key}
                    onClick={() => changeSection(section.key)}
                    className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                      activeSection === section.key
                        ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                        : ADMIN_TAB_BUTTON_IDLE_CLASS
                    }`}
                  >
                    <span>{section.label}</span>
                    {badgeCount > 0 ? (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                        activeSection === section.key
                          ? 'bg-white/20 text-white'
                          : section.key === 'reports'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {badgeCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
            {activeSection === 'feedback' ? (
              <LifeBuoy size={18} />
            ) : activeSection === 'comments' ? (
              <Shield size={18} />
            ) : activeSection === 'reports' ? (
              <AlertTriangle size={18} />
            ) : (
              <MessageSquareText size={18} />
            )}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{activeSectionMeta?.label}</p>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {activeSectionMeta?.description}
            </p>
          </div>
        </div>
      </div>

      {activeSection === 'reports' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-900/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Denúncias pendentes</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{pendingReportsCount}</p>
              <p className="mt-2 text-xs font-semibold text-amber-800/80 dark:text-amber-200/80">
                {groupedReports.length === pendingReportsCount
                  ? 'Cada linha representa uma denúncia aberta.'
                  : `${pendingReportsCount} denúncia(s) em ${groupedReports.length} grupo(s) por alvo e motivo.`}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/30 dark:bg-sky-900/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Alertas abertos</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{openRelationshipAlertsCount}</p>
              <p className="mt-2 text-xs font-semibold text-sky-800/80 dark:text-sky-200/80">
                Denúncias, solicitações, feedbacks e comentários pendentes.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Ação</p>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">Moderação no alvo</p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Use Moderar para tratar o alvo denunciado e Resolver para encerrar a pendência.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Estado</p>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">
                {resolvingReportId ? 'Processando resolução...' : 'Fila pronta para tratamento'}
              </p>
            </div>
          </div>

          <AdminReportsSection
            reports={filteredGroupedReports}
            totalReportCount={filteredReportsCount}
            filter={reportSearch}
            onFilterChange={setReportSearch}
            renderSortableHeader={renderSupportHeader}
            getReportTargetBadgeClass={getReportTargetBadgeClass}
            getReportTargetLabel={getReportTargetLabel}
            onInspect={openReportModerationModal}
            onResolve={handleResolveReport}
          />
        </div>
      ) : activeSection === 'comments' ? (
        <AdminCommentsModerationSection onCountsChange={handleModerationCountsChange} />
      ) : (
        <AdminFeedback
          mode={activeSection === 'threads' ? 'threads' : 'feedback'}
          onPendingCountChange={activeSection === 'threads' ? onPendingSupportThreadsCountChange : onPendingFeedbackCountChange}
        />
      )}

      {moderatingReportGroup ? (
        <ContextualReportModerationModal
          group={moderatingReportGroup}
          onClose={closeReportModerationModal}
          onDone={async () => {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
              queryClient.invalidateQueries({ queryKey: ['admin-data', 'reports'] }),
            ]);
          }}
        />
      ) : null}

      {moderatingReportGroup && moderatingReport && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4">
          <div className={`${ADMIN_MODAL_PANEL_CLASS} my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col shadow-2xl sm:my-4 sm:max-h-[calc(100dvh-2rem)]`}>
            <div className={`${ADMIN_MODAL_HEADER_CLASS} shrink-0`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="inline-flex items-center gap-2 rounded-sm bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    <Shield size={12} />
                    {moderatingReport.reason.toLowerCase().includes('solicitar') ? 'Moderação de solicitação' : 'Moderação de denúncia'}
                  </p>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                    ID #{String(moderatingReport.id).slice(0, 12)}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                    Pendente
                  </span>
                </div>
                <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {moderatingReport.targetLabel || `${getReportTargetLabel(moderatingReport.targetType)} sinalizado`}
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Revise o pedido, escolha uma ação real e envie uma resposta clara ao usuário.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReportModerationModal}
                className="rounded-sm border border-slate-300 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fechar moderação"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-5 p-4 sm:p-6">
                <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    1. Informações da denúncia
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-black text-slate-900 dark:text-slate-100">
                        {moderatingReport.targetLabel || getReportTargetLabel(moderatingReport.targetType)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {moderatingReport.targetContext || `ID do alvo: ${String(getReportTargetId(moderatingReport) || '-')}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${getReportTargetBadgeClass(moderatingReport.targetType)}`}>
                        {getReportTargetLabel(moderatingReport.targetType)}
                      </span>
                      {moderatingReportGroup && moderatingReportGroup.reports.length > 1 ? (
                        <span className="rounded-full bg-rose-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                          {moderatingReportGroup.reports.length} denúncias agrupadas
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {new Date(moderatingReport.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Denunciante</p>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{moderatingReport.userName || 'Não informado'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Alvo técnico</p>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">{String(getReportTargetId(moderatingReport) || '-')}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Status da decisão</p>
                      <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                        {moderationAction === 'ignored' ? 'Ignorar denúncia' : 'Resolver denúncia'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className={`${ADMIN_MUTED_SURFACE_CLASS} p-5`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    2. Motivo e contexto
                  </p>
                  <h4 className="mt-3 text-base font-black text-slate-900 dark:text-slate-100">{moderatingReport.reason}</h4>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    {moderatingReport.details || 'Sem detalhes adicionais enviados pelo usuário.'}
                  </p>
                  {moderatingReport.evidenceUrl ? (
                    <a
                      href={moderatingReport.evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex text-[10px] font-black uppercase tracking-[0.16em] text-sky-600 hover:text-sky-700 dark:text-sky-300"
                    >
                      Abrir evidência anexada
                    </a>
                  ) : null}
                </section>

                <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    3. Conteúdo denunciado
                  </p>
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                    <div className="whitespace-pre-wrap break-words">
                      {moderatingReport.targetContent || 'Não foi possível carregar o conteúdo original deste alvo. Ele pode ter sido removido.'}
                    </div>
                  </div>
                  {moderatingReport.targetUrl ? (
                    <button
                      type="button"
                      onClick={() => router.push(moderatingReport.targetUrl || '')}
                      className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Abrir conteúdo relacionado
                    </button>
                  ) : null}
                </section>

                <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    4. Ações disponíveis
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Escolha a ação que melhor resolve o caso. Quando houver o selo Ação real, o alvo também será alterado ao concluir.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {getReportModerationTemplates(moderatingReport).map((template) => {
                      const isSelected = selectedModerationTemplateId === template.id;

                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyModerationTemplate(template)}
                          className={`min-h-[138px] w-full rounded-xl border p-4 text-left transition-all ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-100 dark:border-indigo-500 dark:bg-indigo-950/40 dark:ring-indigo-900/40'
                              : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900/50 dark:hover:bg-sky-900/10'
                          }`}
                        >
                          <span className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="inline-flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
                              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                              }`}>
                                {isSelected ? <CheckCircle2 size={10} /> : null}
                              </span>
                              {template.label}
                            </span>
                            <span className="flex flex-wrap gap-2">
                              <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${
                                template.action === 'ignored'
                                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}>
                                {template.action === 'ignored' ? 'Ignorar' : 'Resolver'}
                              </span>
                              {template.targetAction && template.targetAction !== 'none' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  <Sparkles size={10} /> Ação real
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="mt-2 block text-xs font-medium leading-6 text-slate-500 dark:text-slate-400">
                            {template.helper || template.resultPreview}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {targetActionFeedback ? (
                    <p className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-bold text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-900/20 dark:text-indigo-200">
                      {targetActionFeedback}
                    </p>
                  ) : null}
                </section>

                <section className={`${ADMIN_MUTED_SURFACE_CLASS} p-5`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    5. Prévia do resultado
                  </p>
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/15">
                    <p className="flex items-center gap-2 text-sm font-black text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 size={16} />
                      {selectedModerationTemplateId ? 'Ação selecionada' : 'Nenhuma ação selecionada'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-emerald-900/80 dark:text-emerald-100/80">
                      {moderationResultPreview || 'Selecione uma ação para visualizar o resultado esperado.'}
                    </p>
                  </div>
                  {moderationContentAfter ? (
                    <label className="mt-4 block">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Conteúdo novo ou sugestão de correção
                      </span>
                      <textarea
                        value={moderationContentAfter}
                        onChange={(event) => setModerationContentAfter(event.target.value)}
                        rows={5}
                        className={`${ADMIN_TEXTAREA_CLASS} mt-3 w-full resize-y bg-white font-medium leading-6 dark:bg-slate-950`}
                      />
                    </label>
                  ) : null}
                </section>

                <section className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-5 dark:bg-slate-950`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    6. Resposta ao usuário
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Este texto será enviado por e-mail ao denunciante e também ficará registrado no atendimento.
                  </p>
                  <textarea
                    value={moderationUserResponse}
                    onChange={(event) => setModerationUserResponse(event.target.value)}
                    rows={5}
                    className={`${ADMIN_TEXTAREA_CLASS} mt-4 w-full resize-y bg-slate-50 font-medium leading-6 dark:bg-slate-900`}
                  />
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      Conferência antes de concluir
                    </p>
                    <div className="mt-3 grid gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                      <span className="rounded-lg bg-white px-3 py-2 dark:bg-slate-950">
                        Decisão: {moderationAction === 'ignored' ? 'ignorar denúncia' : 'resolver denúncia'}
                      </span>
                      <span className="rounded-lg bg-white px-3 py-2 dark:bg-slate-950">
                        Alvo: {targetModerationAction !== 'none' ? 'será atualizado' : 'sem alteração direta'}
                      </span>
                      <span className="rounded-lg bg-white px-3 py-2 dark:bg-slate-950">
                        E-mail: será enviado ao usuário
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex shrink-0 flex-col gap-3 sm:flex-row sm:justify-end`}>
              <button
                type="button"
                onClick={closeReportModerationModal}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmReportModeration}
                disabled={resolvingReportId === moderatingReportGroup?.id}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
              >
                <CheckCircle2 size={14} />
                {resolvingReportId === moderatingReportGroup?.id ? (
                  <>
                    <Loader2 className="animate-spin" size={14} /> Aplicando...
                  </>
                ) : targetModerationAction !== 'none' ? 'Aplicar ação e concluir' : 'Concluir moderação'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default AdminSupportSection;
