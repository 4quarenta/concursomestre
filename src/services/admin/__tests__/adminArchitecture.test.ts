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

const findPatternMatches = (dir: string, pattern: RegExp) => {
  const sourceFiles = listSourceFiles(dir)
    .filter((filePath) => !filePath.includes(`${path.sep}__tests__${path.sep}`));

  return sourceFiles.flatMap((filePath) => {
    const relativePath = path.relative(root, filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

    return lines.flatMap((line, index) =>
      pattern.test(line) ? [`${relativePath}:${index + 1}:${line.trim()}`] : []
    );
  });
};

const listRelativeSourceFiles = (dir: string) =>
  listSourceFiles(dir).map((filePath) => path.relative(root, filePath));

const findUnsafeDangerouslySetInnerHtml = () => (
  listSourceFiles('src')
    .filter((filePath) => !filePath.includes(`${path.sep}__tests__${path.sep}`))
    .flatMap((filePath) => {
      const relativePath = path.relative(root, filePath);
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

      return lines.flatMap((line, index) => {
        if (!line.includes('dangerouslySetInnerHTML')) {
          return [];
        }

        const context = lines.slice(index, index + 4).join('\n');
        const usesKnownSafeRenderer =
          context.includes('normalizeQuestionRichHtml(') ||
          context.includes('fixHtmlImages(') ||
          context.includes('renderQuestionContentWithAssets(') ||
          context.includes('sanitizedHtml') ||
          context.includes('serializeStructuredData(') ||
          context.includes('serializeJsonLd(');

        return usesKnownSafeRenderer ? [] : [`${relativePath}:${index + 1}:${line.trim()}`];
      });
    })
);

const findDirectRechartsResponsiveContainerImports = () => (
  listSourceFiles('src')
    .filter((filePath) => !filePath.endsWith(`${path.sep}StableResponsiveContainer.tsx`))
    .flatMap((filePath) => {
      const relativePath = path.relative(root, filePath);
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

      return lines.flatMap((line, index) => {
        const importsResponsiveContainer =
          /import\s*\{[^}]*\bResponsiveContainer\b[^}]*\}\s*from\s*['"]recharts['"]/.test(line);

        return importsResponsiveContainer ? [`${relativePath}:${index + 1}:${line.trim()}`] : [];
      });
    })
);

const findDirectRuntimeConsoleCalls = () => (
  listSourceFiles('src')
    .filter((filePath) => !filePath.includes(`${path.sep}__tests__${path.sep}`))
    .filter((filePath) => !filePath.endsWith(`${path.sep}services${path.sep}monitoring${path.sep}clientLog.ts`))
    .flatMap((filePath) => {
      const relativePath = path.relative(root, filePath);
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

      return lines.flatMap((line, index) =>
        /console\.(?:error|warn|log|debug)\s*\(/.test(line)
          ? [`${relativePath}:${index + 1}:${line.trim()}`]
          : []
      );
    })
);

describe('admin architecture', () => {
  it('keeps the admin page as a thin composition shell', () => {
    expect(countLines('src/app/admin/page.tsx')).toBeLessThanOrEqual(60);
  });

  it('keeps the database manager as a thin composition shell', () => {
    expect(countLines('src/app/admin/components/database/AdminDatabaseManager.tsx')).toBeLessThanOrEqual(40);
  });

  it('keeps the admin shell helpers thin', () => {
    expect(countLines('src/app/admin/components/shared/useAdminPageController.tsx')).toBeLessThanOrEqual(700);
    expect(countLines('src/app/admin/components/shared/AdminShellLayout.tsx')).toBeLessThanOrEqual(90);
    expect(countLines('src/app/admin/components/shared/AdminPageContent.tsx')).toBeLessThanOrEqual(90);
    expect(countLines('src/app/admin/components/shared/AdminTopBar.tsx')).toBeLessThanOrEqual(260);
  });

  it('keeps route suspense handling extracted and free of loading copy', () => {
    expect(fs.existsSync(path.resolve(root, 'src/providers/NextAppProviders.tsx'))).toBe(true);
    expect(fs.existsSync(path.resolve(root, 'src/providers/NavigationProgressProvider.tsx'))).toBe(true);
    expect(readFile('src/providers/NextAppProviders.tsx')).not.toContain('AppShellFallback');
    expect(readFile('src/providers/NextAppProviders.tsx')).not.toContain('Carregando rota');
  });

  it('keeps runtime code free of DataProvider imports and debug-only logs', () => {
    expect(fs.existsSync(path.resolve(root, 'src/providers/DataProvider.tsx'))).toBe(false);
    expect(findPatternMatches('src', /\buseData\s*\(/)).toEqual([]);
    expect(findPatternMatches('src', /from\s+['"][^'"]*DataProvider['"]/)).toEqual([]);
    expect(findPatternMatches('src', /\bdebugger\b|console\.(?:log|debug)\s*\(/)).toEqual([]);
    expect(findDirectRuntimeConsoleCalls()).toEqual([]);
    expect(findPatternMatches('src', /\bwindow\.confirm\s*\(|\balert\s*\(/)).toEqual([]);
    expect(listRelativeSourceFiles('src').some((filePath) => /quick[-_]?login/i.test(filePath))).toBe(false);
  });

  it('keeps raw HTML injection behind known sanitizers', () => {
    expect(findUnsafeDangerouslySetInnerHtml()).toEqual([]);
  });

  it('keeps custom ad banners sanitized and script-free', () => {
    const adBanner = readFile('src/components/shared/feedback/AdBanner.tsx');

    expect(adBanner).toContain('normalizeQuestionRichHtml(customContent)');
    expect(adBanner).not.toContain("getElementsByTagName('script')");
    expect(adBanner).not.toContain('document.body.appendChild(script)');
  });

  it('keeps rich text editor output sanitized', () => {
    const richTextEditor = readFile('src/components/shared/ui/RichTextEditor.tsx');

    expect(richTextEditor).toContain('normalizeQuestionRichHtml(editor.innerHTML)');
    expect(richTextEditor).toContain('onPaste={handlePaste}');
    expect(richTextEditor).toContain('content: attr(data-placeholder)');
  });

  it('keeps Recharts sizing behind the stable chart wrapper', () => {
    expect(findDirectRechartsResponsiveContainerImports()).toEqual([]);
  });

  it('keeps layout shell mounted in the route frame', () => {
    const routeFrame = readFile('src/providers/NextRouteFrame.tsx');
    expect(routeFrame).toContain('Layout');
    expect(routeFrame).toContain('PageTransition');
    expect(routeFrame).toContain('GlobalLoader');
  });

  it('marks top-bar notifications as seen when the dropdown is opened', () => {
    const publicLayout = readFile('src/components/shared/layout/Layout.tsx');
    const adminTopBar = readFile('src/app/admin/components/shared/AdminTopBar.tsx');

    expect(publicLayout).toContain('markAllNotificationsAsRead(user?.id ? String(user.id) : undefined)');
    expect(publicLayout).toContain('Nao foi possivel marcar notificacoes como vistas ao abrir o box');
    expect(adminTopBar).toContain('markAllNotificationsAsRead()');
    expect(adminTopBar).toContain('Nao foi possivel marcar notificacoes como vistas ao abrir o box');
  });

  it('keeps admin shared limited to shell-layer files', () => {
    const sharedDir = path.resolve(root, 'src/app/admin/components/shared');
    const sharedFiles = fs
      .readdirSync(sharedDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();

    expect(sharedFiles).toEqual([
      'AdminCollectionActionBar.tsx',
      'AdminCollectionPagination.tsx',
      'AdminCollectionTablePanel.tsx',
      'AdminCollectionToolbar.tsx',
      'AdminDesignSystem.tsx',
      'AdminEditorShell.tsx',
      'AdminPageContent.tsx',
      'AdminPageHeader.tsx',
      'AdminPublishStateBadge.tsx',
      'AdminShellLayout.tsx',
      'AdminStandaloneShell.tsx',
      'AdminTopBar.tsx',
      'NotificationDropdown.tsx',
      'adminMarketplaceMetrics.ts',
      'adminPanelStyles.ts',
      'adminSurfaceCoverage.ts',
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

  it('keeps generated audit artifacts out of the project root', () => {
    expect(fs.existsSync(path.resolve(root, 'tmp-hard-refresh-baseline-latest.json'))).toBe(false);
    expect(fs.existsSync(path.resolve(root, 'docs/reports/artifacts/hard-refresh-baseline-latest.json'))).toBe(true);
  });

  it('keeps the engineering rules documented in the repository', () => {
    expect(fs.existsSync(path.resolve(root, '.agent/rules/engineering-standards.md'))).toBe(true);
    expect(readFile('docs/README.md').toLowerCase()).toContain('documentacao viva');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('Estrutura oficial do frontend');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('@since <versao>');
    expect(readFile('.agent/rules/engineering-standards.md')).toContain('v1.0.0');
  });

  it('keeps the central routing and admin shells documented in pt-BR', () => {
    expect(readFile('src/providers/NextRouteFrame.tsx')).toContain('Legacy hash navigation');
    expect(readFile('src/providers/NavigationProgressProvider.tsx')).toContain('Barra global de progresso de navegacao');
    expect(readFile('src/app/admin/page.tsx')).toContain('Entrada oficial da area administrativa');
    expect(readFile('src/app/admin/components/shared/useAdminPageController.tsx')).toContain('Controller principal da pagina administrativa');
    expect(readFile('src/app/admin/components/database/useAdminDatabaseManagerController.tsx')).toContain('Controller central da aba "Base de Dados"');
  });

  it('keeps critical admin confirmations out of native browser dialogs', () => {
    expect(findPatternMatches('src/app/admin', /\bwindow\.confirm\s*\(/)).toEqual([]);
    expect(readFile('src/providers/MarketplaceProvider.tsx')).not.toContain('window.confirm');
  });

  it('keeps finance free of fake fallback data and with extracted marketing section', () => {
    expect(readFile('src/app/admin/components/finance/AdminFinance.tsx')).toContain("import AdminMarketing from './AdminMarketing'");
    expect(readFile('src/app/admin/components/finance/AdminFinance.tsx')).not.toContain('Math.random(');
    expect(fs.existsSync(path.resolve(root, 'src/app/admin/components/finance/AdminMarketing.tsx'))).toBe(true);
  });

  it('keeps settings navigation extracted from the main settings screen', () => {
    expect(readFile('src/app/admin/components/settings/AdminSettings.tsx')).toContain("import AdminSettingsTabsBar from './AdminSettingsTabsBar'");
    expect(fs.existsSync(path.resolve(root, 'src/app/admin/components/settings/AdminSettingsTabsBar.tsx'))).toBe(true);
    expect(fs.existsSync(path.resolve(root, 'src/app/admin/components/settings/AdminSeoSettingsSection.tsx'))).toBe(true);
    expect(fs.existsSync(path.resolve(root, 'src/app/admin/components/settings/AdminCacheManagement.tsx'))).toBe(true);
    expect(readFile('src/app/admin/config/adminPageNavigationConfig.ts')).toContain('seo');
  });

  it('keeps import settings on the official save flow', () => {
    const bridgeContent = readFile('src/app/admin/components/import/useAdminImportSettingsBridge.ts');
    expect(bridgeContent).not.toContain('useData(');
    expect(bridgeContent).not.toContain("dispatch({ type: 'UPDATE_SYSTEM_SETTINGS'");
    expect(bridgeContent).toContain('saveSystemSettingsNow');
  });

  it('keeps admin deep links on path segments instead of search params', () => {
    expect(readFile('src/providers/NextRouteFrame.tsx')).toContain('resolveAdminRoute');
    expect(readFile('src/providers/NextRouteFrame.tsx')).toContain('buildAdminPath');
    expect(findPatternMatches('src', /\/admin\?/)).toEqual([]);
  });
});
