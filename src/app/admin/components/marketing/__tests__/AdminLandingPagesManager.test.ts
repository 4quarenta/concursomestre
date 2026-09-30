import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/marketing/AdminLandingPagesManager.tsx'),
  'utf8',
);

describe('admin landing pages manager', () => {
  it('persists availability without bringing back a content editor', () => {
    expect(source).toContain('await saveSystemSettingsNow({');
    expect(source).not.toContain('updateSystemSettings(persisted)');
    expect(source).toContain('MARKETING_LANDING_SCRIPT_REGISTRY');
    expect(source).toContain('toggleAvailability');
    expect(source).toContain('Copiar link de');
    expect(source).not.toContain('Adicionar nova');
    expect(source).not.toContain('type="file"');
    expect(source).not.toContain('Excluir landing');
  });
});
