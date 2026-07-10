# Architecture: Module Dependencies on Shared Layer

## Regra oficial
A camada `modules/*` deve depender diretamente de `shared/*` para infraestrutura transversal.

## Dependencias permitidas
- `shared/auth/*`
- `shared/http/*`
- `shared/responses/*`
- `shared/security/*`
- `shared/middleware/*`
- `shared/utils/*`

## Papel de `api/utils`
A pasta `api/utils` permanece apenas como compatibilidade para endpoints legados e testes de bridge. Ela nao deve ser importada por modulos oficiais.

## Exemplos consolidados
- autenticacao de request: `shared/auth/request_auth.php`
- sessao/JWT: `shared/auth/AuthSession.php`, `shared/auth/JWTAuth.php`
- resposta JSON: `shared/responses/Response.php`
- seguranca admin: `shared/security/AdminSecurity.php`
