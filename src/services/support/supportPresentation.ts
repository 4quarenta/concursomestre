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

import { getSupportReasonLabel } from './supportReasonLabels';

export type SupportPresentationType =
  | 'support'
  | 'bug'
  | 'suggestion'
  | 'platform-rating'
  | 'teacher-request'
  | 'analysis-request'
  | 'report'
  | 'other';

export type SupportThreadLike = {
  id?: number | string;
  type?: string | null;
  reason?: string | null;
  details?: string | null;
  public_rating?: number | string | null;
};

export type EditorialRequestDetails = {
  requestCode?: string;
  kind?: 'teacher-request' | 'analysis-request';
  lawId?: string;
  sectionId?: string;
  targetId?: string;
  law?: string;
  section?: string;
  linkedItem?: string;
  article?: string;
  excerpt?: string;
  studentNotes?: string;
};

const normalizeKey = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '-');

const normalizeText = (value: unknown) => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .trim();

const readLineValue = (details: string, labels: string[]) => {
  const labelPattern = labels
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const match = details.match(new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*:\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim() || '';
};

export const compactSupportText = (value: unknown, maxLength = 140) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

export const parseEditorialRequestDetails = (detailsValue: unknown): EditorialRequestDetails | null => {
  const details = normalizeText(detailsValue);
  if (!details) return null;

  const codeMatch = details.match(/C[oó]digo do pedido:\s*((teacher_request|analysis_request):([^\s:]+):([^\s:]+):([^\n]+))/i);
  if (!codeMatch) return null;

  const studentNotesMatch = details.match(/Observa[cç][oõ]es do aluno:\s*([\s\S]+)$/i);
  const excerptStart = details.match(/Trecho:\s*([\s\S]*?)(?:\nObserva[cç][oõ]es do aluno:|$)/i);
  const kind = codeMatch[2].toLowerCase() === 'analysis_request' ? 'analysis-request' : 'teacher-request';

  return {
    requestCode: codeMatch[1].trim(),
    kind,
    lawId: codeMatch[3].trim(),
    sectionId: codeMatch[4].trim(),
    targetId: codeMatch[5].trim(),
    law: readLineValue(details, ['Lei']),
    section: readLineValue(details, ['Seção', 'Secao']),
    linkedItem: readLineValue(details, ['Item vinculado']),
    article: readLineValue(details, ['Artigo']),
    excerpt: excerptStart?.[1]?.trim() || '',
    studentNotes: studentNotesMatch?.[1]?.trim() || '',
  };
};

export const getSupportPresentationType = (thread: SupportThreadLike): SupportPresentationType => {
  const type = normalizeKey(thread.type);
  const reason = normalizeKey(thread.reason);
  const details = normalizeKey(thread.details);

  if (Number(thread.public_rating || 0) > 0 || ['platform-rating', 'platform-rating', 'testimonial', 'rating'].includes(type) || reason.includes('avaliar-plataforma')) {
    return 'platform-rating';
  }

  const editorialDetails = parseEditorialRequestDetails(thread.details);
  if (editorialDetails?.kind) return editorialDetails.kind;

  if (reason.includes('solicitar-comentario') || details.includes('teacher-request')) return 'teacher-request';
  if (reason.includes('analise-detalhada') || details.includes('analysis-request')) return 'analysis-request';
  if (type.includes('bug') || reason.includes('bug') || reason.includes('erro')) return 'bug';
  if (type.includes('suggestion') || reason.includes('sugestao')) return 'suggestion';
  if (type.includes('report') || reason.includes('denuncia')) return 'report';
  if (type.includes('support') || reason.includes('ajuda') || reason.includes('suporte')) return 'support';
  if (type.includes('feedback')) return 'other';

  return (type as SupportPresentationType) || 'other';
};

export const SUPPORT_TYPE_LABELS: Record<SupportPresentationType, string> = {
  support: 'Solicitação',
  bug: 'Bug',
  suggestion: 'Sugestão',
  'platform-rating': 'Avaliação',
  'teacher-request': 'Comentário do professor',
  'analysis-request': 'Análise detalhada',
  report: 'Denúncia',
  other: 'Outro',
};

export const getSupportTypeLabel = (thread: SupportThreadLike) => (
  SUPPORT_TYPE_LABELS[getSupportPresentationType(thread)] || 'Solicitação'
);

export const getSupportThreadTitle = (thread: SupportThreadLike) => {
  const editorial = parseEditorialRequestDetails(thread.details);
  if (editorial?.kind === 'teacher-request') return 'Solicitar comentário do professor';
  if (editorial?.kind === 'analysis-request') return 'Solicitar análise detalhada';
  return String(getSupportReasonLabel(thread.reason) || getSupportTypeLabel(thread) || 'Solicitação').trim();
};

export const getSupportThreadPreview = (thread: SupportThreadLike, maxLength = 160) => {
  const editorial = parseEditorialRequestDetails(thread.details);
  if (editorial) {
    const parts = [
      editorial.law,
      editorial.section,
      editorial.linkedItem || editorial.article,
      editorial.studentNotes ? `Observação: ${editorial.studentNotes}` : '',
    ].filter(Boolean);
    return compactSupportText(parts.join(' • '), maxLength);
  }

  return compactSupportText(thread.details, maxLength);
};

export const getSupportThreadExpandedBlocks = (thread: SupportThreadLike) => {
  const editorial = parseEditorialRequestDetails(thread.details);
  if (!editorial) {
    return [
      {
        label: 'Conteúdo enviado',
        value: normalizeText(thread.details) || 'Sem informação registrada.',
      },
    ];
  }

  return [
    { label: 'Lei', value: editorial.law || '-' },
    { label: 'Seção', value: editorial.section || '-' },
    { label: 'Item vinculado', value: editorial.linkedItem || editorial.article || '-' },
    { label: 'Trecho', value: editorial.excerpt || 'Sem trecho informado.' },
    { label: 'Observações do aluno', value: editorial.studentNotes || 'Sem observações adicionais.' },
    { label: 'Código técnico', value: editorial.requestCode || '-' },
  ];
};

export const isFeedbackInboxThread = (thread: SupportThreadLike) => (
  ['platform-rating', 'other'].includes(getSupportPresentationType(thread))
);

export const isOperationalSupportThread = (thread: SupportThreadLike) => (
  ['support', 'bug', 'suggestion', 'teacher-request', 'analysis-request'].includes(getSupportPresentationType(thread))
);
