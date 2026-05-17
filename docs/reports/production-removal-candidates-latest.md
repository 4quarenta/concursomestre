# Remocao de Arquivos e Codigo - Candidatos (Producao)

Data base: `2026-05-16`

## Ja removido nesta rodada

1. `src/app/admin/components/settings/AdminLandingContentSection.tsx`
   - Motivo: bloco duplicado de configuracao de homepage na aba `Geral`.
   - Evidencia: a tela de configuracoes agora usa fluxo unico, sem esse componente.
   - Risco: baixo.

2. Artefatos locais de execucao removidos da raiz:
   - `.codex-dev-3000.err.log`
   - `.codex-dev-3000.out.log`
   - `.codex-dev-3001.err.log`
   - `.codex-dev-3001.out.log`
   - `.codex-dev.log`
   - `tmp-next-start-3102.log`
   - Motivo: lixo operacional local, sem utilidade de runtime.
   - Risco: baixo.

3. Artefatos temporarios locais removidos em `2026-05-16`:
   - `.tmp-dev-err.log`
   - `.tmp-dev-out.log`
   - `.tmp-dev-webpack-err.log`
   - `.tmp-dev-webpack-out.log`
   - `.tmp-dev3000-err.log`
   - `.tmp-dev3000-out.log`
   - `.tmp-next-start.err.log`
   - `.tmp-next-start.log`
   - Motivo: logs de execucao local ignorados pelo Git e sem valor para runtime.
   - Risco: baixo.

4. `tmp-hard-refresh-baseline-latest.json`
   - Status: movido para `docs/reports/artifacts/hard-refresh-baseline-latest.json`.
   - Motivo: baseline tecnico deve ficar junto dos artefatos de auditoria, nao na raiz do projeto.
   - Evidencia: `scripts/checks/hard-refresh-budget.mjs` e `scripts/checks/hard-refresh-baseline.mjs` agora usam `docs/reports/artifacts/` por padrao; `npm run check:hard-refresh-budget` passou.
   - Risco: baixo.

## Candidatos seguros para limpeza imediata

1. Arquivos temporarios ainda presentes por lock de processo local:
   - `.tmp-dev3000-webpack-err.log`
   - `.tmp-dev3000-webpack-out.log`
   - Motivo: artefatos de execucao local em uso pelo servidor dev/webpack ativo.
   - Evidencia: nova tentativa de remocao em `2026-05-16` falhou porque o Windows informou que os arquivos continuam em uso por outro processo. Processo provavel no momento da auditoria: `node.exe` PID `20584`, comando `next dev --webpack --port 3000`.
   - Acao recomendada: encerrar o processo local e limpar no pre-release.

## Candidatos com validacao obrigatoria antes de remover

1. `docs/history/**`
   - Motivo: nao participa do runtime.
   - Risco: medio, por perda de contexto historico de decisoes/auditoria.
   - Acao recomendada: mover para repositorio de arquivo ou release attachment antes de excluir.

## Regra operacional para proximas limpezas

1. Somente remover arquivos de codigo quando:
   - nao houver importacao/referencia em runtime,
   - `npm run typecheck` passar,
   - smoke das rotas afetadas passar.
2. Arquivos de evidencia de auditoria/performance devem ser movidos para pasta de artefatos antes da exclusao.
