# Reclassificacao de scripts de migration

## Objetivo

Remover scripts operacionais de schema e seed do diretório publico `api/migrations`.

## Destino oficial adotado

Todos os scripts PHP legados de migração foram movidos para:

- `C:/xampp/htdocs/questao-pro-backend/scripts/migrations/legacy`

## Motivo

Esses arquivos:
- não são endpoints HTTP
- alteram schema/dados
- pertencem à camada operacional
- não devem ficar acessíveis publicamente por URL

## Impacto

- `api/migrations` foi eliminado.
- os scripts continuam executáveis internamente via CLI/PHP.
- o backend fica mais alinhado ao blueprint com lógica operacional dentro de `scripts/`.
