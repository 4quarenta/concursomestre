# Google Search Console

Este runbook prepara a abertura de indexacao da plataforma Next quando houver dominio e ambiente publico.

## Estado atual

O projeto ainda esta em desenvolvimento local. Como nao ha dominio adquirido nem ambiente final publicado, nenhuma propriedade do Search Console deve ser considerada pronta agora.

## Pre-condicoes futuras

- dominio definitivo adquirido
- ambiente publico respondendo pela plataforma Next da raiz
- canonical final definido em `NEXT_PUBLIC_CANONICAL_URL` e nos manifests da plataforma
- `robots.txt` e `sitemap.xml` ativos no ambiente publico
- rotas publicas principais validadas manualmente
- fluxo de login, checkout e area logada validados sem regressao
- auditoria SEO executada depois da consolidacao funcional

## Sitemaps a enviar quando houver dominio

Substituir o host pelos valores reais do dominio final:

- `https://dominio-final/sitemap.xml`
- `https://dominio-final/question-sitemap.xml`, caso o sitemap dedicado de questoes esteja ativo

## Checklist de abertura

1. Criar propriedade de dominio no Search Console.
2. Validar posse do dominio pelo metodo indicado pelo Google.
3. Confirmar que o ambiente publico responde com canonical correto.
4. Conferir se `robots.txt` permite indexacao das rotas publicas.
5. Enviar os sitemaps reais.
6. Usar o inspetor de URL nas paginas publicas mais importantes.
7. Monitorar cobertura, canonicals e rich results nos primeiros dias.

## Rotas para inspecao manual

- `/`
- `/planos`
- `/elite`
- `/faq`
- uma questao publica real
- um ranking publico real
- um material publico real

## Observacao

Enquanto o projeto estiver apenas em `localhost`, esta frente fica documentada, mas nao deve ser marcada como concluida.
