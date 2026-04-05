# Hardenizacao do runtime de cache

## Objetivo

Remover artefatos de cache e cookies do diretorio publico `api/cache`, mantendo apenas o bridge administrativo `manage.php` exposto.

## Mudancas aplicadas

- `SimpleCache` agora usa `storage/cache` como diretório padrão.
- `cache_helpers.php` passou a inicializar cache em `storage/cache`.
- `modules/questions/routes.php` e `modules/statistics/routes.php` passaram a gravar caches de arquivo em `storage/cache`.
- `StatisticsService` passou a gravar `cookie jars` em `storage/runtime/cookies`.
- Os arquivos antigos `.cache` e `cookies_*.txt` foram migrados para `storage/`.
- `api/cache` ficou apenas com `manage.php`.

## Impacto

- Menos superfície pública para artefatos operacionais.
- Estrutura alinhada ao blueprint com `storage/` como destino de runtime.
- Compatibilidade preservada para os endpoints que já usavam cache em disco.
