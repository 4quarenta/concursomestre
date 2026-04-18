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
import process from 'node:process';
import { execSync } from 'node:child_process';

const repoRoot = process.cwd();
const outputPath = path.resolve(
  process.env.LEGACY_WEB_INVENTORY_OUTPUT || 'docs/reports/legacy-web-inventory-latest.json',
);
const legacyAppRoot = path.join(repoRoot, 'src', 'app');
const nextAppRoot = path.join(repoRoot, 'web-next', 'src', 'app');
const legacyServicesRoot = path.join(repoRoot, 'src', 'services');
const legacySharedComponentsRoot = path.join(repoRoot, 'src', 'components', 'shared');
const nextSourceRoot = path.join(repoRoot, 'web-next', 'src');
const legacySourceRoot = path.join(repoRoot, 'src');

const routeAliasCandidates = [
  {
    legacy: 'plans',
    next: 'planos',
    reason: 'rota comercial antiga versus canonical comercial atual',
  },
  {
    legacy: 'landing',
    next: 'l',
    reason: 'landings publicas antigas versus slug publico curto no Next',
  },
  {
    legacy: 'landing-campaign',
    next: 'promo',
    reason: 'campanhas comerciais antigas versus pagina promocional dedicada',
  },
  {
    legacy: 'performance-subjects',
    next: 'performance',
    reason: 'segmento legado especifico versus agrupamento por dominio no App Router',
  },
  {
    legacy: 'reader',
    next: 'read',
    reason: 'nome antigo do leitor versus rota canonicamente reduzida no Next',
  },
];

/**
 * Lista nomes de diretorios imediatos quando a pasta existir.
 *
 * @since 1.0.0
 */
function listTopLevelDirectories(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Conta arquivos recursivamente dentro de uma raiz.
 *
 * @since 1.0.0
 */
function countFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return 0;
  }

  let total = 0;
  const stack = [directoryPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const resolvedPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(resolvedPath);
        continue;
      }

      total += 1;
    }
  }

  return total;
}

/**
 * Resolve o nome do branch atual sem quebrar a geracao do relatorio.
 *
 * @since 1.0.0
 */
function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Gera o caminho do resumo Markdown a partir do caminho JSON.
 *
 * @since 1.0.0
 */
function getSummaryPath(jsonPath) {
  const directory = path.dirname(jsonPath);
  const fileName = path.basename(jsonPath, path.extname(jsonPath));
  return path.join(directory, `${fileName}.summary.md`);
}

/**
 * Normaliza o bloco de lista para o resumo final.
 *
 * @since 1.0.0
 */
function formatList(items) {
  if (items.length === 0) {
    return ['- nenhum'];
  }

  return items.map((item) => `- \`${item}\``);
}

/**
 * Construi o resumo Markdown que acompanha o JSON do inventario.
 *
 * @since 1.0.0
 */
function buildSummary(report) {
  return [
    '# Legacy Web Inventory',
    '',
    `- **Generated at:** ${report.generatedAt}`,
    `- **Branch:** ${report.branch}`,
    `- **Legacy source files:** ${report.counts.legacySourceFiles}`,
    `- **Next source files:** ${report.counts.nextSourceFiles}`,
    `- **Exact route overlap:** ${report.routes.exactOverlap.length}`,
    `- **Legacy-only route roots:** ${report.routes.legacyOnly.length}`,
    '',
    '## Exact Overlap',
    '',
    ...formatList(report.routes.exactOverlap),
    '',
    '## Legacy Only',
    '',
    ...formatList(report.routes.legacyOnly),
    '',
    '## Next Only',
    '',
    ...formatList(report.routes.nextOnly),
    '',
    '## Alias Candidates',
    '',
    ...report.routes.aliasCandidates.map(
      (entry) => `- \`${entry.legacy}\` -> \`${entry.next}\`: ${entry.reason}`,
    ),
    '',
    '## Legacy Service Domains',
    '',
    ...formatList(report.legacy.services),
    '',
    '## Legacy Shared Components',
    '',
    ...formatList(report.legacy.sharedComponents),
    '',
    '## Recommendations',
    '',
    ...report.recommendations.map((entry) => `- ${entry}`),
    '',
  ].join('\n');
}

const legacyRouteRoots = listTopLevelDirectories(legacyAppRoot);
const nextRouteRoots = listTopLevelDirectories(nextAppRoot);
const legacyServiceDomains = listTopLevelDirectories(legacyServicesRoot);
const legacySharedComponents = listTopLevelDirectories(legacySharedComponentsRoot);
const nextRouteSet = new Set(nextRouteRoots);
const legacyRouteSet = new Set(legacyRouteRoots);

const exactOverlap = legacyRouteRoots.filter((routeRoot) => nextRouteSet.has(routeRoot));
const legacyOnly = legacyRouteRoots.filter((routeRoot) => !nextRouteSet.has(routeRoot));
const nextOnly = nextRouteRoots.filter((routeRoot) => !legacyRouteSet.has(routeRoot));

const report = {
  generatedAt: new Date().toISOString(),
  branch: getCurrentBranch(),
  counts: {
    legacySourceFiles: countFiles(legacySourceRoot),
    nextSourceFiles: countFiles(nextSourceRoot),
    legacyRouteRoots: legacyRouteRoots.length,
    nextRouteRoots: nextRouteRoots.length,
    legacyServiceDomains: legacyServiceDomains.length,
    legacySharedComponents: legacySharedComponents.length,
  },
  routes: {
    legacy: legacyRouteRoots,
    next: nextRouteRoots,
    exactOverlap,
    legacyOnly,
    nextOnly,
    aliasCandidates: routeAliasCandidates,
  },
  legacy: {
    services: legacyServiceDomains,
    sharedComponents: legacySharedComponents,
  },
  recommendations: [
    'tratar as rotas em overlap exato como candidatas naturais a desativacao futura no legado',
    'manter as rotas legacy-only sob ownership explicito antes de qualquer limpeza estrutural',
    'usar os alias candidates para revisar nomes de rota que mudaram durante a migracao',
    'priorizar a auditoria do legado nos dominios que ainda concentram admin, autenticacao e contratos comerciais',
  ],
};

const summaryPath = getSummaryPath(outputPath);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(summaryPath, `${buildSummary(report)}\n`, 'utf8');

console.log(JSON.stringify({
  outputPath,
  summaryPath,
  branch: report.branch,
  counts: report.counts,
}, null, 2));
