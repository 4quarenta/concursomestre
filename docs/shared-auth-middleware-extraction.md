# Extra��o da infraestrutura de auth e middleware

## Objetivo

Tirar o n�cleo transversal de autentica��o e middleware de `api/` e consolid�-lo em `shared/`.

## Estrutura oficial adotada

- `shared/auth/AuthConfig.php`
- `shared/auth/AuthCookies.php`
- `shared/auth/AuthLogger.php`
- `shared/auth/JWTAuth.php`
- `shared/auth/AuthSession.php`
- `shared/auth/request_auth.php`
- `shared/auth/GoogleAuthenticator.php`
- `shared/middleware/AuthMiddleware.php`
- `shared/middleware/RateLimiter.php`
- `shared/middleware/SecurityMiddleware.php`

## Compatibilidade

Os arquivos equivalentes em `api/middleware` e `api/utils` foram mantidos apenas como bridges legados.

## Runtime

- rate limiting em arquivo agora usa `storage/runtime/rate_limits`
