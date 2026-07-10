# Arquitetura de Settings

## Entry point oficial

- Endpoint HTTP: `C:\xampp\htdocs\questao-pro-backend\api\settings.php`

## Responsabilidade

- Leitura publica de configuracoes sanitizadas
- Atualizacao protegida de configuracoes por admin autenticado
- Persistencia de `system_settings`
- Persistencia de configuracoes comerciais de planos
- Atualizacao controlada de chaves de ambiente relacionadas a pagamento

## Decisoes desta rodada

### 1. Endpoint unico

O arquivo duplicado da raiz `settings.php` foi removido. A plataforma passa a considerar apenas `api/settings.php` como entry point legado/bridge valido para configuracoes.

### 2. Log fora de `api/`

O log tecnico de configuracoes nao fica mais em `api/settings_log.txt`. O endpoint agora escreve em:

- `C:\xampp\htdocs\questao-pro-backend\storage\logs\settings.log`

Isso reduz poluicao visual da raiz e evita deixar artefatos operacionais misturados com endpoints publicos.

### 3. Endurecimento de superficie

Foram removidos endpoints e arquivos de debug que nao pertenciam ao runtime oficial:

- `settings_debug.php`
- `settings_ultra_debug.php`
- `dump_settings.php`
- `test_save.php`
- logs e arquivos de chaves auxiliares

## Fluxo

1. A UI altera `systemSettings` pelo provider.
2. O provider agenda autosave por debounce.
3. Quando a tela precisa de salvamento explicito, usa `saveSystemSettingsNow(...)`.
4. O backend valida sessao admin e persiste `system_settings`.
5. Logs tecnicos, quando necessarios, vao para `storage/logs`.
