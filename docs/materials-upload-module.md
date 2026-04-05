# Materials Upload Module

## Objetivo

Tirar o upload legado de `api/upload.php` da raiz procedural e colocá-lo dentro do dominio oficial `materials`.

## O que mudou

- `C:\xampp\htdocs\questao-pro-backend\api\upload.php` virou bridge fino.
- A regra real foi movida para:
  - `C:\xampp\htdocs\questao-pro-backend\modules\materials\routes.php`
  - `C:\xampp\htdocs\questao-pro-backend\modules\materials\controllers\MaterialsController.php`
  - `C:\xampp\htdocs\questao-pro-backend\modules\materials\services\MaterialsService.php`
  - `C:\xampp\htdocs\questao-pro-backend\modules\materials\validators\MaterialsValidator.php`

## Comportamento preservado

- Continua aceitando `multipart/form-data`
- Continua aceitando `password` opcional para PDF
- Continua retornando `success`, `url` e `pageCount`
- Continua respondendo `401` sem autenticacao

## Endurecimentos aplicados

- Validacao de MIME com `finfo`
- Extensao do arquivo derivada do MIME real, sem confiar no nome enviado pelo cliente
- Limite de tamanho por tipo de arquivo
- Pasta de destino centralizada no backend oficial
- Processamento de PDF encapsulado no service do dominio
