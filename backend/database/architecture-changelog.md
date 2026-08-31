# Arquitetura do Modulo de Changelog

## Objetivo

Centralizar no modulo `changelog` a leitura publica das versoes publicadas da plataforma, evitando:

- SQL dentro de endpoint legado
- normalizacao de JSON espalhada em `api/*`
- resposta publica montada fora da camada oficial

## Estrutura oficial

```text
modules/changelog/
  controllers/
    ChangelogController.php
  services/
    ChangelogService.php
  repositories/
    ChangelogRepository.php
  validators/
    ChangelogValidator.php
  routes.php
```

## Tabela tocada

### `changelogs`

Usada para obter:

- `id`
- `version`
- `release_date`
- `title`
- `description`
- `content_json`

## Fluxo absorvido

1. O frontend chama `api/changelog/list.php`
2. O bridge delega para `handleChangelogListRoute()`
3. O repository le os registros ordenados por data e id
4. O validator normaliza `content_json`
5. O service monta a resposta final
6. O endpoint responde com envelope JSON padronizado

## Beneficio arquitetural

O changelog passa a obedecer o blueprint:

- controller fino
- service com regra de normalizacao
- repository com SQL
- validator com sanitizacao do JSON
- response padronizada
