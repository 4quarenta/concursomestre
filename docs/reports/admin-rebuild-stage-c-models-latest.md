# Rebuild Admin - Etapa C: Modelos Iniciais

Data: `2026-04-19`

## Escopo

Inicio da implementacao real do novo admin por dominios.

Esta rodada nao troca a rota `/admin`. Ela cria a primeira camada funcional privada para que as novas telas nascam de dados reais da plataforma, e nao de placeholders soltos ou da casca antiga.

## Arquivos criados

- `src/app/admin/_rebuild/domains/revenue/adminRevenueModel.ts`
- `src/app/admin/_rebuild/domains/overview/adminOverviewModel.ts`

## Revenue model

O modelo de Revenue calcula:

- receita total registrada
- receita liquida
- taxas de plataforma
- receita de planos
- receita de marketplace
- reembolsos pendentes
- valor reembolsado
- transacoes falhas
- transacoes pagas
- metricas por seller com payout disponivel

O modelo usa status reais ja encontrados na plataforma:

- `completed`
- `approved`
- `refund_requested`
- `refunded`
- `failed`
- `rejected`
- `cancelled`
- `canceled`

## Overview model

O modelo de Overview consolida:

- metricas executivas
- fila critica
- risco de billing
- risco de SEO
- risco de suporte

Entradas aceitas:

- transacoes
- denuncias
- materiais
- configuracoes do sistema
- percentual de cobertura do sitemap

Filas geradas:

- reembolsos aguardando decisao
- denuncias abertas
- materiais aguardando moderacao
- falhas recentes de transacao
- configuracao Stripe incompleta
- cobertura SEO a confirmar

## Integracao com o preview privado

`AdminOverviewBlueprint` passou a usar `buildAdminOverviewModel()`.

Isso permite evoluir a tela nova usando o mesmo contrato que sera usado pela rota final, sem depender do layout antigo.

## Screens conectadas nesta rodada

Arquivos:

- `src/app/admin/_rebuild/domains/overview/AdminOverviewScreen.tsx`
- `src/app/admin/_rebuild/domains/operation/adminOperationModel.ts`
- `src/app/admin/_rebuild/domains/operation/AdminOperationBlueprint.tsx`
- `src/app/admin/_rebuild/domains/operation/AdminOperationScreen.tsx`
- `src/app/admin/_rebuild/domains/revenue/AdminRevenueBlueprint.tsx`
- `src/app/admin/_rebuild/domains/revenue/AdminRevenueScreen.tsx`

Overview conectado:

- le `reports` e `systemSettings` pelo `DataProvider`
- le `materials` e `transactions` pelo `MarketplaceProvider`
- le cobertura de sitemap pelo `seoService`
- alimenta `buildAdminOverviewModel()` com dados atuais
- mostra um painel de fontes conectadas para evitar duvida sobre origem dos dados

Revenue conectado:

- le `users` pelo `DataProvider`
- le `transactions` pelo `MarketplaceProvider`
- alimenta `buildAdminRevenueModel()`
- mostra receita total, receita liquida, taxas, refunds, falhas, distribuicao por origem e sellers/payout

Operation conectado:

- le `questions`, `totalQuestions`, `users`, `rankings`, `systemSettings`, `taxonomies` e `examBank` pelo `DataProvider`
- le `materials` pelo `MarketplaceProvider`
- alimenta `buildAdminOperationModel()`
- mostra questoes, usuarios, materiais, rankings, banco de provas, taxonomias e fila operacional
- gera filas para materiais pendentes/rejeitados, rankings pendentes, questoes sem taxonomia, questoes anuladas/desatualizadas, usuarios pendentes/restritos, taxonomias ausentes e banco de provas vazio

Observacao:

- as telas continuam dentro de `_rebuild`
- a rota `/admin` nao foi substituida
- a troca da rota so deve acontecer apos paridade minima por dominio

## Validacao

- `npm run typecheck`: ok
- `npm run check:text-encoding`: ok

Nao foi executado `npm run build`, conforme orientacao atual do projeto.

## Proximo passo

Criar o dominio `Support` dentro da arquitetura `_rebuild`, conectando denuncias, feedbacks e threads em uma fila unica por SLA.
