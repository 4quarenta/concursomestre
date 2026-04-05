# Statistics Module

## Objetivo

Centralizar o dominio de estatisticas da banca na arquitetura oficial do backend e remover chamadas HTTP cruas da tela de raio-x no frontend.

## Backend absorvido

### Rotas oficiais

- `handleStatisticsXrayRoute(PDO $db)`
  - valida sessao autenticada
  - valida entitlement `xray_banca`
  - normaliza filtros de banca, cargo e ano
  - responde o envelope oficial do raio-x
  - aplica cache usando `cache_settings`

- `handleStatisticsBancaInfoRoute(PDO $db)`
  - valida sessao autenticada
  - valida entitlement `xray_banca`
  - normaliza a URL da banca
  - responde o scraping com cache de uma hora
  - preserva o contrato legado de falha graciosa do scraper

- `handleStatisticsUserRoute(PDO $db)`
  - valida sessao autenticada
  - resolve o `user_id` por query ou segmento de URL legado
  - permite consultar outro usuario apenas em contexto admin

- `handleStatisticsQuestionRoute(PDO $db)`
  - resolve `question_id` por query ou segmento legado
  - entrega o agregado publico da questao

- `handleStatisticsPlatformRoute(PDO $db)`
  - exige sessao admin
  - entrega indicadores globais de usuarios, questoes e performance

- `handleStatisticsInstallRoute(PDO $db)`
  - exige sessao admin
  - garante as tabelas e colunas do slice de estatisticas

### Controller

- `StatisticsController::getXrayStats(...)`
  - delega o fluxo do raio-x para a service

- `StatisticsController::getBancaInfo(...)`
  - delega o fluxo de inteligencia publica da banca para a service

### Service

- `StatisticsService::getXrayStats(...)`
  - valida filtros
  - confirma acesso ao beneficio do plano
  - resolve ids dos filtros no banco
  - busca questoes que combinam com banca, cargo e ano
  - calcula estilo textual medio, contextualizacao e distribuicao de dificuldade
  - monta materias, assuntos e ranking detalhado
  - lista provas ligadas a banca
  - tenta gerar recomendacao curta via Gemini, com fallback seguro

- `StatisticsService::getBancaInfo(...)`
  - valida URL e permissao
  - prepara o scraping do site da banca
  - retorna links classificados em `emAndamento` e `realizados`

- `StatisticsService::getUserStatistics(...)`
  - valida o `user_id`
  - garante escopo seguro do usuario autenticado
  - cria baseline em `user_statistics` quando nao houver linha ainda
  - agrega o detalhamento por materia

- `StatisticsService::getQuestionStatistics(...)`
  - devolve o agregado publico de `question_stats`
  - calcula `accuracyRate`
  - normaliza `optionDistribution`

- `StatisticsService::getPlatformStatistics(...)`
  - exige contexto admin
  - agrega totais globais, materias populares e top performers

- `StatisticsService::installStatistics(...)`
  - exige contexto admin
  - garante o schema minimo de estatisticas do slice

- `StatisticsService::buildRecommendation(...)`
  - usa os assuntos mais incidentes para montar um prompt curto
  - chama Gemini apenas se houver chave configurada
  - nunca quebra o fluxo principal se a IA falhar

- `StatisticsService::extractBoardLinksFromHtml(...)`
  - faz parsing do HTML com `DOMDocument`
  - converte links relativos em absolutos
  - classifica links por palavras-chave
  - limita o retorno para evitar poluicao visual no frontend

### Repository

- `getCacheSettings()`
  - le a configuracao global de cache do sistema

- `findFilterIdByTypeAndName(...)`
  - resolve ids de filtros exibidos no app

- `listQuestionsForXray(...)`
  - concentra a SQL principal do raio-x da banca

- `listSubjectFiltersForQuestions(...)`
  - carrega os assuntos vinculados ao conjunto de questoes

- `listFilterNamesByIds(...)`
  - resolve nomes de filtros-pai para reconstruir a hierarquia

- `listExamsByBancaId(...)`
  - lista provas registradas da banca

- `getSystemSettingValue(...)`
  - busca configuracoes usadas pelo modulo, como chave Gemini

- `findUserStatisticsByUserId(...)`
  - le o agregado principal do usuario

- `createUserStatistics(...)`
  - cria o baseline do agregado do usuario

- `listSubjectStatisticsByUserId(...)`
  - le o detalhamento por materia do usuario

- `findQuestionStatisticsByQuestionId(...)`
  - le o agregado publico da questao

- `countTotalUsers()`, `countActiveUsersLast30Days()`, `countTotalQuestions()`, `sumTotalAnswers()`, `getAverageAccuracy()`
  - compoem os indicadores globais da plataforma

- `listPopularSubjects(...)` e `listTopPerformers(...)`
  - entregam rankings agregados do painel global

- `ensureUserStatisticsTable()`, `ensureSubjectStatisticsTable()`, `ensureQuestionStatsEnhancements()`
  - concentram o SQL estrutural do instalador

### Validator

- `validateXrayQuery(...)`
  - exige banca
  - trata `ano=All`
  - devolve cargo/ano opcionais normalizados

- `validateBancaInfoQuery(...)`
  - aceita URL com ou sem esquema
  - injeta `https://` quando necessario
  - valida `url`, `baseUrl` e `host`

- `validateUserStatisticsQuery(...)`
  - exige `user_id` valido

- `validateQuestionStatisticsQuery(...)`
  - exige `question_id` numerico positivo

- `resolveScopedUserId(...)`
  - impede que um usuario comum consulte outro usuario

- `assertAdminContext(...)`
  - protege indicadores globais e instalacao

## Frontend alinhado

### Pagina

- `src/app/bank-analysis/page.tsx`
  - parou de usar `apiClient` e `ENDPOINTS.statistics.*` direto
  - agora consome `bankAnalysisService.getBankIntel(...)`
  - agora consome `bankAnalysisService.getXrayStats(...)`
  - ganhou protecao de ciclo de vida para nao atualizar estado apos desmontagem
  - passou a importar `ReactMarkdown` explicitamente

### Service

- `src/services/bank-analysis/bankAnalysisService.ts`
  - continua sendo a fachada oficial do dominio
  - o contrato foi preservado para a UI

## Bridges legados

- `api/statistics/xray.php`
- `api/statistics/banca_info.php`
- `api/statistics/user.php`
- `api/statistics/question.php`
- `api/statistics/platform.php`
- `api/statistics/install.php`

Agora esses arquivos apenas:
- carregam CORS e conexao
- importam `modules/statistics/routes.php`
- delegam para o handler oficial

## Validacao desta rodada

- `php -l` nos arquivos do modulo e nos bridges
- `StatisticsModuleWiringTest.php`
- `npx vitest run src/services/bank-analysis/__tests__/bankAnalysisService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- smoke `401` coerente em `api/statistics/xray.php`
- smoke `401` coerente em `api/statistics/banca_info.php`
- home `200` em `http://localhost:3000/#/`
