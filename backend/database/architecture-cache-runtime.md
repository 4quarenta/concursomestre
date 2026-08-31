# Arquitetura do runtime de cache

## Estrutura oficial

- `api/cache/manage.php`: bridge HTTP legado para operacoes administrativas de cache.
- `storage/cache`: cache de respostas em disco.
- `storage/runtime/cookies`: cookies temporarios usados por integracoes HTTP do modulo `statistics`.

## Regra

Nenhum artefato de runtime deve permanecer em diretorios publicos de `api/`.

## Modulos afetados

- `modules/questions`
- `modules/statistics`
- `api/utils/SimpleCache.php`
- `api/utils/cache_helpers.php`
