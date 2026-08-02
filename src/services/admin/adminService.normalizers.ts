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

const normalizeAdminQuestionListRow = (value: unknown): Question => {
  const row = toLooseRecord(value) || {};
  const content = toLooseRecord(row.content) || {};
  const publication = toLooseRecord(row.publication) || {};
  const editorial = toLooseRecord(row.editorial) || {};
  const filters = toLooseRecord(row.filters) || {};
  const flags = toLooseRecord(row.flags) || {};
  const subjects = Array.isArray(filters.subjects) ? filters.subjects : [];
  const topics = Array.isArray(filters.topics) ? filters.topics : [];
  const subtopics = Array.isArray(filters.subtopics) ? filters.subtopics : [];
  const exams = Array.isArray(row.provas)
    ? row.provas
    : (Array.isArray(row.exams) ? row.exams : []);
  const canonicalType = String(row.type ?? 'single_choice');
  const canonicalDifficulty = String(row.difficulty ?? 'medium');
  const difficultyValue = canonicalDifficulty === 'hard' ? 3 : (canonicalDifficulty === 'easy' ? 1 : 2);

  return withQuestionPublicationAliases({
    ...row,
    enunciado: String(row.enunciado ?? content.statement ?? ''),
    enunciado_clean: String(row.enunciado_clean ?? content.statementClean ?? content.statement ?? ''),
    bancas: Array.isArray(row.bancas) ? row.bancas : (Array.isArray(filters.examBoards) ? filters.examBoards : []),
    orgaos: Array.isArray(row.orgaos) ? row.orgaos : (Array.isArray(filters.organizations) ? filters.organizations : []),
    cargos: Array.isArray(row.cargos) ? row.cargos : (Array.isArray(filters.roles) ? filters.roles : []),
    carreiras: Array.isArray(row.carreiras) ? row.carreiras : (Array.isArray(filters.careers) ? filters.careers : []),
    assuntos: Array.isArray(row.assuntos) ? row.assuntos : [...subjects, ...topics, ...subtopics],
    anos: Array.isArray(row.anos) ? row.anos : (Array.isArray(filters.years) ? filters.years : []),
    provas: exams,
    provaId: row.provaId ?? toLooseRecord(row.source)?.examId ?? exams[0]?.id ?? null,
    tipo: String(row.tipo ?? (canonicalType === 'true_false' ? 'certo_errado' : 'multipla_escolha')),
    dificuldade: Number(row.dificuldade ?? difficultyValue),
    anulada: Boolean(row.anulada ?? flags.annulled),
    desatualizada: Boolean(row.desatualizada ?? flags.outdated),
    publishStatus: String(row.publishStatus ?? publication.status ?? 'draft'),
    visibilityStatus: String(row.visibilityStatus ?? publication.visibility ?? 'public'),
    scheduledAt: row.scheduledAt ?? publication.scheduledAt ?? null,
    publishedAt: row.publishedAt ?? publication.publishedAt ?? null,
    hasTeacherComment: Boolean(row.hasTeacherComment ?? editorial.hasTeacherComment),
    hasDetailedComment: Boolean(row.hasDetailedComment ?? editorial.hasDetailedAnalysis),
  } as Question);
};

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
  const rows = Array.isArray(rowsCandidate) ? rowsCandidate.map(normalizeAdminQuestionListRow) : [];
  const total = Number(source.total ?? source.count ?? source.totalRows ?? source.total_items ?? rows.length);
  const perPage = Number(source.perPage ?? source.per_page ?? source.limit ?? 20) || 20;
  const page = Number(source.page ?? source.currentPage ?? source.current_page ?? fallbackPage) || fallbackPage;
  const pages = Number(source.pages ?? source.totalPages ?? source.total_pages ?? Math.max(1, Math.ceil(total / Math.max(1, perPage)))) || 1;

  return {
    rows,
    total,
    perPage,
    pages,
    page,
  };
};
