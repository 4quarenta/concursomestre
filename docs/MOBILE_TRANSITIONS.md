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
