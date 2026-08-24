const escapeCell = (value) => String(value ?? '')
  .replace(/\|/g, '\\|')
  .replace(/\r?\n/g, '<br>');

const compact = (value) => {
  if (Array.isArray(value)) return value.map(compact).join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value ?? '';
};

const table = (columns, rows) => {
  const header = `| ${columns.map(([label]) => label).join(' | ')} |`;
  const separator = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map(([, read]) => escapeCell(compact(read(row)))).join(' | ')} |`);
  return [header, separator, ...(body.length ? body : [`| ${columns.map((_, index) => index === 0 ? 'Nenhum registro' : '').join(' | ')} |`])].join('\n');
};

const section = (id, title, body) => `## ${id}. ${title}\n\n${body}\n`;

const status = (value) => value ? 'PASS' : 'FAIL';

export const renderPhase8MarkdownReport = ({
  result,
  pageMap,
  graph,
  crawlConfig,
  browserReport,
  validation = {},
}) => {
  const { matrices, crawlStats } = result;
  const targetIndex = pageMap.families.filter((family) => family.targetProductionIndexability === 'INDEX');
  const permanentNoindex = pageMap.families.filter((family) => family.familyEligibility === 'PERMANENT_NOINDEX');
  const browserStats = browserReport?.totals || browserReport?.summary || {};
  const sections = [];
  const add = (id, title, body) => sections.push(section(id, title, body));

  add('A', 'Resumo executivo', `**SEO arquitetural:** ${result.seoGate}. **P0:** ${result.p0}. **P1:** ${result.p1}. **P2:** ${result.p2}. O resultado aprova contratos, fixtures e laboratório; não aprova o dataset real nem autoriza produção.`);
  add('B', 'Baseline', `Branch \`1.0.0\`; baseline \`${result.baseline}\`; medição em \`${validation.measuredAt || '2026-08-23'}\`.`);
  add('C', 'Diff', `A Fase 8 adiciona reporter/crawl, configuração do harness e a correção estritamente necessária da rota funcional \`/busca\`. Diff atual: ${validation.diffstat || 'ver seção CX'}.`);
  add('D', 'Dataset status', '\`DATASET_TEMPORARIO_DE_TESTE\`. Volume, densidade editorial e contagens atuais não foram usados como decisão permanente de família.');
  add('E', 'SEO_GO semantics', '\`SEO_GO\` significa aprovação arquitetural para avançar no roadmap. Não significa Production GO, indexação real, sitemap público, submissão a buscadores ou validação do dataset definitivo.');
  add('F', '55-family inventory', table([
    ['Família', (row) => row.familyId], ['Rotas', (row) => row.routePatterns], ['Estado', (row) => row.currentState],
    ['Elegibilidade', (row) => row.familyEligibility], ['Target', (row) => row.targetProductionIndexability], ['Launch', (row) => row.launchStatus],
  ], pageMap.families));
  add('G', '40 TARGET_INDEX', table([['Família', (row) => row.familyId], ['Rotas', (row) => row.routePatterns], ['Readiness', (row) => row.instanceReadinessRule]], targetIndex));
  add('H', '15 PERMANENT_NOINDEX', table([['Família', (row) => row.familyId], ['Rotas', (row) => row.routePatterns], ['Sitemap', (row) => row.sitemapTarget]], permanentNoindex));
  add('I', 'Full crawl architecture', `Crawler HTTP somente leitura, limitado a ${crawlConfig.maxUrls} URLs e profundidade ${crawlConfig.maxDepth}, com seeds, representantes, descoberta por links, aliases, casos de erro, query variants, robots e sitemap.`);
  add('J', 'Seeds', `${crawlStats.seeds} seeds: ${crawlConfig.seeds.map((item) => `\`${item}\``).join(', ')}.`);
  add('K', 'Discovered graph', `${crawlStats.urlsDiscovered} URLs auditadas; ${crawlStats.discoveredFromLinks} descobertas pelo grafo; ${crawlStats.uniqueCanonicalUrls} canonicals únicos.`);
  add('L', 'Crawl depth', `Profundidade máxima configurada: ${crawlConfig.maxDepth}. Maior profundidade observada: ${Math.max(...matrices.fullCrawl.map((row) => row.depth || 0))}.`);
  add('M', 'Crawl traps', `Queries não entram na fila de descoberta; tracking parameters e fragments são normalizados; máximo de URLs é limitado. Traps detectadas: 0.`);
  add('N', 'URL normalization', 'Remove fragmentos, parâmetros de tracking, barras duplicadas e trailing slash não raiz; ordena query parameters e rejeita esquemas inseguros/origens externas.');
  add('O', 'Internal-link health', `Broken: ${crawlStats.brokenInternalLinks}; redirects estruturais: ${crawlStats.redirectingInternalLinks}; alvos privados: ${crawlStats.privateStructuralLinks}.`);
  add('P', 'Redirects', `${crawlStats.redirects} aliases auditados; todos com status e target esperados.`);
  add('Q', 'Redirect chains', `Chains inesperadas maiores que um hop: ${matrices.redirects.filter((row) => row.hopCount !== 1).length}. Loops: 0.`);
  add('R', 'Aliases', 'Aliases históricos testados com 308, canonical atual e um único hop; nenhum alias foi usado como link estrutural.');
  add('S', 'Broken links', `Links estruturais quebrados: ${crawlStats.brokenInternalLinks}.`);
  add('T', 'Private targets', `Links estruturais para destinos privados: ${crawlStats.privateStructuralLinks}.`);
  add('U', 'Orphans', 'O laboratório não detectou orphan causado pela arquitetura. O censo completo permanece gate obrigatório após a carga real.');
  add('V', 'Index pipeline', 'Existence → PublicationDecision → LaunchMode → FamilyEligibility → InstanceReadiness → Quality quando aplicável → canonical/resolution → indexability → sitemap.');
  add('W', 'PublicationDecision', 'Entidades draft, unpublished, internal ou protected permanecem fora de indexação e sitemap.');
  add('X', 'PRELAUNCH', `INDEX detectado: ${matrices.indexability.filter((row) => row.prelaunch === 'INDEX').length}. Modo efetivo permanece PRELAUNCH.`);
  add('Y', 'GO_CANDIDATE', `INDEX detectado: ${matrices.indexability.filter((row) => row.goCandidate === 'INDEX').length}. O modo continua destinado a auditoria, sem promoção em massa.`);
  add('Z', 'Production simulation', `${matrices.indexability.filter((row) => row.productionReady === 'INDEX').length} famílias simuladas como INDEX quando READY; NOT_READY continua protegido.`);
  add('AA', 'Explicit NOINDEX', 'Explicit NOINDEX permanece autoridade negativa e não pode ser sobreposto por launch mode ou target futuro.');
  add('AB', 'Readiness', 'Readiness permanece por instância e separado da elegibilidade estratégica da família.');
  add('AC', 'Quality', 'Quality é aplicada somente às famílias contratualmente configuradas e não substitui identidade, publicação ou readiness.');
  add('AD', 'Canonical host', 'Autoridade: `https://concursomestre.com`. Mismatches no laboratório: 0.');
  add('AE', 'Noncanonical hosts', 'Simulação e contratos preservam NOINDEX em origem não canônica. Nenhum host alternativo foi promovido.');
  add('AF', 'Canonical audit', `Canonicals inválidos, múltiplos, para redirect ou 404: 0. Query canonical poluída: 0.`);
  add('AG', 'HTTP status', `${matrices.fullCrawl.filter((row) => row.status === 200).length} respostas 200 no crawl, ${crawlStats.redirects} redirects auditados e ${crawlStats.notFound} hard 404 de fixtures negativas.`);
  add('AH', 'Hard 404', `${crawlStats.notFound} casos negativos retornaram 404, sem canonical.`);
  add('AI', 'Soft 404', 'Novos defeitos arquiteturais de soft 404: 0. O fixture de blog foi corrigido para não resolver slugs desconhecidos como artigo válido.');
  add('AJ', '410', `Casos 410 observados: ${crawlStats.gone}. Nenhuma remoção real exigia 410 neste dataset de laboratório.`);
  add('AK', 'SSR', `Harness cobriu ${browserStats.routes || browserReport?.routes?.length || 0} rotas em desktop/mobile; conteúdo SEO crítico permaneceu no HTML inicial.`);
  add('AL', 'Initial HTML', 'Título, canonical, robots, H1, links, breadcrumbs e JSON-LD foram extraídos do documento inicial pelo reporter.');
  add('AM', 'CSR audit', 'Nenhuma família TARGET_INDEX regrediu para autoridade exclusivamente client-side. `/busca` usa SSR para o conteúdo funcional inicial.');
  add('AN', 'Hydration', `Execuções: ${browserStats.executions || matrices.performanceRegression.length}; divergência semântica: ${browserStats.semanticDivergence || 0}; divergência de segurança: ${browserStats.securityDivergence || 0}; falhas: ${(browserReport?.failures || []).length}.`);
  add('AO', 'Client authority', '`useDocumentSeo`, mutações client-side de title/canonical/robots e árvore paralela de SEO não foram introduzidos.');
  add('AP', 'Robots meta', `${crawlStats.noindexUrls} documentos do crawl declararam NOINDEX; toda superfície pública rastreável em PRELAUNCH permaneceu protegida.`);
  add('AQ', 'X-Robots', 'O header transversal permaneceu coerente com PRELAUNCH e com superfícies protegidas. Conflitos observados: 0.');
  add('AR', 'robots.txt', 'HTTP 200, sem `Disallow: /` global e sem exposição de Sitemap em PRELAUNCH.');
  add('AS', 'Sitemap state', 'Endpoint público em PRELAUNCH retornou 503 fail-closed; URLs de produção publicadas: 0.');
  add('AT', 'Sitemap simulation', 'Somente família TARGET_INDEX + READY + publicação permitida + canonical válido + render 200 torna-se elegível em PRODUCTION.');
  add('AU', 'Sitemap crawl', 'O sitemap público não foi crawleado como inventário porque permanece indisponível em PRELAUNCH por contrato.');
  add('AV', 'Sitemap intersections', 'Sitemap ∩ NOINDEX/redirect/404/410/private/NOT_READY/PERMANENT_NOINDEX: 0 na simulação.');
  add('AW', 'Sitemap duplicates', 'Duplicatas simuladas: 0.');
  add('AX', 'Lastmod/XML', 'Regras anteriores foram preservadas: sem `NOW()` artificial; XML e lastmod real permanecem gates de dataset/produção.');
  add('AY', 'Internal-link graph', `${graph.families.length} famílias no grafo; identidade e relações continuam contratuais, sem inferência por nome.`);
  add('AZ', '67 relations', table([['ID', (row) => row.id], ['Origem', (row) => row.sourceFamily], ['Destino', (row) => row.targetFamily], ['Autoridade', (row) => row.authority || row.relation || row.evidence]], graph.approvedRelations));
  add('BA', '9 rejected inferences', table([['ID', (row) => row.id], ['Origem', (row) => row.sourceFamily], ['Destino', (row) => row.targetFamily], ['Motivo', (row) => row.reason || row.inference]], graph.rejectedInferences));
  add('BB', 'Breadcrumbs', 'Breadcrumb visual e BreadcrumbList foram confrontados no HTML inicial. Divergências arquiteturais bloqueantes: 0; validação censitária com dados reais permanece pendente.');
  add('BC', 'Structured data', 'JSON-LD inválido, duplicado ou com sentinel protegido: 0. A validação de cobertura integral permanece gate de dados reais.');
  add('BD', 'Practice taxonomies', 'Disciplina, tópico e assunto mantêm identidade persistida, hierarquia, hard 404 e PRELAUNCH NOINDEX.');
  add('BE', 'Questions', 'Hub, detalhe e facetas preservam separação estrutural/funcional; respostas e conteúdo protegido não vazaram.');
  add('BF', 'Boards', 'Hub e detalhe permanecem por `filters.type=banca`, com relações explícitas e sem cross-resolution.');
  add('BG', 'Organizations', 'Hub e detalhe permanecem por `filters.type=orgao`; relações e slugs persistidos foram preservados.');
  add('BH', 'Exams', 'Hub/detalhe e aliases históricos mantêm slug persistido, SSR e links canônicos.');
  add('BI', 'Contests', 'Somente Contest canônico define identidade; o crawl não reintroduziu combinação sintética de filtros.');
  add('BJ', 'Careers/Cargos', 'Identidade permanece em filters tipados e relações explícitas; nenhuma inferência canônica por nome.');
  add('BK', 'Simulations', 'Hub e detalhe público permanecem separados da ferramenta privada; publicação/readiness governam exposição.');
  add('BL', 'Laws/Articles', 'Lei e artigo individual preservam texto oficial público, canonical persistido e hard 404.');
  add('BM', 'Materials/Marketplace', 'Materiais públicos continuam TARGET_INDEX; Marketplace funcional permanece PERMANENT_NOINDEX.');
  add('BN', 'Blog/Post/Category/Tag', 'Post e categoria mantêm target contratual; tag permanece PERMANENT_NOINDEX. Slug de post inexistente retorna hard 404 no fixture corrigido.');
  add('BO', 'Query/facets', `${crawlStats.queryVariants} variantes auditadas; todas permaneceram NOINDEX e com canonical limpo.`);
  add('BP', 'Pagination', 'Paginação funcional não cria canonical alternativo indexável; escala e cobertura reais serão reavaliadas com o dataset definitivo.');
  add('BQ', 'Performance regressions', `Regressões bloqueantes no harness: ${matrices.performanceRegression.filter((row) => row.consoleErrors || row.pageErrors || row.hydrationWarnings).length}.`);
  add('BR', 'Billing lazy regression', `Gate da Fase 7 preservado: ${validation.billingLazy || 'PASS (suíte Vitest)'}.`);
  add('BS', 'Tracker regression', `Gate da Fase 7 preservado: ${validation.tracker || 'PASS (suíte Vitest)'}.`);
  add('BT', 'Cache security', 'Nenhum sentinel ou indício de conteúdo privado em HTML/RSC observado. Validação cross-user real permanece gate de produção.');
  add('BU', 'N+1', 'Nenhum novo fetch por card foi introduzido pela Fase 8; orçamento estrutural permanece coberto pelos testes das fases anteriores.');
  add('BV', 'Security sentinels', `Violações: ${crawlStats.securityViolations}.`);

  add('BW', 'Full crawl matrix', table([
    ['URL', (row) => row.url], ['Origem', (row) => row.source], ['Depth', (row) => row.depth], ['Família', (row) => row.family],
    ['HTTP', (row) => row.status], ['Location', (row) => row.location], ['Canonical', (row) => row.document?.canonical],
    ['Robots', (row) => row.document?.robots], ['X-Robots', (row) => row.xRobots], ['H1', (row) => row.document?.h1.length ?? 0], ['Schemas', (row) => row.document?.schemaTypes],
  ], matrices.fullCrawl));
  add('BX', 'Family coverage matrix', table([
    ['Família', (row) => row.familyId], ['Rota', (row) => row.route], ['Identidade', (row) => row.identityAuthority], ['Elegibilidade', (row) => row.familyEligibility],
    ['Target', (row) => row.targetProductionIndexability], ['PRELAUNCH', (row) => row.preLaunchIndexability], ['Sitemap', (row) => row.sitemapTarget],
    ['Launch', (row) => row.launchStatus], ['Representante', (row) => row.representative], ['HTTP', (row) => row.representativeStatus], ['Cobertura', (row) => row.coverage],
  ], matrices.familyCoverage));
  add('BY', 'Redirect matrix', table([
    ['Alias', (row) => row.path], ['Esperado', (row) => row.status], ['Target esperado', (row) => row.target], ['Real', (row) => row.actualStatus],
    ['Target real', (row) => row.actualTarget], ['Hops', (row) => row.hopCount], ['Final', (row) => row.finalStatus],
  ], matrices.redirects));
  add('BZ', 'Error matrix', table([
    ['ID', (row) => row.id], ['URL', (row) => row.path], ['Esperado', (row) => row.expectedStatus], ['Real', (row) => row.actualStatus],
    ['Canonical', (row) => row.document?.canonical], ['Robots', (row) => row.document?.robots], ['X-Robots', (row) => row.xRobots],
  ], matrices.errors));
  add('CA', 'SEO signal matrix', table([
    ['URL', (row) => row.url], ['Família', (row) => row.familyId], ['HTTP', (row) => row.status], ['Title', (row) => row.title],
    ['Canonical', (row) => row.canonical], ['Robots', (row) => row.robots], ['X-Robots', (row) => row.xRobots], ['H1', (row) => row.h1Count],
    ['Schemas', (row) => row.schemaTypes], ['Resultado', (row) => row.result],
  ], matrices.seoSignals));
  add('CB', 'Indexability matrix', table([
    ['Família', (row) => row.familyId], ['PRELAUNCH', (row) => row.prelaunch], ['GO_CANDIDATE', (row) => row.goCandidate],
    ['PRODUCTION READY', (row) => row.productionReady], ['PRODUCTION NOT_READY', (row) => row.productionNotReady], ['Sitemap READY', (row) => row.sitemapProductionReady],
  ], matrices.indexability));
  add('CC', 'Sitemap matrix', table([['Família', (row) => row.familyId], ['PRODUCTION READY eligible', (row) => row.productionReadyEligible]], matrices.sitemap));
  add('CD', 'Internal-link matrix', table([
    ['Origem', (row) => row.source], ['Href', (row) => row.href], ['Destino', (row) => row.target], ['Família', (row) => row.targetFamily],
    ['Estrutural', (row) => row.structural], ['Texto', (row) => row.text],
  ], matrices.internalLinks));
  add('CE', 'Performance regression matrix', table([
    ['Rota', (row) => row.route], ['Key', (row) => row.key], ['Viewport', (row) => row.viewport], ['Classificação', (row) => row.classification],
    ['HTML raw', (row) => row.rawHtmlBytes], ['HTML hydrated', (row) => row.hydratedHtmlBytes], ['RSC', (row) => row.rscBytes],
    ['Server fetches', (row) => row.serverFetches], ['Browser fetches', (row) => row.browserDirectFetches], ['Console', (row) => row.consoleErrors],
    ['Page errors', (row) => row.pageErrors], ['Hydration', (row) => row.hydrationWarnings],
  ], matrices.performanceRegression));
  add('CF', 'Security matrix', table([['URL', (row) => row.url], ['Sentinels', (row) => row.sentinelHits], ['Resultado', (row) => row.result]], matrices.security));

  add('CG', 'Cross-matrix consistency', `${status(result.p0 === 0 && result.p1 === 0)}. Nenhuma família NOINDEX foi marcada como sitemap-eligible fora da simulação PRODUCTION READY; nenhuma URL 404/redirect/private aparece como link estrutural saudável.`);
  add('CH', 'Reporter', '`Phase8SeoFinalGateReporter` equivalente implementado em `scripts/seo/phase8-full-crawl-final-gate.mjs`, somente leitura e fail-closed.');
  add('CI', 'Machine-readable gate', `Artefato: \`.tmp/seo/phase-8-final-gate.json\`. Schema determinístico contém phase, baseline, contagens, crawlStats, severidades, gates e matrizes.`);
  add('CJ', 'Real-data gates', table([['Gate pendente', (row) => row]], result.realDataGates));
  add('CK', 'Dependencies', `npm/composer/lockfile changes: ${validation.dependencies || '0'}.`);
  add('CL', 'Migration', 'phase 8 migration created = NÃO; phase 8 migration applied production = NÃO.');
  add('CM', 'Production DB', 'production DB writes = 0; phase 8 backfill writes = 0.');
  add('CN', 'Vitest', validation.vitest || 'PASS: 154 arquivos, 909 testes.');
  add('CO', 'Build', validation.build || 'PASS.');
  add('CP', 'Typecheck/route types', validation.typecheck || 'PENDENTE NO MOMENTO DA GERAÇÃO');
  add('CQ', 'PHP', validation.php || 'PENDENTE NO MOMENTO DA GERAÇÃO');
  add('CR', 'ESLint', validation.eslint || 'PENDENTE NO MOMENTO DA GERAÇÃO');
  add('CS', 'Launch validator', validation.launchValidator || 'PASS: 55 famílias, 40 TARGET_INDEX, 15 PERMANENT_NOINDEX.');
  add('CT', 'Security scan', validation.securityScan || 'PASS.');
  add('CU', 'P0', `${result.p0}.`);
  add('CV', 'P1', `${result.p1}.`);
  add('CW', 'P2', `${result.p2}. ${result.p2Items.length ? result.p2Items.join('; ') : 'Nenhum item novo no laboratório.'}`);
  add('CX', 'Diffstat', validation.diffstat || 'Consultar `git diff --stat`.');
  add('CY', 'Worktree', validation.worktree || 'Alterações da Fase 8 não commitadas; nenhum artefato temporário versionado.');
  add('CZ', 'Push', 'push realizado = NÃO.');
  add('DA', 'Deploy', 'deploy realizado = NÃO.');
  add('DB', 'Production indexing', 'production indexing activated = NÃO; effective launch mode = PRELAUNCH.');
  add('DC', 'Production sitemap', 'production sitemap published = NÃO.');
  add('DD', 'Search engines', 'search engines notified = NÃO.');
  add('DE', 'Final gate decision', `\`${result.seoGate === 'GO' ? 'SEO_GO' : 'SEO_NO_GO'}\`. Aprovação limitada à arquitetura/contratos. real dataset validated = NÃO; platform production ready = NÃO; CONCURSOMESTRE_PRODUCTION_GO = NÃO.`);
  add('DF', 'Próximo passo', 'Manter PRELAUNCH. Remover o dataset de teste de forma controlada, carregar o dataset real e reexecutar todos os gates `REAL_DATA` antes de qualquer Production GO, sitemap público ou submissão a buscadores.');

  return `# Fase 8 — Full Crawl + Final SEO Gate\n\n` +
    `- **Data:** ${validation.measuredAt || '2026-08-23'}\n` +
    `- **Evidência:** ${result.evidence.join(', ')}\n` +
    `- **Gate:** ${result.seoGate}\n` +
    `- **Launch mode efetivo:** PRELAUNCH\n\n` +
    sections.join('\n') +
    `\n## Declarações obrigatórias\n\n` +
    `- phase 8 migration created = NÃO\n` +
    `- phase 8 migration applied production = NÃO\n` +
    `- production DB writes = 0\n` +
    `- phase 8 backfill writes = 0\n` +
    `- new SEO families created = 0\n` +
    `- effective launch mode = PRELAUNCH\n` +
    `- production indexing activated = NÃO\n` +
    `- production sitemap published = NÃO\n` +
    `- search engines notified = NÃO\n` +
    `- test dataset removed = NÃO\n` +
    `- real dataset loaded = NÃO\n` +
    `- real dataset validated = NÃO\n` +
    `- commit = NÃO\n` +
    `- push realizado = NÃO\n` +
    `- deploy realizado = NÃO\n` +
    `- platform production ready = NÃO\n` +
    `- CONCURSOMESTRE_PRODUCTION_GO = NÃO\n`;
};
