import React from 'react';

export type AdminPublishState = 'published' | 'draft' | 'scheduled';

const STATE_LABEL: Record<AdminPublishState, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  scheduled: 'Programado',
};

const STATE_CLASS: Record<AdminPublishState, string> = {
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  draft: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  scheduled: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300',
};

const normalizeStateToken = (value: unknown) => String(value || '').trim().toLowerCase();

const resolveScheduledDate = (item: Record<string, unknown>) => {
  const candidate = item.scheduledAt
    || item.scheduled_for
    || item.scheduledFor
    || item.publishAt
    || item.publish_at
    || item.publishedAt
    || item.published_at;

  if (!candidate) {
    return null;
  }

  if (!(candidate instanceof Date) && typeof candidate !== 'string' && typeof candidate !== 'number') {
    return null;
  }

  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const resolveAdminPublishState = (item: Record<string, unknown>): AdminPublishState => {
  const rawState = normalizeStateToken(
    item.publishStatus
    || item.publish_status
    || item.publicationStatus
    || item.publication_status
    || item.editorialStatus
    || item.editorial_status
    || item.estadoEditorial
    || item.estado_editorial
    || item.status
  );

  if (['scheduled', 'programado'].includes(rawState)) {
    return 'scheduled';
  }

  if (['draft', 'rascunho', 'pending', 'pendente', 'inactive', 'inativo', 'blocked', 'bloqueado', 'private', 'privado'].includes(rawState)) {
    return 'draft';
  }

  if (['published', 'publicado', 'approved', 'aprovado', 'active', 'ativo', 'live'].includes(rawState)) {
    return 'published';
  }

  const scheduledDate = resolveScheduledDate(item);
  if (scheduledDate && scheduledDate.getTime() > Date.now()) {
    return 'scheduled';
  }

  return 'published';
};

interface AdminPublishStateBadgeProps {
  state: AdminPublishState;
}

const AdminPublishStateBadge = ({ state }: AdminPublishStateBadgeProps) => (
  <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${STATE_CLASS[state]}`}>
    {STATE_LABEL[state]}
  </span>
);

export default AdminPublishStateBadge;
