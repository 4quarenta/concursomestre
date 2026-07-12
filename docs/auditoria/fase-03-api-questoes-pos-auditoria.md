# Fase 03 pos-auditoria - API de questoes e contratos

## Escopo executado

- Confirmado que a listagem publica antiga misturava campos legados e canonicos, carregava dados de detalhe e dependia de agregados completos por questao.
- Criado contrato v2 separado para questoes:
  - `GET /api/v2/questions/list.php`
  - `GET /api/v2/questions/show.php`
  - `POST /api/v2/questions/answer.php`
  - `GET /api/v2/admin/questions/show.php`
- Mantido o contrato legado apenas para consumidores administrativos existentes.

## Implementacao

- A listagem v2 usa DTO leve com:
  - `id`
  - `statementPreview`
  - `type`
  - `difficulty`
  - `hasImage`
  - `taxonomySummary`
  - `stats`
  - `publication`
  - `publishedAt`
  - `createdAt`
- A listagem v2 nao retorna:
  - alternativas;
  - gabarito;
  - editoriais;
  - contextos completos;
  - `data_json`;
  - aliases legados como `enunciado`, `tipo`, `itens`, `resposta`.
- O detalhe publico v2 retorna conteudo, assets, contextos e alternativas, mas nao retorna gabarito, revisao administrativa ou editoriais.
- O detalhe admin v2 retorna gabarito, editoriais e revisao somente apos autorizacao admin/staff.
- A submissao v2 recebe `selectedAlternativeId`; o backend resolve o indice interno e calcula o resultado no servidor.
- O frontend passou a consumir:
  - listagem publica v2 para usuario comum;
  - detalhe publico v2 para abrir questao;
  - resposta v2 por identificador de alternativa.
- A compatibilidade com componentes React atuais ficou encapsulada em `questionService`, sem reintroduzir aliases no contrato de rede.

## Banco e migrations

- Nenhuma migration foi executada.
- Nenhuma alteracao destrutiva de banco foi realizada.
- Foram usados campos e tabelas canonicas ja existentes:
  - `question_options`;
  - `question_assets`;
  - `question_contexts`;
  - `question_context_questions`;
  - `question_editorials`.

## Rollback

1. Remover os arquivos:
   - `backend/api/v2/questions/list.php`
   - `backend/api/v2/questions/show.php`
   - `backend/api/v2/questions/answer.php`
   - `backend/api/v2/admin/questions/show.php`
2. Reverter os metodos v2 adicionados em:
   - `backend/modules/questions/controllers/QuestionsController.php`
   - `backend/modules/questions/routes.php`
   - `backend/modules/questions/services/QuestionsService.php`
   - `backend/modules/questions/repositories/QuestionsRepository.php`
3. Reverter `src/services/questions/questionService.ts` para os endpoints legados.
4. Reverter os testes alterados em `src/services/questions/__tests__/questionService.test.ts`.

## Evidencias

- `npm run typecheck`: passou.
- `npx vitest run src/services/questions/__tests__/questionService.test.ts`: passou, 12 testes.

## Bloqueios

- PHP CLI nao esta disponivel neste workspace, entao `php -l` nao foi executado localmente.
- Sem MySQL local exposto neste workspace, portanto as rotas v2 nao foram executadas contra base real nesta fase.

## Segredos

- Nenhum segredo foi adicionado ou versionado nesta fase.

