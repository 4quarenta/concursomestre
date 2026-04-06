# Reclassificacao de scripts de migration

## Objetivo

Remover scripts operacionais de schema e seed do diret�rio público `api/migrations`.

## Destino oficial adotado

Todos os scripts PHP legados de migra��o foram movidos para:

- `C:/xampp/htdocs/questão-pro-backend/scripts/migrations/legacy`

## Motivo

Esses arquivos:
- n�o s�o endpoints HTTP
- alteram schema/dados
- pertencem � camada operacional
- n�o devem ficar acess�veis publicamente por URL

## Impacto

- `api/migrations` foi eliminado.
- os scripts continuam execut�veis internamente via CLI/PHP.
- o backend fica mais alinhado ao blueprint com l�gica operacional dentro de `scripts/`.
