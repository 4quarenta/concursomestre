# ConcursoMestre Backend

Backend PHP/MySQL da plataforma ConcursoMestre.

## Stack

- PHP 8+
- MySQL/MariaDB
- Composer
- Stripe PHP SDK
- PHPMailer
- FPDI/TCPDF

## Setup local

1. Copie `.env.example` para `.env`.
2. Preencha as variaveis de banco, JWT, cron, Stripe, SMTP e provedores sociais.
3. Instale dependencias:

```bash
composer install
```

4. Execute os testes PHP necessarios com o PHP do XAMPP:

```bash
C:\xampp\php\php.exe tests\LegalCommentaryAdminWiringTest.php
C:\xampp\php\php.exe tests\AiModuleWiringTest.php
```

## Producao

Use `.env.production.example` como base para VPS. Nunca versionar `.env`, logs,
uploads, dumps de banco ou `vendor`.

## Deploy

O deploy do backend deve ser tratado separadamente do frontend Next.js:

- publicar codigo PHP;
- executar `composer install --no-dev --optimize-autoloader`;
- configurar `.env`;
- validar `config/production_preflight.php`;
- configurar webhooks Stripe;
- configurar crons com `CRON_SECRET`;
- validar logs e permissao de escrita em `storage/`.
