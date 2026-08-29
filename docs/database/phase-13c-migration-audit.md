# Fase 13C - Auditoria do runner de migrations

O runner agora expõe uma ação CLI somente leitura `--audit`. Ela compara:

- migrations descobertas no diretório versionado;
- linhas aplicadas em `schema_migrations`;
- checksums;
- identidades lógicas e prefixos ambíguos;
- ordem histórica;
- arquivos SQL/PHP manuais ignorados pelo padrão de descoberta.

Arquivos legados com prefixo de data somente são reconciliados quando o
`base_version` e o `name` coincidem. Isso evita marcar uma migration antiga
como pendente por causa da mudança para timestamp completo. A reconciliação não
altera metadata nem schema.

O relatório deve ser executado antes de qualquer `--apply`. Arquivos antigos
fora do padrão, como scripts SQL de manutenção, aparecem como
`IGNORED_MANUAL_SQL` e precisam de decisão explícita; não são aplicados
automaticamente pelo runner.

A aplicação continua protegida por `MIGRATIONS_ALLOW_APPLY=true` e, em
produção, por `MIGRATIONS_ALLOW_PRODUCTION=true`. Nenhum desses valores é
ativado por este commit.
