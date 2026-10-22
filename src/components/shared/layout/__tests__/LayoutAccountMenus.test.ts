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

  it('keeps the account dropdown compact and limited to account actions', () => {
    expect(source).toContain('min-w-48 rounded-md');
    expect(source).not.toContain('360px');
    for (const item of ['Níveis XP', 'Assinatura', 'Histórico de suporte', 'Transações', 'Meus materiais', 'Minhas anotações', 'Privacidade']) {
      expect(source).not.toContain(`label: '${item}'`);
    }
    expect(source).toContain('Meu perfil');
    expect(source).toContain('Sair da conta');
  });

  it('uses the correct editorial destinations in the More menu', () => {
    for (const path of ['/novidades', '/blog', '/disciplinas', '/bancas']) {
      expect(source).toContain(`href: '${path}'`);
    }
    expect(source).not.toContain("href: '/materiais'");
    expect(source).toContain("href=\"/support\"");
  });
});
