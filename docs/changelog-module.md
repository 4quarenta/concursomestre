# Changelog Module

## Escopo desta rodada

Esta passada absorveu o dominio público de changelog para a arquitetura oficial:

- `api/changelog/list.php`

O endpoint agora e um bridge fino para:

- `C:\xampp\htdocs\questão-pro-backend\modules\changelog\controllers\ChangelogController.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\changelog\services\ChangelogService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\changelog\repositories\ChangelogRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\changelog\validators\ChangelogValidator.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\changelog\routes.php`

## Regras aplicadas

- `controller` fino: apenas repassa para o service.
- `repository` concentra a leitura de `changelogs`.
- `service` normaliza o payload retornado ao frontend.
- `validator` converte `content_json` para array seguro.
- `api/changelog/list.php` deixa de carregar SQL diretamente.

## Contrato preservado

O frontend continuou consumindo:

- `ENDPOINTS.changelog.list`
- `changelogService.listVersions()`

O contrato permanece com:

- `id`
- `version`
- `release_date`
- `title`
- `description`
- `content_json`

## Benefício arquitetural

Com isso, o changelog deixa de ser um endpoint procedural isolado e passa a seguir o mesmo desenho dos demais dominios oficiais do backend.
