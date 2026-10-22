import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/shared/layout/Layout.tsx'), 'utf8');

describe('platform account menus', () => {
  it('opens the account menu from the profile trigger and exposes the profile destination', () => {
    expect(source).toContain('setIsProfileMenuOpen((current) => !current)');
    expect(source).toContain("label: 'Meu perfil'");
    expect(source).toContain("onClick={handleProfileMenuToggle}");
    expect(source).not.toContain("label: 'Perfil', icon: User, path: '/profile/personal'");
  });

  it('keeps admin access permission-gated in the account menu', () => {
    expect(source).toContain('...(canOpenAdminPanel ? [{');
    expect(source).toContain("label: 'Painel Admin'");
    expect(source).not.toContain('navItems.push({');
  });

  it('puts editorial links and account logout in their respective menus', () => {
    for (const path of ['/novidades', '/blog', '/materiais', '/bancas']) {
      expect(source).toContain(`href: '${path}'`);
    }
    expect(source).toContain('Sair da conta');
    expect(source).toContain("href=\"/support\"");
  });
});
