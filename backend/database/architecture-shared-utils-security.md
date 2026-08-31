# Architecture: Shared Utils and Security

## Papel na arquitetura
Esta camada concentra infraestrutura transversal que nao pertence a nenhum dominio funcional.

## Shared Utils
- `shared/utils/Mailer.php`: envio transacional de e-mails e template HTML padrao.
- `shared/utils/SimpleCache.php`: cache em arquivo com TTL e invalidacao basica usando `storage/cache`.
- `shared/utils/cache_helpers.php`: funcoes auxiliares de integracao do cache em rotas legadas e bridges.

## Shared Security
- `shared/security/Recaptcha.php`: leitura de configuracao, validacao e enforcement do reCAPTCHA.
- `shared/security/Validator.php`: funcoes genericas de validacao e sanitizacao.
- `shared/security/SQLSecurity.php`: utilitarios defensivos para nomes de tabela/coluna, limites e padroes LIKE.

## Regra de uso
- Modulos oficiais consomem `shared/*` diretamente.
- `api/utils/*` permanece apenas como camada de compatibilidade.
- Scripts de diagnostico nao devem ficar expostos em `api/`.

## Operacao
A verificacao manual de reCAPTCHA passa a ser feita por:
- `C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_recaptcha_settings.php`
