# Auditoria de Paridade Next na Raiz

Data: `2026-04-19`

## Objetivo

Conferir se a plataforma Next consolidada na raiz preserva a UI e os fluxos da plataforma web do branch `master`, separando ajustes tecnicos necessarios para Next de divergencias funcionais indevidas.

## Metodo

- comparacao textual de arquivos centrais contra `master`
- revisao manual de diffs em rotas e providers sensiveis
- smoke HTTP no servidor local em `localhost:3000`
- validacao TypeScript sem executar build
- validacao de encoding
- bateria Vitest restrita ao `src/services` do web

## Resultado da comparacao

Arquivos `src` versionados no `master` considerados na amostra `ts/tsx/css/svg`:

- `205` iguais byte a byte
- `77` diferentes por ajuste tecnico ou contrato de Next/SSR/tipos
- `12` ausentes por remocao esperada da entrada Vite/React Router:
  - `src/App.tsx`
  - `src/app/AppShell.tsx`
  - `src/main.tsx`
  - `src/router/RouteSuspenseFallback.tsx`
  - `src/router/adminRoutes.tsx`
  - `src/router/guards/RequireAdmin.tsx`
  - `src/router/guards/RequireAuth.tsx`
  - `src/router/guards/index.ts`
  - `src/router/index.tsx`
  - `src/router/privateRoutes.tsx`
  - `src/router/publicRoutes.tsx`
  - `src/router/useRoutePersistence.ts`

## Diffs revisados

- `src/app/auth/page.tsx`: troca de props do React Router pelo `AuthProvider` real e redirect pos-login via Next.
- `src/app/profile/page.tsx`: troca de `useNavigate`, `useLocation` e `useParams` por APIs do Next, mantendo UI e handlers.
- `src/app/checkout/page.tsx`: troca de navegacao e `import.meta.env`, mantendo fluxo de plano, cartao, Stripe e termos.
- `src/app/plans/page.tsx`: troca de navegacao para checkout, mantendo regras de downgrade e ciclo.
- `src/app/marketplace/page.tsx`: troca de query params e navegacao, mantendo compra, leitura, pedidos e KYC.
- `src/components/shared/layout/Layout.tsx`: troca de `Link`/navegacao e protecao SSR de `sessionStorage`, mantendo shell.
- `src/state/question-bank/useQuestionBankActions.ts`: contrato de comentarios/questoes mantido no store dedicado apos remocao do provider legado.
- `src/app/practice/page.tsx`: troca de query params e navegacao para App Router, mantendo filtros, destaque por URL, auth modal, comentarios e resposta de questoes.
- `src/app/simulation/page.tsx`: troca de query params e navegacao para App Router, mantendo simulados, modo imersivo, filtros, revisao e resultado final.

## Leitura da amostra critica

Na rodada mais recente, os fluxos `plans`, `marketplace`, `practice`, `simulation` e `checkout` foram comparados novamente contra `master`.

Conclusao desta amostra:

- o delta dominante segue sendo `use client`, `next/navigation`, `next/link`, substituicao de `import.meta.env` e adaptacao de query params
- nao apareceu redesign estrutural novo nesses modulos
- as strings com acentos vistas em saidas anteriores eram artefato de leitura do PowerShell no Windows, nao evidencia nova de UI quebrada nos arquivos auditados

Uma segunda amostra foi aberta nos componentes renomeados para manter as rotas canonicas no App Router:

- `dashboard/DashboardPage` vs `master:src/app/dashboard/page.tsx`
- `landing/LandingPage` vs `master:src/app/landing/page.tsx`
- `profile/ProfilePage` vs `master:src/app/profile/page.tsx`
- `checkout/CheckoutPage` vs `master:src/app/checkout/page.tsx`
- `reader/ReaderPage` vs `master:src/app/reader/page.tsx`

Conclusao desta segunda amostra:

- o padrao se repetiu: `use client`, `next/navigation`, `next/link`, tipos mais estritos e protecoes de SSR
- nao apareceu reescrita visual indevida nesses componentes-base
- os wrappers canonicos do App Router ficaram com a responsabilidade de URL, enquanto os componentes internos continuam equivalentes ao papel que tinham no `master`

## Correcao aplicada nesta auditoria

`src/providers/NextRouteFrame.tsx` foi realinhado ao comportamento global do roteador antigo:

- guarda de admin por `canAccessAdminPanel`
- modo manutencao com bypass administrativo
- bloqueio de acesso por problema de pagamento
- respeito a `loginRequired` para modulos condicionais
- rotas que sempre exigem usuario autenticado
- fallback de modulo desativado por feature flag
- admin sem sessao preserva a rota solicitada em `redirectAfterLogin` e redireciona para `/auth`, como `RequireAdmin`
- admin sem permissao, mas com sessao, redireciona para `/`
- `partner-dashboard` sem sessao redireciona para `/`, sem entrar no fluxo generico de login
- montagem de `GlobalLoader`
- montagem de `StudyTrackerBridge`
- montagem do `DebugBanner` apenas em desenvolvimento
- compatibilidade com URLs antigas em hash, como `/#/profile/personal` e `/#/admin?tab=...`
- persistencia de ultima rota estavel e rota antes de reload
- normalizacao de rotas antigas antes de salvar/restaurar em `sessionStorage`

A arvore `src/app` tambem foi ajustada para nao criar URLs acidentais no App Router. Componentes internos que antes se chamavam `page.tsx`, mas nao eram rotas publicas no `master`, foram renomeados para nomes de componente e passaram a ser usados por wrappers canonicos:

- `/` usa `dashboard/DashboardPage` ou `landing/LandingPage`, mantendo o comportamento autenticado/publico do roteador antigo
- `/x-ray` usa `bank-analysis/BankAnalysisPage`, sem expor `/bank-analysis`
- `/performance/subjects` usa `performance-subjects/PerformanceSubjectsPage`, sem expor `/performance-subjects`
- `/l/[slug]` usa `landing-campaign/LandingCampaignPage`, sem expor `/landing-campaign`
- `/checkout/[planId]` usa `checkout/CheckoutPage`, sem expor `/checkout`
- `/checkout/termos-de-adesao` usa `checkout/CheckoutAdhesionTermsPage`, sem expor a rota inglesa no mapa tipado
- `/material/[id]/[[...slug]]`, `/promo/[slug]`, `/question/[id]/[[...slug]]`, `/ranking/[id]/[[...slug]]` e `/read/[id]` usam componentes internos sem criar rotas-base soltas
- `/profile` voltou a ser uma rota de redirecionamento para `/profile/personal` ou `/auth`, enquanto `/profile/[tab]` renderiza a area de perfil real
- depois da consolidacao do App Router, `PageTransition` voltou para a casca global de rotas do Next, preservando a mesma entrada visual do roteador antigo sem duplicar wrappers por pagina

`src/app/layout.tsx` tambem voltou a carregar `Inter` via `head`, restaurando a base tipografica do frontend original que antes vinha de `index.html`.

`src/app/globals.css` voltou a declarar o variant `dark` por classe no Tailwind v4 e `src/app/layout.tsx` passou a aplicar `font-sans` no `body`, mantendo o mesmo contrato visual que o `index.html` do `master` tinha com o Tailwind CDN.

`src/providers/NextRouteFrame.tsx` tambem foi refinado para preservar exatamente quais telas ficam fora do shell principal, como no roteador antigo:

- `/auth`, `/reset-password`, `/confirm-email`, `/terms`, `/privacy`, `/changelog`, `/planos`, `/elite`, `/checkout`, `/read`, `/subscription`, `/l/[slug]` e `/partner-dashboard`
- `/profile` voltou a se comportar como rota de redirecionamento puro para `/profile/personal` ou `/auth`, sem montar a area logada completa antes disso

Rotas dinamicas do App Router foram normalizadas para evitar divergencias em parametros catch-all:

- `question/[id]/[[...slug]]`, `material/[id]/[[...slug]]` e `ranking/[id]/[[...slug]]` tratam `slug` como `string | string[]` antes de comparar com o slug canonico de SEO
- `admin/[tab]/[[...section]]` trata `tab` e `section` como `string | string[]`, preservando subsecoes como `/admin/operation/questions`

`src/components/shared/overlays/PdfViewer.tsx` deixou de usar o sufixo `?url` do Vite para o worker do PDF.js e passou a usar o build `legacy` com `new URL(..., import.meta.url)`.

Os pontos restantes que ainda encostavam em PDF.js fora do viewer principal tambem foram realinhados:

- `src/app/admin/components/import/useAdminImportWorkflow.ts` agora carrega o modulo `legacy` apenas sob demanda, no browser
- `src/app/ranking/page.tsx` deixou de registrar worker global desnecessario
- avisos novos de `require`, `DOMMatrix`, `ImageData` e `Path2D` nao voltaram a aparecer nas requisicoes novas de `/admin` e `/ranking` apos a correção

## Validacoes

- `npm run typecheck`: ok
- `npm run check:text-encoding`: ok
- cache `.next/dev` limpo e `npm run dev -- --port 3000` reiniciado na raiz para validar sem manifests antigos
- smoke HTTP em dev: ok para `/`, `/auth`, `/faq`, `/elite`, `/plans`, `/planos`, `/concursos`, `/practice`, `/lei-comentada`, `/flashcards`, `/simulation`, `/x-ray`, `/marketplace`, `/ranking`, `/profile`, `/profile/personal`, `/notifications`, `/support`, `/partner-dashboard`, `/subscription/success`, `/subscription/failure`, `/admin`, `/admin/operation/questions`, `/checkout/1`, `/checkout/termos-de-adesao`, `/performance/subjects`, `/question/1`, `/ranking/1`, `/material/1`, `/read/1` e `/l/teste`
- typegen do Next: ok, sem rotas tipadas para `/dashboard`, `/bank-analysis`, `/landing`, `/landing-campaign`, `/performance-subjects`, `/reader` ou `/ranking-detail`
- smoke de rotas acidentais removidas: `/dashboard`, `/bank-analysis`, `/landing`, `/landing-campaign`, `/material`, `/performance-subjects`, `/promo`, `/question`, `/ranking-detail` e `/reader` retornaram `404`
- `npx vitest run` em servicos web criticos: `55` testes passaram em `adminRouting`, `authFlowService`, `session`, `marketplaceService`, `readerService`, `questionService`, `rankingsService`, `paymentsService`, `subscriptionsService` e `moduleFlags`
- login HTTP validado diretamente no backend local (`/questao-pro-backend/api/auth/login.php`) com resposta `success: true`, `message: "Login successful"` e criacao de sessao autentica
- `npm run build`: nao executado por instrucao explicita

## Observacao operacional

- o frontend Next esta respondendo normalmente no `localhost:3000`
- o backend local tambem respondeu com sucesso no endpoint HTTP de login nesta rodada, entao o diagnostico anterior sobre `auth_sessions` ausente deixa de ser a referencia operacional atual
- o arquivo `web-root-dev.stderr.log` ainda contem erros antigos de `auth_sessions` e `Network Error` em `plans`, mas essas linhas nao representam mais o estado verificado do backend nesta rodada
- com isso, o bloqueio principal desta etapa volta a ser a auditoria visual/funcional de paridade, nao a infraestrutura de autenticacao

## Pendencias

- auditoria visual manual 1:1 em navegador contra o branch `master`
- auditoria funcional autenticada com usuario real para admin, checkout, marketplace, simulados, questoes e materiais
- definir o escopo da etapa 4 depois da conclusao visual/funcional da etapa 3
