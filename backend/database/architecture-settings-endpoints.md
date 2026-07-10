# Arquitetura de endpoints de settings

## Estrategia

As configuracoes sistemicas vivem no modulo `admin`, via `AdminSettingsController`, `AdminSettingsService`, `AdminSettingsRepository` e `AdminSettingsValidator`.

## Entradas HTTP

- `api/settings.php`: bridge legado/publico para leitura saneada.
- `api/admin/settings.php`: bridge administrativo oficial para escrita e leitura autenticada.
- `settingsUpdate`: alias legado reescrito para `api/admin/settings.php`.

## Regra

Leitura publica continua disponivel para bootstrap do frontend, enquanto escrita administrativa fica isolada no namespace `admin`.
