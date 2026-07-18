# Integracao seletiva de contratos e SQL da R6.1

Data: 2026-07-18
Base oficial: branch `1.0.0`
Fonte comparada: R6.1 e `ConcursoMestre_R6_1_database_structure.sql`

## Regra de decisao

A R6.1 foi tratada como fonte de patches, nunca como overlay. Uma mudanca so foi
incorporada quando melhorava o contrato atual sem reintroduzir aliases de sessao,
billing global, setup publico, DDL em runtime ou uma linha paralela de migrations.

## Contratos incorporados

### Configuracoes publicas

- Criado o contrato versionado `public-settings.v1`.
- A API publica usa allowlist por dominio e nao serializa o objeto administrativo.
- Setup, IDs administrativos, segredos, modelos de IA, SMTP, templates privados e
  diagnosticos nao atravessam a fronteira publica.
- Somente landing pages publicadas sao expostas.
- Cupons sao reduzidos a campanhas automaticas publicas; audiencias por ID/e-mail,
  campanhas condicionais e cupons administrativos nao sao serializados.
- O frontend adapta o contrato uma unica vez na borda do service.

### Setup

- `/api/setup/status.php` devolve somente `needsSetup` e `canInstall` enquanto a
  instalacao esta aberta.
- Depois de instalada, a rota devolve 404.
- `/setup` e bloqueada no proxy server-side quando o backend nao autoriza o setup.
- O bootstrap normal da aplicacao nao consulta mais o status do instalador.

### Perfil pessoal

- CPF, telefone, endereco e preferencias permanecem fora da sessao global.
- `/api/users/profile.php` fornece um DTO privado autocontido da sessao atual.
- `/api/users/update.php` atualiza o mesmo dominio sem aceitar ID de outro usuario.
- A pagina `/profile/personal` carrega e atualiza esse contrato sob demanda.
- Assinatura, billing, banco e permissoes nao foram recolocados no perfil.

## SQL incorporado

### Perfil

- `20260718_010000_user_profile_contract.php` formaliza colunas que bases antigas
  podiam tentar criar durante requests.
- O repository de usuarios deixou de executar `SHOW COLUMNS` e `ALTER TABLE users`
  no fluxo de perfil.

### Rankings

- `20260718_020000_rankings_canonical_contract.php` incorpora as colunas uteis da
  estrutura R6.1 para vagas, gabarito, tipos de prova, autoria e participacao.
- O enum de status foi apenas ampliado.
- O indice unico oficial `(ranking_id, user_id)` foi preservado.
- Os endpoints de instalar/migrar rankings agora somente validam o contrato; nenhum
  DDL e executado por requisicao HTTP.

## Comparacao objetiva do banco

Inventario obtido diretamente de `information_schema` da producao:

- Producao: 106 tabelas, 1.215 colunas e 554 linhas de indices.
- Dump R6.1: 104 tabelas.
- Tabelas exclusivas da R6.1: nenhuma.
- Tabelas presentes apenas na producao:
  - `question_answer_idempotency`;
  - `question_search_documents`.
- Indices nomeados exclusivos da R6.1: nenhum.
- Colunas da R6.1 ausentes na producao: 26, concentradas em `rankings`,
  `ranking_entries` e no formato conflitante de `schema_migrations`.

As colunas de rankings foram migradas. As colunas alternativas de
`schema_migrations` foram rejeitadas porque conflitam com o runner oficial baseado
em `version`, `checksum` e `applied_at`.

## Estruturas rejeitadas

- Dump consolidado da R6.1 sobre a base oficial.
- Historico paralelo de migrations (`migration`, `batch`, `status`).
- Exposicao de `setup.adminUserId` observada na resposta R6.1.
- DTOs de sessao com aliases ou billing global.
- Retorno ao fluxo login seguido imediatamente de `/auth/me.php`.
- Assemblers de questoes R6.1: a base atual ja possui DTOs v2 protegidos, read model,
  idempotencia e politica publica mais recente. Copiar os assemblers criaria uma
  segunda fonte de contrato.
- Indice `unique_participation` da R6.1: o indice oficial por usuario/ranking e mais
  estavel e nao depende de numero de inscricao opcional.

## Estruturas ja superiores na base oficial

- `question_answer_idempotency` e resposta canonica por alternativa.
- `question_search_documents` e backfill em lotes.
- cursor/cache de listagem de questoes.
- contratos publicos de questao sem gabarito/editorial nao autorizado.
- fila de recuperacao Stripe e identidade unica de transacao.
- taxonomias, aliases e assets canonicamente migrados.
- scripts de backup, checksum, restore e preflight.

## Rollback

- Aplicacao: sempre por migration oficial depois de backup verificado.
- Codigo: reverter a release/symlink.
- Perfil: rollback SQL e destrutivo e permanece manual.
- Rankings: rollback reduz apenas enum/tipo de score; colunas sao preservadas para
  evitar perda de dados.
- O dump R6.1 nunca deve ser restaurado sobre producao.

## Evidencias executadas

- 429 testes frontend aprovados em 66 arquivos.
- `npm run typecheck`, `npm run build`, `check:secrets`,
  `check:text-encoding` e `check:next-proxy` aprovados.
- 713 arquivos PHP validados por `php -l` na VPS.
- Testes de contratos de settings, setup, perfil e rankings aprovados na VPS.
- As duas migrations foram aplicadas em clone estrutural temporario do banco de
  producao, reaplicadas pelo runner oficial e terminaram com zero pendencias.
