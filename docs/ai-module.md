# AI Module

## Escopo desta rodada

Esta passada absorveu a rota legada de geracao de IA para a arquitetura oficial:

- `api/ai/generate.php`

O endpoint agora e um bridge fino para:

- `C:\xampp\htdocs\questao-pro-backend\modules\ai\controllers\AiController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\ai\services\AiService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\ai\repositories\AiRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\ai\validators\AiValidator.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\ai\routes.php`

## Regras aplicadas

- `controller` fino: apenas repassa para o service.
- `repository` centraliza a leitura da chave Gemini em `system_settings`.
- `service` concentra a chamada HTTP ao Gemini.
- `validator` valida e limita o prompt.
- a rota antiga deixa de montar cURL e SQL no mesmo arquivo.

## Limpeza executada

As rotas utilitarias abaixo sairam de `api/ai` por nao serem endpoints de produto:

- `api/ai/list_models.php`
- `api/ai/list_model_names.php`

O uso operacional permaneceu em CLI via:

- `C:\xampp\htdocs\questao-pro-backend\scripts\manual-tests\list_gemini_models.php`

## Observacao funcional

O frontend atual do admin usa principalmente a integracao direta em `src/services/questions/aiService.ts`.
Esta rodada preserva compatibilidade do endpoint legado `aiGenerate`, mas nao muda o fluxo moderno do painel.
