import type { ErrorReport } from '@types';
import type { AdminFeedbackThread } from '@services/admin/adminService';
import type { AdminSeverityTokenKey } from '../../design-system';

type ReportLike = Partial<ErrorReport>;
type FeedbackLike = Partial<AdminFeedbackThread>;

export interface AdminSupportModelInput {
  reports?: ReportLike[];
  feedbackThreads?: FeedbackLike[];
  now?: number;
}

export interface AdminSupportMetric {
  key: string;
  label: string;
  value: string;
  description: string;
  trend: string;
  severity: AdminSeverityTokenKey;
}

export interface AdminSupportQueueItem {
  key: string;
  title: string;
  description: string;
  severity: AdminSeverityTokenKey;
  meta: string;
  source: 'report' | 'feedback' | 'thread';
  targetId: string;
}

export interface AdminSupportModel {
  metrics: AdminSupportMetric[];
  queue: AdminSupportQueueItem[];
  distribution: Array<{ key: string; label: string; total: number }>;
  totals: {
    reports: number;
    pendingReports: number;
    feedbackThreads: number;
    newFeedback: number;
    unresolvedFeedback: number;
    overdue: number;
    withoutReply: number;
  };
}

const SUPPORT_SLA_MS = 48 * 60 * 60 * 1000;

const readStatus = (value: unknown) => String(value ?? '').trim().toLowerCase();
const readString = (value: unknown) => String(value ?? '').trim();
const readNumber = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const readTimestamp = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = new Date(String(value || '')).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isPendingReport = (report: ReportLike) => readStatus(report.status) === 'pending';
const isResolvedFeedback = (thread: FeedbackLike) => readStatus(thread.status) === 'resolved';
const isNewFeedback = (thread: FeedbackLike) => readStatus(thread.status) === 'new';
const hasReply = (thread: FeedbackLike) => readNumber(thread.reply_count) > 0;

const getFeedbackTypeLabel = (type: unknown) => {
  switch (readStatus(type)) {
    case 'bug':
      return 'Bug';
    case 'suggestion':
      return 'Sugestao';
    case 'cancellation':
      return 'Cancelamento';
    case 'report':
      return 'Denuncia';
    case 'support':
      return 'Suporte';
    default:
      return 'Outro';
  }
};

const getReportTargetLabel = (targetType: unknown) => {
  switch (readStatus(targetType)) {
    case 'question':
      return 'Questao';
    case 'material':
      return 'Material';
    case 'comment':
      return 'Comentario';
    default:
      return 'Alvo';
  }
};

export const buildAdminSupportModel = ({
  reports = [],
  feedbackThreads = [],
  now = Date.now(),
}: AdminSupportModelInput): AdminSupportModel => {
  const pendingReports = reports.filter(isPendingReport);
  const unresolvedFeedback = feedbackThreads.filter((thread) => !isResolvedFeedback(thread));
  const newFeedback = feedbackThreads.filter(isNewFeedback);
  const withoutReply = unresolvedFeedback.filter((thread) => !hasReply(thread));
  const overdueFeedback = unresolvedFeedback.filter((thread) => {
    const createdAt = readTimestamp(thread.created_at);
    return createdAt > 0 && (now - createdAt) > SUPPORT_SLA_MS;
  });
  const feedbackTypeMap = new Map<string, number>();

  for (const thread of feedbackThreads) {
    const label = getFeedbackTypeLabel(thread.type);
    feedbackTypeMap.set(label, (feedbackTypeMap.get(label) || 0) + 1);
  }

  const queue: AdminSupportQueueItem[] = [
    ...pendingReports.map((report) => {
      const targetLabel = getReportTargetLabel(report.targetType);
      const reportId = readString(report.id);

      return {
        key: `report-${reportId}`,
        title: `${targetLabel} denunciado`,
        description: readString(report.details || report.reason) || 'Denuncia aguardando triagem.',
        severity: report.targetType === 'comment' ? 'high' as const : 'medium' as const,
        meta: readString(report.userName) || 'Usuario',
        source: 'report' as const,
        targetId: reportId,
      };
    }),
    ...overdueFeedback.map((thread) => ({
      key: `overdue-${thread.id}`,
      title: `${getFeedbackTypeLabel(thread.type)} com SLA estourado`,
      description: readString(thread.details || thread.reason) || 'Feedback aguardando resposta.',
      severity: 'high' as const,
      meta: readString(thread.user_email || thread.user_name) || 'Usuario',
      source: 'feedback' as const,
      targetId: String(thread.id || ''),
    })),
    ...withoutReply
      .filter((thread) => !overdueFeedback.some((overdue) => overdue.id === thread.id))
      .map((thread) => ({
        key: `without-reply-${thread.id}`,
        title: `${getFeedbackTypeLabel(thread.type)} sem resposta`,
        description: readString(thread.details || thread.reason) || 'Atendimento ainda sem retorno administrativo.',
        severity: 'medium' as const,
        meta: readString(thread.user_email || thread.user_name) || 'Usuario',
        source: 'thread' as const,
        targetId: String(thread.id || ''),
      })),
  ];

  return {
    metrics: [
      {
        key: 'inbox',
        label: 'Inbox aberto',
        value: String(unresolvedFeedback.length),
        description: 'Feedbacks e threads ainda nao resolvidos.',
        trend: unresolvedFeedback.length > 0 ? 'Atender' : 'Saudavel',
        severity: unresolvedFeedback.length > 0 ? 'medium' : 'healthy',
      },
      {
        key: 'reports',
        label: 'Denuncias pendentes',
        value: String(pendingReports.length),
        description: 'Casos aguardando moderacao.',
        trend: pendingReports.length > 0 ? 'Triar' : 'Saudavel',
        severity: pendingReports.length > 0 ? 'high' : 'healthy',
      },
      {
        key: 'without_reply',
        label: 'Sem resposta',
        value: String(withoutReply.length),
        description: 'Atendimentos abertos sem primeira resposta.',
        trend: withoutReply.length > 0 ? 'Responder' : 'Saudavel',
        severity: withoutReply.length > 0 ? 'medium' : 'healthy',
      },
      {
        key: 'sla',
        label: 'SLA estourado',
        value: String(overdueFeedback.length),
        description: 'Threads abertas ha mais de 48 horas.',
        trend: overdueFeedback.length > 0 ? 'Urgente' : 'Saudavel',
        severity: overdueFeedback.length > 0 ? 'high' : 'healthy',
      },
    ],
    queue,
    distribution: Array.from(feedbackTypeMap.entries()).map(([label, total]) => ({
      key: label.toLowerCase(),
      label,
      total,
    })),
    totals: {
      reports: reports.length,
      pendingReports: pendingReports.length,
      feedbackThreads: feedbackThreads.length,
      newFeedback: newFeedback.length,
      unresolvedFeedback: unresolvedFeedback.length,
      overdue: overdueFeedback.length,
      withoutReply: withoutReply.length,
    },
  };
};
