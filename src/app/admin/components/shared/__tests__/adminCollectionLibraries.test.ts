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

describe('admin collection libraries', () => {
  it('uses the same collection toolbar, table rules and pagination in all three libraries', () => {
    [questionSource, examSource, legalSource].forEach((source) => {
      expect(source).toContain('AdminCollectionToolbar');
      expect(source).toContain('AdminCollectionPagination');
      expect(source).toContain('ADMIN_COLLECTION_TABLE_CLASS');
      expect(source).toContain('ADMIN_COLLECTION_TABLE_HEAD_CLASS');
      expect(source).toContain('ADMIN_COLLECTION_TABLE_ROW_CLASS');
    });
  });

  it('keeps bulk actions in the shared action bar where the collection supports selection', () => {
    expect(questionSource).toContain('AdminCollectionActionBar');
    expect(legalSource).toContain('AdminCollectionActionBar');
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
});
