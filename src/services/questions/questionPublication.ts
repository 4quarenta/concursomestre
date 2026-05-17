import type { Question } from 'types';

export type QuestionPublishStatus = 'published' | 'draft' | 'scheduled';
export type QuestionVisibilityStatus = 'public' | 'elite' | 'internal';

const normalizeToken = (value: unknown) => String(value || '').trim().toLowerCase();

const asQuestionPublicationRecord = (question: object): Record<string, unknown> => question as Record<string, unknown>;

export const normalizeQuestionPublishStatus = (question: object): QuestionPublishStatus => {
  const record = asQuestionPublicationRecord(question);
  const explicitState = normalizeToken(
    record.publishStatus
    || record.publish_status
    || record.publicationStatus
    || record.publication_status
    || record.editorialStatus
    || record.editorial_status
    || record.estadoEditorial
    || record.estado_editorial,
  );

  const rawState = explicitState || normalizeToken(record.status);

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

export const normalizeQuestionVisibilityStatus = (question: object): QuestionVisibilityStatus => {
  const record = asQuestionPublicationRecord(question);
  const rawVisibility = normalizeToken(
    record.visibilityStatus
    || record.visibility_status
    || record.visibility,
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

export const resolveQuestionScheduledAt = (question: object): Date | null => {
  const record = asQuestionPublicationRecord(question);
  const candidate = record.scheduledAt
    || record.scheduled_at
    || record.publishAt
    || record.publish_at;

  if (!candidate) {
    return null;
  }

  const dateInput = typeof candidate === 'string' || typeof candidate === 'number' || candidate instanceof Date
    ? candidate
    : String(candidate);
  const date = new Date(dateInput);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isQuestionPubliclyVisible = (question: object): boolean => {
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

export const withQuestionPublicationAliases = <T extends object>(question: T): T & Question => {
  const record = asQuestionPublicationRecord(question);
  const publishStatus = normalizeQuestionPublishStatus(question);
  const visibilityStatus = normalizeQuestionVisibilityStatus(question);
  const scheduledAt = normalizeQuestionDateInput(
    record.scheduledAt
    || record.scheduled_at
    || record.publishAt
    || record.publish_at,
  );
  const publishedAt = normalizeQuestionDateInput(
    record.publishedAt
    || record.published_at
    || record.publicationDate
    || record.publication_date,
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
