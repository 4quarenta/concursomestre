/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sectionSource = readFileSync(
  resolve(process.cwd(), 'src/app/admin/components/files/AdminFilesSection.tsx'),
  'utf8',
);
const navigationSource = readFileSync(
  resolve(process.cwd(), 'src/app/admin/config/adminPageNavigationConfig.ts'),
  'utf8',
);
const sectionsSource = readFileSync(
  resolve(process.cwd(), 'src/app/admin/components/database/AdminDatabaseSections.tsx'),
  'utf8',
);

describe('admin file library', () => {
  it('is exposed as a canonical operation section', () => {
    expect(navigationSource).toContain("{ key: 'files', label: 'Arquivos' }");
    expect(sectionsSource).toContain("activeSubTab === 'files'");
    expect(sectionsSource).toContain('<AdminFilesSection />');
  });

  it('uses server pagination and explicit moderation filters', () => {
    expect(sectionSource).toContain("params: { page, limit: 30, search, type, source, link }");
    expect(sectionSource).toContain('Todos os tipos');
    expect(sectionSource).toContain('Todas as origens');
    expect(sectionSource).toContain('Sem vínculo');
  });

  it('offers guarded deletion and identifies exam files by exam title', () => {
    expect(sectionSource).toContain('item.deletable ?');
    expect(sectionSource).toContain('Excluir arquivo?');
    expect(sectionSource).toContain("item.source === 'exam_file' && item.ownerLabel");
    expect(sectionSource).toContain('Banco de provas · Prova #');
    expect(sectionSource).toContain('Arquivo físico ausente');
  });
});
