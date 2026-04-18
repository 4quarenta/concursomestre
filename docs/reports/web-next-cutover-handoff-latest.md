# Web Next Cutover Handoff

- Gerado em: 2026-04-18T16:11:31.6722225Z
- Macroetapa concluida: 3/5
- Macroetapa atual: 4/5
- Macro 3 concluida: True

## Evidencias

- Relatorio hibrido: docs/reports/web-next-hybrid-local-latest.json
- Resumo hibrido: docs\reports\web-next-hybrid-local-latest.summary.md
- Relatorio publico: docs/reports/web-next-cutover-local.json
- Resumo publico: docs/reports/web-next-cutover-local.summary.md
- Relatorio de bridges: docs/reports/web-next-legacy-bridge-check-local.json
- Resumo de bridges: docs/reports/web-next-legacy-bridge-check-local.summary.md

## Macro 4

- Aplicar o proxy real no ambiente de staging
- Executar o gate com dominio real e IDs reais
- Registrar a rodada no playbook de staging

## Referencias

- docs/WEB_NEXT_STAGE4_STAGING.md
- config/deploy/web-next-staging-rollout.example.json
- .github/workflows/web-next-staging-gate.yml
