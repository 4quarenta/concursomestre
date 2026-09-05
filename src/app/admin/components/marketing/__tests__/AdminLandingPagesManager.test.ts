import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/marketing/AdminLandingPagesManager.tsx'),
  'utf8',
);

describe('admin landing pages manager', () => {
  it('persists each operation once without scheduling a second settings update', () => {
    expect(source).toContain('await saveSystemSettingsNow({');
    expect(source).not.toContain('updateSystemSettings(persisted)');
  });

  it('uses the canonical editor layout with a publication sidebar', () => {
    expect(source).toContain("xl:grid-cols-[minmax(0,1fr)_320px]");
    expect(source).toContain('Salvar alterações');
    expect(source).toContain('Excluir landing');
    expect(source).toContain('xl:sticky xl:top-6');
  });
});
