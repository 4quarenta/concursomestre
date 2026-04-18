# Deploy Config

Templates operacionais para validacao do corte do `web-next` por ambiente.

## Arquivos

- `web-next-staging-gate.example.json`
- `web-next-production-gate.example.json`
- `web-next-staging-rollout.example.json`
- `web-next-stage5-launch.example.json`

## Campos esperados

- `BaseUrl`
  - URL publica do ambiente que sera validado
- `ExpectedCanonicalBaseUrl`
  - host canonico que deve aparecer em metadata, `robots.txt` e sitemaps
- `LegacyWebBaseUrl`
  - opcional; quando informado, o gate tambem valida os redirects para a SPA legada e gera um relatorio combinado do ambiente hibrido
- `QuestionId`
  - ID real de uma questao publica para validar redirect e JSON-LD
- `RankingId`
  - ID real de um ranking publico para validar redirect e JSON-LD
- `MaterialId`
  - ID real de um material publico para validar redirect e JSON-LD
- `ProxyMode`
  - modo do corte registrado na macro 4; use `hybrid` quando o proxy ainda divide rotas entre Next e SPA legada
- `ProxyConfigReference`
  - caminho local ou URL da configuracao de proxy usada na rodada
- `GateOutputPath`
  - caminho do relatorio JSON gerado pelo gate interno da macro 4
- `OutputPath`
  - caminho do relatorio JSON gerado localmente; no rollout da macro 4, representa o relatorio de rollout

## Uso

```bash
npm run web-next:staging-gate -- -ConfigPath config/deploy/web-next-staging-gate.example.json
```

Troque os valores placeholder antes de rodar. Os dois templates usam `exemplo.com` de proposito, e o script falha cedo quando esses hosts ainda nao foram substituidos.

## Arquivos locais

Para uso real no dia a dia, copie o template desejado para um arquivo local ignorado pelo git:

- `config/deploy/web-next-staging-gate.local.json`
- `config/deploy/web-next-production-gate.local.json`

Quando esses arquivos existem, o script pode ser chamado sem `ConfigPath`:

```bash
npm run web-next:staging-gate
npm run web-next:production-gate
```

Para executar a macro 4 completa, use o template de rollout:

```bash
copy config\deploy\web-next-staging-rollout.example.json config\deploy\web-next-staging-rollout.local.json
npm run web-next:stage4-smoke
npm run web-next:stage4-init-config -- -BaseUrl https://staging.concursomestre.com.br -LegacyWebBaseUrl https://app.staging.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real -Force
npm run web-next:stage4-proxy-check -- -ProxyConfigPath docs\examples\nginx-web-next-cutover.conf
npm run web-next:stage4-config-check
npm run web-next:stage4-status
npm run web-next:stage4-rollout
npm run web-next:stage4-handoff
npm run web-next:stage4-readiness
```

O `stage4-smoke` valida os scripts da macro 4 em arquivos temporarios, sem chamar staging real.
O `stage4-init-config` monta o arquivo local ignorado pelo git a partir de parametros reais e tambem valida placeholders antes de gravar.
O `stage4-proxy-check` valida uma referencia local de proxy contra as rotas publicas essenciais do corte.
O `stage4-config-check` valida a config local sem executar chamadas HTTP. O rollout completo falha cedo quando encontra placeholders como `seu-dominio.com`, `123`, `abc` ou `xyz`. Isso evita registrar uma rodada de staging que ainda nao representa o ambiente real.
O `stage4-status` mostra o estado atual da macro 4 sem chamar rede, lendo config, rollout e handoff quando existirem.
O `stage4-handoff` le o relatorio do rollout e so passa quando o gate real da macro 4 passou, deixando a macro 5 pronta para abrir.
O `stage4-readiness` e o gate final para bloquear a macro 5 enquanto o status ainda nao estiver em `macro5-ready`.

Para executar a macro 5 completa, use o template de launch:

```bash
npm run web-next:stage5-smoke
npm run web-next:stage5-init-config -- -BaseUrl https://concursomestre.com.br -LegacyWebBaseUrl https://app.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real -SearchConsoleProperty sc-domain:concursomestre.com.br -MonitoringNotes "monitorar cobertura e canonicals nos primeiros 7 dias" -Force
npm run web-next:stage5-validate
npm run web-next:stage5-status
npm run web-next:stage5-launch
npm run web-next:stage5-readiness
```

O `stage5-smoke` valida os scripts da ultima macro sem chamar producao real.
O `stage5-init-config` cria a config local ignorada pelo git para o corte final em producao.
O `stage5-validate` valida a config sem chamar o production gate.
O `stage5-status` mostra se a macro 5 esta em config pronta, config validada, Search Console pendente ou concluida.
O `stage5-readiness` e a trava final: ele so passa quando a macro 5 foi registrada como concluida.

## Workflow manual

O workflow `.github/workflows/web-next-stage4-smoke.yml` roda o smoke local da macro 4 em CI, sem depender de staging real.

O workflow `.github/workflows/web-next-stage4-rollout.yml` executa a macro 4 completa:

- cria uma config local temporaria a partir dos inputs
- roda `npm run web-next:stage4-rollout`
- roda o handoff para a macro 5 quando `validate_only=false`
- publica rollout, proxy check, status, handoff e relatorios do gate como artifact

Se `validate_only=true`, o mesmo workflow valida a config e gera o relatorio da macro 4 sem chamar o gate HTTP.

O workflow `.github/workflows/web-next-stage5-smoke.yml` roda o smoke local da macro 5 em CI, sem depender de producao real.

O workflow `.github/workflows/web-next-stage5-launch.yml` executa a macro 5:

- cria uma config local temporaria a partir dos inputs
- roda `npm run web-next:stage5-launch`
- roda `npm run web-next:stage5-status`
- publica launch, status e production gate como artifact

O workflow `.github/workflows/web-next-staging-gate.yml` tambem aceita os dois ambientes:

- `environment=staging`
- `environment=production`

Assim o mesmo fluxo de CI publica o artifact correto para cada gate.
O mesmo workflow tambem anexa um resumo curto do resultado no `GITHUB_STEP_SUMMARY`.
Se `LegacyWebBaseUrl` for informado, o gate passa a refletir melhor o corte por proxy com SPA legada ainda ativa.
Nesse caso, o artifact inclui o relatorio combinado e os dois relatorios detalhados (`public` e `legacy`).
Nos wrappers locais, cada JSON tambem ganha uma versao resumida em Markdown com o mesmo nome-base.
Os workflows tambem passam a incluir essas versoes `.summary.md` dentro dos artifacts enviados pelo GitHub Actions.
