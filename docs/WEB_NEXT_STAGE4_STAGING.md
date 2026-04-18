# Macro 4 - Staging e Proxy Real

Esta macroetapa cobre a validacao do corte em ambiente realista, com proxy por rota e dominio que se aproxima do destino final.

## Objetivo

- validar o `web-next` no dominio de staging
- confirmar o comportamento do proxy nas rotas publicas e hibridas
- registrar evidencias antes da abertura final de indexacao

## Entradas obrigatorias

- dominio real de staging do `web-next`
- host canonico esperado nesse ambiente
- IDs reais de:
  - uma questao publica
  - um ranking publico
  - um material publico
- opcionalmente, dominio da SPA legada se o ambiente ainda estiver hibrido

## Execucao recomendada

### Rollout operacional da macro 4

Copie o template para um arquivo local ignorado pelo git:

```bash
cp config/deploy/web-next-staging-rollout.example.json config/deploy/web-next-staging-rollout.local.json
```

Como alternativa mais segura, gere o arquivo local por comando:

```bash
npm run web-next:stage4-init-config -- -BaseUrl https://staging.concursomestre.com.br -LegacyWebBaseUrl https://app.staging.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real
```

Antes de trabalhar com valores reais, rode o smoke local dos scripts da macro 4:

```bash
npm run web-next:stage4-smoke
```

Preencha ou gere o arquivo local com dominio real, IDs reais e referencia do proxy aplicado. Depois rode:

```bash
npm run web-next:stage4-proxy-check -- -ProxyConfigPath docs/examples/nginx-web-next-cutover.conf
npm run web-next:stage4-config-check
npm run web-next:stage4-status
npm run web-next:stage4-rollout
npm run web-next:stage4-handoff
npm run web-next:stage4-readiness
```

O `stage4-smoke` testa os scripts da macro 4 sem chamar staging real. O `stage4-proxy-check` valida a referencia local de proxy contra as rotas publicas essenciais. O `stage4-config-check` tambem executa esse check automaticamente quando `ProxyConfigReference` aponta para arquivo local. O `stage4-status` le config, rollout e handoff e informa se a macro 4 esta em config pronta, config validada, rollout pendente ou macro 5 liberada. O `stage4-rollout` executa a macro 4 de ponta a ponta:

- valida que a config nao usa placeholders
- confirma a referencia de proxy
- executa o gate de staging
- em modo hibrido, valida tambem os redirects para a SPA legada
- gera relatorio JSON e Markdown da macro 4 em `docs/reports/`

O handoff final le o relatorio da macro 4 e so libera a macro 5 quando o rollout real passou. Se ele for executado depois de um `stage4-config-check`, o relatorio fica registrado, mas o comando falha de proposito para sinalizar que ainda falta o gate HTTP real.
O `stage4-readiness` e a trava final: ele falha enquanto o status nao estiver em `macro5-ready`.

### Comando local

```bash
npm run web-next:staging-gate -- -BaseUrl https://staging.seu-dominio.com -ExpectedCanonicalBaseUrl https://staging.seu-dominio.com -QuestionId 123 -RankingId abc -MaterialId xyz
```

### Comando local em modo hibrido

```bash
npm run web-next:staging-gate -- -BaseUrl https://staging.seu-dominio.com -LegacyWebBaseUrl https://app.staging.seu-dominio.com -ExpectedCanonicalBaseUrl https://staging.seu-dominio.com -QuestionId 123 -RankingId abc -MaterialId xyz
```

### Workflow manual

- `.github/workflows/web-next-stage4-smoke.yml` valida os scripts da macro 4 sem staging real
- `.github/workflows/web-next-stage4-rollout.yml` executa a macro 4 completa e publica o artifact de rollout
- no workflow da macro 4, `validate_only=true` valida apenas a config antes de rodar o gate HTTP
- quando o workflow roda o gate real, ele tambem gera o handoff da macro 4 para a macro 5
- o artifact do workflow inclui rollout, proxy check, status, handoff e relatorios detalhados do gate
- `.github/workflows/web-next-staging-gate.yml` executa somente o gate de ambiente

## Evidencias esperadas

- relatorio JSON da macro 4
- resumo Markdown da macro 4
- relatorio JSON/Markdown do proxy check quando houver referencia local
- relatorio JSON/Markdown de status da macro 4
- relatorio JSON/Markdown de handoff da macro 4 para a macro 5
- arquivo local de rollout preenchido
- relatorio JSON do gate
- resumo Markdown do gate
- quando houver modo hibrido:
  - relatorio combinado
  - relatorio publico detalhado
  - relatorio de bridges detalhado
- link da execucao no GitHub Actions, se usada
- confirmacao do proxy aplicado por rota

## Criterios de saida da macro 4

- `npm run web-next:stage4-rollout` passa com config local real
- `npm run web-next:stage4-handoff` passa depois do rollout real
- `npm run web-next:stage4-readiness` passa e confirma `macro5-ready`
- gate de staging passa com dominio real
- canonical host confere com o esperado
- entidades publicas reais passam em redirect e JSON-LD
- se houver modo hibrido, os redirects para a SPA legada passam
- a configuracao de proxy utilizada fica registrada

## Estado de fechamento da implementacao

A implementacao da macro 4 esta concluida no repositorio quando estes comandos passam localmente:

```bash
npm run web-next:stage4-smoke
npm run web-next:stage4-proxy-check -- -ProxyConfigPath docs/examples/nginx-web-next-cutover.conf
npm run web-next:typecheck
npm run web-next:build
```

Nesta condicao, a macro 4 fica pronta para execucao real em staging, mas ainda nao deve abrir a macro 5. A conclusao operacional da macro 4 depende de valores externos:

- `config/deploy/web-next-staging-rollout.local.json` preenchido com dominio real
- IDs reais de questao, ranking e material publicos
- proxy real aplicado no ambiente de staging
- `npm run web-next:stage4-rollout` aprovado contra esse ambiente
- `npm run web-next:stage4-handoff` aprovado
- `npm run web-next:stage4-readiness` indicando `macro5-ready`

Se `stage4-readiness` retornar `missing-config`, a implementacao esta pronta, mas a validacao real ainda nao foi executada.

## Proximo passo

Com a macro 4 encerrada, a macro 5 abre a janela final de corte e Search Console:

- publicar o dominio final
- reenviar sitemaps
- acompanhar indexacao e canonicals reais
