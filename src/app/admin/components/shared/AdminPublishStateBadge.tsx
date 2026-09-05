import React from 'react';
import { AdminStatusBadge } from './AdminDesignSystem';

export type AdminPublishState = 'published' | 'draft' | 'scheduled' | 'archived';

const STATE_LABEL: Record<AdminPublishState, string> = {
  published: 'Publicado',
  draft: 'Rascunho',
  scheduled: 'Programado',
  archived: 'Arquivado',
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

  if (['archived', 'arquivado'].includes(rawState)) {
    return 'archived';
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
  <AdminStatusBadge label={STATE_LABEL[state]} tone={state === 'published' ? 'success' : state === 'scheduled' ? 'info' : state === 'draft' ? 'warning' : 'neutral'} />
);

export default AdminPublishStateBadge;
