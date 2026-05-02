import type { Question } from 'types';

export type QuestionPublishStatus = 'published' | 'draft' | 'scheduled';
export type QuestionVisibilityStatus = 'public' | 'elite' | 'internal';

const normalizeToken = (value: unknown) => String(value || '').trim().toLowerCase();

export const normalizeQuestionPublishStatus = (question: Record<string, any>): QuestionPublishStatus => {
  const explicitState = normalizeToken(
    question.publishStatus
    || question.publish_status
    || question.publicationStatus
    || question.publication_status
    || question.editorialStatus
    || question.editorial_status
    || question.estadoEditorial
    || question.estado_editorial,
  );

  const rawState = explicitState || normalizeToken(question.status);

  if (['scheduled', 'programado'].includes(rawState)) {
    return 'scheduled';
  }

  if (['draft', 'rascunho', 'pending', 'pendente'].includes(rawState)) {
    return 'draft';
  }

  if (['published', 'publicado', 'approved', 'aprovado', 'active', 'ativo', 'live'].includes(rawState)) {
    return 'published';
  }

  const scheduledAt = resolveQuestionScheduledAt(question);
  if (scheduledAt && scheduledAt.getTime() > Date.now()) {
    return 'scheduled';
  }

  return 'published';
};

export const normalizeQuestionVisibilityStatus = (question: Record<string, any>): QuestionVisibilityStatus => {
  const rawVisibility = normalizeToken(
    question.visibilityStatus
    || question.visibility_status
    || question.visibility,
  );

  if (['elite', 'premium'].includes(rawVisibility)) {
    return 'elite';
  }

  if (['internal', 'interno', 'private', 'privado'].includes(rawVisibility)) {
    return 'internal';
  }

  return 'public';
};

export const normalizeQuestionDateInput = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (typeof value === 'number') {
    const timestamp = value > 9999999999 ? value : value * 1000;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  const mysqlDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (mysqlDateTime) {
    return `${mysqlDateTime[1]}T${mysqlDateTime[2]}`;
  }

  const mysqlDate = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (mysqlDate) {
    return `${mysqlDate[1]}T00:00`;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
};

export const resolveQuestionScheduledAt = (question: Record<string, any>): Date | null => {
  const candidate = question.scheduledAt
    || question.scheduled_at
    || question.publishAt
    || question.publish_at;

  if (!candidate) {
    return null;
  }

  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isQuestionPubliclyVisible = (question: Record<string, any>): boolean => {
  if (normalizeQuestionVisibilityStatus(question) !== 'public') {
    return false;
  }

  const publishStatus = normalizeQuestionPublishStatus(question);

  if (publishStatus === 'draft') {
    return false;
  }

  if (publishStatus === 'scheduled') {
    const scheduledAt = resolveQuestionScheduledAt(question);
    return Boolean(scheduledAt && scheduledAt.getTime() <= Date.now());
  }

  return true;
};

export const withQuestionPublicationAliases = <T extends Record<string, any>>(question: T): T & Question => {
  const publishStatus = normalizeQuestionPublishStatus(question);
  const visibilityStatus = normalizeQuestionVisibilityStatus(question);
  const scheduledAt = normalizeQuestionDateInput(
    question.scheduledAt
    || question.scheduled_at
    || question.publishAt
    || question.publish_at,
  );
  const publishedAt = normalizeQuestionDateInput(
    question.publishedAt
    || question.published_at
    || question.publicationDate
    || question.publication_date,
  );

  return {
    ...question,
    publishStatus,
    publish_status: publishStatus,
    publicationStatus: publishStatus,
    publication_status: publishStatus,
    editorialStatus: publishStatus,
    editorial_status: publishStatus,
    status: publishStatus,
    visibilityStatus,
    visibility_status: visibilityStatus,
    scheduledAt,
    scheduled_at: scheduledAt,
    publishedAt,
    published_at: publishedAt,
  } as unknown as T & Question;
};
