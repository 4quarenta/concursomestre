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

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const questionSource = readSource('src/app/admin/components/questions/AdminQuestionsSection.tsx');
const examSource = readSource('src/app/admin/components/exams/AdminExamBankSection.tsx');
const legalSource = readSource('src/app/admin/components/legal-commentary/AdminLegalCommentarySection.tsx');
const blogSource = readSource('src/app/admin/components/blog/AdminBlogSection.tsx');
const filesSource = readSource('src/app/admin/components/files/AdminFilesSection.tsx');
const filtersSource = readSource('src/app/admin/components/database/FiltersManagementSection.tsx');
const usersSource = readSource('src/app/admin/components/users/AdminUsersSection.tsx');

describe('admin collection libraries', () => {
  it('uses the same collection toolbar, table rules and pagination in every content library', () => {
    [questionSource, examSource, legalSource, blogSource, filesSource, filtersSource, usersSource].forEach((source) => {
      expect(source).toContain('AdminCollectionToolbar');
      expect(source).toContain('AdminCollectionPagination');
      expect(source).toContain('AdminCollectionTablePanel');
      expect(source).toContain('ADMIN_COLLECTION_TABLE_CLASS');
      expect(source).toContain('ADMIN_COLLECTION_TABLE_HEAD_CLASS');
      expect(source).toContain('ADMIN_COLLECTION_TABLE_ROW_CLASS');
    });
  });

  it('keeps blog creation and editing in the canonical content editor route', () => {
    const editorSource = readSource('src/app/admin/operation/blog/[articleId]/edit/page.tsx');
    const navigationSource = readSource('src/app/admin/config/adminPageNavigationConfig.ts');
    const databaseControllerSource = readSource('src/app/admin/components/database/useAdminDatabaseManagerController.tsx');
    const databaseNavigationStateSource = readSource('src/app/admin/components/database/useAdminDatabaseNavigationState.ts');
    const marketingSource = readSource('src/app/admin/components/marketing/AdminMarketingSection.tsx');

    expect(blogSource).toContain("buildAdminBlogEditPath('new')");
    expect(editorSource).toContain('AdminStandaloneShell');
    expect(editorSource).toContain('activeTab="operation"');
    expect(editorSource).toContain('activeSectionKey="blog"');
    expect(navigationSource).toContain("{ key: 'blog', label: 'Blog' }");
    expect(navigationSource).toContain("normalizedTab === 'marketing' && normalizedSection === 'blog'");
    expect(databaseControllerSource).toMatch(/VALID_ADMIN_DATABASE_SUBTABS[\s\S]*?'blog'/);
    expect(databaseNavigationStateSource).toMatch(/VALID_SUBTABS[\s\S]*?'blog'/);
    expect(marketingSource).not.toContain('AdminBlogManager');
  });

  it('keeps bulk actions in the shared action bar where the collection supports selection', () => {
    expect(questionSource).toContain('AdminCollectionActionBar');
    expect(legalSource).toContain('AdminCollectionActionBar');
    expect(filtersSource).toContain('AdminCollectionActionBar');
  });

  it('keeps operation navigation mounted and loads large admin domains on demand', () => {
    const pageContentSource = readSource('src/app/admin/components/shared/AdminPageContent.tsx');
    const databaseSectionsSource = readSource('src/app/admin/components/database/AdminDatabaseSections.tsx');

    expect(pageContentSource).toContain("import AdminDatabaseManager from '../database/AdminDatabaseManager'");
    expect(pageContentSource).toContain('return <AdminDatabaseManager {...props.databaseSectionProps} />');
    expect(pageContentSource).not.toContain('<AdminDatabaseManager key={props.databaseSectionKey}');
    expect(databaseSectionsSource).toContain("dynamic(() => import('../questions/AdminQuestionsSection')");
    expect(databaseSectionsSource).toContain("dynamic(() => import('../import/AdminGranCrawlerSection')");
  });

  it('keeps Novidades as a valid operation subtab instead of falling back to questions', () => {
    const navigationSource = readSource('src/app/admin/config/adminPageNavigationConfig.ts');
    const databaseControllerSource = readSource('src/app/admin/components/database/useAdminDatabaseManagerController.tsx');
    const databaseNavigationStateSource = readSource('src/app/admin/components/database/useAdminDatabaseNavigationState.ts');
    const databaseSectionsSource = readSource('src/app/admin/components/database/AdminDatabaseSections.tsx');

    expect(navigationSource).toContain("novidades: { tab: 'operation', section: 'novidades' }");
    expect(databaseControllerSource).toMatch(/VALID_ADMIN_DATABASE_SUBTABS[\s\S]*?'novidades'/);
    expect(databaseNavigationStateSource).toMatch(/VALID_SUBTABS[\s\S]*?'novidades'/);
    expect(databaseSectionsSource).toContain("activeSubTab === 'novidades'");
    expect(databaseSectionsSource).toContain('<AdminChangelogSection />');
  });

  it('does not render standalone summary-card grids in exam and legal libraries', () => {
    expect(examSource).not.toContain('totalLinkedQuestions');
    expect(examSource).not.toContain('grid gap-4 md:grid-cols-3');
    expect(legalSource).not.toContain('home.totals.laws');
    expect(legalSource).not.toContain('grid gap-4 md:grid-cols-4');
  });

  it('paginates exam and legal rows in groups of twenty', () => {
    expect(examSource).toContain('const COLLECTION_PAGE_SIZE = 20');
    expect(examSource).toContain('visibleExams.map');
    expect(legalSource).toContain('const COLLECTION_PAGE_SIZE = 20');
    expect(legalSource).toContain('visibleLaws.map');
  });

  it('normalizes structured exam booklet metadata before rendering', () => {
    expect(examSource).toContain('resolveExamBookletLabel');
    expect(examSource).toContain('record.name ?? record.nome ?? record.label');
    expect(examSource).not.toContain('{exam.caderno || [exam.tipoCaderno');
  });

  it('uses the canonical taxonomy selector for blog categories', () => {
    const editorSource = readSource('src/app/admin/operation/blog/[articleId]/edit/page.tsx');
    expect(editorSource).toContain('SmartTagSelector');
    expect(editorSource).toContain('Busque ou crie uma categoria');
    expect(editorSource).not.toContain('<span className={labelClass}>Nova categoria</span>');
  });
});
