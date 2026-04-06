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

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const readFile = (relativePath: string) =>
  fs.readFileSync(path.resolve(root, relativePath), 'utf8');

const stripStandardHeader = (content: string) =>
  content.replace(/^\/\*[\s\S]*?@since 1\.0\.0[\s\S]*?\*\/\s*/m, '');

const countLines = (relativePath: string) =>
  stripStandardHeader(readFile(relativePath)).split(/\r?\n/).length;

const listSourceFiles = (dir: string): string[] => {
  const absoluteDir = path.resolve(root, dir);

  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(absoluteDir, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(path.relative(root, entryPath));
    }

    if (/\.(ts|tsx)$/.test(entry.name)) {
      return [entryPath];
    }

    return [];
  });
};

const findLegacyLayerImports = () => {
  const sourceFiles = listSourceFiles('src');

  return sourceFiles.flatMap((filePath) => {
    const relativePath = path.relative(root, filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    return lines.flatMap((line, index) => {
      const match = line.match(/^\s*(?:import|export)\b.*?from\s+['"]([^'"]+)['"]/);
      const modulePath = match?.[1];

      if (!modulePath) {
        return [];
      }

      const referencesLegacyLayer =
        modulePath.startsWith('@features') ||
        modulePath.startsWith('@core') ||
        modulePath === 'src/features' ||
        modulePath === 'src/core' ||
        modulePath.startsWith('src/features/') ||
        modulePath.startsWith('src/core/') ||
        modulePath.includes('/features/') ||
        modulePath.includes('/core/') ||
        modulePath.endsWith('/features') ||
        modulePath.endsWith('/core');

      return referencesLegacyLayer
        ? [`${relativePath}:${index + 1}:${modulePath}`]
        : [];
    });
  });
};

describe('admin architecture', () => {
  it('keeps the admin page as a thin composition shell', () => {
    expect(countLines('src/app/admin/page.tsx')).toBeLessThanOrEqual(60);
  });

  it('keeps the database manager as a thin composition shell', () => {
    expect(countLines('src/app/admin/components/database/AdminDatabaseManager.tsx')).toBeLessThanOrEqual(40);
  });

  it('keeps the admin shell helpers thin', () => {
    expect(countLines('src/app/admin/components/shared/useAdminPageController.tsx')).toBeLessThanOrEqual(180);
    expect(countLines('src/app/admin/components/shared/AdminShellLayout.tsx')).toBeLessThanOrEqual(70);
    expect(countLines('src/app/admin/components/shared/AdminPageContent.tsx')).toBeLessThanOrEqual(70);
    expect(countLines('src/app/admin/components/shared/AdminTopBar.tsx')).toBeLessThanOrEqual(120);
  });

  it('keeps route suspense fallback extracted and free of loading copy', () => {
    expect(fs.existsSync(path.resolve(root, 'src/router/RouteSuspenseFallback.tsx'))).toBe(true);
    expect(countLines('src/router/index.tsx')).toBeLessThanOrEqual(160);
    expect(readFile('src/router/index.tsx')).not.toContain('Carregando rota');
    expect(readFile('src/router/RouteSuspenseFallback.tsx')).toContain('animate-pulse');
    expect(readFile('src/router/RouteSuspenseFallback.tsx')).not.toContain('Carregando rota');
    expect(readFile('src/router/RouteSuspenseFallback.tsx')).toContain('LayoutContentRouteFallback');
  });

  it('keeps layout routes mounted while lazy pages load', () => {
    expect(readFile('src/router/publicRoutes.tsx')).toContain('LayoutContentRouteFallback');
    expect(readFile('src/router/privateRoutes.tsx')).toContain('LayoutContentRouteFallback');
    expect(readFile('src/router/publicRoutes.tsx')).toContain('React.Suspense');
    expect(readFile('src/router/privateRoutes.tsx')).toContain('React.Suspense');
  });

  it('keeps admin shared limited to shell components', () => {
    const sharedDir = path.resolve(root, 'src/app/admin/components/shared');
    const sharedFiles = fs
      .readdirSync(sharedDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    expect(sharedFiles).toEqual([
      'AdminPageContent.tsx',
      'AdminPageHeader.tsx',
      'AdminShellLayout.tsx',
      'AdminTopBar.tsx',
      'NotificationDropdown.tsx',
      'useAdminPageController.tsx',
    ]);
  });

  it('keeps the log viewer inside settings and out of admin shared', () => {
    expect(fs.existsSync(path.resolve(root, 'src/app/admin/components/settings/LogViewer.tsx'))).toBe(true);
    expect(fs.existsSync(path.resolve(root, 'src/app/admin/components/shared/LogViewer.tsx'))).toBe(false);
  });

  it('keeps legacy admin components out of src/components/admin', () => {
    const legacyAdminDir = path.resolve(root, 'src/components/admin');
    const exists = fs.existsSync(legacyAdminDir);
    const entries = exists ? fs.readdirSync(legacyAdminDir) : [];

    expect(entries).toEqual([]);
  });

  it('keeps src/pages empty while migration finishes', () => {
    const pagesDir = path.resolve(root, 'src/pages');
    const entries = fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir) : [];
    const pendingDeleteDir = path.resolve(root, 'src/pages_pending_delete');

    expect(entries).toEqual([]);
    expect(fs.existsSync(pendingDeleteDir)).toBe(false);
  });

  it('keeps legacy src/features and src/core out of the active frontend tree', () => {
    expect(fs.existsSync(path.resolve(root, 'src/features'))).toBe(false);
    expect(fs.existsSync(path.resolve(root, 'src/core'))).toBe(false);
    expect(findLegacyLayerImports()).toEqual([]);
  });

  it('keeps the engineering rules documented in the repository', () => {
    expect(fs.existsSync(path.resolve(root, '.agent/rules/engineering-standards.md'))).toBe(true);
    expect(readFile('README.md')).toContain('engineering-standards.md');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('Comentários obrigatorios');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('Estrutura oficial do frontend');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('Padrao de código');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('@since <versao>');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('v1.0.0');
  });

  it('keeps the central routing and admin shells documented in pt-BR', () => {
    expect(readFile('src/router/index.tsx')).toContain('Casca interna do roteamento oficial da plataforma');
    expect(readFile('src/router/RouteSuspenseFallback.tsx')).toContain('Decide qual skeleton mostrar com base na rota atual e no estado de autenticação');
    expect(readFile('src/app/admin/page.tsx')).toContain('Entrada oficial da area administrativa');
    expect(readFile('src/app/admin/components/shared/useAdminPageController.tsx')).toContain('Controller principal da pagina administrativa');
    expect(readFile('src/app/admin/components/database/useAdminDatabaseManagerController.tsx')).toContain('Controller central da aba "Base de Dados"');
  });
});
