# Shared Utils/Security Extraction

## Objetivo
Concluir a extracao da infraestrutura transversal restante de `api/utils` para `shared/`, deixando a pasta publica apenas com bridges finos e movendo scripts operacionais para `scripts/`.

## O que foi consolidado
- `C:\xampp\htdocs\questao-pro-backend\shared\utils\Mailer.php`
- `C:\xampp\htdocs\questao-pro-backend\shared\utils\SimpleCache.php`
- `C:\xampp\htdocs\questao-pro-backend\shared\utils\cache_helpers.php`
- `C:\xampp\htdocs\questao-pro-backend\shared\security\Recaptcha.php`
- `C:\xampp\htdocs\questao-pro-backend\shared\security\Validator.php`
- `C:\xampp\htdocs\questao-pro-backend\shared\security\SQLSecurity.php`

## Bridges legados
- `C:\xampp\htdocs\questao-pro-backend\api\utils\Mailer.php`
- `C:\xampp\htdocs\questao-pro-backend\api\utils\SimpleCache.php`
- `C:\xampp\htdocs\questao-pro-backend\api\utils\cache_helpers.php`
- `C:\xampp\htdocs\questao-pro-backend\api\utils\recaptcha_helper.php`
- `C:\xampp\htdocs\questao-pro-backend\api\utils\Validator.php`
- `C:\xampp\htdocs\questao-pro-backend\api\utils\SQLSecurity.php`

## Reclassificacao operacional
- Removido o endpoint publico `C:\xampp\htdocs\questao-pro-backend\api\utils\check_recaptcha.php`
- Criado o script CLI `C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_recaptcha_settings.php`

## Modulos consumidores alinhados
- `modules/auth`
- `modules/users`
- `modules/subscriptions`
- `modules/transactions`
- `modules/admin`
- `modules/questions`
- `modules/statistics`

## Validacao executada
- `C:\xampp\php\php.exe -l` nos arquivos novos e bridges
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SharedUtilsSecurityWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\AuthModuleWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\UsersModuleWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SubscriptionsCheckoutWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\QuestionsModuleWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\StatisticsModuleWiringTest.php`
- `npm run test:auth`
- `npm run test:admin`
- `npm run build`
- smoke `401` em `api/admin/stats.php`
- smoke `200` em `api/questions/list.php`
- smoke `401` em `api/statistics/banca_info.php`
- smoke `200` na home `http://localhost:3000/#/`
