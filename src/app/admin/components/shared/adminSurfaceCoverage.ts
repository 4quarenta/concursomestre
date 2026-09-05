/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

export type AdminSurfaceKind =
  | 'LIST_SURFACE'
  | 'EDITOR_SURFACE'
  | 'DASHBOARD_SPECIALIZED'
  | 'SETTINGS_FORM'
  | 'OPERATIONAL_WORKBENCH'
  | 'SPECIALIZED_NOT_COMPARABLE';

export type AdminSurfaceCoverageEntry = {
  id: string;
  label: string;
  kind: AdminSurfaceKind;
  usesCanonicalHeader: boolean;
  usesCanonicalPrimaryAction: boolean;
  usesCanonicalToolbar: boolean;
  usesCanonicalSearch: boolean;
  usesCanonicalFilters: boolean;
  usesCanonicalSort: boolean;
  usesCanonicalTableOrList: boolean;
  usesCanonicalRowActions: boolean;
  usesCanonicalPagination: boolean;
  usesCanonicalStatus: boolean;
  usesCanonicalLoadingEmptyError: boolean;
  usesCanonicalConfirmation: boolean;
  usesCanonicalEditorShell: boolean;
  domainExceptionReason?: string;
};

const comparableCollection = (id: string, label: string): AdminSurfaceCoverageEntry => ({
  id,
  label,
  kind: 'LIST_SURFACE',
  usesCanonicalHeader: true,
  usesCanonicalPrimaryAction: true,
  usesCanonicalToolbar: true,
  usesCanonicalSearch: true,
  usesCanonicalFilters: true,
  usesCanonicalSort: true,
  usesCanonicalTableOrList: true,
  usesCanonicalRowActions: true,
  usesCanonicalPagination: true,
  usesCanonicalStatus: true,
  usesCanonicalLoadingEmptyError: true,
  usesCanonicalConfirmation: true,
  usesCanonicalEditorShell: false,
});

const comparableEditor = (id: string, label: string): AdminSurfaceCoverageEntry => ({
  id,
  label,
  kind: 'EDITOR_SURFACE',
  usesCanonicalHeader: true,
  usesCanonicalPrimaryAction: true,
  usesCanonicalToolbar: false,
  usesCanonicalSearch: false,
  usesCanonicalFilters: false,
  usesCanonicalSort: false,
  usesCanonicalTableOrList: false,
  usesCanonicalRowActions: false,
  usesCanonicalPagination: false,
  usesCanonicalStatus: true,
  usesCanonicalLoadingEmptyError: true,
  usesCanonicalConfirmation: true,
  usesCanonicalEditorShell: true,
});

export const ADMIN_SURFACE_COVERAGE: AdminSurfaceCoverageEntry[] = [
  comparableCollection('operation.questions', 'Questões'),
  comparableCollection('operation.question-groups', 'Contextos de questões'),
  comparableCollection('operation.exams', 'Provas'),
  comparableCollection('operation.files', 'Arquivos'),
  comparableCollection('operation.blog', 'Blog'),
  comparableCollection('operation.novidades', 'Novidades'),
  comparableCollection('operation.filters', 'Taxonomias'),
  comparableCollection('operation.lei-comentada', 'Leis comentadas'),
  comparableCollection('operation.users', 'Usuários'),
  comparableCollection('marketplace.vendors', 'Vendedores'),
  comparableCollection('marketplace.materials', 'Materiais'),
  comparableCollection('marketplace.blocked', 'Materiais bloqueados'),
  comparableCollection('finance.transactions', 'Transações'),
  comparableCollection('finance.plans', 'Planos'),
  comparableCollection('finance.coupons', 'Cupons'),
  comparableCollection('marketing.landing-pages', 'Landing pages'),
  comparableCollection('marketing.campaigns', 'Campanhas'),
  comparableCollection('marketing.featured-organizations', 'Organizações em destaque'),
  comparableCollection('support.feedback', 'Feedback'),
  comparableCollection('support.threads', 'Solicitações'),
  comparableCollection('support.reports', 'Denúncias'),
  comparableCollection('support.rankings', 'Rankings'),
  comparableCollection('support.refunds', 'Solicitações de reembolso'),
  comparableCollection('support.comments', 'Comentários'),
  comparableCollection('settings.email-templates', 'Templates de e-mail'),
  comparableCollection('settings.logs', 'Logs'),
  comparableEditor('editor.question', 'Editor de questão'),
  comparableEditor('editor.exam', 'Editor de prova'),
  comparableEditor('editor.blog', 'Editor de post'),
  comparableEditor('editor.novidade', 'Editor de novidade'),
  comparableEditor('editor.law', 'Editor de lei'),
  comparableEditor('editor.user', 'Editor de usuário'),
  comparableEditor('editor.landing-page', 'Editor de landing page'),
];

export const getAdminSurfaceCoverageSummary = () => {
  const lists = ADMIN_SURFACE_COVERAGE.filter((surface) => surface.kind === 'LIST_SURFACE');
  const editors = ADMIN_SURFACE_COVERAGE.filter((surface) => surface.kind === 'EDITOR_SURFACE');
  const exceptions = ADMIN_SURFACE_COVERAGE.filter((surface) => surface.domainExceptionReason);

  return {
    comparableLists: lists.length,
    standardizedLists: lists.filter((surface) => surface.usesCanonicalTableOrList && surface.usesCanonicalToolbar).length,
    editableSurfaces: editors.length,
    standardizedEditors: editors.filter((surface) => surface.usesCanonicalEditorShell).length,
    unjustifiedExceptions: exceptions.length,
  };
};
