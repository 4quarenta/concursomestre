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

import { withQuestionPublicationAliases } from '@services/questions/questionPublication';
import { getSupportReasonLabel } from '@services/support/supportReasonLabels';
import type { Question } from '@types';
import type { AdminFeedbackThread, AdminLooseRecord, AdminQuestionListPayload } from './adminService.types';

const toLooseRecord = (value: unknown): AdminLooseRecord | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as AdminLooseRecord
    : undefined
);

export const normalizeAdminFeedbackThread = <T extends AdminFeedbackThread>(thread: T): T => ({
  ...thread,
  reason: getSupportReasonLabel(thread.reason),
});

export const normalizeAdminQuestionListPayload = (payload: unknown, fallbackPage: number): AdminQuestionListPayload => {
  const record = toLooseRecord(payload);
  const nestedRecord = toLooseRecord(record?.data);
  const source = nestedRecord || record || {};
  const nestedRows = Array.isArray(record?.data) ? record?.data : undefined;
  const rowsCandidate = source.rows
    || source.questions
    || source.items
    || source.results
    || source.records
    || (Array.isArray(source.data) ? source.data : undefined)
    || nestedRows
    || (Array.isArray(payload) ? payload : undefined);
  const rows = Array.isArray(rowsCandidate) ? rowsCandidate as Question[] : [];
  const total = Number(source.total ?? source.count ?? source.totalRows ?? source.total_items ?? rows.length);
  const perPage = Number(source.perPage ?? source.per_page ?? source.limit ?? 20) || 20;
  const page = Number(source.page ?? source.currentPage ?? source.current_page ?? fallbackPage) || fallbackPage;
  const pages = Number(source.pages ?? source.totalPages ?? source.total_pages ?? Math.max(1, Math.ceil(total / Math.max(1, perPage)))) || 1;

  return {
    rows: rows.map((row) => withQuestionPublicationAliases(row)),
    total,
    perPage,
    pages,
    page,
  };
};
