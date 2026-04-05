# Audit Report

## Escopo
- Plataforma completa
- Painel administrativo da plataforma
- Frontend React/Vite em [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- ServiÃ§os administrativos em [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
- Backend administrativo em `C:\xampp\htdocs\questao-pro-backend\api\`
- Fluxos transversais de autenticaÃ§Ã£o, roteamento, organizaÃ§Ã£o de cÃ³digo e seguranÃ§a operacional

## Regra viva do relatÃ³rio
- A partir deste arquivo, toda configuraÃ§Ã£o, implementaÃ§Ã£o, alteraÃ§Ã£o, otimizaÃ§Ã£o, exclusÃ£o e hardening relevante da plataforma deve ser registrada aqui.
- O objetivo Ã© manter rastreabilidade tÃ©cnica real da evoluÃ§Ã£o do sistema, e nÃ£o apenas snapshots pontuais.

## InventÃ¡rio-base jÃ¡ auditado
- Dashboard executivo
- Financeiro
  - vendedores / saldo
  - transaÃ§Ãµes
  - reembolsos
  - preÃ§os e planos
  - automaÃ§Ã£o
- Base de dados
  - questÃµes
  - importador inteligente
  - filtros e taxonomias
  - denÃºncias
  - rankings
  - materiais
  - gestÃ£o de usuÃ¡rios
- Feedback e suporte
- ConfiguraÃ§Ãµes

## Base histÃ³rica consolidada
- O relatÃ³rio inicial da auditoria administrativa foi consolidado a partir de [C:\dev\concursomestre\docs\admin-audit-report.md](C:\dev\concursomestre\docs\admin-audit-report.md).
- A partir deste arquivo, novas correÃ§Ãµes, refactors e ampliaÃ§Ãµes do admin devem ser registradas aqui.

## Ciclo 2026-04-01

### Objetivo do ciclo
- Fechar a pendÃªncia real do admin com foco em:
  - financeiro realmente operacional
  - extraÃ§Ã£o inteligente funcional
  - feedback/suporte com melhor triagem
  - UX do painel mais confiÃ¡vel

### MudanÃ§as implementadas

#### 1. Financeiro: transaÃ§Ãµes alinhadas ao backend real
- Arquivo: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Antes:
  - a tabela recalculava taxa e lÃ­quido no frontend
  - ignorava `platformFee`, `netAmount`, `invoicePdfUrl`, `paymentMethodLabel`, `transactionName`
  - filtros/paginaÃ§Ã£o/exportaÃ§Ã£o estavam duplicados dentro da prÃ³pria renderizaÃ§Ã£o
- Agora:
  - a visÃ£o principal usa os valores consolidados retornados pelo backend
  - a tabela passou a exibir:
    - ID interno
    - referÃªncia do gateway
    - invoice Stripe quando existir
    - mÃ©todo/provedor reais
    - descriÃ§Ã£o da transaÃ§Ã£o
    - parcela projetada quando aplicÃ¡vel
    - botÃ£o de fatura PDF
  - exportaÃ§Ã£o CSV usa o recorte filtrado real
  - cards superiores mostram bruto, taxa e lÃ­quido do filtro atual
- Motivo:
  - eliminar divergÃªncia entre UI e backend e reduzir risco operacional no financeiro

#### 2. Financeiro: persistÃªncia de preÃ§os e benefÃ­cios
- Arquivo: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Antes:
  - o save de planos misturava `updateSystemSettings` com `apiClient.post('settings.php', ...)`
  - sem lock consistente de submit
- Agora:
  - o save usa fluxo central via `adminService.saveSystemSettings(...)`
  - o botÃ£o entra em estado de salvamento real
- Motivo:
  - evitar persistÃªncia duplicada e salvar preÃ§os/benefÃ­cios pelo mesmo contrato administrativo do restante do painel

#### 3. Financeiro: automaÃ§Ã£o orientada pelo provedor ativo
- Arquivo: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Antes:
  - a aba de automaÃ§Ã£o era fixa para Mercado Pago
- Agora:
  - a UI se adapta ao `paymentProvider`
  - exibe URL de cron correta
  - exibe comando cron correto
  - mantÃ©m execuÃ§Ã£o manual para diagnÃ³stico
  - diferencia Stripe ReconciliaÃ§Ã£o x Mercado Pago Subscription API
- Motivo:
  - refletir o estado real da plataforma e impedir orientaÃ§Ã£o operacional errada no admin

#### 4. Base de dados: extraÃ§Ã£o inteligente com gabarito multi-pÃ¡gina
- Arquivo: [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Antes:
  - o gabarito lia sÃ³ a primeira pÃ¡gina do PDF
  - a prÃ©via usava `correctOptionIndex` mesmo quando o fluxo populava apenas `resposta`
  - questÃµes sem gabarito podiam acabar indo para publicaÃ§Ã£o sem bloqueio explÃ­cito
- Agora:
  - o gabarito Ã© lido pÃ¡gina por pÃ¡gina
  - os mapas de resposta sÃ£o consolidados
  - cada questÃ£o extraÃ­da recebe:
    - `correctOptionIndex`
    - `resposta`
  - a UI mostra:
    - quantidade de respostas consolidadas
    - quantidade de questÃµes sem gabarito
  - a publicaÃ§Ã£o em lote bloqueia quando ainda hÃ¡ questÃµes sem gabarito confirmado
  - o publish limpa estado, recarrega a listagem e evita clique duplicado
- Motivo:
  - tornar o importador seguro para uso real em produÃ§Ã£o e impedir publicaÃ§Ã£o silenciosa com resposta incorreta

#### 5. Feedback e suporte: triagem funcional
- Arquivo: [C:\dev\concursomestre\src\components\admin\support\AdminFeedback.tsx](C:\dev\concursomestre\src\components\admin\support\AdminFeedback.tsx)
- Antes:
  - havia listagem funcional, mas a triagem era rasa e pouco escalÃ¡vel
- Agora:
  - mÃ©tricas no topo:
    - total
    - novos
    - lidos
    - resolvidos
  - busca textual
  - filtro por status
  - filtro por tipo
  - estado vazio coerente com os filtros
- Motivo:
  - reduzir atrito operacional para o time administrativo e facilitar resposta em volume

### Riscos mitigados neste ciclo
- divergÃªncia financeira entre frontend e backend
- cron operacional errado para o gateway ativo
- publicaÃ§Ã£o de questÃµes com gabarito incompleto
- pouca visibilidade operacional em suporte

### ValidaÃ§Ã£o executada
- Frontend:
  - `npm run build`
  - `npm run test:admin`
- Backend:
  - `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\AdminSecurityWiringTest.php`
- Resultado:
  - build concluÃ­do com sucesso
  - suÃ­te administrativa mÃ­nima passando
  - wiring administrativo do backend mantido Ã­ntegro

### PrÃ³ximos passos recomendados
- modularizar `AdminFinance` e `AdminDatabaseManager` em componentes por domÃ­nio
- adicionar testes de regressÃ£o visuais/E2E para:
  - transaÃ§Ãµes
  - importador
  - feedback
- mover o bloco legado de transaÃ§Ãµes/automaÃ§Ã£o para remoÃ§Ã£o definitiva apÃ³s estabilizaÃ§Ã£o visual

## Ciclo Plataforma 2026-04-01

### Objetivo do ciclo
- iniciar a auditoria tÃ©cnica da plataforma inteira
- separar cÃ³digo ativo de cÃ³digo morto/recuperado
- modularizar a entrada do frontend
- reduzir risco de exposiÃ§Ã£o de scripts internos no backend
- consolidar uma base mais limpa para as prÃ³ximas refatoraÃ§Ãµes arquiteturais

### InventÃ¡rio tÃ©cnico inicial

#### Frontend ativo
- Entrada: [C:\dev\concursomestre\index.tsx](C:\dev\concursomestre\index.tsx)
- Casca principal: [C:\dev\concursomestre\App.tsx](C:\dev\concursomestre\App.tsx)
- Contextos ativos:
  - [C:\dev\concursomestre\context\AuthContext.tsx](C:\dev\concursomestre\context\AuthContext.tsx)
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
  - [C:\dev\concursomestre\context\MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx)
- NÃºcleo compartilhado:
  - [C:\dev\concursomestre\src\core\api\client.ts](C:\dev\concursomestre\src\core\api\client.ts)
  - [C:\dev\concursomestre\src\core\auth\session.ts](C:\dev\concursomestre\src\core\auth\session.ts)
- Hotspots de tamanho/complexidade:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
  - [C:\dev\concursomestre\pages\Profile.tsx](C:\dev\concursomestre\pages\Profile.tsx)
  - [C:\dev\concursomestre\src\pages\CheckoutPage.tsx](C:\dev\concursomestre\src\pages\CheckoutPage.tsx)

#### Backend ativo
- Entrada HTTP: [C:\xampp\htdocs\questao-pro-backend\index.php](C:\xampp\htdocs\questao-pro-backend\index.php)
- Regras Apache: [C:\xampp\htdocs\questao-pro-backend\.htaccess](C:\xampp\htdocs\questao-pro-backend\.htaccess)
- Configs principais:
  - [C:\xampp\htdocs\questao-pro-backend\config\database.php](C:\xampp\htdocs\questao-pro-backend\config\database.php)
  - [C:\xampp\htdocs\questao-pro-backend\config\cors.php](C:\xampp\htdocs\questao-pro-backend\config\cors.php)
- AutenticaÃ§Ã£o:
  - [C:\xampp\htdocs\questao-pro-backend\api\auth\login.php](C:\xampp\htdocs\questao-pro-backend\api\auth\login.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\auth\refresh.php](C:\xampp\htdocs\questao-pro-backend\api\auth\refresh.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\utils\AuthSession.php](C:\xampp\htdocs\questao-pro-backend\api\utils\AuthSession.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\middleware\Auth.php](C:\xampp\htdocs\questao-pro-backend\api\middleware\Auth.php)
- Hotspots de domÃ­nio:
  - [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\subscription_helpers.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\subscription_helpers.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\list.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\list.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\stripe_webhook.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\stripe_webhook.php)

### Problemas encontrados nesta fase

#### 1. DuplicaÃ§Ã£o estrutural no frontend
- Existiam cÃ³pias mortas na raiz do projeto:
  - `Admin.tsx`
  - `AuthContext.tsx`
  - `CheckoutPage.tsx`
  - `DataContext.tsx`
  - `PlansPage.tsx`
- Impacto:
  - aumentavam ruÃ­do arquitetural
  - confundiam manutenÃ§Ã£o
  - elevavam o risco de editar o arquivo errado

#### 2. Artefatos de recuperaÃ§Ã£o corrompidos dentro de `pages/`
- Existiam:
  - `Profile.tsx.corrupted`
  - `Profile.tsx.recovered`
  - `Profile.tsx.recovered.tsx`
- Impacto:
  - poluiÃ§Ã£o de codebase
  - risco de referÃªncia acidental
  - falso positivo em buscas e auditorias

#### 3. Entrada do frontend pouco modular
- A raiz [C:\dev\concursomestre\App.tsx](C:\dev\concursomestre\App.tsx) acumulava providers globais e toda a Ã¡rvore de rotas.
- Impacto:
  - acoplamento alto
  - revisÃ£o mais difÃ­cil
  - menor previsibilidade para futuras extraÃ§Ãµes

#### 4. Alias morto de `@services`
- `tsconfig.json` e `vite.config.ts` carregavam o alias `@services`, mas nÃ£o havia uso real nem diretÃ³rio consistente para ele.
- Impacto:
  - configuraÃ§Ã£o enganosa
  - aumento de inconsistÃªncia entre convenÃ§Ã£o e cÃ³digo real

#### 5. ExposiÃ§Ã£o potencial de scripts internos no backend
- O backend possui muitos scripts de diagnÃ³stico, teste manual e dumps dentro de `api/`.
- Exemplos:
  - `check_*`
  - `debug_*`
  - `test_*`
  - `manual_fix.php`
  - `settings_log.txt`
- Impacto:
  - risco operacional e de seguranÃ§a se acessados por HTTP
  - superfÃ­cie desnecessÃ¡ria de exposiÃ§Ã£o

### MudanÃ§as implementadas nesta fase

#### 1. ModularizaÃ§Ã£o da entrada do frontend
- Criado: [C:\dev\concursomestre\src\providers\AppProviders.tsx](C:\dev\concursomestre\src\providers\AppProviders.tsx)
- Criado: [C:\dev\concursomestre\src\app\AppShell.tsx](C:\dev\concursomestre\src\app\AppShell.tsx)
- Refatorado: [C:\dev\concursomestre\App.tsx](C:\dev\concursomestre\App.tsx)
- Resultado:
  - `App.tsx` virou uma entrada enxuta
  - providers globais ficaram centralizados
  - a Ã¡rvore de rotas ficou separada do bootstrap

#### 2. RemoÃ§Ã£o de duplicatas mortas e artefatos corrompidos
- Removidos:
  - [C:\dev\concursomestre\Admin.tsx](C:\dev\concursomestre\Admin.tsx)
  - [C:\dev\concursomestre\AuthContext.tsx](C:\dev\concursomestre\AuthContext.tsx)
  - [C:\dev\concursomestre\CheckoutPage.tsx](C:\dev\concursomestre\CheckoutPage.tsx)
  - [C:\dev\concursomestre\DataContext.tsx](C:\dev\concursomestre\DataContext.tsx)
  - [C:\dev\concursomestre\PlansPage.tsx](C:\dev\concursomestre\PlansPage.tsx)
  - [C:\dev\concursomestre\pages\Profile.tsx.corrupted](C:\dev\concursomestre\pages\Profile.tsx.corrupted)
  - [C:\dev\concursomestre\pages\Profile.tsx.recovered](C:\dev\concursomestre\pages\Profile.tsx.recovered)
  - [C:\dev\concursomestre\pages\Profile.tsx.recovered.tsx](C:\dev\concursomestre\pages\Profile.tsx.recovered.tsx)
- Motivo:
  - todos foram confirmados como fora do fluxo ativo atual
  - a plataforma jÃ¡ estÃ¡ protegida por backup externo antes da limpeza

#### 3. Endurecimento de regras de exposiÃ§Ã£o no Apache
- Ajustado: [C:\xampp\htdocs\questao-pro-backend\.htaccess](C:\xampp\htdocs\questao-pro-backend\.htaccess)
- Resultado:
  - scripts de debug, check, test e dumps deixaram de ser publicÃ¡veis por padrÃ£o via URL
  - reduzimos a superfÃ­cie de exposiÃ§Ã£o sem alterar os endpoints produtivos

#### 4. Endurecimento do roteador HTTP legado
- Ajustado: [C:\xampp\htdocs\questao-pro-backend\router.php](C:\xampp\htdocs\questao-pro-backend\router.php)
- Resultado:
  - o roteador passou a reutilizar a configuraÃ§Ã£o oficial de CORS
  - o fallback deixou de aceitar arquivos arbitrÃ¡rios dentro de `api/`
  - o suporte legado agora sÃ³ vale para mÃ³dulos e caminhos explicitamente aceitÃ¡veis

#### 5. Limpeza de configuraÃ§Ã£o morta
- Ajustado: [C:\dev\concursomestre\tsconfig.json](C:\dev\concursomestre\tsconfig.json)
- Ajustado: [C:\dev\concursomestre\vite.config.ts](C:\dev\concursomestre\vite.config.ts)
- Resultado:
  - remoÃ§Ã£o do alias `@services`, que nÃ£o tinha uso real

#### 6. PrevenÃ§Ã£o de reincidÃªncia de artefatos locais
- Ajustado: [C:\dev\concursomestre\.gitignore](C:\dev\concursomestre\.gitignore)
- Resultado:
  - arquivos `.recovered`, `.corrupted`, logs locais da Stripe e payloads temporÃ¡rios deixam de contaminar o repositÃ³rio

### Backup criado antes da auditoria
- Frontend:
  - `C:\dev\backups\concursomestre-audit-20260401-193750\frontend`
- Backend:
  - `C:\dev\backups\concursomestre-audit-20260401-193750\backend`

### BenefÃ­cios obtidos nesta fase
- reduÃ§Ã£o imediata de ruÃ­do arquitetural
- menor risco de ediÃ§Ã£o em arquivo errado
- entrada do app mais previsÃ­vel
- melhor base para modularizar pÃ¡ginas grandes nas prÃ³ximas fases
- reduÃ§Ã£o de superfÃ­cie exposta no backend

### PrÃ³ximos passos recomendados para a fase seguinte
- quebrar os hotspots:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
  - [C:\dev\concursomestre\pages\Profile.tsx](C:\dev\concursomestre\pages\Profile.tsx)
  - [C:\dev\concursomestre\src\pages\CheckoutPage.tsx](C:\dev\concursomestre\src\pages\CheckoutPage.tsx)
- separar melhor as camadas de domÃ­nio do backend procedural
- consolidar contratos de resposta entre frontend e backend
- ampliar testes alÃ©m do admin para auth, checkout e profile

## Fase 2 - DecomposiÃ§Ã£o inicial do painel admin

### Objetivo da fase
- reduzir o tamanho e o acoplamento direto de [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- comeÃ§ar a mover UI compartilhada do admin para `src/features/admin/components`
- fortalecer o fluxo administrativo de visualizaÃ§Ã£o de logs
- padronizar melhor o consumo da service layer do admin

### Problemas encontrados nesta fase

#### 1. Componentes locais demais dentro de `Admin.tsx`
- O arquivo ainda carregava componentes reaproveitÃ¡veis no corpo da prÃ³pria pÃ¡gina:
  - dropdown de notificaÃ§Ãµes
  - seletor inteligente de tags
  - visualizador de logs
- Impacto:
  - arquivo maior do que o necessÃ¡rio
  - baixa reutilizaÃ§Ã£o
  - leitura mais pesada

#### 2. Acoplamento morto no `SmartTagSelector`
- O componente carregava:
  - `useData`
  - `useAuth`
  - estado de notificaÃ§Ãµes
  - navegaÃ§Ã£o
- Nada disso era usado no comportamento final do seletor.
- Impacto:
  - dependÃªncias falsas
  - ruÃ­do cognitivo
  - maior superfÃ­cie para regressÃ£o

#### 3. Endpoint de logs administrativos exposto de forma insegura
- [C:\xampp\htdocs\questao-pro-backend\api\system\logs.php](C:\xampp\htdocs\questao-pro-backend\api\system\logs.php) estava com:
  - `Access-Control-Allow-Origin: *`
  - sem autenticaÃ§Ã£o administrativa obrigatÃ³ria
  - resposta fora do padrÃ£o central de API
- Impacto:
  - risco real de exposiÃ§Ã£o indevida de logs do servidor
  - incoerÃªncia com a camada de seguranÃ§a jÃ¡ adotada no admin

#### 4. `LogViewer` consumindo o `apiClient` em formato incorreto
- O componente tratava a resposta como se fosse `AxiosResponse`, acessando `response.data`.
- PorÃ©m o `apiClient` da plataforma jÃ¡ devolve o payload normalizado.
- Impacto:
  - comportamento frÃ¡gil
  - chance de falso estado vazio

### MudanÃ§as implementadas nesta fase

#### 1. ExtraÃ§Ã£o dos componentes compartilhados do admin
- Criados:
- [C:\dev\concursomestre\src\components\admin\shared\NotificationDropdown.tsx](C:\dev\concursomestre\src\components\admin\shared\NotificationDropdown.tsx)
- [C:\dev\concursomestre\src\components\admin\database\SmartTagSelector.tsx](C:\dev\concursomestre\src\components\admin\database\SmartTagSelector.tsx)
- [C:\dev\concursomestre\src\components\admin\shared\LogViewer.tsx](C:\dev\concursomestre\src\components\admin\shared\LogViewer.tsx)
- Ajustado:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- BenefÃ­cio:
  - o `Admin.tsx` perde parte do peso estrutural
  - a UI administrativa passa a ter blocos reaproveitÃ¡veis e mais fÃ¡ceis de testar

#### 2. Limpeza do `SmartTagSelector`
- O componente foi extraÃ­do jÃ¡ sem dependÃªncias mortas.
- Removidos do comportamento interno:
  - leitura de notificaÃ§Ãµes
  - leitura de usuÃ¡rio autenticado
  - navegaÃ§Ã£o
  - estados nÃ£o utilizados
- BenefÃ­cio:
  - menor acoplamento
  - menos chance de regressÃ£o lateral

#### 3. CentralizaÃ§Ã£o da leitura de logs na service layer
- Ajustado:
- [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
- Adicionado:
  - `getSystemLogs()`
- BenefÃ­cio:
  - o componente de logs deixa de conhecer detalhes do contrato HTTP
  - o fluxo fica alinhado ao restante do mÃ³dulo administrativo

#### 4. Hardening do endpoint de logs administrativos
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\api\system\logs.php](C:\xampp\htdocs\questao-pro-backend\api\system\logs.php)
- O endpoint agora:
  - usa o `cors.php` oficial
  - usa `Database`
  - exige sessÃ£o administrativa via `requireAdminSessionContext(...)`
  - responde via `Response::success(...)`
- BenefÃ­cio:
  - elimina exposiÃ§Ã£o pÃºblica indevida do log do servidor
  - mantÃ©m o endpoint dentro do padrÃ£o central da API

#### 5. Cobertura de teste ampliada na service layer administrativa
- Ajustado:
  - [C:\dev\concursomestre\src\features\admin\services\__tests__\adminService.test.ts](C:\dev\concursomestre\src\features\admin\services\__tests__\adminService.test.ts)
- Nova cobertura:
  - normalizaÃ§Ã£o do retorno de `getSystemLogs()`

### ValidaÃ§Ã£o executada nesta fase
- Frontend:
  - `npm run build`
  - `npm run test:admin`
- Backend:
  - `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\system\logs.php`

### Resultado da fase
- a decomposiÃ§Ã£o do admin comeÃ§ou de forma segura
- o fluxo de logs ficou mais profissional, mais seguro e mais consistente
- o painel admin agora tem mais UI reutilizÃ¡vel fora da pÃ¡gina monolÃ­tica principal

### PrÃ³xima fase recomendada
- extrair blocos maiores de [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx):
  - `AdminDashboard`
  - `AdminSettings`
  - `AdminFinance`
  - `AdminDatabaseManager`
- padronizar o tratamento de respostas histÃ³ricas que ainda misturam `res.success` e `res.data?.success`
- continuar a decomposiÃ§Ã£o dos hotspots:
  - [C:\dev\concursomestre\pages\Profile.tsx](C:\dev\concursomestre\pages\Profile.tsx)
  - [C:\dev\concursomestre\src\pages\CheckoutPage.tsx](C:\dev\concursomestre\src\pages\CheckoutPage.tsx)

## Fase 3 - DecomposiÃ§Ã£o de AdminSettings

### Objetivo da fase
- remover mais um bloco monolÃ­tico crÃ­tico de [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- isolar a configuraÃ§Ã£o administrativa em um componente de domÃ­nio prÃ³prio
- preservar o fluxo funcional jÃ¡ homologado de integraÃ§Ãµes, 2FA, reset e cache

### Problemas encontrados nesta fase

#### 1. `AdminSettings` concentrava responsabilidades demais no arquivo raiz
- A tela de configuraÃ§Ãµes carregava:
  - estado local de dezenas de campos
  - integraÃ§Ã£o com 2FA
  - reset do sistema
  - logs
  - cache
  - integraÃ§Ãµes
  - SMTP
  - anÃºncios
- Impacto:
  - manutenÃ§Ã£o lenta
  - maior risco de regressÃ£o ao tocar em qualquer ajuste administrativo
  - revisÃ£o arquitetural difÃ­cil

#### 2. `CacheManagement` ainda estava acoplado ao mesmo arquivo gigante
- Mesmo sendo uma subÃ¡rea especÃ­fica, continuava embutido em [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx).
- Impacto:
  - acoplamento desnecessÃ¡rio
  - menor clareza de domÃ­nio

### MudanÃ§as implementadas nesta fase

#### 1. ExtraÃ§Ã£o completa de `AdminSettings`
- Criado:
- [C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx](C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx)
- Ajustado:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- O novo componente centraliza:
  - abas de configuraÃ§Ãµes
  - save das configuraÃ§Ãµes
  - integraÃ§Ã£o com 2FA
  - reset do sistema
  - visualizaÃ§Ã£o de logs
  - gerenciamento de cache
  - integraÃ§Ãµes de pagamento
  - SMTP e anÃºncios
- BenefÃ­cio:
  - `Admin.tsx` volta a atuar mais como orquestrador
  - a Ã¡rea de configuraÃ§Ã£o fica pronta para evoluÃ§Ã£o isolada e futura cobertura dedicada

#### 2. Co-localizaÃ§Ã£o do `CacheManagement`
- O bloco de cache foi movido junto com a tela de configuraÃ§Ãµes, mantendo o mesmo comportamento.
- BenefÃ­cio:
  - a responsabilidade de performance/configuraÃ§Ã£o fica no mesmo domÃ­nio
  - reduz espalhamento de lÃ³gica administrativa

#### 3. ComentÃ¡rios e contrato explÃ­cito do componente
- O novo arquivo passou a ter:
  - comentÃ¡rio arquitetural em pt-BR
  - interface de props para o contrato de configuraÃ§Ã£o
  - dependÃªncias importadas localmente
- BenefÃ­cio:
  - mais legibilidade
  - menos dependÃªncia implÃ­cita do arquivo raiz

### ValidaÃ§Ã£o executada nesta fase
- Frontend:
  - `npm run build`
  - `npm run test:admin`

### Resultado da fase
- [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx) perdeu mais um bloco grande e sensÃ­vel
- a tela de configuraÃ§Ãµes ficou extraÃ­da sem alterar o comportamento funcional
- a decomposiÃ§Ã£o do admin avanÃ§ou com menor acoplamento e melhor rastreabilidade

### PrÃ³xima fase recomendada
- extrair [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx):
  - `AdminFinance`
  - `AdminDatabaseManager`
- iniciar a padronizaÃ§Ã£o das respostas histÃ³ricas do admin que ainda misturam mÃºltiplos formatos

## Fase 4 - DecomposiÃ§Ã£o de AdminFinance

### Objetivo da fase
- remover do arquivo raiz do admin o domÃ­nio financeiro, comercial e de automaÃ§Ã£o
- isolar pricing, transaÃ§Ãµes, repasses, cupons e automaÃ§Ã£o em um mÃ³dulo dedicado
- preservar o comportamento jÃ¡ homologado do financeiro administrativo

### Problemas encontrados nesta fase

#### 1. `AdminFinance` ainda concentrava vÃ¡rios subdomÃ­nios no arquivo principal
- O bloco reunia:
  - repasses a vendedores
  - tabela de transaÃ§Ãµes
  - reembolsos
  - pricing e benefÃ­cios
  - campanhas/cupons
  - automaÃ§Ã£o por provedor
- Impacto:
  - alto acoplamento com o restante do painel
  - revisÃ£o difÃ­cil
  - maior risco de regressÃ£o ao tocar em qualquer ajuste financeiro

#### 2. O marketing comercial dependia diretamente do mesmo bloco financeiro
- `AdminMarketing` permanecia colado no domÃ­nio financeiro.
- Impacto:
  - dificultava extraÃ§Ã£o parcial
  - mantinha duas Ã¡reas operacionais fortes presas ao arquivo monolÃ­tico

### MudanÃ§as implementadas nesta fase

#### 1. ExtraÃ§Ã£o de `AdminFinance` e `AdminMarketing`
- Criado:
- [C:\dev\concursomestre\src\components\admin\finance\AdminFinance.tsx](C:\dev\concursomestre\src\components\admin\finance\AdminFinance.tsx)
- Ajustado:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- O novo mÃ³dulo financeiro passou a concentrar:
  - transaÃ§Ãµes
  - repasses
  - reembolsos
  - pricing
  - matriz de benefÃ­cios
  - cupons e campanhas
  - automaÃ§Ã£o Stripe/Mercado Pago
- BenefÃ­cio:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx) ficou mais enxuto
  - o domÃ­nio financeiro agora pode evoluir com menos risco lateral

#### 2. Contrato explÃ­cito do mÃ³dulo financeiro
- O novo arquivo passou a declarar:
  - props esperadas
  - dependÃªncias de domÃ­nio
  - comentÃ¡rio arquitetural em pt-BR
- BenefÃ­cio:
  - menos dependÃªncia implÃ­cita
  - mais clareza na fronteira entre orquestraÃ§Ã£o e implementaÃ§Ã£o

### ValidaÃ§Ã£o executada nesta fase
- Frontend:
  - `npm run build`
  - `npm run test:admin`

### Resultado da fase
- o painel administrativo perdeu mais um bloco gigante do arquivo principal
- o financeiro e o marketing ficaram organizados em um mÃ³dulo prÃ³prio
- a decomposiÃ§Ã£o continua avanÃ§ando sem regressÃ£o funcional detectada

### PrÃ³xima fase recomendada
- extrair [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx):
  - `AdminDatabaseManager`
  - `AdminDashboard`
- padronizar os contratos legados do admin que ainda misturam formatos de resposta diferentes

## Fase 5 - DecomposiÃ§Ã£o de AdminDashboard

### Objetivo da fase
- remover o dashboard executivo do arquivo principal do admin
- isolar KPIs, atalhos operacionais e o modal de auditoria financeira em um mÃ³dulo prÃ³prio
- continuar reduzindo o peso arquitetural de [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)

### Problemas encontrados nesta fase

#### 1. O dashboard ainda estava misturado ao restante do painel
- Mesmo sendo conceitualmente uma Ã¡rea de leitura e navegaÃ§Ã£o, o dashboard seguia dentro do mesmo arquivo que tambÃ©m concentra gestÃ£o de base de dados.
- Impacto:
  - acoplamento alto
  - revisÃ£o difÃ­cil
  - mais ruÃ­do ao alterar qualquer mÃ©trica ou atalho administrativo

#### 2. O modal de auditoria financeira seguia preso Ã  pÃ¡gina raiz
- O modal fullscreen de auditoria fazia parte do mesmo bloco grande do dashboard.
- Impacto:
  - menor reusabilidade
  - maior dificuldade para evoluÃ§Ã£o isolada

### MudanÃ§as implementadas nesta fase

#### 1. ExtraÃ§Ã£o completa de `AdminDashboard`
- Criado:
- [C:\dev\concursomestre\src\components\admin\dashboard\AdminDashboard.tsx](C:\dev\concursomestre\src\components\admin\dashboard\AdminDashboard.tsx)
- Ajustado:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- O novo componente concentra:
  - indicadores executivos
  - cards de acesso rÃ¡pido
  - mÃ©tricas por perÃ­odo
  - visÃ£o geral financeira
  - modal de auditoria lÃ³gica financeira
- BenefÃ­cio:
  - o dashboard passa a ter fronteira clara de domÃ­nio
  - futuras evoluÃ§Ãµes de KPI e navegaÃ§Ã£o ficam desacopladas do restante do admin

#### 2. Contrato explÃ­cito do dashboard
- O novo arquivo passou a declarar:
  - props recebidas
  - comentÃ¡rio arquitetural em pt-BR
  - dependÃªncias prÃ³prias
- BenefÃ­cio:
  - melhora da legibilidade
  - menor dependÃªncia implÃ­cita do arquivo raiz

### ValidaÃ§Ã£o executada nesta fase
- Frontend:
  - `npm run build`
  - `npm run test:admin`

### Resultado da fase
- [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx) perdeu mais um bloco relevante
- dashboard e financeiro jÃ¡ estÃ£o fora do arquivo principal
- o painel segue funcional e a decomposiÃ§Ã£o ficou mais segura para a prÃ³xima rodada

### PrÃ³xima fase recomendada
- extrair [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx):
  - `AdminDatabaseManager`
- iniciar a normalizaÃ§Ã£o dos retornos legados do admin que ainda misturam contratos distintos

## Fase 6 - Congelamento da arquitetura e abertura da migracao por entry points

### Objetivo da fase
- parar a refatoracao estrutural ad-hoc antes da Fase 3
- definir uma arquitetura oficial, simples e previsivel
- padronizar os modulos ja extraidos para a estrutura congelada
- iniciar a proxima fase pela migracao segura dos entry points mais criticos

### Fases oficiais a partir deste ponto
1. Fase 0 - Congelamento da arquitetura
2. Fase 1 - Padronizacao do que ja foi extraido
3. Fase 2 - Migracao dos entry points
4. Fase 3 - Migracao dos providers e do estado global
5. Fase 4 - Migracao dos servicos e contratos
6. Fase 5 - Migracao estrutural do backend por modulos

### Definicao oficial da arquitetura
- Documento-base: [C:\dev\concursomestre\docs\architecture-freeze.md](C:\dev\concursomestre\docs\architecture-freeze.md)
- Estrutura oficial de frontend:
  - `src/app` para paginas e fluxo
  - `src/components` para UI por dominio
  - `src/providers` para contexto global
  - `src/state` para estado global minimo
  - `src/services` para integracoes e chamadas HTTP
  - `src/utils` para funcoes puras reutilizaveis
  - `src/types` para contratos compartilhados
  - `src/constants` para catalogos e configuracoes estaveis
- Estrutura oficial de backend:
  - `modules/<feature>` com `controllers`, `services`, `repositories`, `validators` e `routes`
  - `shared/` apenas para infraestrutura transversal

### Mudancas implementadas nesta fase

#### 1. Arquitetura congelada e documentada
- Criado:
  - [C:\dev\concursomestre\docs\architecture-freeze.md](C:\dev\concursomestre\docs\architecture-freeze.md)
- O documento passou a definir:
  - arvore alvo do frontend
  - arvore alvo do backend
  - zonas legadas em migracao
  - regras oficiais de onde cada tipo de arquivo deve nascer
- Beneficio:
  - elimina ambiguidade estrutural
  - impede novas extracoes fora do padrao oficial

#### 2. Padronizacao dos modulos ja extraidos
- Movidos para a estrutura oficial:
  - [C:\dev\concursomestre\src\providers\AppProviders.tsx](C:\dev\concursomestre\src\providers\AppProviders.tsx)
  - [C:\dev\concursomestre\src\components\admin\dashboard\AdminDashboard.tsx](C:\dev\concursomestre\src\components\admin\dashboard\AdminDashboard.tsx)
  - [C:\dev\concursomestre\src\components\admin\finance\AdminFinance.tsx](C:\dev\concursomestre\src\components\admin\finance\AdminFinance.tsx)
  - [C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx](C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx)
  - [C:\dev\concursomestre\src\components\admin\support\AdminFeedback.tsx](C:\dev\concursomestre\src\components\admin\support\AdminFeedback.tsx)
  - [C:\dev\concursomestre\src\components\admin\shared\LogViewer.tsx](C:\dev\concursomestre\src\components\admin\shared\LogViewer.tsx)
  - [C:\dev\concursomestre\src\components\admin\shared\NotificationDropdown.tsx](C:\dev\concursomestre\src\components\admin\shared\NotificationDropdown.tsx)
  - [C:\dev\concursomestre\src\components\admin\database\SmartTagSelector.tsx](C:\dev\concursomestre\src\components\admin\database\SmartTagSelector.tsx)
  - [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
  - [C:\dev\concursomestre\src\constants\subscriptions\planEntitlements.ts](C:\dev\concursomestre\src\constants\subscriptions\planEntitlements.ts)
- Ajustados:
  - [C:\dev\concursomestre\tsconfig.json](C:\dev\concursomestre\tsconfig.json)
  - [C:\dev\concursomestre\vite.config.ts](C:\dev\concursomestre\vite.config.ts)
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
  - [C:\dev\concursomestre\components\UpgradeModal.tsx](C:\dev\concursomestre\components\UpgradeModal.tsx)
  - [C:\dev\concursomestre\package.json](C:\dev\concursomestre\package.json)
- Beneficio:
  - os modulos ja extraidos deixam de viver em caminhos legados
  - build e teste voltam a refletir a estrutura oficial do projeto

#### 3. Abertura da Fase 2 com entry points oficiais
- Criados:
  - [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx)
  - [C:\dev\concursomestre\src\app\profile\page.tsx](C:\dev\concursomestre\src\app\profile\page.tsx)
  - [C:\dev\concursomestre\src\app\checkout\page.tsx](C:\dev\concursomestre\src\app\checkout\page.tsx)
  - [C:\dev\concursomestre\src\app\plans\page.tsx](C:\dev\concursomestre\src\app\plans\page.tsx)
- Ajustado:
  - [C:\dev\concursomestre\src\app\AppShell.tsx](C:\dev\concursomestre\src\app\AppShell.tsx)
- Resultado:
  - as rotas de `admin`, `profile`, `checkout` e `plans` deixam de importar diretamente os entry points legados
  - a migracao para `src/app/<feature>/page.tsx` passa a acontecer de maneira incremental e segura

### Validacao executada nesta fase
- `npm run build`
- `npm run test:admin`

### Resultado da fase
- Fase 0 concluida
- Fase 1 concluida
- Fase 2 iniciada com entry points reais dentro da arquitetura congelada
- a base do projeto ficou mais previsivel sem quebrar o comportamento aprovado

### Proximo passo recomendado
- continuar a Fase 2 migrando os demais entry points de alto uso
- iniciar em seguida a Fase 3 com a migracao gradual de `context/` para `src/providers`

### Expansao da Fase 2 - migracao ampla dos entry points

#### Objetivo desta rodada
- reduzir ainda mais a dependencia direta de `pages/` dentro da casca de rotas
- fazer a arquitetura congelada valer para praticamente todas as rotas principais
- preparar o terreno para a migracao futura do conteudo interno das paginas

#### Mudancas implementadas nesta rodada
- Criados novos entry points em `src/app`:
  - [C:\dev\concursomestre\src\app\auth\page.tsx](C:\dev\concursomestre\src\app\auth\page.tsx)
  - [C:\dev\concursomestre\src\app\dashboard\page.tsx](C:\dev\concursomestre\src\app\dashboard\page.tsx)
  - [C:\dev\concursomestre\src\app\practice\page.tsx](C:\dev\concursomestre\src\app\practice\page.tsx)
  - [C:\dev\concursomestre\src\app\simulation\page.tsx](C:\dev\concursomestre\src\app\simulation\page.tsx)
  - [C:\dev\concursomestre\src\app\bank-analysis\page.tsx](C:\dev\concursomestre\src\app\bank-analysis\page.tsx)
  - [C:\dev\concursomestre\src\app\marketplace\page.tsx](C:\dev\concursomestre\src\app\marketplace\page.tsx)
  - [C:\dev\concursomestre\src\app\ranking\page.tsx](C:\dev\concursomestre\src\app\ranking\page.tsx)
  - [C:\dev\concursomestre\src\app\promo\page.tsx](C:\dev\concursomestre\src\app\promo\page.tsx)
  - [C:\dev\concursomestre\src\app\landing\page.tsx](C:\dev\concursomestre\src\app\landing\page.tsx)
  - [C:\dev\concursomestre\src\app\notifications\page.tsx](C:\dev\concursomestre\src\app\notifications\page.tsx)
  - [C:\dev\concursomestre\src\app\support\page.tsx](C:\dev\concursomestre\src\app\support\page.tsx)
  - [C:\dev\concursomestre\src\app\changelog\page.tsx](C:\dev\concursomestre\src\app\changelog\page.tsx)
  - [C:\dev\concursomestre\src\app\faq\page.tsx](C:\dev\concursomestre\src\app\faq\page.tsx)
  - [C:\dev\concursomestre\src\app\reset-password\page.tsx](C:\dev\concursomestre\src\app\reset-password\page.tsx)
  - [C:\dev\concursomestre\src\app\confirm-email\page.tsx](C:\dev\concursomestre\src\app\confirm-email\page.tsx)
  - [C:\dev\concursomestre\src\app\partner-dashboard\page.tsx](C:\dev\concursomestre\src\app\partner-dashboard\page.tsx)
  - [C:\dev\concursomestre\src\app\reader\page.tsx](C:\dev\concursomestre\src\app\reader\page.tsx)
  - [C:\dev\concursomestre\src\app\terms\page.tsx](C:\dev\concursomestre\src\app\terms\page.tsx)
  - [C:\dev\concursomestre\src\app\privacy\page.tsx](C:\dev\concursomestre\src\app\privacy\page.tsx)
- Ajustado:
  - [C:\dev\concursomestre\src\app\AppShell.tsx](C:\dev\concursomestre\src\app\AppShell.tsx)

#### Resultado da rodada
- a casca de rotas agora aponta majoritariamente para `src/app/<feature>/page.tsx`
- `pages/` continua existindo como zona legada, mas deixou de ser o ponto de importacao direto da navegacao principal
- a Fase 2 ficou substancialmente adiantada sem mexer ainda na regra de negocio interna de cada tela

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`

#### Estado atual da Fase 2
- entry points migrados:
  - `admin`
  - `auth`
  - `bank-analysis`
  - `changelog`
  - `checkout`
  - `confirm-email`
  - `dashboard`
  - `faq`
  - `landing`
  - `marketplace`
  - `notifications`
  - `partner-dashboard`
  - `plans`
  - `practice`
  - `privacy`
  - `profile`
  - `promo`
  - `ranking`
  - `reader`
  - `reset-password`
  - `simulation`
  - `support`
  - `terms`

#### Proximo passo recomendado
- seguir para a Fase 3 com a migracao gradual de `context/` para `src/providers`
- manter `pages/` apenas como camada de compatibilidade ate a decomposicao interna de cada tela

### Abertura da Fase 3 - camada oficial de providers

#### Objetivo desta rodada
- iniciar a migracao real de `context/` para `src/providers`
- criar uma camada oficial de entrada para os providers globais
- reduzir o acoplamento dos pontos centrais ao diretorio legado `context/`

#### Mudancas implementadas nesta rodada
- Criados bridges oficiais em `src/providers`:
  - [C:\dev\concursomestre\src\providers\AuthProvider.tsx](C:\dev\concursomestre\src\providers\AuthProvider.tsx)
  - [C:\dev\concursomestre\src\providers\DataProvider.tsx](C:\dev\concursomestre\src\providers\DataProvider.tsx)
  - [C:\dev\concursomestre\src\providers\MarketplaceProvider.tsx](C:\dev\concursomestre\src\providers\MarketplaceProvider.tsx)
  - [C:\dev\concursomestre\src\providers\ModalProvider.tsx](C:\dev\concursomestre\src\providers\ModalProvider.tsx)
  - [C:\dev\concursomestre\src\providers\ThemeProvider.tsx](C:\dev\concursomestre\src\providers\ThemeProvider.tsx)
  - [C:\dev\concursomestre\src\providers\ToastProvider.tsx](C:\dev\concursomestre\src\providers\ToastProvider.tsx)
- Ajustados:
  - [C:\dev\concursomestre\src\providers\AppProviders.tsx](C:\dev\concursomestre\src\providers\AppProviders.tsx)
  - [C:\dev\concursomestre\src\app\AppShell.tsx](C:\dev\concursomestre\src\app\AppShell.tsx)

#### Resultado da rodada
- `src/providers` deixou de ser apenas uma pasta-alvo e passou a ser uma camada real de consumo
- a casca principal do app jÃ¡ consome providers pela estrutura oficial
- `context/` continua como base de compatibilidade temporÃ¡ria, mas deixou de ser a Ãºnica porta de entrada dos providers globais

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`

#### Proximo passo recomendado
- continuar a Fase 3 migrando consumidores de `context/*` para `@providers/*`
- depois abrir a Fase 4 para consolidar `src/services/api` e reduzir a dependencia de `src/core`

### Expansao da Fase 3 - consumidores do app migrados para `@providers`

#### Objetivo desta rodada
- parar de consumir `context/*` diretamente fora da camada legada
- fazer `src/providers` virar a porta oficial de acesso a auth, data, toast, theme, modal e marketplace

#### Mudancas implementadas nesta rodada
- Ajustado bridge de modal:
  - [C:\dev\concursomestre\src\providers\ModalProvider.tsx](C:\dev\concursomestre\src\providers\ModalProvider.tsx)
- Consumidores migrados em lote para `@providers/*` nas areas:
  - `components/`
  - `pages/`
  - `src/`
- Resultado:
  - os imports diretos de `context/AuthContext`, `context/DataContext`, `context/ToastContext`, `context/ThemeContext`, `context/MarketplaceContext` e `context/ModalContext` sairam dos consumidores do app
  - `context/` ficou mais claramente delimitado como camada legada de compatibilidade

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`

### Abertura da Fase 4 - fachada oficial de servicos de API

#### Objetivo desta rodada
- fazer o app consumir `src/services/api` como fachada oficial
- reduzir o acoplamento explicito dos modulos ao diretorio legado `src/core/api`

#### Mudancas implementadas nesta rodada
- Consumidores migrados em lote de:
  - `@core/api`
  - `@core/api/client`
  - `@core/api/endpoints`
  - `@core/api/types`
  - imports relativos para `src/core/api`
- Para:
  - [C:\dev\concursomestre\src\services\api\index.ts](C:\dev\concursomestre\src\services\api\index.ts)
- Areas atingidas:
  - `components/`
  - `pages/`
  - `context/`
  - `src/components/`
  - `src/features/`
  - `src/services/admin/`
- Resultado:
  - `src/core/api` passa a ficar mais isolado como implementacao interna
  - a superficie de consumo da API ficou padronizada em `@services/api`

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento, com camada e consumidores principais migrados
5. Fase 4 - iniciada com a fachada oficial de API

#### Proximo passo recomendado
- continuar a Fase 4 criando fachadas por dominio dentro de `src/services`
- depois abrir a Fase 5 para comecar a modularizacao do backend por `modules/<feature>`

### Expansao da Fase 4 - fachadas por dominio em `src/services`

#### Objetivo desta rodada
- parar de consumir `@features/*` quando o uso real for de serviÃ§o de domÃ­nio
- consolidar `src/services` como camada oficial de integraÃ§Ã£o e regra reaproveitÃ¡vel

#### Mudancas implementadas nesta rodada
- Criadas fachadas por dominio:
  - [C:\dev\concursomestre\src\services\auth\index.ts](C:\dev\concursomestre\src\services\auth\index.ts)
  - [C:\dev\concursomestre\src\services\bank-analysis\index.ts](C:\dev\concursomestre\src\services\bank-analysis\index.ts)
  - [C:\dev\concursomestre\src\services\comments\index.ts](C:\dev\concursomestre\src\services\comments\index.ts)
  - [C:\dev\concursomestre\src\services\marketplace\index.ts](C:\dev\concursomestre\src\services\marketplace\index.ts)
  - [C:\dev\concursomestre\src\services\notifications\index.ts](C:\dev\concursomestre\src\services\notifications\index.ts)
  - [C:\dev\concursomestre\src\services\plans\index.ts](C:\dev\concursomestre\src\services\plans\index.ts)
  - [C:\dev\concursomestre\src\services\questions\index.ts](C:\dev\concursomestre\src\services\questions\index.ts)
  - [C:\dev\concursomestre\src\services\rankings\index.ts](C:\dev\concursomestre\src\services\rankings\index.ts)
  - [C:\dev\concursomestre\src\services\statistics\index.ts](C:\dev\concursomestre\src\services\statistics\index.ts)
- Consumidores ativos migrados:
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
  - [C:\dev\concursomestre\context\MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx)
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)

#### Resultado da rodada
- `src/services` deixou de ser apenas `admin` + `api`
- serviÃ§os de domÃ­nio passaram a ter uma porta oficial fora de `src/features`
- `src/features` fica mais prÃ³ximo de uma camada de implementaÃ§Ã£o interna e composiÃ§Ã£o por feature

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`

### Abertura da Fase 5 - modularizacao inicial do backend

#### Objetivo desta rodada
- iniciar a estrutura `modules/<feature>` no backend com um caso real e sensÃ­vel
- validar a abordagem modular sem quebrar endpoints jÃ¡ em produÃ§Ã£o

#### Mudancas implementadas nesta rodada
- Criado o primeiro slice modular em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminSystemLogController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminSystemLogController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminSystemLogService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminSystemLogService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminSystemLogRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminSystemLogRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminSystemLogValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminSystemLogValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
- Endpoint legado adaptado para delegar ao mÃ³dulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\system\logs.php](C:\xampp\htdocs\questao-pro-backend\api\system\logs.php)

#### Beneficio tecnico
- o endpoint de logs deixou de concentrar:
  - validacao
  - acesso a arquivo
  - composiÃ§Ã£o HTTP
  - auditoria administrativa
- agora essas responsabilidades ficam separadas em controller, service, repository, validator e route handler, como definido na arquitetura congelada

#### Validacao executada nesta rodada
- `C:\xampp\php\php.exe -l` em:
  - `api/system/logs.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminSystemLogController.php`
  - `modules/admin/services/AdminSystemLogService.php`
  - `modules/admin/repositories/AdminSystemLogRepository.php`
  - `modules/admin/validators/AdminSystemLogValidator.php`

#### Observacao de ambiente
- o `php -l` exibiu aviso de `openssl already loaded`, mas sem erro de sintaxe. O problema e de configuracao do ambiente PHP local, nao da modularizacao aplicada.

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento, com fachadas por dominio abertas
6. Fase 5 - iniciada no backend com o slice `modules/admin`

#### Proximo passo recomendado
- continuar a Fase 5 modularizando o proximo endpoint administrativo de baixo risco
- em paralelo, seguir a Fase 3 trocando imports restantes de `context/*` dentro das camadas legadas internas

### Expansao da Fase 5 - modularizacao do endpoint administrativo de feedback

#### Objetivo desta rodada
- modularizar outro endpoint administrativo real e usado pelo painel
- validar que a estrutura `modules/admin` comporta fluxos com listagem, detalhe e atualizaÃ§Ã£o

#### Mudancas implementadas nesta rodada
- Criado o slice de feedback em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminFeedbackController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminFeedbackController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminFeedbackService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminFeedbackService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminFeedbackRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminFeedbackRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminFeedbackValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminFeedbackValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\feedback.php](C:\xampp\htdocs\questao-pro-backend\api\admin\feedback.php)

#### Resultado da rodada
- o endpoint legado `api/admin/feedback.php` deixou de concentrar:
  - queries SQL
  - validacao de entrada
  - regra de listagem
  - regra de detalhe da thread
  - regra de atualizaÃ§Ã£o de status
- o fluxo agora passa por controller, service, repository e validator, mantendo o endpoint atual compatÃ­vel com o painel

#### Validacao executada nesta rodada
- `C:\xampp\php\php.exe -l` em:
  - `api/admin/feedback.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminFeedbackController.php`
  - `modules/admin/services/AdminFeedbackService.php`
  - `modules/admin/repositories/AdminFeedbackRepository.php`
  - `modules/admin/validators/AdminFeedbackValidator.php`

#### Observacao de ambiente
- o aviso de `openssl already loaded` continua vindo do ambiente local de PHP e nao da estrutura modular aplicada

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs` e `feedback` ja modularizados

#### Proximo passo recomendado
- modularizar o proximo endpoint administrativo de baixo risco, preferencialmente `report_actions.php`
- depois avaliar a migracao dos primeiros contexts legados internos para implementacoes oficiais em `src/providers`

### Expansao da Fase 5 - modularizacao do endpoint de moderacao de denuncias

#### Objetivo desta rodada
- modularizar o fluxo administrativo de moderacao de denuncias
- consolidar o dominio admin com mais um endpoint critico e usado no painel

#### Mudancas implementadas nesta rodada
- Criado o slice de moderacao de denuncias em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminReportModerationController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminReportModerationController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminReportModerationService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminReportModerationService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminReportModerationRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminReportModerationRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminReportModerationValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminReportModerationValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\report_actions.php](C:\xampp\htdocs\questao-pro-backend\api\admin\report_actions.php)

#### Resultado da rodada
- o endpoint legado de moderacao deixou de concentrar:
  - validacao de payload
  - garantia de colunas administrativas
  - busca da denuncia
  - persistencia do julgamento
  - notificacao ao denunciante
- essas responsabilidades agora ficam distribuidas entre validator, repository, service e controller
- o contrato HTTP foi preservado para o painel administrativo ja existente

#### Validacao executada nesta rodada
- `C:\xampp\php\php.exe -l` em:
  - `api/admin/report_actions.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminReportModerationController.php`
  - `modules/admin/services/AdminReportModerationService.php`
  - `modules/admin/repositories/AdminReportModerationRepository.php`
  - `modules/admin/validators/AdminReportModerationValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback` e `report moderation` modularizados

#### Proximo passo recomendado
- modularizar o proximo endpoint administrativo de baixo risco, como `stats.php` ou `user_actions.php`
- ou voltar ao frontend para substituir implementacoes internas legadas de `context/` por providers oficiais reais

### Expansao da Fase 5 - modularizacao do endpoint de metricas administrativas

#### Objetivo desta rodada
- modularizar o endpoint `admin/stats.php`, usado pelo dashboard do admin
- reduzir o acoplamento entre o componente visual e a rota bruta de mÃ©tricas

#### Mudancas implementadas nesta rodada
- Criado o slice de mÃ©tricas em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminStatsController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminStatsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminStatsService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminStatsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminStatsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminStatsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminStatsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminStatsValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\stats.php](C:\xampp\htdocs\questao-pro-backend\api\admin\stats.php)
- No frontend, o dashboard deixou de chamar a rota diretamente:
  - [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
  - [C:\dev\concursomestre\src\components\admin\dashboard\AdminDashboard.tsx](C:\dev\concursomestre\src\components\admin\dashboard\AdminDashboard.tsx)
- Adicionado teste de regressÃ£o no serviÃ§o administrativo:
  - [C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts)

#### Resultado da rodada
- o endpoint de mÃ©tricas deixou de concentrar:
  - validaÃ§Ã£o de filtros
  - construÃ§Ã£o de condiÃ§Ã£o temporal
  - agregaÃ§Ã£o financeira
  - cÃ¡lculo de MRR
  - contadores do dashboard
- a UI do dashboard passou a consumir o serviÃ§o administrativo oficial, e nÃ£o a rota crua

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/admin/stats.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminStatsController.php`
  - `modules/admin/services/AdminStatsService.php`
  - `modules/admin/repositories/AdminStatsRepository.php`
  - `modules/admin/validators/AdminStatsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation` e `admin stats` modularizados

#### Proximo passo recomendado
- modularizar `user_actions.php` ou `user_details.php` como prÃ³ximos slices administrativos
- ou retomar o frontend profundo migrando implementaÃ§Ãµes internas de `context/` para providers reais em `src/providers`

### Expansao da Fase 5 - modularizacao do endpoint de detalhes de usuario

#### Objetivo desta rodada
- modularizar o endpoint `admin/user_details.php`, usado pelo painel administrativo para abrir o perfil detalhado do usuario
- alinhar o frontend ao servico administrativo oficial, evitando chamadas cruas duplicadas dentro de `Admin.tsx`

#### Mudancas implementadas nesta rodada
- Criado o slice de detalhes de usuario em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminUserDetailsController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminUserDetailsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminUserDetailsService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminUserDetailsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminUserDetailsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminUserDetailsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminUserDetailsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminUserDetailsValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\user_details.php](C:\xampp\htdocs\questao-pro-backend\api\admin\user_details.php)
- No frontend, consolidado o consumo do payload detalhado no servico oficial:
  - [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Adicionado teste de regressao para a fachada:
  - [C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts)

#### Resultado da rodada
- o endpoint legado deixou de acumular validacao, consulta, montagem de payload e auditoria em um unico arquivo
- o painel admin deixou de misturar dois fluxos de refresh para o mesmo modal de usuario
- a acao administrativa agora recarrega o perfil detalhado por um unico caminho, com `try/catch/finally` consistente

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/admin/user_details.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminUserDetailsController.php`
  - `modules/admin/services/AdminUserDetailsService.php`
  - `modules/admin/repositories/AdminUserDetailsRepository.php`
  - `modules/admin/validators/AdminUserDetailsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats` e `user details` modularizados

#### Proximo passo recomendado
- modularizar `user_actions.php`, que e o proximo complemento natural do fluxo de detalhamento administrativo de usuario
- depois disso, aplicar a mesma padronizacao aos proximos endpoints administrativos de mutacao ainda legados

### Expansao da Fase 5 - modularizacao do endpoint de acoes administrativas de usuario

#### Objetivo desta rodada
- modularizar o endpoint `admin/user_actions.php`, que concentrava varias mutacoes administrativas em um unico arquivo procedural
- alinhar o frontend para consumir um metodo oficial do `adminService` em vez de um `POST` cru dentro de `Admin.tsx`

#### Mudancas implementadas nesta rodada
- Criado o slice de acoes administrativas em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminUserActionsController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminUserActionsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminUserActionsService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminUserActionsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminUserActionsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminUserActionsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminUserActionsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminUserActionsValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\user_actions.php](C:\xampp\htdocs\questao-pro-backend\api\admin\user_actions.php)
- No frontend, consolidado o envio da mutacao administrativa:
  - [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
- Adicionado teste de regressao para a fachada de mutacao:
  - [C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts)

#### Resultado da rodada
- o endpoint legado deixou de concentrar extensao de prazo, upgrade manual, estorno, emissao de nota e atualizacao de perfil no mesmo arquivo
- o modal administrativo de usuario passou a atualizar o perfil pelo servico oficial e deixou de depender de `apiClient.post(...)` direto
- o formulario de edicao agora preserva o `role` atual ao abrir, evitando downgrade silencioso para `user` quando o admin salva sem alterar o cargo

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/admin/user_actions.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminUserActionsController.php`
  - `modules/admin/services/AdminUserActionsService.php`
  - `modules/admin/repositories/AdminUserActionsRepository.php`
  - `modules/admin/validators/AdminUserActionsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details` e `user actions` modularizados

#### Proximo passo recomendado
- modularizar o proximo endpoint administrativo de mutacao ou consulta ainda legado, priorizando os fluxos com maior uso no painel
- continuar reduzindo dependencias internas de `context/` no frontend enquanto os providers oficiais amadurecem

### Expansao da Fase 5 - modularizacao da manutencao administrativa da base

#### Objetivo desta rodada
- modularizar os endpoints `admin/list_tables.php` e `admin/reset_db.php`, que ainda estavam totalmente procedurais
- mover o frontend de configuracoes para a fachada oficial do `adminService`
- corrigir o contrato quebrado de atualizacao administrativa de status/reputacao do usuario

#### Mudancas implementadas nesta rodada
- Criado o slice de manutencao da base em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminDatabaseMaintenanceController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminDatabaseMaintenanceController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminDatabaseMaintenanceService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminDatabaseMaintenanceService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminDatabaseMaintenanceRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminDatabaseMaintenanceRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminDatabaseMaintenanceValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminDatabaseMaintenanceValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\list_tables.php](C:\xampp\htdocs\questao-pro-backend\api\admin\list_tables.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\admin\reset_db.php](C:\xampp\htdocs\questao-pro-backend\api\admin\reset_db.php)
- No frontend, o fluxo de reset/listagem foi alinhado ao servico oficial:
  - [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
  - [C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx](C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx)
- Expandido o slice de `user_actions` para suportar atualizacao administrativa explicita de status e reputacao:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminUserActionsService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminUserActionsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminUserActionsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminUserActionsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminUserActionsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminUserActionsValidator.php)
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
- Adicionados testes de regressao no servico administrativo:
  - [C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts)

#### Resultado da rodada
- a manutencao da base deixou de misturar autenticacao, leitura de configuracao, 2FA, listagem de tabelas e reset destrutivo em arquivos legados isolados
- a aba de configuracoes agora usa uma camada oficial para listar tabelas resetaveis e disparar reset controlado
- a atualizacao administrativa de reputacao/status deixou de enviar um payload incompatível com o backend
- o fluxo de moderacao do marketplace voltou a ter persistencia real para `status` e `reputation`, em vez de depender de um `update_profile` com estrutura errada

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/admin/list_tables.php`
  - `api/admin/reset_db.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminDatabaseMaintenanceController.php`
  - `modules/admin/services/AdminDatabaseMaintenanceService.php`
  - `modules/admin/repositories/AdminDatabaseMaintenanceRepository.php`
  - `modules/admin/validators/AdminDatabaseMaintenanceValidator.php`
  - `modules/admin/services/AdminUserActionsService.php`
  - `modules/admin/repositories/AdminUserActionsRepository.php`
  - `modules/admin/validators/AdminUserActionsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions` e `database maintenance` modularizados

#### Proximo passo recomendado
- continuar a Fase 5 nos demais endpoints administrativos legados ainda usados pelo painel
- ou voltar para a Fase 3/4 e reduzir mais a dependencia das implementacoes legadas em `context/` e `pages/`

### Expansao da Fase 5 - modularizacao do gerenciamento administrativo de cache

#### Objetivo desta rodada
- modularizar o endpoint legado `api/cache/manage.php`, usado pela aba de performance/configuracoes do admin
- eliminar regra procedural de estatisticas, limpeza e configuracao de cache do endpoint legado
- reforcar a padronizacao do frontend para usar `ENDPOINTS.cache.manage` em vez de strings cruas

#### Mudancas implementadas nesta rodada
- Criado o slice de cache em `modules/admin`:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminCacheController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminCacheController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminCacheService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminCacheService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminCacheRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\repositories\AdminCacheRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminCacheValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminCacheValidator.php)
- Ajustado:
  - [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\cache\manage.php](C:\xampp\htdocs\questao-pro-backend\api\cache\manage.php)
- No frontend, padronizado o consumo do endpoint oficial:
  - [C:\dev\concursomestre\src\core\api\endpoints.ts](C:\dev\concursomestre\src\core\api\endpoints.ts)
  - [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
  - [C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts)

#### Resultado da rodada
- o endpoint legado de cache deixou de concentrar descoberta de tabela, agregacao de estatisticas, leitura/escrita de `system_settings` e manutencao destrutiva em um unico arquivo
- a aba de configuracoes continua funcional, mas agora depende de um backend modular alinhado com a arquitetura congelada
- o caminho oficial de cache ficou centralizado em `ENDPOINTS.cache.manage`, reduzindo strings cruas espalhadas no servico administrativo

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/cache/manage.php`
  - `modules/admin/routes.php`
  - `modules/admin/controllers/AdminCacheController.php`
  - `modules/admin/services/AdminCacheService.php`
  - `modules/admin/repositories/AdminCacheRepository.php`
  - `modules/admin/validators/AdminCacheValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance` e `admin cache` modularizados

#### Proximo passo recomendado
- continuar a Fase 5 nos proximos endpoints ainda legados que impactam o painel administrativo
- ou aprofundar a Fase 3/4 reduzindo ainda mais a dependencia das camadas legadas em `context/` e `pages/`

### Expansao da Fase 5 - modularizacao do dominio de filtros e taxonomias

#### Objetivo desta rodada
- modularizar o dominio `filters`, que alimenta a Base de Dados do admin e o carregamento global de taxonomias do app
- remover a logica procedural dos endpoints `api/filters/*.php`
- extrair a normalizacao de taxonomias do frontend para uma fachada unica, eliminando duplicacao entre `Admin.tsx` e `DataContext.tsx`

#### Mudancas implementadas nesta rodada
- Criado o modulo `filters` no backend:
  - [C:\xampp\htdocs\questao-pro-backend\modules\filters\controllers\FiltersController.php](C:\xampp\htdocs\questao-pro-backend\modules\filters\controllers\FiltersController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\filters\services\FiltersService.php](C:\xampp\htdocs\questao-pro-backend\modules\filters\services\FiltersService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\filters\repositories\FiltersRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\filters\repositories\FiltersRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\filters\validators\FiltersValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\filters\validators\FiltersValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\filters\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\filters\routes.php)
- Ajustado os endpoints legados para apenas delegarem ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\filters\list.php](C:\xampp\htdocs\questao-pro-backend\api\filters\list.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\filters\save.php](C:\xampp\htdocs\questao-pro-backend\api\filters\save.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\filters\delete.php](C:\xampp\htdocs\questao-pro-backend\api\filters\delete.php)
- Criada a fachada de frontend para o dominio:
  - [C:\dev\concursomestre\src\services\filters\index.ts](C:\dev\concursomestre\src\services\filters\index.ts)
- Consumidores migrados para a fachada oficial:
  - [C:\dev\concursomestre\pages\Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx)
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
- Adicionado teste de regressao do dominio de filtros:
  - [C:\dev\concursomestre\src\services\filters\__tests__\filters.test.ts](C:\dev\concursomestre\src\services\filters\__tests__\filters.test.ts)

#### Resultado da rodada
- o CRUD de taxonomias deixou de ficar espalhado entre `Admin.tsx`, `DataContext.tsx` e endpoints procedurais diferentes
- a normalizacao das taxonomias agora vive em uma unica camada reutilizavel no frontend
- a Base de Dados do admin e o bootstrap de taxonomias do app passaram a compartilhar o mesmo contrato e a mesma interpretacao do payload
- o backend agora separa listagem publica e mutacoes administrativas do dominio de filtros com auditoria e validacao centralizadas

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npx vitest run src/services/filters/__tests__/filters.test.ts`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/filters/list.php`
  - `api/filters/save.php`
  - `api/filters/delete.php`
  - `modules/filters/routes.php`
  - `modules/filters/controllers/FiltersController.php`
  - `modules/filters/services/FiltersService.php`
  - `modules/filters/repositories/FiltersRepository.php`
  - `modules/filters/validators/FiltersValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance`, `admin cache` e o modulo `filters` modularizados

#### Proximo passo recomendado
- seguir na Fase 5 modularizando outros dominios ativos do painel, como materiais/marketplace ou rankings, conforme a priorizacao de uso real
- continuar a Fase 3/4 reduzindo a dependencia de camadas legadas ainda presentes em `pages/` e `context/`

### Expansao da Fase 5 - modularizacao completa do dominio de rankings

#### Objetivo desta rodada
- modularizar o dominio `rankings`, que ainda misturava listagem publica, criacao, participacao e moderacao em endpoints legados separados
- parar de usar chamadas cruas de rankings no `DataContext`
- consolidar uma fachada oficial de frontend para o dominio

#### Mudancas implementadas nesta rodada
- Criado o modulo `rankings` no backend:
  - [C:\xampp\htdocs\questao-pro-backend\modules\rankings\controllers\RankingsController.php](C:\xampp\htdocs\questao-pro-backend\modules\rankings\controllers\RankingsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\rankings\services\RankingsService.php](C:\xampp\htdocs\questao-pro-backend\modules\rankings\services\RankingsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\rankings\repositories\RankingsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\rankings\repositories\RankingsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\rankings\validators\RankingsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\rankings\validators\RankingsValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\rankings\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\rankings\routes.php)
- Ajustado os endpoints legados para apenas delegarem ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\list.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\list.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\create.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\create.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\join.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\join.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\moderate.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\moderate.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\update.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\update.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\rankings\delete.php](C:\xampp\htdocs\questao-pro-backend\api\rankings\delete.php)
- Criada a fachada oficial de frontend:
  - [C:\dev\concursomestre\src\services\rankings\rankingsService.ts](C:\dev\concursomestre\src\services\rankings\rankingsService.ts)
  - [C:\dev\concursomestre\src\services\rankings\index.ts](C:\dev\concursomestre\src\services\rankings\index.ts)
- Consumidor principal migrado:
  - [C:\dev\concursomestre\context\DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
- Adicionado teste de regressao do dominio:
  - [C:\dev\concursomestre\src\services\rankings\__tests__\rankingsService.test.ts](C:\dev\concursomestre\src\services\rankings\__tests__\rankingsService.test.ts)

#### Resultado da rodada
- o dominio de rankings deixou de depender de varios arquivos procedurais isolados sem separacao clara de responsabilidade
- o `DataContext` passou a usar uma camada oficial para listar rankings, criar ranking, enviar gabarito e moderar ranking
- a regra de `list` continua respeitando o comportamento antigo: admin enxerga pendentes, usuario comum recebe apenas rankings aprovados
- o backend agora trata o dominio inteiro de rankings com repositorio, service, controller e rotas centralizadas

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npx vitest run src/services/rankings/__tests__/rankingsService.test.ts`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/rankings/list.php`
  - `api/rankings/create.php`
  - `api/rankings/join.php`
  - `api/rankings/moderate.php`
  - `api/rankings/update.php`
  - `api/rankings/delete.php`
  - `modules/rankings/routes.php`
  - `modules/rankings/controllers/RankingsController.php`
  - `modules/rankings/services/RankingsService.php`
  - `modules/rankings/repositories/RankingsRepository.php`
  - `modules/rankings/validators/RankingsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance`, `admin cache`, o modulo `filters` e agora o modulo `rankings` modularizados

#### Proximo passo recomendado
- seguir para o proximo dominio ativo do painel com impacto alto, como materiais/marketplace administrativo
- ou voltar a Fase 3/4 para continuar reduzindo o peso de `pages/Admin.tsx` e `context/DataContext.tsx`

### Expansao da Fase 5 - modularizacao completa do dominio de materiais/marketplace

#### Objetivo desta rodada
- modularizar o dominio `materials`, que ainda concentrava listagem, CRUD, moderacao e avaliacao em endpoints legados soltos
- parar de usar chamadas cruas de materiais no `MarketplaceContext` e no `Marketplace`
- criar uma fachada oficial em `src/services/marketplace`

#### Mudancas implementadas nesta rodada
- Criado o modulo `materials` no backend:
  - [C:\xampp\htdocs\questao-pro-backend\modules\materials\controllers\MaterialsController.php](C:\xampp\htdocs\questao-pro-backend\modules\materials\controllers\MaterialsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\materials\services\MaterialsService.php](C:\xampp\htdocs\questao-pro-backend\modules\materials\services\MaterialsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\materials\repositories\MaterialsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\materials\repositories\MaterialsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\materials\validators\MaterialsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\materials\validators\MaterialsValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\materials\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\materials\routes.php)
- Ajustados os endpoints legados para apenas delegarem ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\list.php](C:\xampp\htdocs\questao-pro-backend\api\materials\list.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\create.php](C:\xampp\htdocs\questao-pro-backend\api\materials\create.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\update.php](C:\xampp\htdocs\questao-pro-backend\api\materials\update.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\moderate.php](C:\xampp\htdocs\questao-pro-backend\api\materials\moderate.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\delete.php](C:\xampp\htdocs\questao-pro-backend\api\materials\delete.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\materials\rate.php](C:\xampp\htdocs\questao-pro-backend\api\materials\rate.php)
- Criada a fachada oficial de frontend:
  - [C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts](C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts)
  - [C:\dev\concursomestre\src\services\marketplace\index.ts](C:\dev\concursomestre\src\services\marketplace\index.ts)
- Mantido um bridge de compatibilidade para o caminho legado:
  - [C:\dev\concursomestre\src\features\marketplace\services\marketplaceService.ts](C:\dev\concursomestre\src\features\marketplace\services\marketplaceService.ts)
- Consumidores principais migrados:
  - [C:\dev\concursomestre\context\MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx)
  - [C:\dev\concursomestre\pages\Marketplace.tsx](C:\dev\concursomestre\pages\Marketplace.tsx)
- Adicionado teste de regressao do dominio:
  - [C:\dev\concursomestre\src\services\marketplace\__tests__\marketplaceService.test.ts](C:\dev\concursomestre\src\services\marketplace\__tests__\marketplaceService.test.ts)

#### Resultado da rodada
- o dominio de materiais passou a respeitar a sessao oficial do backend, sem decode manual espalhado
- a regra de visibilidade ficou centralizada: anonimo ve apenas aprovados, usuario autenticado ve aprovados + proprios materiais, admin ve tudo
- CRUD, moderacao, avaliacao e hidratacao de comentarios passaram a viver em um modulo proprio do backend
- `MarketplaceContext` e `Marketplace.tsx` deixaram de depender diretamente de endpoints de materiais nas acoes principais

#### Validacao executada nesta rodada
- `npm run build`
- `npm run test:admin`
- `npx vitest run src/services/marketplace/__tests__/marketplaceService.test.ts`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/materials/list.php`
  - `api/materials/create.php`
  - `api/materials/update.php`
  - `api/materials/moderate.php`
  - `api/materials/delete.php`
  - `api/materials/rate.php`
  - `modules/materials/routes.php`
  - `modules/materials/controllers/MaterialsController.php`
  - `modules/materials/services/MaterialsService.php`
  - `modules/materials/repositories/MaterialsRepository.php`
  - `modules/materials/validators/MaterialsValidator.php`

### Expansao da Fase 5 - modularizacao das mutacoes do dominio de transacoes

#### Objetivo desta rodada
- modularizar o fluxo de compra direta de materiais e o ciclo de estorno, que ainda estavam em endpoints procedurais com autenticacao legada
- criar uma fachada oficial de `transactions` no frontend
- remover o acoplamento do `MarketplaceContext` com criacao direta de transacao e estorno por endpoint cru

#### Mudancas implementadas nesta rodada
- Criado o modulo `transactions` no backend para mutacoes:
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\controllers\TransactionsController.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\controllers\TransactionsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsService.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\repositories\TransactionsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\repositories\TransactionsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\validators\TransactionsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\validators\TransactionsValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\routes.php)
- Ajustados os endpoints legados para apenas delegarem ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\create.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\create.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\refund.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\refund.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\approve_refund.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\approve_refund.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\reject_refund.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\reject_refund.php)
- Criada a fachada oficial de frontend:
  - [C:\dev\concursomestre\src\services\transactions\transactionsService.ts](C:\dev\concursomestre\src\services\transactions\transactionsService.ts)
  - [C:\dev\concursomestre\src\services\transactions\index.ts](C:\dev\concursomestre\src\services\transactions\index.ts)
- Alinhados os consumidores principais:
  - [C:\dev\concursomestre\context\MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx)
  - [C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts](C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts)
  - [C:\dev\concursomestre\src\core\api\endpoints.ts](C:\dev\concursomestre\src\core\api\endpoints.ts)
- Adicionado teste de regressao do dominio:
  - [C:\dev\concursomestre\src\services\transactions\__tests__\transactionsService.test.ts](C:\dev\concursomestre\src\services\transactions\__tests__\transactionsService.test.ts)

#### Resultado da rodada
- a compra direta de materiais passou a usar a sessao oficial do backend, sem depender de `JWTAuth` manual no endpoint
- a solicitacao de reembolso e a decisao administrativa de estorno passaram a usar validacao centralizada e auditoria administrativa
- `MarketplaceContext` deixou de criar compras e resolver estornos via endpoint cru
- o dominio de transacoes ficou preparado para a proxima rodada, que pode mover tambem a listagem paginada para o mesmo modulo

#### Validacao executada nesta rodada
- `npm run build`
- `npx vitest run src/services/transactions/__tests__/transactionsService.test.ts`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/transactions/create.php`
  - `api/transactions/refund.php`
  - `api/transactions/approve_refund.php`
  - `api/transactions/reject_refund.php`
  - `modules/transactions/routes.php`
  - `modules/transactions/controllers/TransactionsController.php`
  - `modules/transactions/services/TransactionsService.php`
  - `modules/transactions/repositories/TransactionsRepository.php`
  - `modules/transactions/validators/TransactionsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance`, `admin cache`, os modulos `filters`, `rankings`, `materials` e agora as mutacoes do dominio `transactions` modularizados

#### Proximo passo recomendado
- continuar a Fase 5 levando a listagem paginada de transacoes para o modulo `transactions`
- ou seguir para o proximo dominio comercial ativo, como pagamentos/assinaturas ou aprofundar a extracao de responsabilidades ainda concentradas em `MarketplaceContext`
### Expansao da Fase 5 - modularizacao da listagem paginada do dominio de transacoes

#### Objetivo desta rodada
- retirar a listagem paginada de transacoes do endpoint legado procedural
- manter o contrato atual de `rows`, `pagination` e `stats` sem quebrar o frontend
- consolidar tambem a projecao de parcelas Stripe e a hidratacao de invoices dentro do modulo `transactions`

#### Mudancas implementadas nesta rodada
- Expandido o modulo `transactions` no backend para leitura paginada:
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\controllers\TransactionsController.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\controllers\TransactionsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsService.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\repositories\TransactionsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\repositories\TransactionsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\validators\TransactionsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\validators\TransactionsValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\transactions\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\transactions\routes.php)
- O endpoint legado agora apenas delega ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\transactions\list.php](C:\xampp\htdocs\questao-pro-backend\api\transactions\list.php)

#### Resultado da rodada
- a listagem de transacoes agora vive no mesmo dominio modular das mutacoes de compra e estorno
- a regra de filtros, paginação, totais financeiros, projecao de parcelas Stripe e hidratacao de invoice PDF/hosted invoice saiu do endpoint legado
- o contrato da resposta foi preservado, entao o frontend continua consumindo `rows`, `pagination` e `stats` sem adaptacao extra
- o dominio `transactions` ficou praticamente fechado ponta a ponta dentro da nova arquitetura

#### Validacao executada nesta rodada
- `npm run build`
- `npx vitest run src/services/transactions/__tests__/transactionsService.test.ts`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/transactions/list.php`
  - `modules/transactions/routes.php`
  - `modules/transactions/services/TransactionsService.php`
  - `modules/transactions/repositories/TransactionsRepository.php`
  - `modules/transactions/validators/TransactionsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance`, `admin cache`, os modulos `filters`, `rankings`, `materials` e agora o dominio `transactions` modularizado em leitura e escrita

#### Proximo passo recomendado
- seguir para o proximo dominio comercial ativo, como pagamentos/assinaturas
- ou reduzir o peso residual de `MarketplaceContext` e `DataContext` agora que marketplace e transacoes ja contam com fachadas oficiais mais maduras
### Expansao da Fase 5 - modularizacao inicial do dominio de subscriptions

#### Objetivo desta rodada
- iniciar a modularizacao do dominio `subscriptions` por um slice de baixo risco e uso real
- retirar `update_renewal` e `create_stripe_portal` dos endpoints procedurais
- abrir a fachada oficial de frontend para gestao de assinatura em `src/services/subscriptions`

#### Mudancas implementadas nesta rodada
- Criado o modulo `subscriptions` no backend:
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php)
- Ajustados os endpoints legados para apenas delegarem ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\update_renewal.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\update_renewal.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\create_stripe_portal.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\create_stripe_portal.php)
- Criada a fachada oficial de frontend:
  - [C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts](C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts)
  - [C:\dev\concursomestre\src\services\subscriptions\index.ts](C:\dev\concursomestre\src\services\subscriptions\index.ts)
- O bridge legado de planos passou a delegar para a fachada oficial nos dois fluxos migrados:
  - [C:\dev\concursomestre\src\features\plans\services\planService.ts](C:\dev\concursomestre\src\features\plans\services\planService.ts)
- Adicionado teste de regressao do dominio:
  - [C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts](C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts)

#### Resultado da rodada
- a atualizacao de renovacao automatica saiu do endpoint procedural e passou a usar sessao oficial, validacao central e integracoes Stripe/Mercado Pago encapsuladas no modulo
- a abertura do portal Stripe deixou de depender de `JWTAuth` manual e passou a usar a camada oficial de autenticacao do backend
- o frontend ganhou a primeira fachada oficial do dominio `subscriptions`, reduzindo o acoplamento direto do `planService` com endpoints legados
- a migracao ficou baixa em risco porque preserva os contratos atuais usados pela tela de perfil

#### Validacao executada nesta rodada
- `npm run build`
- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/subscriptions/update_renewal.php`
  - `api/subscriptions/create_stripe_portal.php`
  - `modules/subscriptions/routes.php`
  - `modules/subscriptions/controllers/SubscriptionsController.php`
  - `modules/subscriptions/services/SubscriptionsService.php`
  - `modules/subscriptions/repositories/SubscriptionsRepository.php`
  - `modules/subscriptions/validators/SubscriptionsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento, com `subscriptions` agora tambem contando com fachada oficial de frontend
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance`, `admin cache`, os modulos `filters`, `rankings`, `materials`, o dominio `transactions` em leitura e escrita e o inicio do modulo `subscriptions`

#### Proximo passo recomendado
- continuar o modulo `subscriptions` pelos proximos fluxos de baixo risco, como `cancel.php` ou `validate_coupon.php`
- ou voltar para a Fase 3/4 reduzindo o peso residual de `Profile.tsx`, `MarketplaceContext.tsx` e `DataContext.tsx` agora que os dominios principais ja contam com fachadas oficiais mais maduras
### Expansao da Fase 5 - cancelamento e validacao de cupom no dominio de subscriptions

#### Objetivo desta rodada
- continuar o modulo `subscriptions` por dois fluxos ativos e de baixo risco: `cancel.php` e `validate_coupon.php`
- tirar a regra de cancelamento do endpoint procedural sem alterar a experiencia da tela de perfil
- tirar a validacao de cupom do endpoint procedural preservando o contrato esperado pelo checkout

#### Mudancas implementadas nesta rodada
- Expandido o modulo `subscriptions` no backend:
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php)
  - [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php)
- Ajustados os endpoints legados para apenas delegarem ao modulo:
  - [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cancel.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cancel.php)
  - [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\validate_coupon.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\validate_coupon.php)
- Expandida a fachada oficial de frontend:
  - [C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts](C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts)
  - [C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts](C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts)
- O bridge legado de planos passou a delegar tambem o cancelamento:
  - [C:\dev\concursomestre\src\features\plans\services\planService.ts](C:\dev\concursomestre\src\features\plans\services\planService.ts)

#### Resultado da rodada
- o cancelamento da assinatura passou a usar sessao oficial, validacao central, reCAPTCHA e encapsulamento de notificacao/e-mail dentro do modulo `subscriptions`
- a regra de reembolso automatico no cancelamento ficou fora do endpoint legado e dentro da camada de servico do dominio
- a validacao de cupom saiu do endpoint procedural, mas manteve o comportamento esperado pelo checkout ao continuar retornando um resultado controlado para cupom invalido
- a fachada `subscriptionsService` passou a normalizar o contrato para preservar o comportamento atual do perfil e do checkout

#### Validacao executada nesta rodada
- `npm run build`
- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run test:admin`
- `npm run test:auth`
- `C:\xampp\php\php.exe -l` em:
  - `api/subscriptions/cancel.php`
  - `api/subscriptions/validate_coupon.php`
  - `modules/subscriptions/routes.php`
  - `modules/subscriptions/controllers/SubscriptionsController.php`
  - `modules/subscriptions/services/SubscriptionsService.php`
  - `modules/subscriptions/repositories/SubscriptionsRepository.php`
  - `modules/subscriptions/validators/SubscriptionsValidator.php`

#### Estado atual das fases
1. Fase 0 - concluida
2. Fase 1 - concluida
3. Fase 2 - concluida
4. Fase 3 - em andamento
5. Fase 4 - em andamento, com `subscriptions` agora cobrindo cupom, portal, renovacao e cancelamento na fachada oficial
6. Fase 5 - em andamento, com os slices `system logs`, `feedback`, `report moderation`, `admin stats`, `user details`, `user actions`, `database maintenance`, `admin cache`, os modulos `filters`, `rankings`, `materials`, o dominio `transactions` em leitura e escrita e o modulo `subscriptions` cobrindo os fluxos de gestao mais ativos da conta

#### Proximo passo recomendado
- continuar o modulo `subscriptions` pelos fluxos mais sensiveis do checkout, como `create_stripe_checkout.php` ou `create_stripe_subscription.php`
- ou reduzir o peso residual de `Profile.tsx` e `CheckoutPage.tsx` agora que o dominio de assinatura ja possui fachada oficial mais completa
## 2026-04-01 23:43 - Fase 5: subscriptions (checkout hospedado e criacao inline)

### Objetivo
Remover a criacao Stripe de create_stripe_checkout.php e create_stripe_subscription.php do fluxo procedural, levando a regra principal para modules/subscriptions e preservando o contrato ja consumido pelo checkout React.

### Alteracoes aplicadas
- Expandi modules/subscriptions com dois novos fluxos oficiais: handleSubscriptionsStripeCheckoutRoute(...) e handleSubscriptionsStripeInlineRoute(...) em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php.
- Adicionei no controller os metodos createStripeCheckoutSession(...) e createStripeInlineSubscription(...) em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php.
- ExtraI a regra compartilhada de criacao Stripe para C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php, incluindo:
  - validacao consolidada do contexto de checkout Stripe;
  - ativacao por credito interno quando o valor final zera;
  - montagem padronizada de metadata Stripe;
  - criacao do cupom tecnico da primeira cobranca;
  - resolucao/anexo do metodo de pagamento no fluxo inline;
  - persistencia local da assinatura pendente Stripe.
- Ampliei o repositorio com leitura padronizada de plano e perfil Stripe do usuario em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php.
- Ampliei o validator com payloads oficiais para checkout Stripe hospedado e fluxo interno em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php.
- Os endpoints legados agora apenas delegam:
  - C:\xampp\htdocs\questao-pro-backend\api\subscriptions\create_stripe_checkout.php
  - C:\xampp\htdocs\questao-pro-backend\api\subscriptions\create_stripe_subscription.php
- No frontend, a fachada oficial de assinaturas passou a cobrir criacao de checkout, criacao inline e finalizacao em C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts.
- O bridge legado de planos agora delega esses fluxos para a fachada oficial em C:\dev\concursomestre\src\features\plans\services\planService.ts.
- Adicionei regressao da fachada em C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts.

### Ganhos arquiteturais
- Os dois pontos mais duplicados do checkout Stripe deixaram de depender de JWT manual nos endpoints.
- A regra de criacao de assinatura Stripe ficou centralizada no modulo subscriptions, reduzindo divergencia entre checkout hospedado e fluxo inline.
- O frontend passou a consumir um unico ponto oficial do dominio de assinaturas, em vez de falar direto com endpoints de criacao.

### Validacao
- 
pm run build
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run test:admin
- 
pm run test:auth
- php -l em modules/subscriptions/* e nos endpoints delegados create_stripe_checkout.php e create_stripe_subscription.php

### Proximo passo natural
Extrair inalize_stripe_subscription.php para o mesmo modulo, fechando o ciclo Stripe completo dentro de modules/subscriptions.
## 2026-04-01 23:48 - Fase 5: subscriptions (finalizacao Stripe)

### Objetivo
Fechar o ciclo Stripe do dominio subscriptions, levando inalize_stripe_subscription.php para o modulo oficial e removendo a confirmacao procedural do backend.

### Alteracoes aplicadas
- Expandi C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php com handleSubscriptionsStripeFinalizeRoute(...).
- Adicionei inalizeStripeSubscription(...) em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php.
- ExtraI a finalizacao Stripe para C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php, incluindo:
  - recuperacao e validacao da assinatura Stripe do usuario;
  - verificacao de ownership entre subscription, customer e payment_intent;
  - validacao antifraude via stripe_payment_validator.php;
  - bloqueio com 422 padronizado quando a aprovacao antifraude falha;
  - sincronizacao final da assinatura local;
  - persistencia da primeira transacao/invoice Stripe;
  - sincronizacao do cartao salvo e do lock de recorrencia;
  - atualizacao do plano ativo do usuario.
- Ampliei o repositorio em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php com operacoes de leitura e persistencia usadas na finalizacao.
- Ampliei o validator em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php com o payload oficial de finalizacao Stripe.
- O endpoint legado C:\xampp\htdocs\questao-pro-backend\api\subscriptions\finalize_stripe_subscription.php agora apenas delega para o modulo.

### Ganhos arquiteturais
- O ciclo principal de checkout Stripe do app ficou concentrado em modules/subscriptions.
- A camada de rota agora decide explicitamente entre success e alidationError, sem espalhar resposta antifraude por endpoint legado.
- A confirmacao final deixou de depender de JWT manual e helpers locais no endpoint procedural.

### Validacao
- 
pm run build
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run test:admin
- 
pm run test:auth
- php -l em modules/subscriptions/* e no endpoint delegado inalize_stripe_subscription.php

### Proximo passo natural
Seguir para o proximo slice sensivel do dominio comercial: webhook Stripe/subscriptions ou reduzir o peso residual dos contexts legados agora que subscriptions, 	ransactions e marketplace ja possuem fachadas mais maduras.
## 2026-04-01 23:58 - Fase 5: subscriptions (webhook Stripe)

### Objetivo
Levar o webhook Stripe de assinaturas para o modulo oficial subscriptions, removendo o endpoint procedural que ainda concentrava sincronizacao de checkout, invoices, renovacao, antifraude e refund webhooks.

### Alteracoes aplicadas
- Expandi C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php com handleSubscriptionsStripeWebhookRoute(...), preservando o comportamento HTTP do webhook (200 com eceived: true e erro controlado em falha).
- Adicionei processStripeWebhook(...) em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php.
- ExtraI o processamento do webhook para C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php, incluindo os eventos:
  - checkout.session.completed
  - invoice.paid
  - invoice.payment_failed
  - customer.subscription.updated
  - customer.subscription.deleted
  - charge.refunded
- O servico agora centraliza:
  - sincronizacao da assinatura Stripe vinda do webhook;
  - atualizacao do acesso do usuario;
  - progressao de parcelas/termo contratado;
  - registro da invoice paga no historico local;
  - tratamento antifraude no invoice.paid;
  - notificacoes e e-mails do ciclo Stripe;
  - sincronizacao de reembolso via charge.refunded.
- Ampliei o repositorio em C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php com leitura por provider_subscription_id.
- O endpoint legado C:\xampp\htdocs\questao-pro-backend\api\subscriptions\stripe_webhook.php agora apenas delega para o modulo.

### Ganhos arquiteturais
- O ciclo principal Stripe do app ficou concentrado em modules/subscriptions: criacao hospedada, criacao inline, finalizacao, portal, renovacao, cancelamento, cupom e webhook.
- O endpoint legado deixou de concentrar validacao, sincronizacao de invoice, antifraude e atualizacao de acesso no mesmo arquivo procedural.
- O webhook passou a seguir a mesma linha arquitetural dos demais fluxos sensiveis do dominio de assinaturas.

### Validacao
- php -l em modules/subscriptions/* e pi/subscriptions/stripe_webhook.php
- 
pm run build
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run test:admin
- 
pm run test:auth

### Proximo passo natural
Continuar a Fase 5 pelo proximo dominio comercial ainda parcialmente legado, ou usar a maturidade das fachadas oficiais para reduzir o peso residual de DataContext.tsx e MarketplaceContext.tsx.
## 2026-04-01 - Fase 4/5: Desacoplamento do MarketplaceContext

### Objetivo
Reduzir o peso residual do MarketplaceContext agora que as fachadas oficiais de marketplace, transacoes e comentarios ja estao maduras, deixando o contexto mais proximo de orquestracao e estado de dominio.

### Problemas encontrados
- O MarketplaceContext ainda fazia upload cru com piClient.post('upload.php'), conhecendo detalhes HTTP do endpoint legado.
- A carga administrativa de transacoes ainda dependia diretamente de 	ransactionsService, fora da fachada principal de marketplace.
- A compra de material e a curtida de comentarios misturavam estado local com chamadas HTTP de baixo nivel dentro do contexto.
- Havia mapeamentos imutaveis repetidos para materiais e transacoes, o que aumentava ruído e risco de divergencia em futuras mutacoes.

### Alteracoes realizadas
- Ampliei [src/services/marketplace/marketplaceService.ts](C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts) com:
  - listTransactions(...)
  - createMaterialPurchase(...)
  - uploadFile(...)
- Atualizei [context/MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx) para consumir a fachada oficial de marketplace na leitura administrativa de transacoes, compra de material e upload de arquivos.
- Centralizei os mapeamentos imutaveis do contexto com helpers locais para materiais e transacoes, reduzindo duplicacao de transformacoes.
- Ajustei [src/features/comments/services/commentService.ts](C:\dev\concursomestre\src\features\comments\services\commentService.ts) para que a curtida de comentarios use o contrato real do backend via commentsHandle, eliminando mais uma chamada HTTP crua no contexto.
- Ampliei a regressao de [src/services/marketplace/__tests__/marketplaceService.test.ts](C:\dev\concursomestre\src\services\marketplace\__tests__\marketplaceService.test.ts) para cobrir listagem de transacoes, compra com retorno de transacao e normalizacao de upload.

### Resultado tecnico
O MarketplaceContext ficou mais fino e mais previsivel: agora ele orquestra notificacoes, atualizacao otimista e sincronizacao de estado, enquanto a camada src/services/marketplace concentra a conversa com os contratos HTTP do dominio.
## 2026-04-01 - Fase 3: Provider oficial de marketplace

### Objetivo
Concluir mais um passo da migracao para a arquitetura congelada, fazendo src/providers/MarketplaceProvider.tsx deixar de ser apenas reexport e passar a ser a implementacao oficial do dominio.

### Alteracoes realizadas
- Transformei [src/providers/MarketplaceProvider.tsx](C:\dev\concursomestre\src\providers\MarketplaceProvider.tsx) no provider real do marketplace, com comentarios em pt-BR e dependencias alinhadas a @providers/* e @services/*.
- Converti [context/MarketplaceContext.tsx](C:\dev\concursomestre\context\MarketplaceContext.tsx) em bridge legado minimalista, preservando compatibilidade com imports antigos durante a migracao.
- Mantive o contrato publico MarketplaceProvider/useMarketplace, entao as telas continuam estaveis enquanto a estrutura interna passa a obedecer a pasta oficial de providers.

### Resultado tecnico
A Fase 3 ganhou mais aderencia real a arquitetura congelada: o dominio de marketplace agora vive oficialmente em src/providers, enquanto context/ passa a atuar apenas como camada temporaria de compatibilidade.
## 2026-04-02 - Fase 4/3: Reducao do slice de comentarios no DataContext

### Objetivo
Reduzir o acoplamento residual do DataContext no dominio de comentarios, movendo leitura, curtida, exclusao e denuncia para a camada oficial de servicos.

### Problemas encontrados
- O DataContext ainda fazia chamadas HTTP cruas para comentar, curtir, excluir, denunciar e carregar comentarios.
- O dominio de comentarios tinha uma fachada parcial, mas o contexto continuava conhecendo detalhes de payload e endpoints.
- O fluxo de progresso do usuario ainda buscava comentarios diretamente via piClient, mesmo ja existindo um dominio de comentarios reutilizavel.

### Alteracoes realizadas
- Reescrevi [src/features/comments/services/commentService.ts](C:\dev\concursomestre\src\features\comments\services\commentService.ts) como fachada completa do dominio, cobrindo:
  - getComments(...)
  - getUserComments(...)
  - ddComment(...)
  - likeComment(...)
  - eportComment(...)
  - deleteComment(...)
- Atualizei [context/DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx) para consumir commentService em:
  - ensureUserProgressLoaded
  - ddComment
  - likeComment
  - eportComment
  - etchComments
  - etchUserComments
  - deleteComment
- Adicionei regressao dedicada em [src/services/comments/__tests__/commentsService.test.ts](C:\dev\concursomestre\src\services\comments\__tests__\commentsService.test.ts).

### Resultado tecnico
O DataContext ficou menos acoplado ao backend no dominio de comentarios e mais coerente com a arquitetura congelada: o contexto agora orquestra estado e feedback visual, enquanto a camada de servicos centraliza contratos HTTP e normalizacao de resposta.
## 2026-04-02 - Fase 4: Reducao do slice users/reports/settings no DataContext

### Objetivo
Remover mais um bloco de leituras cruas do DataContext, alinhando users, eports e system settings com a camada oficial de servicos.

### Problemas encontrados
- O DataContext ainda fazia piClient.get(...) direto para usersList, eportsList e /settings.php.
- O slice administrativo e o slice de configuracoes ainda nao passavam por uma fachada oficial, o que mantinha detalhes de payload e resposta dentro do contexto.
- O carregamento lazy de usuarios e denuncias estava correto funcionalmente, mas ainda fora da arquitetura congelada.

### Alteracoes realizadas
- Ampliei [src/services/admin/adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts) com:
  - getSystemSettings()
  - getUsers()
  - getReports()
- Atualizei [context/DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx) para consumir essas fachadas em:
  - ensureUsersLoaded
  - ensureReportsLoaded
  - bootstrap inicial de system settings
- Expandi a regressao de [src/services/admin/__tests__/adminService.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts) para cobrir os novos contratos.

### Resultado tecnico
O DataContext ficou mais fino em mais um slice relevante: leituras de usuarios, denuncias e configuracoes do sistema agora passam pela camada oficial de servicos, deixando o contexto mais proximo de orquestracao de estado e menos dependente de detalhes HTTP.
## 2026-04-02 - Fase 4: Reducao do slice questions/progress no DataContext

### Objetivo
Tirar do DataContext o bloco de respostas, exclusao, reset, salvos e paginação incremental de questoes, alinhando o dominio a uma fachada oficial de servicos.

### Problemas encontrados
- O DataContext ainda persistia respostas, reset de progresso, paginação incremental e salvos via chamadas HTTP cruas.
- O dominio de questoes ainda carregava um desvio legado: atualizacao de questao usando createQuestions([payload]).
- O servico de questoes nao refletia completamente o contrato real do backend, especialmente em update, delete, toggle de salvos e reset de respostas.

### Alteracoes realizadas
- Reescrevi [src/features/questions/services/questionService.ts](C:\dev\concursomestre\src\features\questions\services\questionService.ts) para cobrir:
  - getQuestionPage(...)
  - submitUserAnswer(...)
  - updateQuestion(...) usando o endpoint real de save com id
  - deleteQuestion(...)
  - 	oggleSavedQuestion(...)
  - esetAnswers(...)
- Atualizei [context/DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx) para usar essa camada em:
  - bootstrap inicial de questoes
  - submitAnswer
  - updateQuestion
  - deleteQuestion
  - 	oggleSaveQuestion
  - esetAnswers
  - etchMoreQuestions
- Corrigi o fluxo de update de questao, removendo o uso inadequado de createQuestions([payload]) para edicao.
- Adicionei regressao dedicada em [src/services/questions/__tests__/questionService.test.ts](C:\dev\concursomestre\src\services\questions\__tests__\questionService.test.ts).

### Resultado tecnico
O DataContext perdeu mais um bloco grande de integrações cruas e o dominio de questoes ficou muito mais consistente com o backend real. Isso melhora a arquitetura e corrige um fluxo legado frágil de atualizacao/exclusao ao mesmo tempo.## 2026-04-02 - Fase 4: Reducao do slice answers/notes no DataContext

### Objetivo
Eliminar os dois ultimos carregamentos crus de progresso do usuario dentro do DataContext, alinhando respostas e anotacoes com uma fachada oficial de servicos.

### Problemas encontrados
- O DataContext ainda chamava apiClient.get(...) direto para /users/answers.php e /users/notes.php.
- O contexto ainda conhecia detalhes de payload e normalizacao de notas de questoes.
- O endpoint de notes ainda nao tinha mapeamento oficial em ENDPOINTS.users.

### Alteracoes realizadas
- Adicionei users.notes em [src/core/api/endpoints.ts](C:\dev\concursomestre\src\core\api\endpoints.ts).
- Criei a fachada oficial [src/services/progress/userProgressService.ts](C:\dev\concursomestre\src\services\progress\userProgressService.ts) com:
  - getUserAnswers(...)
  - getUserQuestionNotes(...)
- Adicionei a porta publica [src/services/progress/index.ts](C:\dev\concursomestre\src\services\progress\index.ts).
- Atualizei [context/DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx) para consumir userProgressService em ensureUserProgressLoaded.
- Removi o uso residual de apiClient e ENDPOINTS do DataContext nesse slice.
- Adicionei regressao dedicada em [src/services/progress/__tests__/userProgressService.test.ts](C:\dev\concursomestre\src\services\progress\__tests__\userProgressService.test.ts).

### Resultado tecnico
O DataContext deixou de fazer chamadas HTTP cruas para progresso do usuario. Respostas e anotacoes agora passam por uma fachada unica, com normalizacao centralizada e contrato mais previsivel. Isso reduz ainda mais o acoplamento do contexto com o backend e aproxima o frontend da arquitetura congelada.## 2026-04-02 - Fase 4: Reducao do hotspot do AuthContext

### Objetivo
Remover chamadas HTTP diretas do AuthContext, mantendo o fluxo de sessao estavel e deslocando mutacoes de perfil, notificacoes de XP e persistencia de simulados para fachadas oficiais.

### Problemas encontrados
- O AuthContext ainda chamava apiClient/ENDPOINTS diretamente para atualizar perfil, promover parceiro, salvar simulados e enviar notificacoes de XP/level up.
- O contexto de autenticacao ainda misturava sessao, estado local e integracao HTTP no mesmo arquivo.
- O dominio de simulados ainda nao tinha fachada oficial em src/services.

### Alteracoes realizadas
- Criei [src/services/auth/accountService.ts](C:\dev\concursomestre\src\services\auth\accountService.ts) com:
  - updateUserProfile(...)
  - becomePartner()
- Expandi [src/services/auth/index.ts](C:\dev\concursomestre\src\services\auth\index.ts) para exportar accountService.
- Criei [src/services/simulations/simulationsService.ts](C:\dev\concursomestre\src\services\simulations\simulationsService.ts) e [src/services/simulations/index.ts](C:\dev\concursomestre\src\services\simulations\index.ts).
- Atualizei [context/AuthContext.tsx](C:\dev\concursomestre\context\AuthContext.tsx) para:
  - usar accountService em updateUser e becomePartner
  - usar notificationService para notificacoes de XP e level up
  - usar questionService no toggle de salvos
  - usar simulationsService em addSimulation
- Adicionei regressao em:
  - [src/services/auth/__tests__/accountService.test.ts](C:\dev\concursomestre\src\services\auth\__tests__\accountService.test.ts)
  - [src/services/simulations/__tests__/simulationsService.test.ts](C:\dev\concursomestre\src\services\simulations\__tests__\simulationsService.test.ts)

### Resultado tecnico
O AuthContext deixou de depender diretamente da camada HTTP. Agora ele volta a cumprir melhor o papel de orquestrador de sessao e estado local, enquanto perfil, notificacoes e simulados passam por servicos oficiais alinhados com a arquitetura congelada.## 2026-04-02 - Fase 2: Migracao estrutural de checkout e plans para src/app

### Objetivo
Reduzir a dependencia de src/pages/* nos entry points da arquitetura nova, começando pelos dois fluxos mais importantes ja apoiados por src/app: checkout e planos.

### Problemas encontrados
- [src/app/checkout/page.tsx](C:\dev\concursomestre\src\app\checkout\page.tsx) e [src/app/plans/page.tsx](C:\dev\concursomestre\src\app\plans\page.tsx) ainda eram wrappers simples para src/pages/*.
- As implementacoes reais de checkout e planos ainda nao estavam co-localizadas com seus entry points oficiais.
- Os imports desses modulos ainda usavam caminhos relativos legados, menos consistentes com a arquitetura congelada.

### Alteracoes realizadas
- Copiei a implementacao real para dentro de:
  - [src/app/checkout/CheckoutPage.tsx](C:\dev\concursomestre\src\app\checkout\CheckoutPage.tsx)
  - [src/app/plans/PlansPage.tsx](C:\dev\concursomestre\src\app\plans\PlansPage.tsx)
- Atualizei os entry points:
  - [src/app/checkout/page.tsx](C:\dev\concursomestre\src\app\checkout\page.tsx)
  - [src/app/plans/page.tsx](C:\dev\concursomestre\src\app\plans\page.tsx)
  para apontarem para as implementacoes locais do dominio.
- Padronizei imports dos novos modulos usando aliases oficiais como @types e @features/*.
- Transformei os arquivos antigos em bridges minimas de compatibilidade:
  - [src/pages/CheckoutPage.tsx](C:\dev\concursomestre\src\pages\CheckoutPage.tsx)
  - [src/pages/PlansPage.tsx](C:\dev\concursomestre\src\pages\PlansPage.tsx)

### Resultado tecnico
Checkout e planos passaram a existir fisicamente dentro de src/app, com entry point e implementacao no mesmo dominio. Isso reduz a dependencia de src/pages/*, melhora a navegacao da arquitetura e preserva compatibilidade com imports antigos durante a migracao gradual.## 2026-04-02 - Fase 2: Migracao estrutural de practice e simulation para src/app

### Objetivo
Continuar reduzindo a dependencia de pages/* nos entry points da arquitetura nova, agora nos fluxos centrais de pratica e simulados.

### Problemas encontrados
- [src/app/practice/page.tsx](C:\dev\concursomestre\src\app\practice\page.tsx) e [src/app/simulation/page.tsx](C:\dev\concursomestre\src\app\simulation\page.tsx) ainda apontavam para pages/*.
- As implementacoes reais de pratica e simulados ainda nao estavam co-localizadas com seus entry points oficiais.
- Os imports nesses modulos ainda usavam caminhos legados fora do padrao por feature.

### Alteracoes realizadas
- Copiei a implementacao real para dentro de:
  - [src/app/practice/PracticePage.tsx](C:\dev\concursomestre\src\app\practice\PracticePage.tsx)
  - [src/app/simulation/SimulationPage.tsx](C:\dev\concursomestre\src\app\simulation\SimulationPage.tsx)
- Atualizei os entry points:
  - [src/app/practice/page.tsx](C:\dev\concursomestre\src\app\practice\page.tsx)
  - [src/app/simulation/page.tsx](C:\dev\concursomestre\src\app\simulation\page.tsx)
  para apontarem para as implementacoes locais.
- Padronizei imports relevantes desses modulos, aproximando-os da estrutura congelada.
- Transformei os arquivos antigos em bridges minimas:
  - [pages/Practice.tsx](C:\dev\concursomestre\pages\Practice.tsx)
  - [pages/Simulation.tsx](C:\dev\concursomestre\pages\Simulation.tsx)

### Resultado tecnico
Pratica e simulados agora vivem fisicamente em src/app, com entry point e implementacao no mesmo dominio. Isso reduz a dependencia da camada pages/*, melhora a navegacao do frontend e preserva compatibilidade enquanto a migracao avanca.## 2026-04-02 - Fase 2: Migracao estrutural de marketplace, notifications e reader para src/app

### Objetivo
Continuar a reducao de dependencias de pages/* dentro de src/app/*, priorizando o dominio comercial e dois entry points menores de alta relacao custo/beneficio.

### Problemas encontrados
- [src/app/marketplace/page.tsx](C:\dev\concursomestre\src\app\marketplace\page.tsx) ainda apontava para pages/Marketplace.tsx.
- [src/app/notifications/page.tsx](C:\dev\concursomestre\src\app\notifications\page.tsx) e [src/app/reader/page.tsx](C:\dev\concursomestre\src\app\reader\page.tsx) ainda eram wrappers da camada antiga.
- O marketplace ainda usava imports relativos legados incompatíveis com o novo posicionamento do arquivo.

### Alteracoes realizadas
- Copiei a implementacao real para dentro de:
  - [src/app/marketplace/MarketplacePage.tsx](C:\dev\concursomestre\src\app\marketplace\MarketplacePage.tsx)
  - [src/app/notifications/NotificationsPage.tsx](C:\dev\concursomestre\src\app\notifications\NotificationsPage.tsx)
  - [src/app/reader/ReaderPage.tsx](C:\dev\concursomestre\src\app\reader\ReaderPage.tsx)
- Atualizei os entry points:
  - [src/app/marketplace/page.tsx](C:\dev\concursomestre\src\app\marketplace\page.tsx)
  - [src/app/notifications/page.tsx](C:\dev\concursomestre\src\app\notifications\page.tsx)
  - [src/app/reader/page.tsx](C:\dev\concursomestre\src\app\reader\page.tsx)
  para apontarem para os modulos locais.
- Ajustei imports relativos do novo marketplace e padronizei os caminhos necessarios para a estrutura congelada.
- Transformei os arquivos antigos em bridges minimas:
  - [pages/Marketplace.tsx](C:\dev\concursomestre\pages\Marketplace.tsx)
  - [pages/Notifications.tsx](C:\dev\concursomestre\pages\Notifications.tsx)
  - [pages/ReaderPage.tsx](C:\dev\concursomestre\pages\ReaderPage.tsx)

### Resultado tecnico
Marketplace, notificacoes e leitor agora vivem fisicamente em src/app, com entry point e implementacao no mesmo dominio. Isso acelera a migracao da camada antiga e reduz mais um bloco relevante de dependencias diretas de pages/*.## 2026-04-02 - Fase 2: Migracao estrutural de dashboard e bank-analysis para src/app

### Objetivo
Continuar a reducao de dependencias de pages/* em src/app/*, aproveitando dois entry points de impacto alto e risco moderado para acelerar a fase sem entrar ainda no refactor pesado de perfil.

### Problemas encontrados
- [src/app/dashboard/page.tsx](C:\dev\concursomestre\src\app\dashboard\page.tsx) e [src/app/bank-analysis/page.tsx](C:\dev\concursomestre\src\app\bank-analysis\page.tsx) ainda apontavam para pages/*.
- O dashboard e o raio-x da banca ainda nao estavam co-localizados com seus entry points oficiais.
- O raio-x da banca usava imports legados de constantes/componentes e dependia de caminhos relativos da camada antiga.

### Alteracoes realizadas
- Copiei a implementacao real para dentro de:
  - [src/app/dashboard/DashboardPage.tsx](C:\dev\concursomestre\src\app\dashboard\DashboardPage.tsx)
  - [src/app/bank-analysis/BankAnalysisPage.tsx](C:\dev\concursomestre\src\app\bank-analysis\BankAnalysisPage.tsx)
- Atualizei os entry points:
  - [src/app/dashboard/page.tsx](C:\dev\concursomestre\src\app\dashboard\page.tsx)
  - [src/app/bank-analysis/page.tsx](C:\dev\concursomestre\src\app\bank-analysis\page.tsx)
  para apontarem para os modulos locais.
- Ajustei imports dos novos modulos para o posicionamento em src/app.
- Transformei os arquivos antigos em bridges minimas:
  - [pages/Dashboard.tsx](C:\dev\concursomestre\pages\Dashboard.tsx)
  - [pages/BankAnalysis.tsx](C:\dev\concursomestre\pages\BankAnalysis.tsx)

### Resultado tecnico
Dashboard e raio-x da banca agora vivem fisicamente em src/app, com entry point e implementacao no mesmo dominio. A dependencia residual de src/app para pages/* caiu para 13 entry points, reduzindo mais um bloco relevante da camada antiga.## 2026-04-02 - Fase 2: Migracao estrutural dos entry points residuais de baixo e medio risco

### Objetivo
Acelerar a Fase 2 concentrando a migracao nos entry points restantes fora dos monolitos principais, para reduzir a camada pages/* ao minimo antes de enfrentar profile e dmin.

### Alteracoes realizadas
- Internalizei em src/app os seguintes dominios e deixei bridges minimas em pages/*:
  - [src/app/changelog/ChangelogPage.tsx](C:\dev\concursomestre\src\app\changelog\ChangelogPage.tsx)
  - [src/app/confirm-email/ConfirmEmailPage.tsx](C:\dev\concursomestre\src\app\confirm-email\ConfirmEmailPage.tsx)
  - [src/app/faq/FaqPage.tsx](C:\dev\concursomestre\src\app\faq\FaqPage.tsx)
  - [src/app/landing/LandingPage.tsx](C:\dev\concursomestre\src\app\landing\LandingPage.tsx)
  - [src/app/privacy/PrivacyPolicyPage.tsx](C:\dev\concursomestre\src\app\privacy\PrivacyPolicyPage.tsx)
  - [src/app/promo/PromoLandingPage.tsx](C:\dev\concursomestre\src\app\promo\PromoLandingPage.tsx)
  - [src/app/reset-password/ResetPasswordPage.tsx](C:\dev\concursomestre\src\app\reset-password\ResetPasswordPage.tsx)
  - [src/app/terms/TermsOfUsePage.tsx](C:\dev\concursomestre\src\app\terms\TermsOfUsePage.tsx)
  - [src/app/support/SupportPage.tsx](C:\dev\concursomestre\src\app\support\SupportPage.tsx)
  - [src/app/ranking/RankingPage.tsx](C:\dev\concursomestre\src\app\ranking\RankingPage.tsx)
  - [src/app/partner-dashboard/PartnerDashboardPage.tsx](C:\dev\concursomestre\src\app\partner-dashboard\PartnerDashboardPage.tsx)
- Atualizei os respectivos page.tsx para apontarem para as implementacoes locais.
- Ajustei imports relativos necessarios em landing, ranking e partner-dashboard para refletir o novo posicionamento dos arquivos.

### Resultado tecnico
A dependencia residual de src/app para pages/* caiu de 13 para apenas 2 entry points: profile e dmin. Isso deixa a Fase 2 praticamente encerrada, restando apenas os dois modulos mais pesados e sensiveis do frontend.## 2026-04-02 - Fase 2: Migracao estrutural de profile para src/app

### Objetivo
Fechar o penultimo entry point legado do frontend dentro da Fase 2, deixando o app praticamente livre de dependencia direta de pages/* na camada src/app.

### Problemas encontrados
- [src/app/profile/page.tsx](C:\dev\concursomestre\src\app\profile\page.tsx) ainda apontava para pages/Profile.tsx.
- O perfil continuava fisicamente fora da estrutura nova, apesar de ser um dos principais fluxos do produto.
- O modulo de perfil usava poucos imports relativos legados, o que tornava a migracao estrutural viavel sem alterar a logica.

### Alteracoes realizadas
- Copiei a implementacao real para [src/app/profile/ProfilePage.tsx](C:\dev\concursomestre\src\app\profile\ProfilePage.tsx).
- Atualizei [src/app/profile/page.tsx](C:\dev\concursomestre\src\app\profile\page.tsx) para apontar para o modulo local.
- Ajustei imports do novo modulo para o posicionamento em src/app, incluindo aliases de features.
- Transformei [pages/Profile.tsx](C:\dev\concursomestre\pages\Profile.tsx) em bridge minima de compatibilidade.

### Resultado tecnico
A dependencia residual de src/app para pages/* caiu para apenas 1 entry point: dmin. Com isso, a Fase 2 fica praticamente encerrada, restando somente o monolito administrativo como ultimo caso ainda preso a pages/*.## 2026-04-02 - Fase 2: Encerramento da migracao de entry points com a internalizacao do admin

### Objetivo
Concluir a Fase 2 eliminando o ultimo entry point da camada src/app que ainda dependia diretamente de pages/*.

### Problemas encontrados
- [src/app/admin/page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) ainda apontava para pages/Admin.tsx.
- O painel administrativo, apesar de ja ter varios modulos extraidos, ainda estava fisicamente fora da estrutura oficial de entry points.
- O modulo administrativo usava poucos imports relativos legados, o que permitia uma migracao estrutural sem alterar comportamento.

### Alteracoes realizadas
- Copiei a implementacao real para [src/app/admin/AdminPage.tsx](C:\dev\concursomestre\src\app\admin\AdminPage.tsx).
- Atualizei [src/app/admin/page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) para apontar para o modulo local.
- Ajustei imports relativos do novo modulo para o posicionamento em src/app, inclusive os componentes administrativos extraidos e os componentes de layout.
- Transformei [pages/Admin.tsx](C:\dev\concursomestre\pages\Admin.tsx) em bridge minima de compatibilidade.

### Resultado tecnico
A dependencia de src/app para pages/* caiu a zero. Com isso, a Fase 2 fica concluida do ponto de vista estrutural: todos os entry points oficiais do frontend agora vivem dentro de src/app, e pages/* passa a existir apenas como camada de compatibilidade temporaria.## 2026-04-02 - Fase 3: Inversao dos providers globais pequenos

### Objetivo
Comecar a consolidacao de context/* como camada de compatibilidade, transferindo a implementacao real dos providers globais menores para src/providers/*.

### Problemas encontrados
- src/providers/ToastProvider.tsx, src/providers/ThemeProvider.tsx e src/providers/ModalProvider.tsx ainda eram apenas bridges para context/*.
- A implementacao real desses providers continuava vivendo na camada legada de contexts.
- AuthContext e DataContext ainda consumiam useToast via caminho local legado.

### Alteracoes realizadas
- Transformei os arquivos oficiais em implementacoes reais:
  - [src/providers/ToastProvider.tsx](C:\dev\concursomestre\src\providers\ToastProvider.tsx)
  - [src/providers/ThemeProvider.tsx](C:\dev\concursomestre\src\providers\ThemeProvider.tsx)
  - [src/providers/ModalProvider.tsx](C:\dev\concursomestre\src\providers\ModalProvider.tsx)
- Converti os arquivos legados em bridges minimas:
  - [context/ToastContext.tsx](C:\dev\concursomestre\context\ToastContext.tsx)
  - [context/ThemeContext.tsx](C:\dev\concursomestre\context\ThemeContext.tsx)
  - [context/ModalContext.tsx](C:\dev\concursomestre\context\ModalContext.tsx)
- Atualizei os consumidores centrais:
  - [context/AuthContext.tsx](C:\dev\concursomestre\context\AuthContext.tsx)
  - [context/DataContext.tsx](C:\dev\concursomestre\context\DataContext.tsx)
  para usarem @providers/ToastProvider em vez do caminho legado local.

### Resultado tecnico
A camada oficial de providers agora tem implementacao real para toast, tema e modal. context/* ficou menor e mais coerente com o papel de compatibilidade temporaria, o que aproxima o frontend do modelo final onde providers vivem em src/providers e contexts antigos deixam de carregar logica propria.
## 2026-04-02 - Fase 3 concluida e subscriptions cancel/refund modularizado

### Fase 3 - providers oficiais consolidados
- A implementacao real de autenticacao foi movida para C:\dev\concursomestre\src\providers\AuthProvider.tsx.
- A implementacao real de dados foi movida para C:\dev\concursomestre\src\providers\DataProvider.tsx.
- C:\dev\concursomestre\context\AuthContext.tsx e C:\dev\concursomestre\context\DataContext.tsx viraram bridges legados de compatibilidade.
- Toast, Theme, Modal, Auth, Data e Marketplace agora ficam consolidados sob src\providers como camada canonica.
- Verificacao de imports mostrou que nao restou consumo ativo de context/AuthContext ou context/DataContext fora de um comentario legado em src\features\auth\index.ts.

### subscriptions - cancel_refund e undo_cancel
- O modulo C:\xampp\htdocs\questao-pro-backend\modules\subscriptions foi expandido com os fluxos cancelRefundRequest e undoCancellationRequest.
- C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cancel_refund.php e C:\xampp\htdocs\questao-pro-backend\api\subscriptions\undo_cancel.php agora apenas delegam para as rotas oficiais do modulo.
- O repositorio passou a centralizar busca e reversao de transacoes efund_requested, alem de religar a renovacao automatica com consistencia (uto_renew = 1 e cancel_at_period_end = 0).
- A fachada C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts ganhou os metodos cancelRefundRequest() e undoCancellationRequest().
- C:\dev\concursomestre\src\features\plans\services\planService.ts passou a delegar esses fluxos para o service oficial.
- C:\dev\concursomestre\src\app\profile\ProfilePage.tsx deixou de chamar piClient.post('subscriptions/cancel_refund.php', ...) diretamente e passou a usar o bridge oficial do dominio.

### Validacao
- 
pm run build
- 
pm run test:admin
- 
pm run test:auth
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- php -l em modules/subscriptions/* e nos endpoints delegados cancel_refund.php e undo_cancel.php

### Estado das fases
1. Fase 0: concluida
2. Fase 1: concluida
3. Fase 2: concluida
4. Fase 3: concluida
5. Fase 4: em andamento
6. Fase 5: em andamento

### Proximo passo natural
- Seguir a Fase 5 pelos endpoints legados restantes de subscriptions/dominios comerciais ainda fora da camada modular.
- Depois disso, fazer a passada de padronizacao dos contratos hibridos frontend/backend e a limpeza arquitetural final.
## 2026-04-02 - Mercado Pago de subscriptions modularizado

### subscriptions - Mercado Pago create e webhooks
- C:\xampp\htdocs\questao-pro-backend\api\subscriptions\create.php saiu do procedural e agora apenas delega para C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php.
- O modulo subscriptions ganhou a criacao oficial da preferencia Mercado Pago via createMercadoPagoSubscriptionPreference(...) em:
  - C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php
  - C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php
  - C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php
- C:\xampp\htdocs\questao-pro-backend\api\subscriptions\webhook_mp.php e C:\xampp\htdocs\questao-pro-backend\api\subscriptions\webhook.php agora delegam para a mesma rota oficial do modulo.
- O modulo passou a concentrar processMercadoPagoWebhook(...), incluindo:
  - sincronizacao de subscription_preapproval
  - tratamento de subscription_payment e payment
  - idempotencia por external_id
  - atualizacao da assinatura local
  - criacao de transacao aprovada
  - marcacao de past_due em falhas

### Correcao estrutural importante
- O legado do webhook Mercado Pago renovava a assinatura sempre com +30 days, independentemente do plano.
- Agora a renovacao usa o intervalo real do plano com calculateSubscriptionRenewalPeriodRange(...), preservando corretamente mensal, trimestral e anual.

### Frontend
- A fachada C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts ganhou createMercadoPagoSubscriptionPreference(...).
- C:\dev\concursomestre\src\features\plans\services\planService.ts deixou de chamar piClient.post('/subscriptions/create.php', ...) diretamente e passou a delegar para o service oficial.
- A regressao foi ampliada em C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts.

### Validacao
- php -l no modulo subscriptions e nos endpoints create.php, webhook.php e webhook_mp.php
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin

### Estado das fases
1. Fase 0: concluida
2. Fase 1: concluida
3. Fase 2: concluida
4. Fase 3: concluida
5. Fase 4: em andamento
6. Fase 5: em andamento

### Proximo passo natural
- Modularizar o proximo dominio comercial ainda procedural, com foco em process_payment.php ou em outros auxiliares remanescentes de subscriptions.
- Depois disso, entrar na passada de padronizacao de contratos frontend/backend e limpeza arquitetural final.
## 2026-04-02 - process_payment endurecido e oficializado no frontend

### subscriptions - process_payment
- C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php foi endurecido para usar a sessao autenticada como fonte de verdade do user_id.
- O endpoint agora exige autenticacao oficial via equest_auth.php e rejeita mismatch entre user_id do payload e user_id autenticado.
- O checkout deixou de depender de user_id vindo manualmente do frontend para processar pagamento Mercado Pago.

### Frontend
- C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts ganhou processMercadoPagoPayment(...).
- C:\dev\concursomestre\src\features\plans\services\planService.ts parou de chamar piClient.post('/subscriptions/process_payment.php', ...) diretamente e passou a delegar para o service oficial.
- C:\dev\concursomestre\src\app\checkout\CheckoutPage.tsx deixou de enviar user_id no payload do pagamento Mercado Pago.
- A regressao foi ampliada em C:\dev\concursomestre\src\services\subscriptions\__tests__\subscriptionsService.test.ts.

### Beneficio tecnico
- Reducao de trust indevido no client no fluxo mais sensivel de checkout legado.
- O dominio subscriptions segue ganhando fachada oficial no frontend mesmo antes da reescrita completa do endpoint procedural.

### Validacao
- php -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
## 2026-04-02 - process_payment com bootstrap modularizado

### subscriptions - decomposicao inicial do checkout Mercado Pago
- Foi criado C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentBootstrap.php.
- Esse arquivo passou a concentrar:
  - helpers de bandeira/cartao (getBrandFromBin, 
ormalizePaymentMethodId, etc.)
  - autenticacao oficial do checkout legado
  - validacao inicial do payload
  - carregamento seguro de plano e usuario
- C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php agora consome esse bootstrap modular em vez de manter toda essa responsabilidade no proprio endpoint.

### Beneficio tecnico
- O endpoint procedural ficou menor e com responsabilidades iniciais mais bem separadas.
- A validacao/autenticacao do checkout Mercado Pago passou a ter um ponto canônico dentro do modulo subscriptions.
- Isso prepara a proxima passada, que sera mover o core do processamento de pagamento para a camada oficial do modulo sem uma reescrita destrutiva.

### Validacao
- php -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentBootstrap.php
- php -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
## 2026-04-02 - Fase 5 - Decomposicao de process_payment.php (Mercado Pago)

### Objetivo
Reduzir o maior bloco procedural restante do checkout legado do Mercado Pago sem alterar o comportamento funcional do pagamento.

### Alteracoes realizadas
- Extraido o novo helper [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php).
- Centralizada a resolucao de cartao salvo em esolveMercadoPagoSavedCardContext(...).
- Centralizada a limpeza de cartao salvo invalido em cleanupMissingMercadoPagoSavedCard(...).
- Centralizado o calculo de downgrade/pro-rata/recorrencia em esolveMercadoPagoPricingContext(...).
- Extraidas regras auxiliares de hierarquia e multiplicador mensal para funcoes dedicadas.
- Atualizado [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php) para consumir esses helpers em vez de manter toda a logica no topo do endpoint.

### Ganhos tecnicos
- O topo do endpoint ficou menor e previsivel.
- A validacao de cartao salvo e o bloqueio de downgrade agora vivem em funcoes nomeadas, reutilizaveis e testaveis.
- A limpeza de carteira local inconsistente ficou centralizada.
- O fluxo de preco final do upgrade ficou concentrado em um ponto unico, reduzindo risco de divergencia futura.

### Validacao
- C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php
- C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin

### Proximo hotspot restante
- Extrair o bloco save-then-pay de cartao/cliente Mercado Pago.
- Extrair o branch final de execucao (Orders vs PaymentClient) e persistencia de assinatura/transacao.
### Atualizacao complementar - Save-then-Pay do Mercado Pago
- Extraido o contexto operacional inicial do pagamento para `resolveMercadoPagoPaymentRuntimeContext(...)`.
- Extraida a persistencia de cartao reutilizavel para `prepareMercadoPagoReusableCard(...)` em [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php).
- Simplificado o trecho central de [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php), que deixou de misturar flags de runtime com criacao/sincronizacao de customer e gravacao de cartao salvo.
- Mantido o comportamento atual do checkout, mas com menos acoplamento e menos risco de regressao ao mexer em cartao salvo ou renovacao automatica.

### Validacao complementar
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php`
- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
### Atualizacao complementar - Execucao da cobranca inicial do Mercado Pago
- Extraido `executeMercadoPagoInitialCharge(...)` em [C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php](C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php).
- O helper passou a concentrar o branch `Orders` para cartao salvo e o branch `Payment API` para os demais cenarios, incluindo retry sem metadados redundantes.
- [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php) agora so orquestra a execucao da cobranca e reage ao resultado padronizado do helper.
- Isso removeu do endpoint a duplicacao de payload, logs e regras de aprovacao/rejeicao entre `Orders` e `PaymentClient`.

### Validacao complementar
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php`
- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
## 2026-04-02 19:45 - Fase 5 - Reconstrucao segura do process_payment Mercado Pago

### Contexto
- O endpoint `api/subscriptions/process_payment.php` era o maior bloco procedural restante do checkout legado do Mercado Pago.
- Durante a extracao do bloco final de ativacao, o arquivo ativo precisou ser recomposto com seguranca a partir da copia integra mais proxima e dos helpers ja extraidos para o modulo `subscriptions`.

### Alteracoes aplicadas
- Reconstrucao completa de `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php` como orquestrador fino.
- O endpoint agora delega bootstrap/autenticacao para `MercadoPagoPaymentBootstrap.php`.
- A resolucao de cartao salvo, pricing/pro-rata, preparo de cartao reutilizavel, cobranca inicial e ativacao local foram centralizados nos helpers do modulo `subscriptions`.
- O endpoint passou a usar o usuario autenticado como fonte de verdade do checkout, sem confiar em `user_id` do payload.
- O fluxo de cartao salvo remoto inexistente agora limpa o vinculo local e retorna erro explicito de conflito, evitando reuse quebrado.
- O endpoint continua tratando cobranca normal, cartao salvo via Orders, recorrencia mensalizada e pagamento totalmente coberto por credito proporcional.

### Ajuste adicional no helper final
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php` passou a registrar a transacao local de plano de forma idempotente durante a ativacao aprovada.
- Isso evita perder historico financeiro ao extrair a persistencia final para fora do endpoint procedural.

### Validacao
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\MercadoPagoPaymentPreparation.php`
- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

### Resultado arquitetural
- `process_payment.php` deixou de ser um arquivo misturando autenticacao, leitura de payload, regra comercial, salvamento de cartao, cobranca e ativacao local.
- O dominio Mercado Pago de assinaturas ficou mais previsivel e mais proximo da etapa final de migracao para o modulo oficial `subscriptions`.
## 2026-04-02 20:00 - Fase 5 - Modularizacao do cron_scheduled_payments

### Contexto
- Apos estabilizar `process_payment.php`, o proximo fluxo legado relevante em `subscriptions` era `api/subscriptions/cron_scheduled_payments.php`.
- Esse arquivo ainda concentrava validacao da chave, consulta SQL, cobranca no Mercado Pago, persistencia local e notificacao em um unico ponto procedural.

### Alteracoes aplicadas
- Criado handler oficial `handleSubscriptionsScheduledPaymentsCronRoute(...)` em `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`.
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_scheduled_payments.php` agora virou apenas endpoint delegado para a rota do modulo.
- `SubscriptionsController` ganhou `runScheduledMercadoPagoPaymentsCron()`.
- `SubscriptionsService` passou a processar o cron legado de parcelas agendadas do Mercado Pago, com:
  - idempotency key por transacao agendada
  - cobranca via `PaymentClient`
  - renovacao do periodo usando `calculateSubscriptionRenewalPeriodRange(...)`
  - atualizacao do historico financeiro local
  - notificacao de sucesso/falha para o usuario
  - log dedicado de erros operacionais do cron
- `SubscriptionsRepository` ganhou operacoes especificas para:
  - buscar transacoes agendadas vencidas
  - aplicar aprovacao de parcela agendada
  - marcar parcela agendada como rejeitada
- O segredo do cron passou a usar `CRON_SECRET` com fallback compativel, em vez de depender so de hardcode solto no endpoint.

### Testes e validacao
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_scheduled_payments.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SubscriptionsCronWiringTest.php`

### Resultado arquitetural
- O cron de parcelas agendadas deixou de ser uma ilha procedural fora do modulo oficial `subscriptions`.
- O dominio de assinaturas ganhou mais um fluxo operacional centralizado, reduzindo divergencia entre webhooks, checkout e jobs de cobranca.
## 2026-04-02 20:10 - Fase 5 - Modularizacao do cron_recurring

### Contexto
- Depois do `cron_scheduled_payments`, o proximo job legado relevante em `subscriptions` era `api/subscriptions/cron_recurring.php`.
- O arquivo ainda concentrava busca de assinaturas vencidas, cobranca no Mercado Pago, renovacao de periodo, reaproveitamento de transacao pre-aprovada, notificacao e log de erro no mesmo bloco procedural.

### Alteracoes aplicadas
- Criado handler oficial `handleSubscriptionsRecurringCronRoute(...)` em `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`.
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_recurring.php` agora delega para a rota do modulo.
- `SubscriptionsController` ganhou `runRecurringMercadoPagoSubscriptionsCron()`.
- `SubscriptionsService` passou a executar o cron de renovacoes recorrentes, com:
  - idempotency key por assinatura/parcela
  - cobranca via `PaymentClient`
  - renovacao baseada em `calculateSubscriptionRenewalPeriodRange(...)`, respeitando o intervalo real do plano
  - reaproveitamento da primeira transacao `pre-approved` quando ela existir
  - notificacao de sucesso/falha ao usuario
  - log operacional de erros do cron
- `SubscriptionsRepository` ganhou metodos para:
  - buscar assinaturas recorrentes vencidas
  - localizar a primeira transacao `pre-approved` reutilizavel
  - persistir a cobranca recorrente aprovada sem duplicar a regra no service

### Correcao estrutural embutida
- O cron recorrente deixou de renovar sempre por `+30 days` fixos e passou a usar o helper oficial de periodo do plano.
- Isso reduz risco de divergencia entre mensal, trimestral e anual no fluxo legado de renovacao automatica.

### Testes e validacao
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_recurring.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SubscriptionsCronWiringTest.php`

### Resultado arquitetural
- Os dois cron jobs legados principais do dominio Mercado Pago agora estao ancorados no modulo oficial `subscriptions`.
- O dominio de assinaturas ficou mais consistente entre checkout, webhook e jobs operacionais.
## 2026-04-02 20:20 - Fase 5 - Modularizacao do cron_stripe_reconciliation

### Contexto
- Depois de migrar os dois cron jobs legados do Mercado Pago, o ultimo job operacional principal ainda fora do modulo `subscriptions` era `api/subscriptions/cron_stripe_reconciliation.php`.
- Esse endpoint ainda fazia leitura direta do banco, consulta ao provider Stripe, sincronizacao local e log em um unico arquivo procedural.

### Alteracoes aplicadas
- Criado handler oficial `handleSubscriptionsStripeReconciliationCronRoute(...)` em `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`.
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php` agora virou endpoint delegado.
- `SubscriptionsController` ganhou `runStripeReconciliationCron()`.
- `SubscriptionsService` passou a executar a reconciliacao Stripe, preservando:
  - leitura remota da assinatura com `latest_invoice.payment_intent`
  - sincronizacao de `status`
  - sincronizacao de `recurring_amount`
  - sincronizacao de `total_installments`
  - analise de proxima cobranca (`upcoming invoice`)
  - deteccao de divergencias como `amount_mismatch` e `overdue_without_confirmed_payment`
  - log operacional por linha reconciliada
- `SubscriptionsRepository` ganhou metodos especificos para:
  - buscar assinaturas Stripe elegiveis para reconciliacao
  - atualizar `status`
  - atualizar `recurring_amount`
  - atualizar `total_installments`

### Validacao
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`
- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SubscriptionsCronWiringTest.php`

### Resultado arquitetural
- Os tres jobs operacionais principais do dominio `subscriptions` (`cron_scheduled_payments`, `cron_recurring`, `cron_stripe_reconciliation`) agora estao ancorados no modulo oficial.
- O dominio de assinaturas ficou mais coeso entre checkout, webhook, jobs e persistencia local.
## 2026-04-02 20:50 - Fase 4 - Normalizacao de contratos hibridos na camada de servicos

### Contexto
- Mesmo com a arquitetura por dominios mais madura, varios servicos ainda tratavam respostas de formas diferentes (`response.data`, `response.data.data`, `response.success`, payload cru, fallback manual).
- Isso mantinha logica duplicada e comportamento inconsistente entre mutacoes e leituras do frontend.

### Alteracoes aplicadas
- Criado `C:\dev\concursomestre\src\services\api\response.ts` com utilitarios oficiais:
  - `normalizeApiEnvelope(...)`
  - `readApiData(...)`
  - `assertApiSuccess(...)`
- `C:\dev\concursomestre\src\services\api\index.ts` passou a exportar a camada de normalizacao junto da fachada HTTP.
- Migrados para a nova porta de contrato os servicos:
  - `adminService`
  - `marketplaceService`
  - `transactionsService`
  - `filtersService`
  - `rankingsService`
  - `accountService`
  - `simulationsService`
  - `subscriptionsService`
- O objetivo foi remover `unwrap/assertSuccess` locais e centralizar leitura de payload/mensagem/sucesso numa unica implementacao.
- Ajustado o upload do marketplace para continuar aceitando o retorno legado de `upload.php`, mas sob a mesma leitura normalizada.

### Testes adicionados/ajustados
- Novo teste dedicado em `C:\dev\concursomestre\src\services\api\__tests__\response.test.ts`.
- Atualizados mocks dos testes de servico que dependem de `@services/api`:
  - `adminService.test.ts`
  - `accountService.test.ts`
  - `filters.test.ts`
  - `marketplaceService.test.ts`
  - `rankingsService.test.ts`
  - `simulationsService.test.ts`
  - `subscriptionsService.test.ts`
  - `transactionsService.test.ts`

### Validacao
- `npx vitest run src/services/api/__tests__/response.test.ts src/services/admin/__tests__/adminService.test.ts src/services/auth/__tests__/accountService.test.ts src/services/filters/__tests__/filters.test.ts src/services/marketplace/__tests__/marketplaceService.test.ts src/services/rankings/__tests__/rankingsService.test.ts src/services/simulations/__tests__/simulationsService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts src/services/transactions/__tests__/transactionsService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

### Resultado arquitetural
- A camada `src/services` ficou mais previsivel para consumidores antigos e novos.
- O frontend passou a lidar melhor com endpoints que ainda misturam envelope `{ success, data }` e payload cru, sem reimplementar a mesma regra em cada dominio.## 2026-04-02 20:12 - Fase 4 - Fechamento da normalizacao restante da camada de servicos

### Contexto
- Depois da criacao de `src/services/api/response.ts`, ainda restavam dominios antigos com parsing proprio de envelope e telas consumindo HTTP cru para fluxos mais simples.
- Os pontos mais visiveis eram `comments`, `questions`, `notifications`, `bank-analysis`, `progress` e a tela publica de `support`.

### Alteracoes aplicadas
- `C:\dev\concursomestre\src\features\comments\services\commentService.ts` passou a usar `assertApiSuccess(...)` e `readApiData(...)`, removendo `unwrap/assertSuccess` locais.
- `C:\dev\concursomestre\src\features\questions\services\questionService.ts` foi alinhado ao mesmo contrato central para leitura de listas, mutacoes e reset de respostas.
- `C:\dev\concursomestre\src\features\notifications\services\notificationService.ts` foi reescrito para normalizar listas e mutacoes sob uma unica leitura de envelope.
- `C:\dev\concursomestre\src\features\bank-analysis\services\bankAnalysisService.ts` ganhou fachada oficial para:
  - `getBankIntel(...)`
  - `getXrayStats(...)`
  - mantendo bridges para metodos legados ainda nao migrados
- Criado `C:\dev\concursomestre\src\services\support\supportService.ts` e `C:\dev\concursomestre\src\services\support\index.ts` para centralizar:
  - listagem do historico de chamados
  - carregamento de replies por thread
  - criacao de novo chamado/feedback
- `C:\dev\concursomestre\src\app\support\SupportPage.tsx` deixou de usar `apiClient` direto e passou a consumir `supportService`.
- `C:\dev\concursomestre\src\app\bank-analysis\BankAnalysisPage.tsx` deixou de usar `apiClient` direto para `statistics/banca_info.php` e `statistics/xray.php`, passando a consumir `bankAnalysisService`.
- `C:\dev\concursomestre\src\services\progress\userProgressService.ts` foi alinhado a `readApiData(...)`, eliminando o unwrap local de `answers/notes`.

### Testes adicionados/ajustados
- Novos testes:
  - `C:\dev\concursomestre\src\services\notifications\__tests__\notificationService.test.ts`
  - `C:\dev\concursomestre\src\services\bank-analysis\__tests__\bankAnalysisService.test.ts`
  - `C:\dev\concursomestre\src\services\support\__tests__\supportService.test.ts`
- Ajustados mocks para a nova fachada de resposta em:
  - `C:\dev\concursomestre\src\services\comments\__tests__\commentsService.test.ts`
  - `C:\dev\concursomestre\src\services\questions\__tests__\questionService.test.ts`
  - `C:\dev\concursomestre\src\services\progress\__tests__\userProgressService.test.ts`

### Validacao
- `npx vitest run src/services/comments/__tests__/commentsService.test.ts src/services/questions/__tests__/questionService.test.ts src/services/notifications/__tests__/notificationService.test.ts src/services/bank-analysis/__tests__/bankAnalysisService.test.ts src/services/support/__tests__/supportService.test.ts src/services/progress/__tests__/userProgressService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

### Resultado arquitetural
- O frontend ficou com menos parsing ad hoc fora da camada oficial de servicos.
- `support` e `bank-analysis` sairam da zona de HTTP cru e passaram a usar fachadas por dominio.
- O restante mais relevante de contrato hibrido agora ficou concentrado principalmente em fluxos sensiveis como `checkout` e alguns bridges administrativos/legados.## 2026-04-02 20:11 - Fase 4 - Fechamento do 2FA administrativo na service layer

### Contexto
- Mesmo apos a normalizacao da camada de servicos, o bloco de 2FA em `AdminSettings` ainda fazia parsing hibrido direto na UI com `res.success || res.data?.success`.
- Isso mantinha a tela de configuracoes com responsabilidade de integracao HTTP, fugindo da arquitetura congelada.

### Alteracoes aplicadas
- `C:\dev\concursomestre\src\services\admin\adminService.ts` ganhou:
  - `setupTwoFactor()`
  - `enableTwoFactor(secret, code)`
- `C:\dev\concursomestre\src\components\admin\settings\AdminSettings.tsx` passou a consumir `adminService` para iniciar e ativar o 2FA, removendo o uso direto de `apiClient` nesse trecho.

### Testes adicionados/ajustados
- `C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts` ganhou cenarios para:
  - carregar o payload de setup do 2FA
  - ativar o 2FA pelo endpoint oficial

### Validacao
- `npx vitest run src/services/admin/__tests__/adminService.test.ts src/services/comments/__tests__/commentsService.test.ts src/services/questions/__tests__/questionService.test.ts src/services/notifications/__tests__/notificationService.test.ts src/services/bank-analysis/__tests__/bankAnalysisService.test.ts src/services/support/__tests__/supportService.test.ts src/services/progress/__tests__/userProgressService.test.ts`
- `npm run build`

### Resultado arquitetural
- O admin perdeu mais um parsing manual de envelope na camada visual.
- O bloco de seguranca/configuracao ficou mais aderente a `src/services` e mais facil de manter.## 2026-04-02 20:23 - Fase 4 - Checkout e billing migrados para services oficiais

### Contexto
- O `CheckoutPage` ainda concentrava os maiores restos de contrato hibrido do frontend: cadastro/login inline, reenvio de confirmacao, validacao de cupom e leitura de cartoes salvos.
- O `ProfilePage` repetia a mesma integracao de billing para listar/remover/definir cartao padrao e preparar o cofre Stripe.

### Alteracoes aplicadas
- Criado `C:\dev\concursomestre\src\services\auth\authFlowService.ts` para centralizar:
  - `register(...)`
  - `login(...)`
  - `resendConfirmation(...)`
- Criado `C:\dev\concursomestre\src\services\billing\cardsService.ts` e `C:\dev\concursomestre\src\services\billing\index.ts` para centralizar:
  - listagem de cartoes salvos
  - remocao de cartao
  - definicao de cartao padrao
  - salvamento de cartao legado/local
  - `createStripeSetupIntent()`
  - `syncStripeCard(...)`
- `C:\dev\concursomestre\src\services\auth\index.ts` passou a exportar `authFlowService`.
- `C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts` foi ajustado para devolver payload achatado nos fluxos mais usados do checkout:
  - Stripe checkout hospedado
  - Stripe inline
  - finalizacao Stripe
  - portal Stripe
  - Mercado Pago preference/processamento
  - renovacao/cancelamento de solicitacao
- `C:\dev\concursomestre\src\features\plans\services\planService.ts` passou a delegar setup/sincronizacao de cartao para `cardsService` e ganhou bridge para `validateCoupon(...)`.
- `C:\dev\concursomestre\src\app\checkout\CheckoutPage.tsx` passou a consumir as fachadas oficiais para:
  - cadastro/login
  - reenvio de confirmacao de email
  - validacao de cupom
  - listagem de cartoes salvos
  - leitura achatada das respostas Stripe
- `C:\dev\concursomestre\src\app\profile\ProfilePage.tsx` passou a consumir `cardsService` para o fluxo de billing/cartoes salvos.

### Testes adicionados/ajustados
- Novos testes:
  - `C:\dev\concursomestre\src\services\auth\__tests__\authFlowService.test.ts`
  - `C:\dev\concursomestre\src\services\billing\__tests__\cardsService.test.ts`
- Mantidos/validados os testes de `subscriptionsService` e `adminService` apos o achatamento das respostas.

### Validacao
- `npx vitest run src/services/auth/__tests__/accountService.test.ts src/services/auth/__tests__/authFlowService.test.ts src/services/billing/__tests__/cardsService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts src/services/admin/__tests__/adminService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

### Resultado arquitetural
- O checkout perdeu boa parte do HTTP cru e do parsing manual de envelopes.
- Billing/cartoes salvos passaram a ter uma porta de dominio reaproveitavel entre checkout e perfil.
- O restante mais pesado de contrato hibrido no frontend ficou concentrado nos ultimos detalhes sensiveis do checkout e em alguns bridges legados administrativos.## 2026-04-02 20:33 - Fase 4 - Checkout sem parsing manual de contratos hibridos

- Criei a fachada oficial de parcelas em src/services/payments/paymentsService.ts e src/services/payments/index.ts, removendo o ultimo piClient.get('payments/get-installments.php') cru do CheckoutPage.
- Ampliei src/services/api/response.ts com eadApiErrorMessage(...) e eadApiErrorCode(...), reduzindo leitura manual de error.response?.data na UI.
- Refatorei src/app/checkout/CheckoutPage.tsx para consumir paymentsService, eadApiErrorMessage(...) e eadApiErrorCode(...), simplificando os fluxos de login, cupom, parcelas, Stripe hosted checkout, Stripe internal checkout, cartao salvo e Mercado Pago.
- Removi o alias temporario const res = result do carregamento de cartoes salvos e passei a tratar cardsService.listSavedCards(...) como fonte oficial do contrato.
- Normalizei createStripeCheckoutSession(...) em src/services/subscriptions/subscriptionsService.ts para sempre expor url, eliminando o fallback edirect_url no entry point do checkout.
- Adicionei cobertura em src/services/payments/__tests__/paymentsService.test.ts e expandi src/services/api/__tests__/response.test.ts e src/services/subscriptions/__tests__/subscriptionsService.test.ts.

Validacao:
- 
px vitest run src/services/api/__tests__/response.test.ts src/services/payments/__tests__/paymentsService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts src/services/auth/__tests__/authFlowService.test.ts src/services/billing/__tests__/cardsService.test.ts src/services/admin/__tests__/adminService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin## 2026-04-02 20:39 - Fase 4 - Limpeza final de marketplace e estornos

- Refatorei src/app/marketplace/MarketplacePage.tsx para remover chamadas cruas de comentarios e estorno. A tela agora usa commentService para listar, criar, curtir e excluir comentarios, e marketplaceService.cancelRefundRequest(...) para cancelar solicitacoes de reembolso.
- Removi parsing manual e tratamento legado de erros nesse fluxo, usando eadApiErrorMessage(...) em avaliacao, comentarios e cancelamento de reembolso.
- Ampliei src/services/transactions/transactionsService.ts com cancelRefundRequest(...) e conectei a fachada em src/services/marketplace/marketplaceService.ts.
- Limpei o MarketplaceProvider em src/providers/MarketplaceProvider.tsx, substituindo o ultimo error.response?.data?.message por eadApiErrorMessage(...).
- Confirmei que pages/* e context/* permanecem apenas como bridges de compatibilidade nesta etapa; os imports ativos do app principal ja estao ancorados na arquitetura oficial congelada.
- Atualizei a cobertura em src/services/transactions/__tests__/transactionsService.test.ts.

Validacao:
- 
px vitest run src/services/transactions/__tests__/transactionsService.test.ts src/services/marketplace/__tests__/marketplaceService.test.ts src/services/comments/__tests__/commentsService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin## 2026-04-02 20:49 - Fase 4 - ProfilePage migrado para services oficiais

- Criei src/services/profile/profileService.ts e src/services/profile/index.ts para centralizar eferrals/stats.php, users/upload_photo.php e users/change_password.php.
- Ampliei src/services/marketplace/marketplaceService.ts com listUserMaterials(...) para retirar users/materials.php do ProfilePage.
- Migrei src/app/profile/ProfilePage.tsx para usar 	ransactionsService, marketplaceService, profileService, cardsService e eadApiErrorMessage(...), eliminando as ultimas chamadas cruas de piClient e ENDPOINTS dentro da tela.
- Simplifiquei os fluxos de billing do perfil: cartao salvo, portal Stripe, cancelamento de solicitacao de reembolso, upload de foto e troca de senha agora dependem de fachadas oficiais em vez de parsing manual da resposta.
- Adicionei cobertura em src/services/profile/__tests__/profileService.test.ts e expandi src/services/marketplace/__tests__/marketplaceService.test.ts.

Validacao:
- 
px vitest run src/services/profile/__tests__/profileService.test.ts src/services/marketplace/__tests__/marketplaceService.test.ts src/services/transactions/__tests__/transactionsService.test.ts src/services/billing/__tests__/cardsService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin## 2026-04-02 20:53 - Verificacao do blueprint atualizado e limpeza do AdminPage

- Atualizei C:\dev\concursomestre\docs\architecture-freeze.md para refletir o blueprint oficial atual do frontend e do backend PHP, incluindo:
  - pp/ como ponto de entrada oficial das telas
  - components/shared/ como area exclusiva de UI reutilizavel
  - providers/, state/, services/, utils/, constants/, 	ypes/ e outer/ com responsabilidade definida
  - regra oficial do backend com modules/<domain>/{controllers,services,repositories,validators,routes} e shared/{auth,db,http,middleware,security,utils}
  - regras obrigatorias para controllers finos, repository para banco, service para regra de negocio, respostas/erros padronizados e comentarios em pt-BR
- Registrei no freeze os gaps arquiteturais reais ainda existentes:
  - src/router/ ainda precisa ser formalizado
  - components/shared ainda precisa consolidacao maior
  - src/features/ e src/core/ seguem como zona legada
  - backend ainda precisa formalizar shared/ e modularizar dominios restantes (uth, users, questions, comments, 
otifications, simulations, statistics, plans, eports, parte de payments)
- Limpei o ultimo acesso direto de API do entry point principal do admin em C:\dev\concursomestre\src\app\admin\AdminPage.tsx, movendo o carregamento filtrado de questoes para C:\dev\concursomestre\src\services\admin\adminService.ts com o metodo getQuestions(...).
- Atualizei a cobertura em C:\dev\concursomestre\src\services\admin\__tests__\adminService.test.ts para validar o endpoint oficial de questoes filtradas.

Validacao:
- 
px vitest run src/services/admin/__tests__/adminService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
## 2026-04-02 21:05 - Fase 4/5 - Entry points menores limpos e shared/http oficial no PHP

### Frontend
- Criei a fachada oficial de changelog em src/services/changelog/changelogService.ts e passei src/app/changelog/ChangelogPage.tsx a consumir essa camada, com estado de erro visivel em vez de console.error solto.
- Expandi src/services/auth/authFlowService.ts com confirmEmail(...) e esetPassword(...), e migrei src/app/confirm-email/ConfirmEmailPage.tsx e src/app/reset-password/ResetPasswordPage.tsx para os servicos oficiais.
- Corrigi um bug estrutural no ConfirmEmailPage: o cleanup do setInterval estava retornando de dentro da funcao async, entao o efeito nao limpava o timer corretamente. Agora o timer fica em useRef com cleanup real no useEffect.
- Removi imports legados sem uso em src/app/ranking/RankingPage.tsx.
- Atualizei src/core/api/endpoints.ts com os contratos oficiais de confirmEmail, esetPassword e changelog.

### Backend PHP
- Formalizei a primeira camada oficial de HTTP compartilhado em C:\xampp\htdocs\questao-pro-backend\shared\http\ApiResponse.php.
- Transformei C:\xampp\htdocs\questao-pro-backend\api\utils\Response.php em bridge legado para a camada nova, preservando compatibilidade dos endpoints existentes.
- Adicionei o teste de wiring C:\xampp\htdocs\questao-pro-backend\tests\SharedHttpWiringTest.php para garantir que o bridge legado continua apontando para a infraestrutura oficial.

### Verificacao
- Busca em src/app confirmou que nao restou uso real de piClient, ENDPOINTS ou error.response?.data nos entry points ativos; o unico match remanescente foi texto estatico da politica de privacidade.
- 
px vitest run src/services/auth/__tests__/authFlowService.test.ts src/services/changelog/__tests__/changelogService.test.ts src/services/admin/__tests__/adminService.test.ts
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
- php -l C:\xampp\htdocs\questao-pro-backend\shared\http\ApiResponse.php
- php -l C:\xampp\htdocs\questao-pro-backend\api\utils\Response.php
- C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SharedHttpWiringTest.php

### Estado arquitetural apos a rodada
- src/app ficou limpo dos hotspots menores de integracao direta.
- O frontend segue convergindo para services/* como unica camada de request.
- O backend agora ja tem o primeiro diretorio oficial em shared/http, abrindo caminho para padronizar erro/resposta nos proximos endpoints legados.
## 2026-04-02 21:09 - Fase final de limpeza - router oficial e remocao de bridges mortos

### Router oficial
- Criei src/router/AppRouter.tsx como ponto oficial do roteamento da aplicacao.
- Criei src/router/index.ts para expor a fachada do router.
- App.tsx passou a consumir AppRouter diretamente.
- src/app/AppShell.tsx virou bridge minimo de compatibilidade, alinhando o projeto ao blueprint que exige outer/ proprio.

### Limpeza estrutural
- Removi o diretorio raiz pages/, que continha apenas bridges mortos para src/app/* e uma pagina orfa (pages/Evolution.tsx) sem rota nem import ativo no codigo vivo.
- Removi o diretorio raiz context/, que continha apenas bridges mortos para src/providers/*.
- Os arquivos de src/pages/ foram removidos; sobrou apenas o diretorio vazio src/pages, que ficou travado por processo externo no filesystem no momento da exclusao. O codigo ja nao depende dele.

### Verificacao de uso real antes da remocao
- Busca no codigo vivo (src, pages, context, components, constants, ui, App.tsx) confirmou ausencia de imports ativos para pages/* e context/*.
- A unica estrutura residual relacionada era o proprio bridge em src/pages/*, que tambem deixou de ser importado.

### Verificacao apos a limpeza
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin

### Estado atual
- src/router agora existe oficialmente.
- pages/ e context/ deixaram de poluir o workspace principal.
- O cleanup final ficou pendente apenas para o diretorio vazio src/pages, bloqueado por processo externo no momento da remocao.
## 2026-04-02 - Alinhamento com a Arquitetura Oficial Revisada

### Comparacao objetiva com o blueprint revisado

Frontend:
- `src/app` segue como camada oficial de telas, mas ainda restam 5 entry points em bridge para legado: `admin`, `bank-analysis`, `checkout`, `dashboard` e `marketplace`.
- O padrao de `page.tsx` como entry point unico avancou nesta rodada: `confirm-email`, `changelog`, `faq`, `notifications` e `landing` deixaram de depender de `pages/*`.
- `src/router` ja esta formalizado com `index.tsx`, `publicRoutes.tsx`, `privateRoutes.tsx`, `adminRoutes.tsx` e `guards/`.
- `src/components/shared` passou a existir de forma real, com `ui/`, `layout/`, `feedback/` e `overlays/`.
- Divergencia ainda aberta: `src/components/admin` continua fora do alvo final `src/app/admin/components`.
- Divergencia ainda aberta: ainda existe legado em `components/` na raiz e `ui/temas`, que hoje nao recebem codigo novo, mas ainda nao foram totalmente internalizados ao desenho final.
- `context/` continua apenas como bridge temporario; nao deve receber regra nova.

Backend PHP:
- `shared/` foi endurecido como infraestrutura transversal, com `http/`, `errors/`, `responses/` e agora tambem a espinha oficial `auth/`, `db/`, `middleware/`, `security/` e `utils/`.
- Os modulos oficiais existentes continuam em `modules/admin`, `modules/filters`, `modules/materials`, `modules/rankings`, `modules/subscriptions` e `modules/transactions`.
- Divergencia ainda aberta: varios dominios continuam fora de `modules/`, como `auth`, `users`, `questions`, `comments`, `notifications`, `simulations`, `statistics`, `plans`, `payments` e `reports`.
- Divergencia ainda aberta: `api/` ainda nao esta reduzido apenas a bridges; ha endpoints legados com regra e `echo json_encode(...)` manual, principalmente em `comments`, `materials`, `notifications`, `payments`, `questions`, `reports`, `simulations` e `statistics`.

### Correcoes aplicadas nesta rodada

Frontend:
- `src/app/confirm-email/page.tsx` refeito como tela real usando `authFlowService`, `AuthProvider` e `ToastProvider`, sem request cru nem dependencia de `pages/ConfirmEmail.tsx`.
- `src/app/changelog/page.tsx` refeito como tela real usando `changelogService` e erro padronizado via `readApiErrorMessage(...)`.
- `src/app/faq/page.tsx` refeito como tela real, sem wrapper legado.
- `src/app/notifications/page.tsx` refeito como tela real usando `AuthProvider` e `DataProvider`, sem dependencia de `pages/Notifications.tsx`.
- `src/app/landing/page.tsx` deixou de ser wrapper e passou a ser a implementacao real da landing page.
- `components/ThemeOrnaments.tsx` foi movido para `src/app/landing/components/ThemeOrnaments.tsx`, aproximando o componente do dominio que realmente o usa.
- `src/components/shared/layout/Footer.tsx` e `src/components/shared/layout/DashboardSidebar.tsx` passaram a ser a localizacao oficial dos layouts compartilhados.
- `src/components/shared/ui/AdPlaceholder.tsx` passou a ser a localizacao oficial do placeholder compartilhado.
- Importacoes foram alinhadas em `src/app/partner-dashboard/page.tsx`, `components/Layout.tsx`, `pages/Admin.tsx`, `pages/Dashboard.tsx` e `pages/Marketplace.tsx`.

Backend:
- A arvore oficial de `shared/` foi completada no filesystem com `auth/`, `db/`, `middleware/`, `security/` e `utils/`, preservando `shared/` como camada transversal e nao de dominio.

### Limpeza executada

Arquivos removidos com seguranca:
- `pages/ConfirmEmail.tsx`
- `pages/Changelog.tsx`
- `pages/FAQ.tsx`
- `pages/Notifications.tsx`

Diretorios legados vazios removidos:
- `src/components/layout`
- `src/components/ads`

### Estado atual validado

Restam 5 wrappers de `page.tsx` apontando para legado:
- `src/app/admin/page.tsx`
- `src/app/bank-analysis/page.tsx`
- `src/app/checkout/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/marketplace/page.tsx`

Restam 4 bridges em `pages/`:
- `pages/Admin.tsx`
- `pages/BankAnalysis.tsx`
- `pages/Dashboard.tsx`
- `pages/Marketplace.tsx`

Resta 1 bridge em `src/pages/`:
- `src/pages/CheckoutPage.tsx`

### Validacao executada
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

Tudo passou apos as correcoes desta rodada.

### Proximo alvo correto
Nao avancar para nova fase ainda. O passo correto agora e terminar a consolidacao de `page.tsx` nos 5 wrappers restantes e, em paralelo, continuar tirando `src/components/admin` da zona cinzenta para a estrutura final do dominio `admin`.
## 2026-04-02 22:20 - Estabilizacao do runtime e fechamento dos wrappers de page.tsx

### Incidente corrigido
- O frontend estava entregando tela branca em http://localhost:3000/#/ por uma combinacao de blockers de runtime.
- Corrigi App.tsx para importar explicitamente src/router/index, evitando resolucao quebrada do modulo do router no dev server.
- Corrigi src/providers/DataProvider.tsx, onde addComment estava referenciando fetchUserComments antes da inicializacao.
- Corrigi src/router/index.tsx, trocando o uso invalido de <PublicRoutes />, <PrivateRoutes /> e <AdminRoutes /> dentro de <Routes> por invocacao direta que retorna apenas Route/Fragment.
- A home foi verificada novamente por screenshot em navegador headless e voltou a renderizar corretamente.

### Consolidacao do padrao unico de page.tsx
- Migrei a implementacao real de dashboard para src/app/dashboard/page.tsx.
- Migrei a implementacao real de bank-analysis para src/app/bank-analysis/page.tsx.
- Migrei a implementacao real de marketplace para src/app/marketplace/page.tsx.
- Migrei a implementacao real de checkout para src/app/checkout/page.tsx.
- Migrei a implementacao real de admin para src/app/admin/page.tsx.
- Com isso, src/app/*/page.tsx deixou de ter wrappers ativos para legado.

### Ajustes estruturais associados
- src/app/bank-analysis/constants.ts passou a concentrar a paleta local dos graficos da feature.
- tsconfig.json e vite.config.ts deixaram de expor aliases legados @pages e @context.
- O diretorio raiz pages/ foi removido.
- O diretorio raiz context/ foi removido.
- O diretorio temporario .tmp-chrome-profile e os arquivos tmp-* gerados durante a investigacao foram removidos.

### Pendencia mecanica de limpeza
- src/pages/ ficou vazio, mas a remocao fisica do diretorio falhou por lock de processo no filesystem mesmo apos a remocao do codigo legado. O codigo vivo ja nao depende dele.

### Estado objetivo apos a rodada
- Wrappers restantes de src/app/*/page.tsx: 0.
- pages/ ativo no frontend: 0 arquivos.
- context/ ativo no frontend: 0 arquivos.
- A raiz do frontend ainda nao esta totalmente limpa porque permanecem zonas legadas nao migradas nesta rodada, principalmente components/, constants/, ui/, src/features/, src/core/ e o diretorio vazio src/pages/.
- A raiz do backend continua poluida porque a classificacao e relocalizacao dos scripts operacionais/diagnosticos para scripts/ e dos dominios restantes para modules/ ainda nao terminou.

### Validacao executada
- npm run build
- npm run test:auth
- npm run test:admin
- Verificacao visual da home em http://localhost:3000/#/ via Chrome headless

### Situacao das fases
1. Fase 0 - arquitetura oficial revisada: concluida.
2. Fase 1 - padronizacao do que ja estava extraido: concluida.
3. Fase 2 - migracao dos entry points para src/app e consolidacao de page.tsx: concluida.
4. Fase 3 - providers oficiais em src/providers: concluida.
5. Fase 4 - retirada de requests crus da UI e normalizacao dos contratos de frontend: em fechamento.
6. Fase 5 - modularizacao do backend PHP por dominios: em andamento.
7. Fase 6 - limpeza final de legado e despoluicao de raiz frontend/backend: em andamento.

### Proximo alvo correto
- Fechar a Fase 6 no frontend, migrando o que ainda esta em components/, constants/ e ui/ para o desenho revisado.
- Iniciar a despoluicao real da raiz do backend, movendo scripts soltos para scripts/ e reduzindo api/ a bridges onde ja houver modulo oficial.
## 2026-04-02 22:35 - Migracao de constants/themes e criacao do feature report

### Migracao arquitetural no frontend
- A raiz constants/ foi removida e seu conteudo global foi consolidado em src/constants/index.ts.
- A raiz ui/temas foi removida e o catalogo de temas foi consolidado em src/constants/themes/*.
- Imports ativos foram alinhados em src/providers/DataProvider.tsx, src/app/admin/page.tsx, src/app/landing/page.tsx e src/components/admin/finance/AdminFinance.tsx.
- Com isso, mais duas zonas cinzentas deixaram de existir na raiz do frontend.

### Documentacao funcional criada
- Criei docs/feature-report.md como inventario funcional amplo da plataforma.
- O documento cobre:
  - rotas publicas
  - rotas autenticadas
  - rota administrativa e suas secoes internas
  - providers globais
  - services globais do frontend
  - modulos backend oficiais
  - dominios legados ainda existentes
  - integracoes externas e divergencias arquiteturais ainda abertas

### Estado atual apos a rodada
- Diretorios removidos da raiz do frontend nesta rodada:
  - constants/
  - ui/
- Diretorios ainda poluentes e fora do alvo final no frontend:
  - components/
  - src/components/admin/
  - src/features/
  - src/core/
  - src/pages/ vazio e travado por lock mecanico anterior
- Diretorios ainda poluentes e fora do alvo final no backend:
  - scripts soltos na raiz
  - dominios legados como plans/, eferrals/, subscriptions/, 	ransactions/ e scrapper/
  - pi/ ainda nao reduzido apenas a bridges

### Validacao executada
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin

### Proximo alvo correto
- Continuar a Fase 6 pela raiz do frontend, migrando componentes compartilhados de components/ para src/components/shared/* e componentes do dominio admin para src/app/admin/components/*.
- Em seguida, atacar a despoluicao da raiz do backend com classificacao dos scripts soltos para scripts/ e reducao progressiva de pi/ a bridges.
## 2026-04-02 22:40 - Migracao inicial de componentes compartilhados da raiz

### Migracao de components/ para src/components/shared
- Os seguintes componentes sairam da raiz components/ e passaram para a camada oficial compartilhada:
  - AuthModal -> src/components/shared/overlays/AuthModal.tsx
  - ConfirmModal -> src/components/shared/overlays/ConfirmModal.tsx
  - SuccessModal -> src/components/shared/overlays/SuccessModal.tsx
  - UpgradeModal -> src/components/shared/overlays/UpgradeModal.tsx
  - PromoBanner -> src/components/shared/feedback/PromoBanner.tsx
  - ProgressBar -> src/components/shared/ui/ProgressBar.tsx
- Os consumidores foram alinhados em Layout, QuestionCard, ModalProvider, ank-analysis, marketplace, partner-dashboard, practice, profile, anking e simulation.

### Resultado direto na raiz do frontend
- components/ caiu para 10 arquivos restantes:
  - AdBanner.tsx
  - Auth.tsx
  - CommentsSection.tsx
  - DevModeBanner.tsx
  - Layout.tsx
  - LegacyAddressParser.tsx
  - PaymentModal.tsx
  - PdfViewer.tsx
  - QuestionCard.tsx
  - RichTextEditor.tsx
- Isso reduz a raiz, mas ainda ha componentes grandes a migrar com mais cuidado por dependerem de dominio ou composicao ampla.

### Validacao executada
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin

### Proximo alvo correto
- Continuar a migracao de components/ pela proxima leva segura: Layout, AdBanner, DevModeBanner e componentes de leitura/feedback que sao realmente compartilhados.
- Em paralelo, iniciar a classificacao dos scripts soltos da raiz do backend para a futura migracao a scripts/.
## 2026-04-02 - Rodada de migracao estrutural e feature report

### Objetivo da rodada

- continuar a migracao para a arquitetura oficial revisada
- esvaziar a raiz legada de components/
- ampliar a documentacao funcional da plataforma
- remover artefatos temporarios e diretorios ja mortos

### Alteracoes realizadas no frontend

- movido components/Auth.tsx para src/app/auth/components/Auth.tsx
- movido components/PaymentModal.tsx para src/app/marketplace/components/PaymentModal.tsx
- movido components/QuestionCard.tsx para src/app/questions/components/QuestionCard.tsx
- movido components/PdfViewer.tsx para src/components/shared/overlays/PdfViewer.tsx
- movido components/CommentsSection.tsx para src/components/shared/feedback/CommentsSection.tsx
- movido components/RichTextEditor.tsx para src/components/shared/ui/RichTextEditor.tsx
- removido components/LegacyAddressParser.tsx por nao possuir uso real no codigo ativo
- src/app/auth/page.tsx passou a consumir o componente local da feature
- src/app/marketplace/page.tsx, src/app/reader/page.tsx, src/app/practice/page.tsx e src/app/simulation/page.tsx foram alinhados aos novos caminhos oficiais
- src/services/payments/paymentsService.ts ganhou processMaterialPayment(...) para tirar HTTP cru do modal de compra de materiais
- src/app/checkout/page.tsx passou a usar a camada oficial de auth no fluxo de cadastro inline

### Documentacao funcional

- docs/feature-report.md foi reescrito para documentar a plataforma por rotas, dominios, providers, services, modulos backend e divergencias abertas

### Limpeza executada

- removido o diretorio raiz components/
- removido dist/ apos a validacao
- removidos uth-cookies.txt, uth-login.json, 	mp-vite-direct-out.log, 	mp-vite-direct-err.log, stripe-listener.log e stripe-listener.err.log
- src/pages/ continua vazio, mas ainda bloqueado por processo externo no filesystem

### Validacao

- 
px vitest run src/services/payments/__tests__/paymentsService.test.ts passou
- 
pm run build passou
- 
pm run test:auth passou
- 
pm run test:admin passou

### Pendencias reais apos a rodada

- src/shared/ ainda existe como zona legada e precisa ser consolidado ou removido
- src/features/ e src/core/ seguem como areas legadas da migracao
- src/pages/ ainda precisa ser removido fisicamente quando o lock externo liberar
- o backend ainda precisa continuar a despoluicao da raiz e a reducao de pi/ a bridges minimos
### Ajuste adicional de limpeza

- src/shared/ foi removido por nao possuir consumidores ativos no frontend atual
- src/pages/ segue vazio, mas ainda bloqueado por processo externo e nao pode ser removido fisicamente nesta sessao
## 2026-04-02 - Consolidacao da camada oficial de API e ampliacao do feature report

### Objetivo da rodada

- mover a implementacao principal da camada HTTP para src/services/api
- transformar src/core/api em bridge legado
- reduzir strings soltas de endpoints nos services criticos
- ampliar o eature-report para funcionar como inventario funcional mais completo da plataforma

### Alteracoes realizadas

#### Frontend - camada oficial de API

- criei src/services/api/client.ts
- criei src/services/api/interceptors.ts
- criei src/services/api/endpoints.ts
- criei src/services/api/types.ts
- atualizei src/services/api/index.ts para exportar a implementacao oficial
- converti src/core/api/client.ts, src/core/api/endpoints.ts, src/core/api/types.ts e src/core/api/index.ts em bridges legados

#### Frontend - alinhamento de consumers

- src/app/admin/page.tsx passou a importar a camada oficial em @services/api
- src/app/bank-analysis/page.tsx passou a importar a camada oficial em @services/api
- src/app/checkout/page.tsx passou a importar a camada oficial em @services/api
- src/app/marketplace/page.tsx passou a importar a camada oficial em @services/api

#### Frontend - normalizacao de services

- src/services/subscriptions/subscriptionsService.ts deixou de depender de strings soltas com caminhos absolutos e passou a usar ENDPOINTS.subscriptions.*
- src/services/billing/cardsService.ts passou a usar ENDPOINTS.users.*
- src/services/admin/adminService.ts passou a usar ENDPOINTS para settings, 2FA, feedback e stats
- src/services/payments/paymentsService.ts passou a usar ENDPOINTS.payments.*
- src/features/plans/services/planService.ts passou a usar ENDPOINTS.plans.list
- src/features/bank-analysis/services/bankAnalysisService.ts passou a usar ENDPOINTS.bankAnalysis.*

#### Frontend - checkout

- src/app/checkout/page.tsx passou a usar cardsService.listSavedCards(...)
- src/app/checkout/page.tsx passou a usar planService.validateCoupon(...)
- src/app/checkout/page.tsx passou a usar uthFlowService.resendConfirmation(...)
- removi um ramo inconsistente que ainda tentava ler esult.message apos a migracao do login para uthFlowService

#### Frontend - limpeza adicional

- removi o alias morto @components de 	sconfig.json e ite.config.ts
- removi import nao usado de xios em src/app/marketplace/page.tsx

#### Documentacao

- reescrevi docs/feature-report.md para documentar:
  - rotas publicas, autenticadas e administrativas
  - features locais por dominio
  - componentes compartilhados reais
  - providers globais
  - services globais do frontend
  - modulos oficiais do backend
  - diretorios legados ainda abertos
  - divergencias arquiteturais e impacto funcional

### Validacao

- 
pm run build passou
- 
px vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts src/services/billing/__tests__/cardsService.test.ts src/services/admin/__tests__/adminService.test.ts src/services/payments/__tests__/paymentsService.test.ts passou
- 
pm run test:auth passou
- 
pm run test:admin passou
- http://localhost:3000/#/ respondeu 200

### Impacto arquitetural

- src/services/api passa a ser a implementacao oficial da camada HTTP, como exige a arquitetura revisada
- src/core/api passa a existir apenas como compatibilidade temporaria
- o frontend reduz dependencia de paths absolutos e prepara a limpeza futura da raiz do backend
- o eature-report passa a ser um inventario funcional muito mais completo da plataforma
## 2026-04-02 - Migracao adicional de services, arquitetura da base e inventario funcional completo

### O que foi feito
- realoquei as implementacoes reais de comentarios, questoes, notificacoes, estatisticas e bank-analysis de src/features/*/services para src/services/*, deixando bridges finos nos caminhos antigos;
- normalizei mais strings cruas de endpoint em dminService, marketplaceService e ENDPOINTS;
- movi schema.sql da raiz do frontend para C:\xampp\htdocs\questao-pro-backend\database\schema.sql, classificando o schema-base no lugar correto;
- movi ARCHITECTURE_README.md e LEGACY.md para docs/legacy/ no frontend;
- movi STRIPE_SETUP.md para config/stripe-setup.md e OPTIMIZATION_SUMMARY.md para scripts/optimization-summary.md no backend, reduzindo poluicao da raiz;
- criei C:\xampp\htdocs\questao-pro-backend\database\architecture.md para documentar a arquitetura atual da base de dados;
- reescrevi C:\dev\concursomestre\docs\feature-report.md para detalhar rotas, providers, services e funcoes principais da plataforma.

### Validacao
- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
- 
px vitest run src/services/questions/__tests__/questionService.test.ts src/services/comments/__tests__/commentsService.test.ts src/services/notifications/__tests__/notificationService.test.ts src/services/bank-analysis/__tests__/bankAnalysisService.test.ts src/services/payments/__tests__/paymentsService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts
- C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\database\architecture.md

### Observacoes
- a raiz do frontend ficou menos poluida, mas ainda restam artefatos como constants.backup.ts, ix_admin.cjs, materials.json, metadata.json, 	ypes-plan.d.ts e 	ypes.ts aguardando classificacao ou remocao segura;
- a raiz do backend melhorou, mas ainda restam diretorios legados de dominio fora do desenho final, como plans, eferrals, scrapper, subscriptions e 	ransactions.
## 2026-04-03 - README, imagem institucional, limpeza de raiz e migracao do dominio de planos

### O que foi feito

- reescrito o README.md para refletir a plataforma real, incluindo proposta do produto, arquitetura, passos de execucao e mapa de documentacao
- criado o asset visual oficial em src/assets/site/concurso-mestre-platform.svg e integrado na landing page em src/app/landing/page.tsx
- atualizado index.html com titulo e descricao coerentes com a plataforma de questoes, simulados, ranking e materiais
- migrado planService para src/services/plans/planService.ts, deixando src/features/plans/services/planService.ts apenas como bridge legado
- removido o ultimo acoplamento cru de parcelas dentro do checkout, agora usando paymentsService.getInstallments(...)
- ampliado o eature-report.md para documentar rotas, providers, services e funcoes principais da plataforma
- reforcado database/architecture.md com dominios, tabelas, relacoes, modulos PHP x base e fluxos criticos
- removidos artefatos mortos da raiz do frontend: constants.backup.ts, ix_admin.cjs, materials.json, metadata.json e 	ypes-plan.d.ts
- centralizado o backup legado ackup_pre_phase2_20260205_201628 dentro de ackups/
- removidos artefatos tecnicos mortos do backend: models_output.json, out.json, plans/debug_plans.php, plans/plans_output.json, subscriptions/payment_debug.log, subscriptions/tmp_schema.php e scrapper/questoes/front.php

### Beneficios

- a raiz do projeto ficou consideravelmente mais limpa e mais proxima da arquitetura revisada
- a apresentacao publica do produto deixou de refletir o template original de AI Studio e passou a comunicar a plataforma real
- o dominio de planos avançou para a camada oficial de services, reduzindo dependencia de src/features/*
- a documentacao funcional e de banco ficou mais util para onboarding, manutencao e auditoria

### Validacao

- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
- 
px vitest run src/services/auth/__tests__/authFlowService.test.ts src/services/billing/__tests__/cardsService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts src/services/payments/__tests__/paymentsService.test.ts src/services/changelog/__tests__/changelogService.test.ts
- http://localhost:3000/#/ respondeu 200

### Pendencias abertas

- continuar esvaziando src/features/* e src/core/*
- mover a tipagem global da raiz 	ypes.ts para a camada oficial src/types/*
- classificar os diretorios legados restantes da raiz do backend (plans, eferrals, scrapper, subscriptions, 	ransactions) antes de remover ou realocar
- consolidar o relatorio tecnico final com arvore final, exclusoes e excecoes arquiteturais
## 2026-04-03 - Internalizacao de tipagens globais e modulo oficial de planos

### O que foi feito

- movida a tipagem global da raiz do frontend para src/types/global.ts
- atualizado src/types/index.ts para apontar para a nova camada oficial
- removido 	ypes.ts da raiz do frontend
- atualizados imports legados para @types em src/core/auth/session.ts, src/features/comments/types.ts, src/features/notifications/types.ts, src/features/questions/types.ts, src/features/rankings/index.ts, src/features/rankings/services/rankingsService.ts, src/features/plans/components/PlanCard.tsx, src/features/payments/components/StripeCardElementForm.tsx e src/features/subscriptions/utils/planAccess.ts
- criado o modulo oficial modules/plans no backend com controller, service, epository, alidator e outes.php
- transformado plans/list.php em bridge fino para handlePlansListRoute(...)
- criado o teste de wiring 	ests/PlansModuleWiringTest.php
- atualizados eature-report.md e database/architecture.md para refletir o modulo plans

### Beneficios

- a raiz do frontend ficou ainda mais limpa e aderente ao blueprint revisado
- a camada oficial de tipagens deixou de depender de um arquivo solto fora de src/
- o backend ganhou mais um dominio dentro da estrutura oficial modules/*
- plans/ na raiz do backend agora se comporta como bridge legado fino, nao mais como endpoint com regra solta

### Validacao

- 
pm run build
- 
pm run test:auth
- 
pm run test:admin
- 
px vitest run src/services/payments/__tests__/paymentsService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts
- http://localhost:3000/#/ respondeu 200
- php -l passou nos arquivos de modules/plans
- C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\PlansModuleWiringTest.php

### Pendencias abertas

- continuar esvaziando src/features/* e src/core/*
- classificar o diretorio raiz eferrals/ do backend, que e o proximo candidato natural a migracao para modulo oficial
- classificar os diretorios legados restantes do backend (scrapper, subscriptions, 	ransactions) entre bridge, script operacional e lixo removivel
- consolidar o relatorio tecnico final
## 2026-04-03 - Modulo users, reputacao oficial e limpeza da raiz legado do backend

### O que foi feito
- criado o modulo oficial modules/users no backend com controller, service, repository, validator e routes.php para o resumo de indicacoes;
- transformado api/referrals/stats.php em bridge fino para handleUsersReferralStatsRoute(...);
- removido o diretorio legado C:\xampp\htdocs\questao-pro-backend\referrals, que deixou de ser necessario;
- criada a fachada oficial src/services/auth/reputationService.ts, deixando src/features/auth/services/reputationService.ts apenas como bridge fino;
- normalizado src/services/profile/profileService.ts para consumir ENDPOINTS.users.referralStats;
- adicionadas regras de rewrite em C:\xampp\htdocs\questao-pro-backend\.htaccess para preservar URLs legadas de plans, transactions e subscriptions sem manter os diretorios fisicos na raiz;
- removidos os diretorios legados C:\xampp\htdocs\questao-pro-backend\plans, C:\xampp\htdocs\questao-pro-backend\transactions e C:\xampp\htdocs\questao-pro-backend\subscriptions;
- removidos artefatos mortos em api/plans/debug_plans.php, api/plans/plans_output.json, api/subscriptions/payment_debug.log e api/subscriptions/tmp_schema.php;
- atualizado o teste C:\xampp\htdocs\questao-pro-backend\tests\PlansModuleWiringTest.php para validar o bridge oficial em api/plans/list.php.

### Validacao
- npm run build
- npx vitest run src/services/profile/__tests__/profileService.test.ts src/core/auth/__tests__/session.test.ts src/services/admin/__tests__/adminService.test.ts
- npm run test:auth
- npm run test:admin
- http://localhost:3000/#/ respondeu 200
- php -l passou nos arquivos de modules/users e em api/referrals/stats.php
- C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\UsersModuleWiringTest.php
- C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\PlansModuleWiringTest.php
- http://localhost/questao-pro-backend/plans/list.php respondeu 200
- http://localhost/questao-pro-backend/transactions/list.php respondeu 200
- http://localhost/questao-pro-backend/subscriptions/update_renewal.php respondeu 401, confirmando a preservacao da rota legada com protecao de autenticacao

### Beneficios
- o dominio de indicacoes saiu da raiz e entrou na arquitetura oficial de modulo por dominio;
- a raiz do backend ficou menos poluida e mais aderente ao blueprint revisado;
- URLs antigas continuam funcionando, mas agora sem carregar regra de negocio fora de api/ e modules/;
- o frontend ficou mais coerente ao consumir reputacao e referrals pela camada oficial de services.
### Ajuste de consistencia apos validacao
- api/plans/list.php ainda estava com implementacao procedural direta; ele foi convertido para bridge fino do modulo plans.
- o teste PlansModuleWiringTest voltou a passar e a URL http://localhost/questao-pro-backend/api/plans/list.php permaneceu respondendo 200.
## 2026-04-03 - Reclassificacao do scrapper e retirada de imports ativos de src/features

### O que foi feito
- movido o importador operacional de questoes da Gran de C:\xampp\htdocs\questao-pro-backend\scrapper\questoes para C:\xampp\htdocs\questao-pro-backend\scripts\importers\questions\gran;
- ajustados os caminhos internos de include e o link de retorno da interface operacional para refletir a nova localizacao;
- removido o diretorio raiz C:\xampp\htdocs\questao-pro-backend\scrapper;
- movido PlanCard para src/app/plans/components/PlanCard.tsx;
- movidos StripeCardElementForm e StripeSavedCardCvcForm para src/app/checkout/components/;
- movido StripeSetupCardForm para src/app/profile/components/;
- movido aiService para src/services/questions/aiService.ts;
- atualizados os entry points de admin, plans, checkout e profile para consumirem caminhos oficiais em src/app e src/services;
- mantidos bridges finos em src/features para compatibilidade temporaria durante a ultima fase de limpeza.

### Beneficios
- a raiz do backend ficou mais aderente ao blueprint revisado, com ferramentas operacionais vivendo em scripts/;
- paginas centrais do frontend deixaram de depender de componentes ativos em src/features/*;
- a camada oficial src/services/questions passou a concentrar de forma clara a IA usada pelo admin.

### Validacao
- npm run build
- npm run test:auth
- npm run test:admin
- http://localhost:3000/#/ respondeu 200
- http://localhost/questao-pro-backend/scripts/importers/questions/gran/index.php respondeu 200
- php -l passou em scripts/importers/questions/gran/index.php e import_worker.php
## 2026-04-03 - Remocao de src/features e src/core do caminho produtivo

### O que foi feito
- movido o estado de sessao para src/services/auth/session.ts e atualizado o consumo em AuthProvider e na camada de API;
- movido o DebugLogger para src/utils/helpers/DebugLogger.ts e atualizado o consumo em interceptors e DebugBanner;
- movido planAccess para src/services/plans/planAccess.ts e atualizado pages e componentes compartilhados;
- movidas tipagens de bank-analysis e statistics para src/services/*/types.ts;
- movido o teste de sessao para src/services/auth/__tests__/session.test.ts;
- removidos fisicamente os diretorios src/features e src/core;
- removidos os aliases @features e @core de tsconfig.json e vite.config.ts;
- movidos tmp/inspect_db.php e tmp/migrate_2fa.php para scripts/maintenance/ e removido o diretorio tmp do backend.

### Beneficios
- o frontend ficou mais aderente ao blueprint revisado, sem camadas concorrentes de core/features no codigo ativo;
- o backend ficou com a raiz mais limpa, sem tmp/ ambigua;
- a configuracao do projeto passou a impedir regressao para caminhos legados.

### Validacao
- npm run build
- npm run test:auth
- npm run test:admin
- http://localhost:3000/#/ respondeu 200
- php -l passou em scripts/maintenance/inspect_db.php e scripts/maintenance/migrate_2fa.php
## 2026-04-03 - Expansao do modulo users para foto de perfil e troca de senha

### O que foi feito
- expandido modules/users com fluxos de upload de foto e troca de senha do proprio usuario;
- adicionados metodos novos em UsersController, UsersService, UsersRepository e UsersValidator;
- criado api/users/change_password.php como bridge fino para o modulo users;
- convertido api/users/upload_photo.php para bridge fino do modulo users;
- atualizados ENDPOINTS.users.uploadPhoto e ENDPOINTS.users.changePassword no frontend;
- alinhado src/services/profile/profileService.ts para consumir os endpoints oficiais do catalogo;
- ampliado tests/UsersModuleWiringTest.php para validar os novos bridges de users.

### Beneficios
- o perfil deixa de depender de um endpoint inexistente para troca de senha;
- o upload de foto ficou mais seguro, com validacao de tipo real e limite de tamanho;
- o dominio users passou a concentrar mais regra de conta na arquitetura oficial.

### Validacao
- npx vitest run src/services/profile/__tests__/profileService.test.ts
- C:\xampp\php\php.exe -l passou em modules/users e nos bridges api/users/upload_photo.php e api/users/change_password.php
- C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\UsersModuleWiringTest.php
- npm run build
- npm run test:auth
- npm run test:admin
- http://localhost:3000/#/ respondeu 200
- http://localhost/questao-pro-backend/api/users/change_password.php respondeu 401 sem sessao
- http://localhost/questao-pro-backend/api/users/upload_photo.php respondeu 401 sem sessao## 2026-04-03 - users absorve profile/update e elimina duplicacao de auth me

### O que foi feito
- expandido `modules/users` para cobrir snapshot autenticado do perfil e atualizacao cadastral;
- adicionados `UsersController::getAuthenticatedProfile()` e `UsersController::updateAuthenticatedProfile()`;
- adicionados `UsersService::getAuthenticatedProfile()` e `UsersService::updateAuthenticatedProfile()` com regra de montagem do payload e transacao unica;
- ampliado `UsersRepository` com leitura completa do perfil, assinatura, comentarios, cartao preferencial e `upsert` de endereco/conta bancaria;
- ampliado `UsersValidator` com `validateProfileUpdatePayload()` para whitelisting e normalizacao do payload;
- convertido `api/users/profile.php` e `api/users/update.php` em bridges finos do modulo `users`;
- convertido `api/auth/me.php` em bridge fino para o mesmo handler do modulo `users`, removendo duplicacao do snapshot autenticado;
- alinhado o frontend para usar `ENDPOINTS.users.update = users/update.php` e `ENDPOINTS.users.profile = users/profile.php`.

### Beneficios
- o dominio `users` passa a concentrar de fato o perfil autenticado, sem controller procedural gigante em `api/users/update.php`;
- a duplicacao entre `users/profile.php` e `auth/me.php` foi eliminada;
- a atualizacao de perfil ficou mais segura, com whitelist de campos e transacao para `users`, `addresses` e `bank_accounts`;
- o modulo passou a devolver um snapshot mais rico e previsivel para sessao/perfil, incluindo assinatura, comentarios e alertas basicos de pagamento.

### Validacao
- `npx vitest run src/services/auth/__tests__/accountService.test.ts src/services/profile/__tests__/profileService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- `C:\xampp\php\php.exe -l` passou em `modules/users/*`, `api/users/profile.php`, `api/users/update.php` e `api/auth/me.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\UsersModuleWiringTest.php`
- `http://localhost:3000/#/` respondeu `200`
- `http://localhost/questao-pro-backend/api/users/profile.php` respondeu `401` sem sessao valida
- `http://localhost/questao-pro-backend/api/users/update.php` respondeu `401` sem sessao valida
- `http://localhost/questao-pro-backend/api/auth/me.php` respondeu `401` sem sessao valida## 2026-04-03 - users materials migrado para modules/materials

### O que foi feito
- expandido `modules/materials` com a leitura da biblioteca de materiais comprados pelo usuario autenticado;
- adicionados `MaterialsController::listPurchasedMaterials()` e `MaterialsService::listPurchasedMaterials()`;
- ampliado `MaterialsRepository` com `fetchPurchasedMaterialsByUser()`;
- ampliado `MaterialsValidator` com `validatePurchasedMaterialsRequest()` para impedir leitura arbitraria por query string fora de contexto admin;
- criado `handleMaterialsPurchasedLibraryRoute($db)` em `modules/materials/routes.php`;
- convertido `api/users/materials.php` em bridge fino para o modulo `materials`;
- criado `tests/MaterialsModuleWiringTest.php` para proteger o wiring do dominio.

### Beneficios
- a regra de biblioteca do usuario saiu do endpoint procedural e passou a viver no modulo correto de materiais;
- o backend deixou de confiar cegamente no `userId` vindo por query string;
- a compatibilidade do frontend foi preservada, sem mudar o contrato consumido pelo perfil.

### Validacao
- `C:\xampp\php\php.exe -l` passou em `modules/materials/*` e `api/users/materials.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\MaterialsModuleWiringTest.php`
- `npx vitest run src/services/marketplace/__tests__/marketplaceService.test.ts`
- `http://localhost/questao-pro-backend/api/users/materials.php?userId=usr-x` respondeu `401` sem sessao valida
- `http://localhost:3000/#/` respondeu `200`## 2026-04-03 - access e download de materiais migrados para modules/materials

### O que foi feito
- expandido `modules/materials` para cobrir abertura inline e download protegido de PDFs comprados;
- adicionados `MaterialsController::buildProtectedAccessPdf()` e `MaterialsController::buildProtectedDownloadPdf()`;
- adicionados `MaterialsService::buildProtectedAccessPdf()` e `MaterialsService::buildProtectedDownloadPdf()` com validacao de permissao, resolucao segura do arquivo e geracao do PDF personalizado;
- adicionadas funcoes `handleMaterialsAccessRoute($db)` e `handleMaterialsDownloadRoute($db)` em `modules/materials/routes.php`;
- convertido `api/materials/access.php` e `api/materials/download.php` em bridges finos do modulo `materials`;
- removido `api/materials/material_access_helper.php`, que ficou obsoleto apos a migracao;
- formalizados `ENDPOINTS.materials.access` e `ENDPOINTS.materials.download` no frontend, com `client.ts` usando o catalogo oficial.

### Beneficios
- a regra de acesso protegido a PDF saiu do helper procedural e foi concentrada no modulo oficial de materiais;
- a validacao de permissao passou a ficar junto da regra de dominio, e nao espalhada em arquivos soltos;
- o backend ganhou mais uma limpeza real em `api/materials`, sem helper legado duplicando fluxo.

### Validacao
- `C:\xampp\php\php.exe -l` passou em `modules/materials/services/MaterialsService.php`, `modules/materials/routes.php`, `api/materials/access.php` e `api/materials/download.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\MaterialsModuleWiringTest.php`
- `npx vitest run src/services/marketplace/__tests__/marketplaceService.test.ts src/services/auth/__tests__/accountService.test.ts src/services/profile/__tests__/profileService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- `http://localhost/questao-pro-backend/api/materials/access.php?id=mat-x` respondeu `401` sem sessao valida
- `http://localhost/questao-pro-backend/api/materials/download.php?material_id=mat-x` respondeu `401` sem sessao valida
- `http://localhost:3000/#/` respondeu `200`
## 2026-04-03 - reader state de materiais migrado para modules/materials

- migratei pi/materials/get_bookmarks.php, save_bookmark.php, delete_bookmark.php, get_highlights.php, save_highlight.php, delete_highlight.php, get_note.php e save_note.php para bridges finos do modulo materials;
- concentrei SQL em modules/materials/repositories/MaterialsRepository.php, regra de negocio em services/MaterialsService.php, validacao em alidators/MaterialsValidator.php e respostas/rotas em modules/materials/routes.php;
- criei src/services/materials/readerService.ts e tirei do PdfViewer as chamadas cruas de nota e marcadores;
- corrigi um bug funcional do leitor: a lateral de marcadores nao era recarregada ao abrir e nem tinha botao visivel no toolbar;
- corrigi uma inconsistencia estrutural da base local, migrando user_bookmarks.user_id/material_id e user_highlights.user_id/material_id para VARCHAR(36) para acompanhar o modelo atual de IDs string.

## 2026-04-03 - users absorve comments e notes do perfil

- migrei pi/users/comments.php e pi/users/notes.php para bridges finos do modulo users;
- concentrei leitura de comentarios/notas em modules/users/repositories/UsersRepository.php, regra em services/UsersService.php, validacao/autorizacao em alidators/UsersValidator.php e resposta em modules/users/routes.php;
- os endpoints agora exigem sessao autenticada e so aceitam consultar outro usuario em contexto admin;
- mantive compatibilidade com os parametros legados user_id e userId, mas o backend deixou de confiar neles como fonte de verdade.

## 2026-04-03 - users absorve answers do progresso

- migrei pi/users/answers.php para bridge fino do modulo users;
- concentrei a leitura de user_answers em modules/users/repositories/UsersRepository.php, regra em services/UsersService.php e resposta em modules/users/routes.php;
- o endpoint agora exige sessao autenticada e so permite consultar outro usuario em contexto admin, alinhando answers ao mesmo padrao de comments e 
otes.

## 2026-04-03 - users absorve billing basico de cartoes salvos

- pi/users/list_cards.php, pi/users/remove_card.php e pi/users/set_default_card.php viraram bridges finos para modules/users.
- O modulo ganhou UsersCardsController.php e UsersCardsService.php, mantendo controller fino e regra de billing fora do legado procedural.
- O suporte Stripe de cartoes saiu de pi/users/stripe_card_helpers.php e passou a viver em modules/users/services/UsersCardsStripeSupport.php; o arquivo em pi/users ficou apenas como bridge de compatibilidade.
- pi/users/card_request_auth.php foi removido por nao ter mais consumidores ativos apos a extracao desse slice.
- A persistencia local de cartoes continuou preservada, com listagem, remocao, definicao de padrao e sincronizacao do flag users.has_saved_card.
- Validacao executada: php -l, UsersModuleWiringTest.php, cardsService.test.ts, 
pm run build, 
pm run test:auth, 
pm run test:admin, home 200, endpoints protegidos 401 sem sessao.
## 2026-04-03 - users absorve setup e sync de cartoes do perfil

- pi/users/create_stripe_setup_intent.php, pi/users/sync_stripe_card.php e pi/users/save_card.php viraram bridges finos para modules/users.
- O modulo users passou a centralizar o restante do billing do perfil em UsersCardsService.php, incluindo SetupIntent Stripe, sincronizacao do payment method salvo e persistencia do cofre legado/local.
- O contrato do frontend foi preservado para cardsService.createStripeSetupIntent(), cardsService.syncStripeCard() e cardsService.saveLegacyCard().
- O handler de save_card agora exige sessao autenticada e resolve user_id do payload apenas como compatibilidade, usando a sessao como fonte de verdade.
- Validacao executada: php -l, UsersModuleWiringTest.php, cardsService.test.ts, 
pm run build, 
pm run test:auth, 
pm run test:admin, home 200, endpoints protegidos 401 sem sessao.
## 2026-04-03 - subscriptions deixa de depender de helpers de dominio em api

- pi/subscriptions/subscription_helpers.php e pi/subscriptions/stripe_payment_validator.php sairam de pi/ e foram internalizados em modules/subscriptions/services/SubscriptionsBillingSupport.php e modules/subscriptions/services/StripePaymentApprovalValidator.php.
- modules/subscriptions/SubscriptionsService.php, modules/transactions/TransactionsService.php, pi/utils/payment_refund_helper.php e pi/subscriptions/process_payment.php passaram a apontar para os helpers oficiais do modulo.
- pi/users/stripe_card_helpers.php tambem foi removido; modules/subscriptions agora consome modules/users/services/UsersCardsStripeSupport.php diretamente.
- Validacao executada: php -l nos arquivos afetados, StripePaymentApprovalValidatorTest.php, StripeSubscriptionBillingTermTest.php, endpoint protegido 401, home 200.## 2026-04-03 - users absorve listagem admin, delete_note e pedido de exclusao

- pi/users/list.php, pi/users/delete_note.php e pi/users/delete.php viraram bridges finos para modules/users/routes.php.
- modules/users passou a concentrar a listagem administrativa de usuarios, a exclusao de anotacoes do proprio usuario e o registro de pedido de exclusao de conta.
- users/list.php agora exige sessao autenticada com papel dmin, em vez de expor a listagem sem autorizacao.
- users/delete_note.php deixou de confiar em user_id do payload como fonte de verdade e passou a resolver ownership pela sessao, com excecao apenas para admin.
- users/delete.php saiu do fluxo com JWT manual e agora usa a sessao oficial via equest_auth.php, mantendo reCAPTCHA e registrando a conta como pending_deletion.
- Validacao executada: php -l, UsersModuleWiringTest.php, dminService.test.ts, userProgressService.test.ts, 
pm run build, 
pm run test:auth, 
pm run test:admin, home 200, endpoints protegidos 401 sem sessao.## 2026-04-03 - auth absorve sessao e recuperacao de conta

- criei o modulo modules/auth com AuthController.php, AuthService.php, AuthRepository.php, AuthValidator.php e outes.php.
- pi/auth/logout.php, pi/auth/refresh.php, pi/auth/forgot-password.php, pi/auth/reset-password.php, pi/auth/resend-confirmation.php e pi/auth/confirm-email.php agora sao bridges finos para o modulo oficial.
- o refresh e o logout passaram a depender do wiring oficial do modulo, reaproveitando a infraestrutura transversal de sessao em AuthSession.php sem deixar a regra colada nos endpoints.
- o slice de recuperacao/confirmacao de conta agora concentra tabela de resets, tabela de verificacao de e-mail, notificacao de boas-vindas, envio de e-mail e validacao de payload no modulo uth.
- validacao executada: php -l, AuthModuleWiringTest.php, uthFlowService.test.ts, 
pm run build, 
pm run test:auth, 
pm run test:admin.## 2026-04-03 - auth absorve login, cadastro e 2FA

- pi/auth/login.php, pi/auth/register.php, pi/auth/setup_2fa.php, pi/auth/enable_2fa.php e pi/auth/verify_2fa.php viraram bridges finos para modules/auth/routes.php.
- modules/auth agora centraliza login com sessao oficial, cadastro com emissao de bundle, verificacao de 2FA, setup/ativacao de 2FA e onboarding inicial de e-mail/referral/notificacao.
- o login e o cadastro passaram a reaproveitar o snapshot oficial de usuario do dominio users, reduzindo duplicacao de regra de perfil dentro do fluxo de autenticacao.
- o bloco de 2FA deixou de depender de JWT manual nos endpoints admin e passou a usar a sessao oficial via equest_auth.php.
- validacao executada: php -l, AuthModuleWiringTest.php, uthFlowService.test.ts, dminService.test.ts, 
pm run build, 
pm run test:auth, 
pm run test:admin, home 200, setup_2fa.php protegido com 401 sem sessao.## 2026-04-03 - notifications absorve inbox, leitura e limpeza

- criei o modulo modules/notifications com NotificationsController.php, NotificationsService.php, NotificationsRepository.php, NotificationsValidator.php e routes.php.
- api/notifications/list.php, mark-read.php, mark_read.php, mark-all-read.php, mark_all_read.php, delete.php, clear_all.php e send.php agora sao bridges finos para modules/notifications/routes.php.
- adicionei api/notifications/clear.php como bridge legado para manter compatibilidade com rewrites antigos.
- corrigi api/.htaccess para cobrir notificationsMarkAllRead e notificationsClearAll, que estavam inconsistentes com o catalogo oficial do frontend.
- a listagem, a marcacao individual, a marcacao em lote, a exclusao logica, a limpeza em lote e o envio de notificacoes agora usam a sessao oficial via request_auth.php.
- notifications/send.php deixou de ser endpoint permissivo sem sessao; agora usuarios autenticados podem notificar a si mesmos e o pseudo-destinatario admin, enquanto administradores continuam podendo disparar para outros escopos.
- validacao executada: php -l, NotificationsModuleWiringTest.php, notificationService.test.ts, npm run build, npm run test:auth, npm run test:admin, smokes 401 em notifications/list.php, mark-all-read.php, clear_all.php, notificationsMarkAllRead e notificationsClearAll.## 2026-04-03 - comments absorve listagem e mutacoes

- criei o modulo modules/comments com CommentsController.php, CommentsService.php, CommentsRepository.php, CommentsValidator.php e routes.php.
- api/comments/list.php, api/comments/handle.php e api/comments/list_cached.php agora sao bridges finos para modules/comments/routes.php.
- comments/list.php continua publico, mas agora usa autenticacao opcional apenas para calcular isLiked sem depender de SQL procedural na rota.
- comments/handle.php passou a usar a sessao autenticada como fonte de verdade para add/like/delete, deixando de confiar em userId do payload.
- a regra de QA de materiais, a validacao de ownership para delete, o toggle de likes e as notificacoes derivadas de resposta/curtida sairam do procedural e entraram no service oficial do dominio.
- list_cached.php deixou de carregar o cache procedural legado e virou bridge funcional para a listagem oficial, preservando apenas o header X-Cache: BYPASS de compatibilidade.
- validacao executada: php -l, CommentsModuleWiringTest.php, commentsService.test.ts, npm run build, npm run test:auth, npm run test:admin, comments/list.php 200, comments/list_cached.php 200 e comments/handle.php 401 sem sessao em POST.## 2026-04-03 - questions absorve progresso e salvos

- Criado o modulo oficial modules/questions com controllers, services, epositories, alidators e outes.php.
- pi/questions/answer.php, history.php, eset_answers.php e 	oggle_save.php agora sao bridges finos.
- O backend oficializou a gravacao de respostas, historico, limpeza de respostas e toggle de salvos usando sessao autenticada como fonte de verdade.
- questionService passou a ler 
ew_xp/new_level do envelope padronizado e ganhou getQuestionHistory(...).
- debug_answer_log.txt foi removido como resquicio legado do endpoint procedural.

Validacao desta rodada:
- php -l passou nos arquivos do modulo e nos bridges
- QuestionsModuleWiringTest.php passou
- 
px vitest run src/services/questions/__tests__/questionService.test.ts passou
- 
pm run build passou
- 
pm run test:auth passou
- 
pm run test:admin passou
- pi/questions/history.php respondeu 200
- pi/questions/answer.php, eset_answers.php e 	oggle_save.php responderam 401 sem sessao## 2026-04-03 - questions absorve listagem, filtro admin e stats

- pi/questions/list.php, ilter.php e get_stats.php agora sao bridges finos para modules/questions.
- O modulo questions passou a concentrar listagem principal, filtro administrativo e estatisticas agregadas por questao.
- QuestionCard saiu de requests crus para questionService.getQuestionStats(...) e questionService.getQuestionHistory(...).
- questionService ganhou normalizacao segura para historico vazio e estatisticas de questao.
- O filtro administrativo de questoes agora exige sessao autenticada de admin.

Validacao desta rodada:
- php -l passou nos arquivos do modulo, nos bridges e no wiring test
- QuestionsModuleWiringTest.php passou
- 
px vitest run src/services/questions/__tests__/questionService.test.ts passou
- 
pm run build passou
- 
pm run test:auth passou
- 
pm run test:admin passou
- pi/questions/list.php respondeu 200
- pi/questions/get_stats.php?question_id=1 respondeu 200
- pi/questions/filter.php respondeu 401 sem sessao## 2026-04-03 - questions absorve persistencia e edicao administrativa

- pi/questions/create.php, save.php, update.php, edit.php e delete.php agora sao bridges finos para modules/questions.
- O modulo questions passou a concentrar criacao, atualizacao, leitura para edicao e exclusao administrativa de questoes.
- questionService.updateQuestion(...) passou a usar questionsUpdate de forma explicita.
- A tela [admin/page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de chamar ENDPOINTS.questions.filter cru e passou a usar dminService.getQuestions(...).

Validacao desta rodada:
- php -l passou nos arquivos do modulo, novos bridges e wiring test
- QuestionsModuleWiringTest.php passou
- 
px vitest run src/services/questions/__tests__/questionService.test.ts passou
- 
pm run build passou
- 
pm run test:auth passou
- 
pm run test:admin passou
- pi/questions/create.php, save.php, update.php, edit.php e delete.php responderam 401 sem sessao
## 2026-04-04 - Settings endpoint formalization
- Criado o bridge oficial pi/admin/settings.php para configuracoes administrativas.
- ENDPOINTS.settings.update passou a apontar para dmin/settings.php.
- pi/settings.php foi mantido como bridge publico/legado para leitura saneada.
- O alias legado settingsUpdate agora reescreve para dmin/settings.php.

## 2026-04-04 - Cache runtime hardening
- O runtime de cache saiu de pi/cache e foi movido para storage/cache e storage/runtime/cookies.
- SimpleCache, cache_helpers, modules/questions e modules/statistics foram ajustados para usar storage/.
- pi/cache ficou apenas com o bridge manage.php, sem artefatos operacionais publicos.

## 2026-04-04 - Migration scripts reclassification
- pi/migrations foi removido da superfície pública.
- Os scripts PHP legados de migration/seed foram movidos para scripts/migrations/legacy.
- O bootstrap desses scripts foi ajustado para continuar funcionando fora de pi/.

- pi/referrals/stats.php foi revalidado e mantido como bridge fino para modules/users, sem necessidade de nova duplicacao de modulo.

## 2026-04-04 - Shared auth and middleware extraction
- O nucleo transversal de auth foi movido para shared/auth (AuthConfig, AuthCookies, AuthLogger, JWTAuth, AuthSession, equest_auth, GoogleAuthenticator).
- O middleware transversal foi movido para shared/middleware (AuthMiddleware, RateLimiter, SecurityMiddleware).
- pi/middleware/* e os utilitarios centrais de auth em pi/utils/* agora sao bridges finos.
- AdminSecurity passou a depender do nucleo oficial em shared/.

## 2026-04-04 - Shared utils/security extraction
- `api/utils/Mailer.php`, `recaptcha_helper.php`, `Validator.php` e `SQLSecurity.php` foram reduzidos a bridges finos para `shared/utils` e `shared/security`.
- `api/utils/check_recaptcha.php` saiu da area publica e foi reclassificado para `scripts/checks/check_recaptcha_settings.php`.
- Foi criado `tests/SharedUtilsSecurityWiringTest.php` para congelar a arquitetura desta camada.
- Validacoes: php lint, wiring tests de auth/users/subscriptions/shared infra, `npm run test:auth`, `npm run test:admin`, `npm run build`, smoke `401` em `api/admin/stats.php` e home `200`.
- `api/utils/SimpleCache.php` e `cache_helpers.php` tambem foram reduzidos a bridges finos para `shared/utils`, com `modules/questions` e `modules/statistics` passando a consumir `shared/utils/SimpleCache.php` diretamente.
- `api/utils/payment_refund_helper.php` foi reduzido a bridge fino para `modules/transactions/services/TransactionsRefundSupport.php`, com `transactions`, `subscriptions` e `admin` consumindo o suporte oficial do dominio.
- Validacoes: php lint, `TransactionsRefundSupportWiringTest.php`, `SubscriptionsCheckoutWiringTest.php`, `AdminSecurityWiringTest.php`, vitest de `transactions/admin/subscriptions`, smoke `401` em `api/transactions/approve_refund.php` e home `200`.
- Os modulos oficiais deixaram de importar `api/utils/*` diretamente. Agora `modules/*` consome `shared/auth`, `shared/security` e `shared/responses` de forma direta, com `api/utils` restrito a bridges legados.
- Foram criados `shared/security/AdminSecurity.php`, `shared/responses/Response.php` e o teste `SharedModuleDependenciesWiringTest.php` para congelar essa regra.
- Validacoes: wiring tests de auth/http/module dependencies/admin/materials/rankings, `npm run test:auth`, `npm run test:admin`, smoke `401` em `api/admin/stats.php` e home `200`.
- O endpoint oficial de cache administrativo passou a ser `api/admin/cache.php`; `api/cache/manage.php` ficou apenas como bridge legado, e o frontend foi alinhado para consumir a rota oficial.
- Validacoes: `AdminCacheEndpointWiringTest.php`, vitest do admin, `npm run build`, smoke `401` em `api/admin/cache.php?action=stats`, smoke `401` em `api/cache/manage.php?action=stats` e home `200`.
- Formalizado `api/admin/logs.php` como endpoint oficial de logs administrativos, com `api/system/logs.php` reduzido a bridge legado.
- O alias `settingsUpdate` foi alinhado em `.htaccess` e `router.php` para apontar diretamente para `api/admin/settings.php`.
- Foi criado `AdminLegacyBridgesWiringTest.php` para congelar `api/admin` como pasta de bridges finos para `modules/admin/routes.php`.
- Limpeza adicional da raiz do backend: `migrations` foi movido para `database/migrations/legacy`, `backups` para `storage/backups/legacy-code` e `composer.phar` para `scripts/setup/composer.phar`.
- `BackendRootCleanupWiringTest.php` foi criado para congelar essa estrutura da raiz.

## 2026-04-04 - Cron secret hardening
- O fallback inseguro `SECURE_CRON_KEY_123` foi removido de `modules/users/routes.php` e `modules/subscriptions/routes.php`.
- Os bridges HTTP de cron agora falham fechados quando `CRON_SECRET` nao estiver configurado.
- `api/tasks/ProcessRewards.php` e os crons HTTP de `subscriptions` continuam existindo so como compatibilidade, enquanto o caminho operacional preferencial permanece em `scripts/tasks/*`.
- O helper administrativo de automacao de assinaturas deixou de gerar URL operacional com segredo vazio.
- Foi criado `tests/CronSecretHardeningWiringTest.php` para impedir o retorno de segredo hardcoded no backend.
## 2026-04-04 - Frontend bundle splitting
- As rotas publicas, autenticadas e administrativas passaram a usar `React.lazy`, com fallback central em `src/router/index.tsx`.
- O `vite.config.ts` ganhou `manualChunks` para separar `react-vendor`, `motion-icons`, `charts`, `pdf`, `stripe` e `integrations`.
- O chunk principal caiu de um build anterior na faixa de `2.7 MB` para um build dividido por rota/vendor, sem o warning de chunk acima do limite padrao do Vite.
- Validacoes: `npm run build`, `npm run test:auth`, `npm run test:admin` e smoke `200` na home.
## 2026-04-04 - API residual surface freeze
- Foi criado `tests/ApiResidualSurfaceWiringTest.php` para congelar a superficie residual aceita de `api/`.
- A raiz de `api/` ficou formalmente restrita a `.htaccess`, `settings.php` e `upload.php`.
- `api/cache/manage.php`, `api/system/logs.php`, `api/tasks/ProcessRewards.php` e `api/utils/*` ficaram documentados como bridges legados minimos e intencionais.
## 2026-04-04 - Architecture status consolidation
- Foi criado `docs/architecture-status.md` com a arvore real resumida do frontend e backend, excecoes residuais aceitas e proximo alvo de migracao.
- `src/components/debug` vazio foi removido.
- `src/pages` continua vazio, mas permanece bloqueado por outro processo no filesystem.
## 2026-04-04 - Admin page component internalization
- Removidos os blocos inline ativos de NotificationDropdown e SmartTagSelector de src/app/admin/page.tsx, com consumo oficial a partir de src/app/admin/components/shared/NotificationDropdown.tsx e src/app/admin/components/database/SmartTagSelector.tsx.
- O runtime das abas dashboard e settings passou a usar src/app/admin/components/dashboard/AdminDashboard.tsx e src/app/admin/components/settings/AdminSettings.tsx.
- O estado arquitetural foi corrigido em docs/architecture-status.md, refletindo que src/components/admin ja nao existe e que o residuo real agora esta no proprio src/app/admin/page.tsx.
- Validacao: 
pm run test:admin, 
pm run test:auth, 
pm run build e home 200 em http://localhost:3000/#/.
- A aba inance do admin passou a usar src/app/admin/components/finance/AdminFinance.tsx.
- src/app/admin/components/finance/AdminFinance.tsx foi saneado para consumir subscriptionsService.getAutomationHelperInfo() e saveSystemSettingsNow(...), removendo referencias a SECURE_CRON_KEY_123.
- O estado arquitetural em docs/architecture-status.md e docs/admin-page-component-internalization.md foi atualizado para refletir que o residuo real agora e codigo inline morto em src/app/admin/page.tsx.
- Validacao adicional: 
pm run test:admin, 
pm run test:auth, 
pm run build, ausencia de SECURE_CRON_KEY_123 em src/app/admin/components/finance/AdminFinance.tsx e home 200 em http://localhost:3000/#/.
- O bloco legado morto de AdminDashboard, LogViewer, AdminSettings e AdminFinance foi removido fisicamente de src/app/admin/page.tsx.
- O topo de src/app/admin/page.tsx foi limpo de imports e dependencias orfas que pertenciam apenas a esse legado removido.
- A documentacao de status passou a refletir que o proximo alvo do admin nao e mais podar codigo morto, e sim fatiar AdminDatabaseManager e os subfluxos administrativos ainda muito grandes.
- Validacao: 
pm run test:admin, 
pm run test:auth, 
pm run build e home 200 em http://localhost:3000/#/.
- Iniciada a decomposicao do AdminDatabaseManager: a aba ilters foi extraida para src/app/admin/components/database/FiltersManagementSection.tsx.
- src/app/admin/page.tsx agora delega a listagem/navegacao de filtros ao componente da feature, mantendo apenas estado, handlers e modal de taxonomia no manager.
- Documentacao adicionada em docs/admin-filters-section-extraction.md e status arquitetural atualizado em docs/architecture-status.md.
- Validacao: 
pm run test:admin, 
pm run test:auth, 
pm run build e home 200 em http://localhost:3000/#/.

## 2026-04-04 - AdminDatabaseManager extractions (reports, rankings, materials, blocked, users)
- validei a extracao anterior de `reports` e `rankings` em `src/app/admin/page.tsx`; `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke em `http://localhost:3000/#/` ficaram verdes.
- extrai `reports` para `C:\dev\concursomestre\src\app\admin\components\reports\AdminReportsSection.tsx`.
- extrai `rankings` para `C:\dev\concursomestre\src\app\admin\components\rankings\AdminRankingsSection.tsx`.
- extrai `materials` para `C:\dev\concursomestre\src\app\admin\components\materials\AdminMaterialsSection.tsx`.
- extrai `blocked` para `C:\dev\concursomestre\src\app\admin\components\materials\BlockedMaterialsSection.tsx`.
- extrai `users` para `C:\dev\concursomestre\src\app\admin\components\users\AdminUsersSection.tsx`.
- `src/app/admin/page.tsx` ficou mais proximo do papel de orquestrador e deixou de carregar a maior parte das tabelas inline dessas subabas.
- atualizei `docs/admin-page-component-internalization.md`, `docs/admin-database-sections-extraction.md` e `docs/architecture-status.md`.

## 2026-04-04 - Admin questions section extraction
- extrai a aba `questions` de `C:\dev\concursomestre\src\app\admin\page.tsx` para `C:\dev\concursomestre\src\app\admin\components\questions\AdminQuestionsSection.tsx`.
- a nova secao passou a concentrar a tabela administrativa de questoes, badges de status e a paginacao, enquanto o `page.tsx` manteve apenas estado, busca, modal e handlers.
- validei com `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `200` em `http://localhost:3000/#/`.
- atualizei `docs/admin-database-sections-extraction.md`, `docs/admin-page-component-internalization.md` e `docs/architecture-status.md`.

## 2026-04-04 - Admin import section extraction
- extrai a aba `import` de `C:\dev\concursomestre\src\app\admin\page.tsx` para `C:\dev\concursomestre\src\app\admin\components\import\AdminImportSection.tsx`.
- o novo componente passou a concentrar a interface do importador, selecao de arquivos, progresso visual, terminal de logs e revisao/publicacao das questoes extraidas.
- o `page.tsx` manteve apenas os callbacks de IA, publicacao em massa e estado compartilhado do fluxo.
- validei com `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `200` em `http://localhost:3000/#/`.
- atualizei `docs/admin-database-sections-extraction.md`, `docs/admin-page-component-internalization.md` e `docs/architecture-status.md`.

## 2026-04-04 - Admin modal extraction hardening
- o runtime de `C:\dev\concursomestre\src\app\admin\page.tsx` passou a consumir `C:\dev\concursomestre\src\app\admin\components\questions\ManualQuestionModal.tsx` para o editor manual de questoes.
- o runtime de `C:\dev\concursomestre\src\app\admin\page.tsx` passou a consumir `C:\dev\concursomestre\src\app\admin\components\rankings\RankingEditorModal.tsx` para a edicao de rankings.
- `C:\dev\concursomestre\src\app\admin\components\materials\MaterialModerationModal.tsx` permaneceu como modal oficial de moderacao de materiais.
- por causa do encoding legado de `C:\dev\concursomestre\src\app\admin\page.tsx`, os blocos inline antigos de manual/ranking foram deixados desativados no runtime nesta rodada, para evitar corrupcao do arquivo enquanto a decomposicao segue.
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `http://localhost:3000/#/` = `200`.

## 2026-04-04 - Admin taxonomy modal extraction
- o runtime de `C:\dev\concursomestre\src\app\admin\page.tsx` passou a consumir `C:\dev\concursomestre\src\app\admin\components\database\TaxonomyModal.tsx` para o modal universal de taxonomia.
- o bloco inline antigo de taxonomia ficou desativado no runtime por seguranca de encoding, seguindo a mesma estrategia usada nos modais manual/ranking.
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `http://localhost:3000/#/` = `200`.

## 2026-04-04 - Admin user profile modal internalization
- o modal detalhado de usuario do admin saiu do runtime de [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) e passou a rodar em [C:\dev\concursomestre\src\app\admin\components\users\UserProfileAdminModal.tsx](C:\dev\concursomestre\src\app\admin\components\users\UserProfileAdminModal.tsx)
- a nova implementacao cobre as abas `overview`, `subscription`, `transactions` e `comments`, reaproveitando os handlers oficiais de admin para upgrade, add days, nota fiscal e estorno
- o bloco inline antigo de perfil detalhado ficou desativado no runtime por seguranca de encoding e virou residuo tecnico para poda fisica posterior
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `http://localhost:3000/#/` com status `200`

## 2026-04-04 - Admin inline legacy pruning
- removidos fisicamente de [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) os blocos inline desativados de ranking e taxonomia, mantendo o runtime preso aos componentes oficiais da feature
- os dois residuos maiores, modal manual e perfil detalhado, foram mantidos no estado seguro anterior porque o arquivo ainda carrega markup legado com encoding misto; a poda total deles continua como proximo passo
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `http://localhost:3000/#/` com status `200`

## 2026-04-04 - Admin portal residue neutralization
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de depender de `createPortal` e de blocos mortos com `false &&`
- os residuos legados de modal manual e perfil detalhado foram neutralizados como comentario tecnico, evitando impacto no parser e mantendo o runtime preso aos componentes oficiais da feature
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `http://localhost:3000/#/` com status `200`

## 2026-04-04 - Admin database navigation extraction
- a navegacao categorizada do `AdminDatabaseManager` saiu de [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) para [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseNavigation.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseNavigation.tsx)
- o cabecalho ordenavel compartilhado saiu do inline para [C:\dev\concursomestre\src\app\admin\components\database\SortableHeader.tsx](C:\dev\concursomestre\src\app\admin\components\database\SortableHeader.tsx)
- o entry point do admin ficou mais proximo do papel de orquestrador, mantendo no `page.tsx` principalmente estado, fetch e handlers
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e smoke `http://localhost:3000/#/` com status `200`

## 2026-04-04 - Admin reports moderation helper extraction
- extraidos badges, labels, templates, agrupamento e resolucao rapida de denuncias para [C:\dev\concursomestre\src\app\admin\components\reports\reportModeration.ts](C:\dev\concursomestre\src\app\admin\components\reports\reportModeration.ts)
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse bloco de logica pura no corpo do entry point
- validacao: npm run test:admin, npm run test:auth, npm run build, smoke 200 na home


## 2026-04-04 - Feature version baseline
- definido baseline funcional 2026.4.0 no feature report para servir como base futura de changelog por plataforma e por feature
- mantida a separacao entre versao funcional de produto e versao tecnica  .0.0 do package.json


## 2026-04-04 - Admin import workflow extraction
- criado [C:\dev\concursomestre\src\app\admin\components\import\useAdminImportWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\import\useAdminImportWorkflow.ts) para concentrar estado e handlers de PDF, extracao IA, geracao em massa e publicacao do importador
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar o bloco pesado do importador no corpo do entry point
- corrigido o toast de revisao de questao extraida para sucesso em vez de erro
- validacao: npm run test:admin, npm run test:auth, npm run build, smoke 200 na home


## 2026-04-04 - Feature version matrix by functionality
- criada [C:\dev\concursomestre\docs\feature-version-matrix.md](C:\dev\concursomestre\docs\feature-version-matrix.md) com baseline funcional `2026.4.0` organizada por funcionalidade e pronta para servir de base futura de changelog
- [C:\dev\concursomestre\docs\feature-report.md](C:\dev\concursomestre\docs\feature-report.md) passou a apontar para essa matriz como referencia funcional, em vez de depender apenas de snapshot por pagina

## 2026-04-04 - Admin user profile workflow extraction
- criado [C:\dev\concursomestre\src\app\admin\components\users\useAdminUserProfileWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\users\useAdminUserProfileWorkflow.ts) para concentrar fetch, estado de edicao e acoes administrativas do perfil detalhado
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse bloco no corpo do entry point e passou a delegar a abertura/fechamento do modal para a propria feature
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e home `200`

## 2026-04-04 - Admin material moderation workflow extraction
- criado [C:\dev\concursomestre\src\app\admin\components\materials\useMaterialModerationWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\materials\useMaterialModerationWorkflow.ts) para concentrar inspecao de reports, abertura do modal, prova, aprovacao, ocultacao e bloqueio de materiais
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse bloco grande no corpo do entry point e passou a delegar o fluxo para a propria feature
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build`

## 2026-04-05 - Admin taxonomy workflow extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\useAdminTaxonomyWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\database\useAdminTaxonomyWorkflow.ts) para concentrar CRUD de filtros, slug, hierarquia, abertura do modal e sincronizacao de taxonomias
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse bloco no corpo do entry point e passou a plugar a secao e o modal ao hook oficial da feature
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build`

## 2026-04-05 - Admin questions listing workflow extraction
- criado [C:\dev\concursomestre\src\app\admin\components\questions\useAdminQuestionsWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\questions\useAdminQuestionsWorkflow.ts) para concentrar fetch, paginacao e reload da listagem administrativa de questoes
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse bloco no corpo do entry point e passou a conectar a tabela e o workflow manual ao hook oficial da feature
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build`

## 2026-04-05 - Admin sorting and manual reference extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\useAdminTableSorting.ts](C:\dev\concursomestre\src\app\admin\components\database\useAdminTableSorting.ts) para concentrar a ordenacao compartilhada do admin
- criado [C:\dev\concursomestre\src\app\admin\components\questions\useManualQuestionReferenceData.ts](C:\dev\concursomestre\src\app\admin\components\questions\useManualQuestionReferenceData.ts) para concentrar os catalogos de referencia do editor manual
- criado [C:\dev\concursomestre\src\app\admin\components\database\adminDatabaseNavigationConfig.ts](C:\dev\concursomestre\src\app\admin\components\database\adminDatabaseNavigationConfig.ts) para formalizar categorias e labels da navegacao da base
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar essas utilidades no corpo do entry point
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build`

## 2026-04-05 - Admin database navigation state extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\useAdminDatabaseNavigationState.ts](C:\dev\concursomestre\src\app\admin\components\database\useAdminDatabaseNavigationState.ts) para concentrar sync de query param, hash, categoria, subaba e filtro do manager da base
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse estado no corpo do `AdminDatabaseManager` e passou a conectar a navegacao ao hook oficial da feature
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build`
## 2026-04-05 - Documentation consolidation and ranking editor workflow
- a trilha incremental do admin foi consolidada em [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) e [C:\dev\concursomestre\docs\audit-report.md](C:\dev\concursomestre\docs\audit-report.md), com remocao dos arquivos redundantes `admin-page-component-internalization.md`, `admin-database-sections-extraction.md` e `admin-filters-section-extraction.md`
- criado [C:\dev\concursomestre\src\app\admin\components\rankings\useRankingEditorWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\rankings\useRankingEditorWorkflow.ts) para concentrar abertura, fechamento, estado e persistencia do editor de ranking
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar esse fluxo inline e passou a plugar a secao e o modal ao hook oficial da feature
## 2026-04-05 - Admin manual editor composition extraction
- criado [C:\dev\concursomestre\src\app\admin\components\questions\useAdminManualQuestionEditor.ts](C:\dev\concursomestre\src\app\admin\components\questions\useAdminManualQuestionEditor.ts) para concentrar o workflow do editor manual e os catalogos do modal em um ponto unico da feature
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de carregar a composicao inline do modal manual e passou a plugar `openManualModal` e `ManualQuestionModal` a partir do hook oficial
- a ordem dos hooks do admin foi saneada para o fluxo manual deixar de depender de referencia adiantada dentro da moderacao de materiais
## 2026-04-05 - Admin database datasets normalization extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\useAdminDatabaseDatasets.ts](C:\dev\concursomestre\src\app\admin\components\database\useAdminDatabaseDatasets.ts) para concentrar filtros de usuarios, materiais, bloqueados e o agrupamento oficial de reports
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) deixou de repetir filtros inline por subaba e passou a reaproveitar `renderSortableHeader` em um unico ponto
- o `AdminDatabaseManager` ficou mais proximo do papel de composicao, com menos transformacao de dataset misturada ao markup das secoes
## 2026-04-05 - Admin database manager extraction
- extraido o manager da base administrativa de [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) para [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx)
- o entry point do admin ficou reduzido ao papel de orquestrador de abas, shell visual e wiring de alto nivel
- a nova versao do manager foi internalizada ja limpa, sem o bloco legado comentado gigante do modal manual que antes poluia `page.tsx`
## 2026-04-05 - Admin question workbench and import/settings bridge
- criado [C:\dev\concursomestre\src\app\admin\components\questions\useAdminQuestionWorkbench.ts](C:\dev\concursomestre\src\app\admin\components\questions\useAdminQuestionWorkbench.ts) para unir o pipeline de importacao e a edicao manual de questoes em um ponto unico da feature
- criado [C:\dev\concursomestre\src\app\admin\components\import\useAdminImportSettingsBridge.ts](C:\dev\concursomestre\src\app\admin\components\import\useAdminImportSettingsBridge.ts) para tirar do manager o wiring de `geminiApiKey` e persistencia de settings do importador
- [C:\dev\concursomestre\src\app\admin\components\database\useAdminTaxonomyWorkflow.ts](C:\dev\concursomestre\src\app\admin\components\database\useAdminTaxonomyWorkflow.ts) passou a internalizar o sync com o provider, sem exigir `dispatch` vindo do manager
## 2026-04-05 - Admin moderation workbench extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\useAdminModerationWorkbench.ts](C:\dev\concursomestre\src\app\admin\components\database\useAdminModerationWorkbench.ts) para concentrar inspecao de reports, resolucao rapida e o modal de moderacao de materiais
- [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx) deixou de carregar callbacks inline de moderacao entre as secoes `reports`, `materials` e `blocked`
- o manager caiu para 338 linhas apos essa passada, reduzindo mais o peso estrutural da base administrativa
## 2026-04-05 - Admin database sections and modals extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseSections.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseSections.tsx) para concentrar o switch visual das subabas `questions`, `users`, `materials`, `reports`, `rankings`, `blocked`, `filters` e `import`
- criado [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseModals.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseModals.tsx) para concentrar o runtime dos modais de questoes, materiais, perfil, ranking e taxonomia
- [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx) caiu para 297 linhas e ficou mais proximo do papel de orquestrador de hooks e wiring
## 2026-04-05 - Admin database manager controller extraction
- criado [C:\dev\concursomestre\src\app\admin\components\database\useAdminDatabaseManagerController.tsx](C:\dev\concursomestre\src\app\admin\components\database\useAdminDatabaseManagerController.tsx) para concentrar o wiring de navegacao, datasets, questoes, importacao, moderacao, ranking, perfil e taxonomias do manager da base
- [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx) caiu para 21 linhas e passou a atuar so como shell visual que conecta `AdminDatabaseNavigation`, `AdminDatabaseSections` e `AdminDatabaseModals`
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Admin page shell extraction
- criado [C:\dev\concursomestre\src\app\admin\components\shared\useAdminPageController.tsx](C:\dev\concursomestre\src\app\admin\components\shared\useAdminPageController.tsx) para concentrar tabs, notificacoes, bootstrap de dados e props das secoes do shell do admin
- criado [C:\dev\concursomestre\src\app\admin\components\shared\AdminTopBar.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminTopBar.tsx) para concentrar tema, notificacoes e perfil no header sticky
- criado [C:\dev\concursomestre\src\app\admin\components\shared\AdminPageContent.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminPageContent.tsx) para concentrar o roteamento entre `dashboard`, `database`, `finance`, `feedback` e `settings`
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) caiu para 93 linhas e passou a atuar como shell visual principal do painel
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Admin shell layout and header extraction
- criado [C:\dev\concursomestre\src\app\admin\components\shared\AdminPageHeader.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminPageHeader.tsx) para concentrar o header interno com titulo, badge e subtitulo do painel
- criado [C:\dev\concursomestre\src\app\admin\components\shared\AdminShellLayout.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminShellLayout.tsx) para concentrar sidebar, topbar e container principal do admin
- [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx) caiu para 42 linhas e passou a atuar so como composicao final entre controller, shell e content
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Admin settings log viewer cleanup
- movido [C:\dev\concursomestre\src\app\admin\components\shared\LogViewer.tsx](C:\dev\concursomestre\src\app\admin\components\shared\LogViewer.tsx) para [C:\dev\concursomestre\src\app\admin\components\settings\LogViewer.tsx](C:\dev\concursomestre\src\app\admin\components\settings\LogViewer.tsx), alinhando o componente ao dominio `settings`
- [C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx](C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx) passou a importar o visualizador localmente, e `admin/shared` ficou reservado ao shell do painel
- tentativa de remover [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages) ainda falhou por lock externo, mas o diretorio permanece vazio
- validacao: `npm run test:admin`, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Admin architecture guardrails
- criado [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts) para congelar a arquitetura atual do admin: `page.tsx` enxuto, `AdminDatabaseManager.tsx` enxuto, `admin/shared` limitado ao shell, `LogViewer` em `settings`, ausencia de legado em `src/components/admin` e `src/pages` vazio
- [C:\dev\concursomestre\package.json](C:\dev\concursomestre\package.json) passou a incluir esse guardrail em `npm run test:admin`
- validacao: `npm run test:admin` com 24 testes verdes, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Legacy frontend layers guardrail
- [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts) passou a congelar tambem a ausencia de `src/features` e `src/core`, incluindo verificacao de que nao restaram imports ativos para essas camadas legadas
- validacao: `npm run test:admin` com 25 testes verdes, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Architecture status consolidation
- [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) foi reescrito como snapshot limpo da arquitetura atual, com fases, progresso, guardrails, excecoes residuais e criterios de fechamento em um unico lugar
- o historico incremental continua concentrado neste [C:\dev\concursomestre\docs\audit-report.md](C:\dev\concursomestre\docs\audit-report.md), sem voltar a abrir um `.md` por alteracao
## 2026-04-05 - Fase 6 closure blocker clarified
- [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) passou a explicitar que a Fase 6 esta tecnicamente pronta e bloqueada apenas pelo lock externo sobre [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages)
- a Fase 4 tambem ficou marcada como praticamente fechada, porque `src/features` e `src/core` ja estao ausentes e protegidos por teste estrutural
## 2026-04-05 - Pages lock diagnostics
- criado [C:\dev\concursomestre\scripts\checks\find-locking-process.ps1](C:\dev\concursomestre\scripts\checks\find-locking-process.ps1) para diagnosticar locks em paths via Restart Manager do Windows
- o teste em [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages) retornou `RmGetList failed: 5`, e `openfiles /query` confirmou que a lista local de objetos nao esta habilitada no sistema
- conclusao pratica: o diretorio continua vazio e sem dependencia viva de codigo, mas o bloqueio atual ainda e operacional/externo ao projeto
## 2026-04-05 - Final frontend closure guardrails
- [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts) passou a congelar tambem os budgets do shell do admin: `useAdminPageController`, `AdminShellLayout`, `AdminPageContent` e `AdminTopBar`
- criado [C:\dev\concursomestre\scripts\checks\remove-empty-pages-dir.ps1](C:\dev\concursomestre\scripts\checks\remove-empty-pages-dir.ps1) para tentar remover [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages) de forma segura e devolver estado operacional explicito
- o script retornou `LOCKED`, confirmando que o ultimo bloqueio remanescente continua externo ao codigo
- validacao: `npm run test:admin` com 26 testes verdes, `npm run test:auth`, `npm run build` e home `200`
## 2026-04-05 - Backend API operational artifacts cleanup
- removidos da superficie publica de [C:\xampp\htdocs\questao-pro-backend\api](C:\xampp\htdocs\questao-pro-backend\api) os artefatos operacionais [C:\xampp\htdocs\questao-pro-backend\api\feedback\check_schema.php](C:\xampp\htdocs\questao-pro-backend\api\feedback\check_schema.php), [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\db_check.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\db_check.php), [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\migrate_transactions.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\migrate_transactions.php) e [C:\xampp\htdocs\questao-pro-backend\api\rankings\seed_data.sql](C:\xampp\htdocs\questao-pro-backend\api\rankings\seed_data.sql)
- reclassificados para camadas operacionais corretas em [C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_feedback_parent_id.php](C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_feedback_parent_id.php), [C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_subscriptions_transactions_schema.php](C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_subscriptions_transactions_schema.php), [C:\xampp\htdocs\questao-pro-backend\scripts\migrations\migrate_transactions_due_date_mp_card.php](C:\xampp\htdocs\questao-pro-backend\scripts\migrations\migrate_transactions_due_date_mp_card.php) e [C:\xampp\htdocs\questao-pro-backend\database\seeds\rankings_seed_data.sql](C:\xampp\htdocs\questao-pro-backend\database\seeds\rankings_seed_data.sql)
- [C:\xampp\htdocs\questao-pro-backend\tests\ApiResidualSurfaceWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiResidualSurfaceWiringTest.php) agora tambem falha se algum `.sql`, `.log`, `.txt` ou scripts operacionais como `check_schema.php`, `db_check.php` e `migrate_transactions.php` voltarem para `api/`
## 2026-04-05 - Backend API bridge inventory freeze
- criado [C:\xampp\htdocs\questao-pro-backend\tests\ApiBridgeInventoryWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiBridgeInventoryWiringTest.php) para congelar a arvore publica aceita de `api/*` por dominio
- o baseline agora exige listagem explicita dos bridges aceitos em `admin`, `auth`, `materials`, `questions`, `subscriptions`, `users`, `utils` e demais pastas publicas
- [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) foi atualizado para registrar esse guardrail e elevar o progresso da Fase 5
## 2026-04-05 - Backend thin bridge semantics freeze
- criado [C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php) para congelar a semantica dos bridges publicos de `api/*.php`
- o guardrail agora exige budget maximo de 20 linhas por bridge, delegacao clara para `modules`, `shared` ou `admin`, e ausencia de assinaturas de logica operacional como `new PDO`, `ALTER TABLE`, `DESCRIBE`, `SHOW TABLES` e `TRUNCATE TABLE`
- [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) foi atualizado para refletir esse guardrail e o novo percentual da Fase 5
## 2026-04-05 - Backend exceptional bridges freeze
- criado [C:\xampp\htdocs\questao-pro-backend\tests\ApiExceptionalBridgesWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiExceptionalBridgesWiringTest.php) para congelar as excecoes publicas justificadas de `api/*`
- o guardrail trava o comportamento esperado de [C:\xampp\htdocs\questao-pro-backend\api\settings.php](C:\xampp\htdocs\questao-pro-backend\api\settings.php), [C:\xampp\htdocs\questao-pro-backend\api\upload.php](C:\xampp\htdocs\questao-pro-backend\api\upload.php), [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_recurring.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_recurring.php), [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_scheduled_payments.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_scheduled_payments.php), [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php) e [C:\xampp\htdocs\questao-pro-backend\api\tasks\ProcessRewards.php](C:\xampp\htdocs\questao-pro-backend\api\tasks\ProcessRewards.php)
- [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) foi atualizado com esse guardrail e com o novo percentual da Fase 5
- padronizados [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_recurring.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_recurring.php), [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_scheduled_payments.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_scheduled_payments.php) e [C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php](C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php) para o bootstrap oficial com `require_once __DIR__ . '/../../config/database.php';`
## 2026-04-05 - Backend bridge bootstrap standardization
- padronizados os bridges publicos de [C:\xampp\htdocs\questao-pro-backend\api](C:\xampp\htdocs\questao-pro-backend\api) para `require_once __DIR__ ...` no bootstrap de `config` e `modules`
- [C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php) agora tambem falha se algum bridge voltar a usar `include_once` ou `require_once` com caminho relativo cru em vez de `__DIR__`
- [C:\dev\concursomestre\docs\architecture-status.md](C:\dev\concursomestre\docs\architecture-status.md) foi atualizado com o novo percentual da Fase 5
## 2026-04-05 - Route transition skeleton fallback
- [C:\dev\concursomestre\src\router\index.tsx](C:\dev\concursomestre\src\router\index.tsx) deixou de usar o estado textual `Carregando rota...` no `React.Suspense`
- o fallback agora usa skeleton responsivo com dois modos: shell publico e shell com sidebar para rotas de painel (`/admin` e `/partner-dashboard`)
- a transicao de paginas ficou visualmente alinhada ao layout da plataforma sem recorrer a spinner + texto generico
## 2026-04-05 - Route suspense fallback extraction
- extraido o fallback de transicao de rotas para [C:\dev\concursomestre\src\router\RouteSuspenseFallback.tsx](C:\dev\concursomestre\src\router\RouteSuspenseFallback.tsx)
- [C:\dev\concursomestre\src\router\index.tsx](C:\dev\concursomestre\src\router\index.tsx) voltou a ficar mais enxuto e passou a apenas plugar o skeleton oficial no `React.Suspense`
- [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts) agora tambem congela que o texto `Carregando rota` nao retorne e que o fallback de rota permaneÃ§a extraido
## 2026-04-05 - Route skeleton aligned to real platform shells
- [C:\dev\concursomestre\src\router\RouteSuspenseFallback.tsx](C:\dev\concursomestre\src\router\RouteSuspenseFallback.tsx) foi refinado para refletir os shells reais da plataforma por tipo de rota: `admin/partner-dashboard`, `auth`, `landing/promo` e app com sidebar
- o skeleton deixou de parecer placeholder generico e passou a espelhar melhor a navegacao, a hero da landing e o layout autenticado com sidebar e footer
- [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts) continua travando a ausencia do texto `Carregando rota` e a extracao do fallback

## 2026-04-05 - Route skeleton aligned to real shells
- Reworked `src/router/RouteSuspenseFallback.tsx` so route transitions now follow the real platform anatomy instead of a generic placeholder.
- The fallback now distinguishes marketing, app layout, auth, admin/partner dashboard, checkout, reader and legal/document routes.
- Validation: `npm run test:admin`, `npm run test:auth`, `npm run build`, home `200`.

## 2026-04-05 - Public settings route decoupled from admin module
- Created `C:/xampp/htdocs/questao-pro-backend/modules/settings/routes.php` as the official public settings entry point.
- `api/settings.php` now delegates to `handlePublicSettingsRoute($db)` while `api/admin/settings.php` remains the official admin write endpoint.
- Updated backend guardrails to freeze the new public-settings delegation path.
- Validation: `AdminSettingsWiringTest.php`, `ApiExceptionalBridgesWiringTest.php`, `ApiResidualSurfaceWiringTest.php`, `ApiThinBridgesWiringTest.php`, `api/settings.php` `200`, `api/admin/settings.php` `401` without session.

## 2026-04-05 - Layout routes keep sidebar mounted during lazy transitions
- Added `LayoutContentRouteFallback` in `src/router/RouteSuspenseFallback.tsx`.
- `src/router/publicRoutes.tsx` and `src/router/privateRoutes.tsx` now use local `React.Suspense` inside `Layout`, so the real lateral menu and shell stay mounted while lazy pages resolve.
- Validation: `npm run test:admin`, `npm run test:auth`, `npm run build`, home `200`.

## 2026-04-05 - Settings module wiring frozen
- Added `C:/xampp/htdocs/questao-pro-backend/tests/SettingsModuleWiringTest.php` to freeze `api/settings.php` -> `modules/settings/routes.php` delegation.
- Validation: `SettingsModuleWiringTest.php` passed.

## 2026-04-05 - Backend accepted exception classes frozen
- Added `C:/xampp/htdocs/questao-pro-backend/tests/ApiAcceptedExceptionsWiringTest.php`.
- The new guardrail freezes the accepted exception classes in `api/cache`, `api/system`, `api/tasks` and `api/utils`, plus the expected delegation for `manage.php`, `logs.php` and `ProcessRewards.php`.
- Validation: `ApiAcceptedExceptionsWiringTest.php`, `ApiBridgeInventoryWiringTest.php`, home `200`.

## 2026-04-05 - src/pages removal retried
- Retried removal of `C:/dev/concursomestre/src/pages` using execution-policy bypass.
- Current result is still `LOCKED`, confirming the remaining block is operational and external to the codebase.

## 2026-04-05 - Accepted backend exceptions now include middleware bridges
- Expanded `C:/xampp/htdocs/questao-pro-backend/tests/ApiAcceptedExceptionsWiringTest.php` to freeze `api/middleware` as an accepted residual exception class.
- The guardrail now asserts the exact accepted bridge set in `api/middleware` and their delegation to `shared/middleware`.
- Validation: `ApiAcceptedExceptionsWiringTest.php`, `SharedAuthInfrastructureWiringTest.php`, home `200`.

## 2026-04-05 - Phase 4 formally closed
- Marked Phase 4 as completed in `C:/dev/concursomestre/docs/architecture-status.md`.
- This closure is based on the already-green frontend guardrails around `src/features`, `src/core`, `src/components/admin`, admin shell budgets and route suspense extraction.
- Remaining open fronts are now the backend residual baseline finalization and the external Windows lock on `C:/dev/concursomestre/src/pages`.

## 2026-04-05 - Phase 5 formally closed
- Revalidated the full backend residual baseline: `ApiResidualSurfaceWiringTest.php`, `ApiBridgeInventoryWiringTest.php`, `ApiThinBridgesWiringTest.php`, `ApiExceptionalBridgesWiringTest.php`, `ApiAcceptedExceptionsWiringTest.php` and `SettingsModuleWiringTest.php`.
- Marked Phase 5 as completed in `C:/dev/concursomestre/docs/architecture-status.md`.
- The only remaining open front is now the external Windows lock on `C:/dev/concursomestre/src/pages`, which blocks formal closure of Phase 6.

## 2026-04-05 - Frontend closing guardrail hardened
- Expanded `C:/dev/concursomestre/src/services/admin/__tests__/adminArchitecture.test.ts` so the migration only accepts two final states for the old pages area: `src/pages` absent or empty, and no `src/pages_pending_delete` leftover.
- Validation: `npm run test:admin`, `npm run test:auth`, home `200`.

## 2026-04-05 - Lock source narrowed to workspace processes
- Retried removal and rename of `C:/dev/concursomestre/src/pages`; both still fail with `file is being used by another process`.
- The lock owner is still not proven because Restart Manager continues returning `RmGetList failed: 5`.
- A workspace process scan now shows active VS Code and Vite/node processes attached to `C:/dev/concursomestre`, which makes them the main likely lock candidates.

## 2026-04-05 - Unified transition readiness check added
- Added `npm run test:transition` in `C:/dev/concursomestre/package.json`.
- The command runs frontend admin/auth checks, production build, backend residual baseline assertions and the home smoke check through `C:/dev/concursomestre/scripts/checks/transition-readiness.ps1`.
- Current result: `TRANSITION_READY|OK`.

## 2026-04-05 - Transition finalizer added
- Added `npm run finalize:transition` in `C:/dev/concursomestre/package.json`.
- The finalizer lives in `C:/dev/concursomestre/scripts/checks/transition-finalize.ps1`: it first tries to remove the empty `src/pages` directory and, if successful, runs `npm run test:transition`.
- Current execution result is explicit and expected in this environment: `TRANSITION_FINALIZE|BLOCKED|LOCKED|C:\dev\concursomestre\src\pages|...`.

## 2026-04-05 - Transition formally closed
- C:/dev/concursomestre/src/pages was removed successfully and no longer exists.
- 
pm run finalize:transition now completes with TRANSITION_FINALIZE|OK.
- Full closure validation passed end to end through 
pm run test:transition: frontend admin/auth suites, production build, backend residual baseline and home smoke 200.
- A temporary local Vite server was started to satisfy the final smoke check because http://localhost:3000/#/ was unavailable in the previous finalize attempt.

## 2026-04-05 - Transition closure validated
- finalize:transition completed successfully and returned TRANSITION_FINALIZE|OK.
- test:transition also completed successfully, including frontend admin/auth tests, production build, backend residual baseline and home smoke 200.
- src/pages has been removed and the transition is now formally closed.

## 2026-04-05 - Regras permanentes de comentarios e padrao estrutural
- Centralizadas as regras permanentes de comentarios, estrutura e padrao de codigo em `C:/dev/concursomestre/.agent/rules/engineering-standards.md`.
- `README.md` agora aponta para essa regra e deixa explicito que comentarios tecnicos em pt-BR sao obrigatorios em funcoes, componentes, hooks, services e scripts novos ou alterados.
- Comentados em pt-BR os arquivos centrais do shell e do roteamento: `src/router/index.tsx`, `src/router/RouteSuspenseFallback.tsx`, `src/router/publicRoutes.tsx`, `src/router/privateRoutes.tsx`, `src/app/admin/page.tsx`, `src/app/admin/components/shared/AdminPageContent.tsx`, `src/app/admin/components/shared/useAdminPageController.tsx`, `src/app/admin/components/database/AdminDatabaseManager.tsx` e `src/app/admin/components/database/useAdminDatabaseManagerController.tsx`.
- `src/services/admin/__tests__/adminArchitecture.test.ts` agora tambem congela a existencia da regra e a documentacao minima dos shells centrais.
- Validation: `npm run test:transition` green, including home smoke `200`.

## 2026-04-05 - runtime fix admin/ranking, debug overlay e baseline v1.0.0

### Ajustes desta rodada
- corrigido crash potencial do admin em src/app/admin/components/dashboard/AdminDashboard.tsx com import dos icones usados em runtime
- corrigido fluxo do ranking em src/app/ranking/page.tsx, preservando ctionSource no modal de autenticacao quando o usuario precisa confirmar e-mail
- corrigido o overlay da home em src/components/shared/feedback/debug/DebugBanner.tsx: o monitor agora nasce oculto e so abre sob opt-in explicito, com atalho Ctrl+Shift+D
- definida a baseline publica 1.0.0 em package.json, README.md, docs/architecture-status.md, docs/feature-version-matrix.md e docs/feature-report.md
- endurecida a regra permanente para comentarios com @since <versao> em .agent/rules/engineering-standards.md
- reforcado o guardrail em src/services/admin/__tests__/adminArchitecture.test.ts

### Validacao
- 
pm run test:transition: verde
- 
pm run test:admin: 30 testes verdes dentro do 	est:transition
- 
pm run test:auth: 5 testes verdes dentro do 	est:transition
- 
pm run build: verde dentro do 	est:transition
- smoke da home: 200
- dist removido ao final

### Observacoes
- o warning local de PHP sobre openssl already loaded continua sem bloquear a validacao
- a frente de comentarios completos por funcao foi iniciada, mas ainda nao cobre todo o repositorio; a regra e a baseline @since v1.0.0 ja estao congeladas

## 2026-04-05 - sweep de comentarios na camada de services do frontend

### Escopo desta rodada
- comentados com @since v1.0.0 os pontos centrais de [C:\dev\concursomestre\src\services\api\client.ts](C:\dev\concursomestre\src\services\api\client.ts)
- comentado o contrato administrativo em [C:\dev\concursomestre\src\services\admin\adminService.ts](C:\dev\concursomestre\src\services\admin\adminService.ts)
- alinhadas as fachadas de [C:\dev\concursomestre\src\services\rankings\rankingsService.ts](C:\dev\concursomestre\src\services\rankings\rankingsService.ts), [C:\dev\concursomestre\src\services\questions\questionService.ts](C:\dev\concursomestre\src\services\questions\questionService.ts) e [C:\dev\concursomestre\src\services\simulations\simulationsService.ts](C:\dev\concursomestre\src\services\simulations\simulationsService.ts)
- total desta passada: 60 ocorrencias de @since v1.0.0 nesses arquivos centrais da camada de services

### Validacao
- 
pm run test:admin: verde
- 
pm run test:auth: verde

## 2026-04-05 - manifesto profissional de plataforma para web e Android

### Estrutura adicionada
- criado manifesto base em [C:\dev\concursomestre\config\platform\base.json](C:\dev\concursomestre\config\platform\base.json)
- criado canal web em [C:\dev\concursomestre\config\platform\website.json](C:\dev\concursomestre\config\platform\website.json)
- criado canal Android em [C:\dev\concursomestre\config\platform\android.json](C:\dev\concursomestre\config\platform\android.json)
- criado helper tipado em [C:\dev\concursomestre\src\config\platform.ts](C:\dev\concursomestre\src\config\platform.ts)
- criado bootstrap global em [C:\dev\concursomestre\src\providers\PlatformMetadataProvider.tsx](C:\dev\concursomestre\src\providers\PlatformMetadataProvider.tsx)
- integrado o bootstrap em [C:\dev\concursomestre\src\providers\AppProviders.tsx](C:\dev\concursomestre\src\providers\AppProviders.tsx)
- adicionados favicon publico em public/platform-icons/concurso-mestre.svg e manifesto web em public/site.webmanifest

### Resultado pratico
- nome, slug, versao, descricao, branding e icone agora tem fonte central preparada para web e Android
- o site ja aplica automaticamente 	itle, pplication-name, description, 	heme-color, avicon e manifest
- a versao publica usada pelo manifesto permanece alinhada com 1.0.0

### Validacao
- 
pm run build: verde
- 
pm run test:admin: verde

## 2026-04-05 - cabecalho autoral padronizado na base ativa

### Escopo desta rodada
- aplicada a regra do cabecalho autoral oficial nos arquivos ativos 	s, 	sx, js, jsx e php
- criado aplicador automatico em [C:\dev\concursomestre\scripts\checks\apply-standard-file-header.ps1](C:\dev\concursomestre\scripts\checks\apply-standard-file-header.ps1)
- total de arquivos atualizados pelo aplicador: 683
- ajustados os guardrails para ignorarem o cabecalho ao medir budgets em [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts) e [C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php)
- corrigido [C:\dev\concursomestre\scripts\checks\transition-readiness.ps1](C:\dev\concursomestre\scripts\checks\transition-readiness.ps1) para falhar de verdade quando um step interno retornar erro
- removido o resíduo quebrado [C:\xampp\htdocs\questao-pro-backend\scripts\debug\temp_users.php](C:\xampp\htdocs\questao-pro-backend\scripts\debug\temp_users.php)

### Validacao
- 
pm run test:transition: verde
- lint sintatico PHP em massa: verde
- dist removido ao final

## 2026-04-05 - sweep de comentarios funcionais no nucleo de servicos

### Escopo desta rodada
- comentado o nucleo de sessao em [C:\dev\concursomestre\src\services\auth\session.ts](C:\dev\concursomestre\src\services\auth\session.ts), cobrindo bootstrap, refresh, logout, broadcast entre abas e locks de renovacao
- comentados os contratos de autenticacao em [C:\dev\concursomestre\src\services\auth\accountService.ts](C:\dev\concursomestre\src\services\auth\accountService.ts) e [C:\dev\concursomestre\src\services\auth\authFlowService.ts](C:\dev\concursomestre\src\services\auth\authFlowService.ts)
- comentados os servicos de operacao frequente em [C:\dev\concursomestre\src\services\notifications\notificationService.ts](C:\dev\concursomestre\src\services\notifications\notificationService.ts), [C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts](C:\dev\concursomestre\src\services\marketplace\marketplaceService.ts), [C:\dev\concursomestre\src\services\payments\paymentsService.ts](C:\dev\concursomestre\src\services\payments\paymentsService.ts), [C:\dev\concursomestre\src\services\reports\reportsService.ts](C:\dev\concursomestre\src\services\reports\reportsService.ts), [C:\dev\concursomestre\src\services\comments\commentsService.ts](C:\dev\concursomestre\src\services\comments\commentsService.ts), [C:\dev\concursomestre\src\services\support\supportService.ts](C:\dev\concursomestre\src\services\support\supportService.ts) e [C:\dev\concursomestre\src\services\transactions\transactionsService.ts](C:\dev\concursomestre\src\services\transactions\transactionsService.ts)
- reforcado o contrato da camada HTTP em [C:\dev\concursomestre\src\services\api\interceptors.ts](C:\dev\concursomestre\src\services\api\interceptors.ts), [C:\dev\concursomestre\src\services\api\response.ts](C:\dev\concursomestre\src\services\api\response.ts) e [C:\dev\concursomestre\src\services\api\endpoints.ts](C:\dev\concursomestre\src\services\api\endpoints.ts)

### Validacao
- npm run test:transition: verde

## 2026-04-05 - sweep de comentarios em assinaturas e shell de providers

### Escopo desta rodada
- comentado o dominio comercial de assinaturas em [C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts](C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts) e [C:\dev\concursomestre\src\services\plans\planService.ts](C:\dev\concursomestre\src\services\plans\planService.ts)
- padronizados e regravados os providers pequenos [C:\dev\concursomestre\src\providers\AppProviders.tsx](C:\dev\concursomestre\src\providers\AppProviders.tsx), [C:\dev\concursomestre\src\providers\PlatformMetadataProvider.tsx](C:\dev\concursomestre\src\providers\PlatformMetadataProvider.tsx) e [C:\dev\concursomestre\src\providers\ThemeProvider.tsx](C:\dev\concursomestre\src\providers\ThemeProvider.tsx) para remover ruido de encoding e fixar comentarios em pt-BR com `@since 1.0.0`

### Validacao
- npm run test:transition: verde
