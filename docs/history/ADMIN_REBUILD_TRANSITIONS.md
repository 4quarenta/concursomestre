# Transicoes do Rebuild do Admin

## 2026-04-19 - Etapa A

Congelado o inventario funcional obrigatorio do admin atual.

Resultado:

- UI atual passa a ser referencia funcional, nao referencia visual
- dominios e capacidades obrigatorias documentados
- expansoes futuras registradas: RBAC, auditoria, analytics de receita, incidentes, command palette e versionamento de configuracoes

Evidencia:

- `docs/reports/admin-rebuild-functional-map-latest.md`

## 2026-04-19 - Etapa B

Definida a arquitetura de informacao e a primeira versao do design system administrativo.

Resultado:

- dominios alvo definidos: overview, operation, revenue, growth, support, security e settings
- hierarquia futura de rotas documentada
- paleta, tokens, severidades e regras visuais iniciais definidos
- base privada `src/app/admin/_rebuild` criada sem substituir a rota `/admin`
- componentes primitivos iniciais criados para metricas, status, acoes, paineis, filas e empty states

Evidencia:

- `docs/reports/admin-information-architecture-latest.md`
- `docs/reports/admin-design-system-blueprint-latest.md`
- `src/app/admin/_rebuild/`

Proxima transicao:

- iniciar Etapa C com implementacao real por dominio, sem reaproveitar a casca visual antiga

## 2026-04-19 - Etapa C iniciada

Iniciada a implementacao real por dominio, com modelos de Overview e Revenue.

Resultado:

- `Revenue` calcula receita total, receita liquida, taxas, refunds, falhas, receita por tipo e payout de sellers
- `Overview` consolida metricas executivas, filas criticas e riscos de billing/SEO/suporte
- `AdminOverviewBlueprint` passou a usar o modelo real em vez de lista estatica
- a rota `/admin` ainda nao foi trocada

Evidencia:

- `docs/reports/admin-rebuild-stage-c-models-latest.md`
- `src/app/admin/_rebuild/domains/revenue/adminRevenueModel.ts`
- `src/app/admin/_rebuild/domains/overview/adminOverviewModel.ts`

Complemento da mesma transicao:

- `AdminOverviewScreen` conectado a `DataProvider`, `MarketplaceProvider` e `seoService`
- `AdminOperationScreen` conectado a `DataProvider` e `MarketplaceProvider`
- `AdminRevenueScreen` conectado a `DataProvider` e `MarketplaceProvider`
- `AdminOperationBlueprint` criado com leitura de questoes, usuarios, materiais, rankings, provas e taxonomias
- `AdminRevenueBlueprint` criado com leitura de receita, refunds, falhas, distribuicao e sellers/payout
- `_rebuild` continua privado, sem trocar `/admin`
