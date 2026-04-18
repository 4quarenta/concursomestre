# Documentacao do Projeto

- Esta pasta concentra toda a documentacao viva do repositorio.
- A raiz do projeto foi limpa.
- A documentacao foi reduzida para poucos arquivos consolidados.
- Relatorios operacionais ficam em `docs/reports/`.

## Estrutura final

- `ARQUITETURA_CONSOLIDADA.md`
- `PRODUTO_E_MODULOS.md`
- `ADMIN_CONSOLIDADO.md`
- `BILLING_E_VALIDACAO.md`
- `ENCODING_E_TEXTO.md`
- `MOBILE_TRANSITIONS.md`
- `NEXTJS_MIGRATION.md`
- `WEB_NEXT_CUTOVER.md`
- `WEB_NEXT_STAGE4_STAGING.md`
- `WEB_NEXT_STAGE5_PRODUCTION.md`
- `GOOGLE_SEARCH_CONSOLE.md`
- `examples/` para snippets operacionais, como os cortes Apache e Nginx do `web-next`
- `config/deploy/` para templates operacionais de gate e corte por ambiente
- `reports/` para saidas automatizadas do billing

## Checks operacionais da migracao web

- `npm run web-next:cutover-check`
- `npm run web-next:legacy-bridge-check`
- `npm run web-next:legacy-bridge-report`
- `npm run web-next:hybrid-local-check`
- `npm run web-next:hybrid-local-report`
- `npm run web-next:cutover-handoff`
- `npm run web-next:staging-gate`
- `npm run web-next:stage4-init-config`
- `npm run web-next:stage4-status`
- `npm run web-next:stage4-readiness`
- `npm run web-next:stage4-proxy-check`
- `npm run web-next:stage4-smoke`
- `npm run web-next:stage4-config-check`
- `npm run web-next:stage4-rollout`
- `npm run web-next:stage4-handoff`
- `npm run web-next:stage5-init-config`
- `npm run web-next:stage5-validate`
- `npm run web-next:stage5-launch`
- `npm run web-next:stage5-status`
- `npm run web-next:stage5-readiness`
- `npm run web-next:stage5-smoke`
- `npm run web-next:production-gate`
- `npm run test:transition`
- `scripts/checks/run-web-next-hybrid-local-check.ps1`
- `scripts/checks/run-web-next-hybrid-local-report.ps1`
- `scripts/checks/run-web-next-cutover-handoff.ps1`
- `scripts/checks/run-web-next-cutover-report.ps1`
- `scripts/checks/run-web-next-legacy-bridge-check.ps1`
- `scripts/checks/new-web-next-stage4-rollout-config.ps1`
- `scripts/checks/run-web-next-stage4-status.ps1`
- `scripts/checks/run-web-next-stage4-proxy-check.ps1`
- `scripts/checks/run-web-next-stage4-smoke.ps1`
- `scripts/checks/run-web-next-stage4-rollout.ps1`
- `scripts/checks/run-web-next-stage4-handoff.ps1`
- `scripts/checks/new-web-next-stage5-launch-config.ps1`
- `scripts/checks/run-web-next-stage5-launch.ps1`
- `scripts/checks/run-web-next-stage5-status.ps1`
- `scripts/checks/run-web-next-stage5-smoke.ps1`
- `scripts/checks/render-web-next-gate-summary.mjs`
- `.github/workflows/web-next-stage4-smoke.yml`
- `.github/workflows/web-next-stage4-rollout.yml`
- `.github/workflows/web-next-stage5-smoke.yml`
- `.github/workflows/web-next-stage5-launch.yml`
- `.github/workflows/web-next-staging-gate.yml`
- `.github/workflows/web-next-legacy-bridge-check.yml`

## Fonte principal

- Este `README.md` e os 4 consolidados acima passam a ser a referencia oficial.
  
## Regra de integridade de texto

- Toda alteracao textual deve respeitar UTF-8 e passar no check de mojibake.
- Comandos oficiais:
  - `npm run check:text-encoding`
  - `npm run fix:text-encoding`
- Regra detalhada: `docs/ENCODING_E_TEXTO.md`

## Arquivos absorvidos

- `C:\dev\concursomestre\README.md`

---

## Fonte absorvida: `C:\dev\concursomestre\README.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# ConcursoMestre

![Visao geral da plataforma](./src/assets/site/concurso-mestre-platform.svg)

Plataforma de questoes para concursos publicos com pratica filtrada, simulados, ranking pos-prova, assinatura, progresso do aluno e marketplace de materiais em PDF.

## Versao atual

- baseline publica atual: `v1.0.0`
- versao tecnica do frontend em `package.json`: `1.0.0`
- baseline funcional detalhada por dominio: [C:\dev\concursomestre\docs\feature-version-matrix.md](C:\dev\concursomestre\docs\feature-version-matrix.md)

## O que a plataforma faz

- pratica de questoes com filtros por banca, orgao, cargo, assunto, ano e dificuldade
- simulados e historico de desempenho
- raio-x de banca e estatisticas de estudo
- ranking competitivo para acompanhar desempenho apos provas
- marketplace de materiais com compra, leitura autenticada e comentarios
- checkout e assinaturas com Stripe
- painel administrativo para operacao, moderacao, financeiro e configuracoes

## Estrutura do projeto

### Frontend

- raiz atual: `C:\dev\concursomestre`
- stack: `Vite + React + TypeScript`
- arquitetura oficial:
  - `src/app/` -> telas por feature
  - `src/components/shared/` -> componentes realmente compartilhados
  - `src/providers/` -> comportamento global
  - `src/services/` -> integracao HTTP e dominios globais
  - `src/router/` -> rotas publicas, privadas e admin
  - `src/state/` -> estado global real
  - `src/utils/`, `src/constants/`, `src/types/` -> apoio transversal

### Backend

- raiz atual: `C:\xampp\htdocs\questao-pro-backend`
- stack: `PHP + PDO + MySQL`
- arquitetura oficial:
  - `modules/<domain>/` -> controller, service, repository, validator, routes e dto
  - `shared/` -> infraestrutura transversal
  - `database/` -> schema e migracoes
  - `tests/` -> testes e wiring

## Como rodar localmente

### Frontend

1. Instale dependencias:

```bash
npm install
```

2. Configure `.env.local` com as chaves necessarias do frontend.

3. Rode o servidor de desenvolvimento:

```bash
npm run dev
```

4. Acesse:

- [http://localhost:3000/#/](http://localhost:3000/#/)

### Backend

1. Garanta que o backend esteja disponivel em `C:\xampp\htdocs\questao-pro-backend`.
2. Inicie Apache/MySQL no XAMPP.
3. Configure o `.env` do backend e a base de dados.

## Scripts uteis

```bash
npm run dev
npm run build
npm run test:auth
npm run test:admin
```

## Documentacao

- arquitetura oficial revisada: [docs/architecture-freeze.md](./docs/architecture-freeze.md)
- auditoria tecnica viva: [docs/audit-report.md](./docs/audit-report.md)
- inventario funcional completo: [docs/feature-report.md](./docs/feature-report.md)
- arquitetura da base de dados do backend: `C:\xampp\htdocs\questao-pro-backend\database\architecture.md`

## Estado atual da migracao

- `src/app/*/page.tsx` ja e o entry point oficial das telas
- `src/providers/*` ja concentra os providers reais
- `src/services/api/*` ja e a camada HTTP oficial
- `modules/*` no backend ja concentra boa parte do dominio administrativo e comercial
- `src/features` e `src/core` sairam do caminho produtivo
- a principal pendencia estrutural agora e reduzir bridges legados do backend em `api/*`

## Diretriz de arquitetura

Codigo novo deve nascer apenas na arquitetura oficial revisada. Nao criar regra nova em:

- `pages/`
- `context/`
- `api/` legado do backend, exceto bridges finos

## Regras permanentes de codigo

- comentarios tecnicos sao obrigatorios em **pt-BR** para funcoes, componentes, hooks, services e scripts novos ou alterados
- cada comentario deve explicar para que serve a unidade, qual responsabilidade ela assume e como ela se conecta ao fluxo real da plataforma
- cada comentario funcional deve registrar `@since <versao>` e, na baseline atual, usar `@since v1.0.0` quando a versao historica exata ainda nao estiver mapeada
- `page.tsx` deve ser apenas composicao; regras e fluxos devem morar em hooks/controllers da feature
- `src/components/shared` e `shared/` no backend devem conter apenas infraestrutura realmente compartilhada
- o padrao oficial do projeto esta congelado em [C:\dev\concursomestre\.agent\rules\engineering-standards.md](C:\dev\concursomestre\.agent\rules\engineering-standards.md)

## Observacoes

- os backups pedidos durante a auditoria foram preservados
- a plataforma foi realinhada para refletir o produto real, e nao mais o template original de AI Studio
