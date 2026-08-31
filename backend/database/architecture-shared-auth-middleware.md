# Arquitetura de auth e middleware compartilhados

## Regra

Infraestrutura transversal de autenticação, sessão, cookies, JWT, TOTP e middlewares deve viver em `shared/`, e não em `api/`.

## Camadas oficiais

- `shared/auth`: config, sessão, cookies, JWT, autenticação por request, TOTP.
- `shared/middleware`: autenticação HTTP, segurança transversal, rate limiting.

## Compatibilidade legada

- `api/utils/*` e `api/middleware/*` permanecem apenas como bridges finos.
