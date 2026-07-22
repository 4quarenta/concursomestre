import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const modalSource = readFileSync(
  resolve(process.cwd(), 'src/app/admin/components/database/TaxonomyModal.tsx'),
  'utf8',
);

const nextConfigSource = readFileSync(
  resolve(process.cwd(), 'next.config.ts'),
  'utf8',
);

describe('organization taxonomy editor', () => {
  it('keeps name, acronym and image as distinct organization fields', () => {
    expect(modalSource).toContain("'Nome completo do órgão'");
    expect(modalSource).toContain("'Sigla do órgão'");
    expect(modalSource).toContain("'Ícone ou logo do órgão'");
    expect(modalSource).toContain('value={filterAcronym}');
    expect(modalSource).toContain('value={filterAssetUrl}');
  });

  it('supports image upload and a single preview', () => {
    expect(modalSource).toContain('type="file"');
    expect(modalSource).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(modalSource).toContain("'Selecionar imagem'");
    expect(modalSource.match(/<img/g)).toHaveLength(1);
  });

  it('prevents stale admin HTML and RSC documents from being cached', () => {
    expect(nextConfigSource).toContain("source: '/admin/:path*'");
    expect(nextConfigSource).toContain('private, no-store, no-cache, must-revalidate, max-age=0');
  });
});
