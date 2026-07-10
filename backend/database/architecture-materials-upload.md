# Arquitetura de Upload de Materiais

## Entry point legado

- `C:\xampp\htdocs\questao-pro-backend\api\upload.php`

## Camada oficial

- `C:\xampp\htdocs\questao-pro-backend\modules\materials\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\materials\controllers\MaterialsController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\materials\services\MaterialsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\materials\validators\MaterialsValidator.php`

## Responsabilidades

### Validator

- validar presenca do arquivo
- validar `UPLOAD_ERR_OK`
- validar MIME real com `finfo`
- validar limite de tamanho
- decidir pasta e extensao seguras a partir do MIME

### Service

- verificar usuario autenticado
- garantir pasta fisica de upload
- mover o arquivo
- contar paginas do PDF
- aplicar senha opcional em PDF
- devolver o contrato HTTP padronizado

### Bridge legado

`api/upload.php` nao contem mais autenticacao, validacao ou regra de negocio. Ele apenas carrega CORS, banco e delega ao handler do modulo.
