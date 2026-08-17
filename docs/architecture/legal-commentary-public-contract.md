# Contrato publico da Lei Comentada

O endpoint publico de detalhe usa uma projecao allowlist. Campos novos no modelo interno permanecem privados ate serem explicitamente adicionados a `PublicLegalCommentaryProjection` e aos testes de seguranca.

## Classificacao

- Publico: identidade da norma, texto legal oficial, hierarquia, fonte, datas publicas, navegacao e contagens publicas.
- Disponibilidade: flags `available`, `hasContent` e `access` podem informar que um recurso existe sem transportar seu conteudo.
- Preview: somente o preview configurado pela regra de plano pode ser emitido quando o modo efetivo for `preview`.
- Protegido: comentarios editoriais, raio-x, resumo de secao, blocos editoriais, doutrina, jurisprudencia, sumulas, macetes, analises e modulos de estudo integrais exigem modo efetivo `full`.
- Administrativo: logs de sincronizacao, moderacao interna, contagens de denuncia, historico de texto e diagnosticos nunca pertencem ao DTO publico.

As regras de acesso continuam sendo calculadas pelo servico existente de autenticacao, plano e beneficios. A projecao apenas aplica o modo efetivo recebido; ela nao recria RBAC.

## Fronteiras

O endpoint projeta antes de montar o envelope SEO e antes da resposta HTTP. O Next revalida a mesma allowlist antes de serializar `initialLaw`. Metadata, JSON-LD e a pagina real consomem somente esse objeto publico.

Respostas contextuais do detalhe usam `private, no-store` e variam por credenciais. O fetch server-side e sempre anonimo e pode armazenar apenas a projecao anonima sanitizada. O cliente nao persiste detalhes autenticados em cache.

## Testes

- PHP: `backend/tests/LegalCommentaryPublicProjectionSecurityTest.php`.
- TypeScript: `src/services/legal-commentary/__tests__/publicLegalCommentaryProjection.test.ts`.
- Transporte server-side: `src/app/lei-comentada/__tests__/legalCommentaryServerData.test.ts`.

Os testes usam sentinelas no modelo interno e exigem ausencia na API publica projetada, props serializadas, SeoFacts, metadata e JSON-LD.
