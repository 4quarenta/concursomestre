# ConcursoMestre Mobile (React Native)

App Android/iOS em React Native (Expo), com painel admin mantido apenas na web.

## Fase 1 (entregue)

- Base Expo + TypeScript
- Navegacao (auth + tabs)
- Sessao persistida (SecureStore)
- Login/cadastro/logout via API oficial
- Bootstrap de usuario autenticado (`auth/me.php`)
- Estrutura inicial de modulos mobile para migracao com paridade
- Dashboard mobile com dados reais de estatisticas:
  - questoes respondidas
  - acuracia
  - streak atual e melhor streak
  - tempo de estudo total / questoes / leitura
  - desempenho por materia (top 5)

## Fase 2 (em andamento)

- Modulo `Questoes` com:
  - lista real via API
  - filtros basicos (keyword, dificuldade, materia)
  - paginação/load more
  - envio de resposta do usuario
- Modulo `Planos` com catalogo oficial
- Fluxo `Checkout` mobile (sessao Stripe hospedada):
  - resumo do plano
  - cupom
  - toggle de renovacao automatica
  - redirecionamento seguro para URL retornada pelo backend
- Modulos em leitura real:
  - `Simulados` (listagem)
  - `Ranking` (listagem)
  - `Marketplace` (vitrine de materiais, filtros e compra)
- Fluxo de simulado em execucao:
  - configuracao (questoes + timer)
  - execucao com navegacao por questao
  - finalizacao com score
  - persistencia da sessao via `simulationsCreate`
  - envio das respostas no endpoint oficial de questoes
- Perfil mobile com billing Stripe:
  - listagem de cartoes do cofre
  - definir cartao padrao
  - remocao com bloqueio para cartao vinculado a assinatura
  - aviso de cartao expirado/expirando
  - atalho para portal Stripe (adicionar/gerenciar cartoes)
  - historico de transacoes da conta (plano, ciclo, metodo, gateway, status, valor)

## Estrutura

- `App.tsx`: shell principal
- `src/providers/AuthProvider.tsx`: sessao e autenticacao
- `src/services/api/*`: cliente HTTP e normalizacao de resposta
- `src/services/auth/*`: fluxo de auth e cofre local de sessao
- `src/navigation/*`: stacks e tabs
- `src/screens/*`: telas iniciais (dashboard, perfil e placeholders)
- `src/screens/PlansScreen.tsx`: catalogo de planos no mobile
- `src/screens/CheckoutScreen.tsx`: entrada de checkout mobile
- `src/services/plans/planService.ts`: fachada mobile de planos/checkout

## Como rodar

Na raiz do repositorio:

1. `npm --prefix mobile install`
2. `npm run mobile:start`
3. `npm run mobile:android` ou `npm run mobile:ios`

## Config da API

Base URL no arquivo `mobile/app.json`:

- `expo.extra.apiBaseUrl`

Padrao local:

- `http://localhost/questao-pro-backend/api/`

## Proxima fase

- Migracao de modulos com paridade:
  - Dashboard completo
  - Questoes/practice
  - Simulados
  - Lei comentada
  - Flashcards
  - Ranking
  - Checkout/assinaturas/transacoes
  - Marketplace
  - Notificacoes e deep links
