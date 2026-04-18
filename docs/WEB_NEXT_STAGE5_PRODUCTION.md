# Macro 5 - Producao e Search Console

Esta macroetapa cobre o corte final no dominio canonico, a abertura do Search Console e o monitoramento inicial de indexacao.

Nota em `2026-04-18`: `web-next` permanece como nome historico dos scripts da macro, mas a aplicacao Next ativa roda na raiz do repositorio.

## Objetivo

- validar o Next no dominio final
- registrar o envio dos sitemaps no Search Console
- confirmar URLs canonicas e indexacao inicial
- abrir a janela de monitoramento dos primeiros dias

## Fluxo recomendado

1. Validar os scripts localmente:

```bash
npm run web-next:stage5-smoke
```

2. Gerar a config local da macro 5:

```bash
npm run web-next:stage5-init-config -- -BaseUrl https://concursomestre.com.br -LegacyWebBaseUrl https://app.concursomestre.com.br -QuestionId questao-real -RankingId ranking-real -MaterialId material-real -SearchConsoleProperty sc-domain:concursomestre.com.br -MonitoringNotes "monitorar cobertura e canonicals nos primeiros 7 dias"
```

3. Validar a config sem chamar producao:

```bash
npm run web-next:stage5-validate
```

4. Executar o launch real:

```bash
npm run web-next:stage5-launch
```

5. Verificar o estado final:

```bash
npm run web-next:stage5-status
npm run web-next:stage5-readiness
```

## Evidencias esperadas

- relatorio JSON/Markdown da macro 5
- relatorio JSON/Markdown de status da macro 5
- production gate aprovado
- propriedade do Search Console registrada
- envio de `/sitemap.xml`
- envio de `/question-sitemap.xml`
- URLs inspecionadas registradas
- notas de monitoramento dos primeiros dias

## Criterios de saida

- `npm run web-next:stage5-launch` passa com producao real
- `npm run web-next:stage5-status` retorna `completed`
- `npm run web-next:stage5-readiness` passa
- production gate aprovado no dominio final
- Search Console documentado
- monitoramento inicial registrado

## Estado de fechamento da implementacao

A implementacao da macro 5 esta concluida no repositorio quando estes comandos passam localmente:

```bash
npm run web-next:stage5-smoke
npm run web-next:typecheck
npm run web-next:build
```

Nesta condicao, a macro 5 fica pronta para execucao real, mas o go-live final ainda depende de dados externos:

- `config/deploy/web-next-stage5-launch.local.json` preenchido com dominio real
- production gate aprovado contra o dominio final
- propriedade do Search Console registrada
- sitemaps enviados
- monitoramento inicial registrado
- `npm run web-next:stage5-readiness` indicando conclusao da macro 5

Se `stage5-readiness` retornar `missing-config`, a implementacao esta pronta, mas a execucao final ainda nao foi registrada.
