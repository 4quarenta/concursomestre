# Backend Root Cleanup

## Objetivo
Remover da raiz do backend artefatos que nao pertencem ao desenho oficial e reclassificar seu conteudo para areas coerentes.

## Reclassificacoes executadas
- `C:\xampp\htdocs\questao-pro-backend\migrations` -> `C:\xampp\htdocs\questao-pro-backend\database\migrations\legacy`
- `C:\xampp\htdocs\questao-pro-backend\backups` -> `C:\xampp\htdocs\questao-pro-backend\storage\backups\legacy-code`
- `C:\xampp\htdocs\questao-pro-backend\composer.phar` -> `C:\xampp\htdocs\questao-pro-backend\scripts\setup\composer.phar`

## Ajustes complementares
- scripts PHP movidos de `migrations` tiveram o bootstrap de `config/database.php` corrigido
- criado `BackendRootCleanupWiringTest.php` para falhar se a raiz voltar a receber `migrations`, `backups` ou `composer.phar`

## Estado atual da raiz
A raiz operacional ficou restrita a:
- `api`
- `config`
- `database`
- `modules`
- `scripts`
- `shared`
- `storage`
- `tests`
- `uploads`
- `vendor`
- arquivos esperados de bootstrap e composer
