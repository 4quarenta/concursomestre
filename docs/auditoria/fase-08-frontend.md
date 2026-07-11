# Fase 08 - Frontend, contratos e requisicoes

Data: 2026-07-11

## Escopo

Esta fase consolida pontos criticos da fronteira entre o frontend Next.js e a
API PHP: sessao, requisicoes autenticadas, polling, estado otimista e dados
de estudo que precisam sobreviver a navegacao, troca de aba e recarregamento.
Ela parte das regras de autorizacao e dos contratos de dominio estabilizados
nas fases anteriores.

## Diagnostico confirmado

1. A camada `apiClient` ja concentrava token em memoria, refresh de sessao,
   normalizacao de resposta e tratamento de erros, mas alguns componentes ainda
   usavam `fetch` diretamente para arquivos privados.
2. O provider de notificacoes continuava programando novo polling quando a aba
   ficava oculta. A requisicao em andamento nao era cancelada pelo ciclo de
   visibilidade.
3. `useUserProgressActions.saveNote` alterava apenas Zustand e o cache do
   TanStack Query. A tela confirmava sucesso mesmo sem gravacao no backend.
4. A tela detalhada da Lei Comentada misturava favoritos e reacoes retornados
   pelo backend com `localStorage`, permitindo estado visual divergente entre
   dispositivos.

## Contratos consolidados

| Dominio | Contrato anterior | Contrato aplicado nesta fase |
| --- | --- | --- |
| Resposta HTTP | Endpoints legados podiam devolver array cru ou envelope | `normalizeApiEnvelope`, `readApiData` e `assertApiSuccess` permanecem a unica normalizacao usada pelos services. |
| Arquivo protegido | Alguns componentes executavam `fetch` proprio com cookie | `fetchAuthenticatedResource` concentra token em memoria, refresh unico, `401` e erro amigavel. |
| Notificacoes | `GET` sem sinal de abort e polling em aba oculta | `getUserNotifications(userId, { signal })` recebe o sinal do TanStack Query; o polling e pausado/cancelado quando o documento fica oculto. |
| Nota de questao | Atualizacao somente local com id temporario | `POST /api/users/notes.php` salva ou remove de modo idempotente e devolve a nota autoritativa. |
| Favorito de secao | Backend mais cache persistente local | O detalhe da Lei Comentada usa apenas o campo `isFavorite` retornado pelo backend e o retorno de `toggleFavorite`. |
| Reacao editorial | Backend mais fallback em `localStorage` | Likes e dislikes continuam otimistas, mas confirmam/recuperam exclusivamente a resposta do backend. |

## Requisicoes centralizadas nesta fase

- `AdminExamEditorPage.readNoticeFileForExtraction`: passou a usar
  `fetchAuthenticatedResource`.
- `useAdminImportWorkflow.loadAttachedExamFile`: passou a usar
  `fetchAuthenticatedResource`.
- notificacoes: o service aceita `AbortSignal` e o provider cancela a query ao
  ocultar a aba.

Os `fetch` restantes em rotas server-side, SEO, Ads.txt e OAuth de terceiros
nao foram migrados porque nao pertencem ao transporte autenticado do app. Eles
permanecem deliberadamente fora do `apiClient`.

## Persistencia de notas de questoes

`POST /api/users/notes.php` aceita:

```json
{
  "questionId": 123,
  "text": "Revisar a excecao cobrada pela banca."
}
```

- texto preenchido: cria ou atualiza a mesma chave logica
  `user_id + item_id + type`;
- texto vazio: remove a nota sem erro caso ela ja nao exista;
- ownership: a sessao define o usuario, e somente admin pode solicitar outro
  usuario dentro das regras do modulo;
- resposta: devolve a linha persistida ou `deleted: true`;
- frontend: aplica atualizacao otimista, substitui pelo retorno autoritativo e
  restaura o snapshot anterior em caso de falha.

## Sessao, retry e idempotencia

- access token continua somente em memoria; eventos entre abas nao carregam o
  token;
- `401` continua usando uma unica tentativa de refresh no interceptor;
- o cliente nao executa retry automatico de mutacoes, portanto uma falha de
  rede nao repete criacao, pagamento, importacao ou alteracao sensivel;
- operacoes com idempotencia de servidor ja existentes, como a ingestao privada
  de questoes, mantem a chave `Idempotency-Key` no contrato proprio. Nao foi
  adicionado retry generico que pudesse criar duplicidade em endpoints PHP que
  ainda nao confirmam suporte a esse cabecalho.

## Polling e cancelamento

`createVisibilityAwarePoller` separa a regra de agenda da UI. Ele:

1. so agenda o proximo ciclo se a aba estiver visivel;
2. limpa timer e dispara `onPause` ao ocultar/desmontar;
3. permite cancelar a query pendente por `queryClient.cancelQueries`;
4. reativa a consulta no foco/retorno da visibilidade sem acumular timers.

## Estado local mantido de forma deliberada

Preferencias puramente visuais do leitor podem continuar no navegador, como
modo de leitura e configuracao de toolbar. Elas nao concedem acesso, nao
representam uma mutacao de conteudo e nao substituem o backend. Helpers mortos
de notas e destaques locais foram removidos; favoritos e reacoes nao usam mais
`localStorage` como fonte de verdade.

## Arquivos principais

- `src/services/api/client.ts`
- `src/services/api/visibilityPolling.ts`
- `src/providers/NotificationsProvider.tsx`
- `src/services/notifications/notificationService.ts`
- `src/services/progress/userProgressService.ts`
- `src/state/user-progress/useUserProgressActions.ts`
- `src/app/lei-comentada/[slug]/page.tsx`
- `backend/modules/users/routes.php`
- `backend/modules/users/services/UsersService.php`
- `backend/modules/users/repositories/UsersRepository.php`

## Validacao local

- Vitest: resposta HTTP, polling, notificacoes, progresso e contrato de
  questoes;
- `npm run typecheck`;
- `npm run build`;
- `git diff --check`.

## Validacao e deploy na VPS

- Backup validado antes da alteracao em
  `/root/backups/concursomestre-phase08-20260711-220019`, com snapshot do
  codigo, dump do banco e `SHA256SUMS` conferido.
- PHP lint aprovado nos arquivos alterados do modulo `users`.
- `FrontendContractsPhase08Test.php` aprovado com sete assercoes.
- `UsersModuleWiringTest.php` corrigido para usar a raiz dinamica do repositorio
  e aprovado na VPS.
- Build de producao do Next.js aprovado na VPS.
- `concursomestre-frontend.service` reiniciado e ativo.
- `https://concursomestre.com/` respondeu `200` apos o health check; a primeira
  sondagem imediatamente apos o restart retornou `502` transitorio enquanto o
  processo Next.js subia.
- `GET /api/users/notes.php` sem sessao respondeu `401`, confirmando que o novo
  endpoint nao expõe notas sem autenticacao.

## Riscos residuais

- `useAdminImportWorkflow.ts` continua grande por concentrar a revisao de
  importacao criada na Fase 04. Nesta fase somente o carregamento autenticado
  de anexos foi isolado, para nao reabrir o parser/importador sem necessidade.
- Componentes administrativos extensos permanecem candidatos a extracoes
  graduais futuras; nenhum componente foi quebrado em massa nesta fase.
- Preferencias visuais locais nao sao sincronizadas entre dispositivos por nao
  possuirem ainda um contrato de backend proprio.

## Rollback

1. Restaurar a release anterior do frontend se houver regressao visual.
2. O endpoint de notas e aditivo, sem migration; codigo anterior continua
   podendo listar e apagar notas existentes.
3. Nao restaurar os caches locais de favorito/reacao como fonte de verdade.

## Estado da fase

Concluida e implantada na VPS em 2026-07-11.
