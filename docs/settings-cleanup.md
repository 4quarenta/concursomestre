# Settings Cleanup

## Objetivo

Fechar a pend?ncia arquitetural do fluxo de configurações do admin e remover artefatos técnicos sensiveis que ainda poluiam a raiz operacional do backend.

## O que mudou

### Frontend

- O botao explicito de salvar planos no admin deixou de fazer `apiClient.post('settings.php', ...)` direto.
- A persistencia imediata agora usa a camada oficial de dados via `saveSystemSettingsNow(...)`.
- O contexto de dados continua suportando autosave com debounce por `updateSystemSettings(...)`, mas passou a expor um flush imediato para telas que precisam de salvamento explicito.

### Backend

- O endpoint oficial [C:\xampp\htdocs\questão-pro-backend\api\settings.php](C:\xampp\htdocs\questão-pro-backend\api\settings.php) continua sendo o unico endpoint valido de configurações.
- O log técnico de settings saiu de `api/settings_log.txt` e foi movido para `storage/logs/settings.log`.
- O endpoint duplicado da raiz [C:\xampp\htdocs\questão-pro-backend\settings.php](C:\xampp\htdocs\questão-pro-backend\settings.php) foi removido.

## Arquivos removidos

- `C:\xampp\htdocs\questão-pro-backend\settings.php`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_debug.php`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_ultra_debug.php`
- `C:\xampp\htdocs\questão-pro-backend\api\dump_settings.php`
- `C:\xampp\htdocs\questão-pro-backend\api\test_save.php`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_debug.log`
- `C:\xampp\htdocs\questão-pro-backend\api\settings_log.txt`
- `C:\xampp\htdocs\questão-pro-backend\api\debug.log`
- `C:\xampp\htdocs\questão-pro-backend\api\admin\keys.txt`
- `C:\xampp\htdocs\questão-pro-backend\api\admin\keys_addr.txt`
- `C:\xampp\htdocs\questão-pro-backend\api\admin\keys_ua.txt`

## Impacto

- O admin segue salvando configurações sem mudar contrato funcional.
- O save duplicado foi eliminado.
- A raiz `api/` ficou menos exposta e menos poluida.
- Os residuos de debug e chaves soltas deixaram de existir no código ativo.
