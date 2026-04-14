# Mobile Transitions

Este arquivo registra cada transicao de modulo da plataforma web para o app Expo.

## Regra de transicao

Toda transicao mobile deve registrar:

- modulo migrado
- origem web/plataforma
- destino no app Expo
- endpoints e services envolvidos
- estado de paridade entregue
- validacoes executadas
- commit de referencia
- pendencias conhecidas

## 2026-04-14 - Marketplace

- commit: `931e8ef Add mobile marketplace parity screen`
- origem web/plataforma:
  - `src/app/marketplace/page.tsx`
  - `src/services/marketplace/marketplaceService.ts`
  - endpoint `materialsList`
  - endpoint `transactions/create.php`
- destino mobile:
  - `mobile/src/screens/MarketplaceScreen.tsx`
  - `mobile/src/services/marketplace/marketplaceService.ts`
  - aba `Marketplace` exposta como `Materiais`
- paridade entregue:
  - vitrine de materiais
  - filtro por materia
  - busca local por titulo, autor, tipo, materia e descricao
  - compra de material via service mobile e endpoint oficial de transacoes
  - placeholders visuais para materiais sem capa remota
- validacoes:
  - `npm --prefix mobile run typecheck`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android
- pendencias conhecidas:
  - detalhamento/leitor de material ainda precisa ser migrado.
  - fluxo de upload/publicacao de material do parceiro ainda segue web/admin.

## 2026-04-14 - Notificacoes e deep links

- commit: `a82d97d Add mobile notifications flow`
- origem web/plataforma:
  - `src/app/notifications/page.tsx`
  - `src/services/notifications/notificationService.ts`
  - endpoints `notificationsList`, `notificationsMarkRead`, `notificationsMarkAllRead`, `notificationsDelete`, `notificationsClearAll`
- destino mobile:
  - `mobile/src/screens/NotificationsScreen.tsx`
  - `mobile/src/services/notifications/notificationService.ts`
  - `mobile/src/types/notifications.ts`
  - rota stack `Notifications`
  - deep link `concursomestre://notificacoes`
- paridade entregue:
  - listagem de notificacoes do usuario autenticado
  - marcar uma notificacao como lida
  - marcar todas como lidas
  - remover notificacao individual
  - limpar todas as notificacoes
  - roteamento de links para abas principais quando o destino e reconhecido
  - fallback para abertura externa quando o destino e URL HTTP/HTTPS
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android
- pendencias conhecidas:
  - notificacoes push nativas ainda nao foram ativadas.
  - destinos especificos de detalhe ainda precisam de telas dedicadas antes de mapear deep links granulares.

## 2026-04-14 - Roadmap mobile

- commit: `6655a14 Update mobile parity roadmap`
- transicao registrada:
  - Marketplace saiu da lista de proxima fase depois de entrar na Fase 2.
  - Notificacoes e deep links sairam da lista de proxima fase depois de entrar na Fase 2.
- validacoes:
  - `git diff --check`

## 2026-04-14 - Ranking detalhe publico

- commit: `80164e8 Add mobile ranking detail screen`
- origem web/plataforma:
  - `src/app/ranking/page.tsx`
  - `src/app/ranking-detail/page.tsx`
  - `src/services/rankings/rankingsService.ts`
  - endpoint `rankingsList`
- destino mobile:
  - `mobile/src/screens/RankingsScreen.tsx`
  - `mobile/src/screens/RankingDetailScreen.tsx`
  - `mobile/src/services/rankings/rankingsService.ts`
  - rota stack `RankingDetail`
  - deep link `concursomestre://ranking/:rankingId`
- paridade entregue:
  - abertura de detalhe a partir da listagem mobile
  - resumo publico do ranking
  - leitura de status de gabarito, discursiva, datas e vagas
  - exibicao de tipos de prova
  - top colocacoes ordenadas por score
  - atalho para abrir PDF de gabarito quando houver URL publica
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - bundle no Expo Go via Metro na porta `8081`
  - verificacao visual no emulador Android apos reiniciar o Metro com `--clear`
- pendencias conhecidas:
  - participacao/envio de gabarito do candidato ainda precisa de transicao propria.
  - ranking detail usa a listagem oficial como fonte porque ainda nao ha endpoint mobile dedicado para detalhe por id.

## 2026-04-14 - Ranking participacao e envio de gabarito

- commit: `450a9f0 Add mobile ranking answer submission`
- origem web/plataforma:
  - `src/app/ranking/page.tsx`
  - `src/services/rankings/rankingsService.ts`
  - endpoint `rankingsJoin`
- destino mobile:
  - `mobile/src/screens/RankingDetailScreen.tsx`
  - `mobile/src/services/rankings/rankingsService.ts`
  - `mobile/src/services/api/endpoints.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - formulario mobile de participacao no detalhe do ranking
  - preenchimento de inscricao, caderno/tipo de prova, categoria e nota discursiva
  - sanitizacao do cartao-resposta com alternativas A-E e limite de questoes
  - reaproveitamento de participacao anterior do usuario autenticado
  - calculo local da nota objetiva por gabarito oficial ou consenso colaborativo
  - envio da participacao para o backend via `rankingsJoin`
  - atualizacao otimista da lista local de colocacoes apos envio bem-sucedido
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - ranking detail ainda usa a listagem oficial como fonte porque nao ha endpoint mobile dedicado para detalhe por id.
  - status de aprovacao/classificacao por vaga ainda segue apenas como exibicao simples de colocacoes.

## 2026-04-14 - Simulados resultado e revisao

- commit: `04dcfc1 Add mobile simulation result review`
- origem web/plataforma:
  - `src/app/simulation/page.tsx`
  - tipo `SimulationSession`
  - fluxo de resultado/revisao apos `handleFinish`
- destino mobile:
  - `mobile/src/screens/SimulationRunScreen.tsx`
  - `mobile/src/types/simulation.ts`
  - status atualizado em `mobile/README.md`
- paridade entregue:
  - resultado mobile mantem o resumo de score, aproveitamento e tempo total
  - resultado passa a carregar os resultados por questao
  - revisao por questao exibe enunciado resumido, status correta/incorreta/em branco, resposta do usuario e gabarito
  - roadmap mobile passou a tratar `Simulados com filtros avancados/taxonomias` como pendencia especifica
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - push para `origin/master`
- pendencias conhecidas:
  - configuracao mobile ainda nao replica os filtros avancados/taxonomias da web.
  - revisao detalhada ainda nao abre uma tela dedicada por questao com comentarios e notas.

## 2026-04-14 - Simulados compatibilidade de listagem

- commit: `8d7cfbb Handle missing mobile simulations list`
- origem web/plataforma:
  - `src/services/simulations/simulationsService.ts`
  - fluxo web persiste simulados via `simulationsCreate`, sem depender de uma listagem publica equivalente
- destino mobile:
  - `mobile/src/services/simulations/simulationsService.ts`
- paridade/compatibilidade entregue:
  - a listagem mobile aceita `simulationsList` quando o backend expuser o contrato
  - quando o backend local responde 404 para a listagem, o app exibe estado vazio em vez de alerta bloqueante
  - o fluxo de criar novo simulado permanece disponivel
- validacoes:
  - `npm --prefix mobile run typecheck`
  - `git diff --check`
  - verificacao no emulador Android apos o alerta 404 observado
- pendencias conhecidas:
  - ainda falta definir um endpoint oficial de historico/detalhe de simulados se a plataforma quiser listar tentativas persistidas no mobile.
