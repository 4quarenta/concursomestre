# Formalizacao dos endpoints de settings

## Objetivo

Separar o contrato administrativo oficial de configuracoes sistemicas do endpoint publico legado, sem quebrar o carregamento inicial da plataforma.

## Decisao adotada

- `GET /api/settings.php` permanece como bridge de compatibilidade para leitura publica das configuracoes saneadas.
- `POST /api/admin/settings.php` passa a ser o entry point administrativo oficial para salvar configuracoes.
- O alias legado `settingsUpdate` continua existindo apenas como compatibilidade, mas agora delega para `admin/settings.php`.

## Impacto

- O frontend administrativo salva configuracoes pela rota oficial administrativa.
- O carregamento inicial da plataforma continua usando o endpoint publico de leitura.
- A arquitetura fica menos ambigua sem quebrar clientes antigos.
