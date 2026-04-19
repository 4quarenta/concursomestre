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
- `src/providers/DataProvider.tsx`: ajuste de assinatura de `deleteComment` para contrato real usado pela UI.

## Correcao aplicada nesta auditoria

`src/providers/NextRouteFrame.tsx` foi realinhado ao comportamento global do roteador antigo:

- guarda de admin por `canAccessAdminPanel`
- modo manutencao com bypass administrativo
- bloqueio de acesso por problema de pagamento
- respeito a `loginRequired` para modulos condicionais
- rotas que sempre exigem usuario autenticado
- fallback de modulo desativado por feature flag
- montagem de `GlobalLoader`
- montagem de `StudyTrackerBridge`
- montagem do `DebugBanner` apenas em desenvolvimento
- compatibilidade com URLs antigas em hash, como `/#/profile/personal` e `/#/admin?tab=...`
- persistencia de ultima rota estavel e rota antes de reload
- normalizacao de rotas antigas antes de salvar/restaurar em `sessionStorage`

## Validacoes

- `npm run typecheck`: ok
- `npm run check:text-encoding`: ok
- smoke HTTP em dev: ok para `/`, `/auth`, `/practice`, `/profile/personal`, `/admin`, `/admin/operation/questions`, `/marketplace`, `/planos`, `/plans`, `/checkout/1`, `/ranking`, `/notifications`, `/support`, `/question/1`, `/ranking/1`, `/material/1`, `/promo/teste`, `/elite`, `/faq`, `/terms`, `/privacy` e `/simulation`
- `npm run build`: nao executado por instrucao explicita

## Pendencias

- auditoria visual manual 1:1 em navegador contra o branch `master`
- auditoria funcional autenticada com usuario real para admin, checkout, marketplace, simulados, questoes e materiais
- definir o escopo da etapa 4 depois da conclusao visual/funcional da etapa 3
