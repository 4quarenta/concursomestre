# Architecture: Admin Legacy Bridges

## Regra oficial
A pasta `api/admin` deve conter apenas bridges para `modules/admin/routes.php`.

## Endpoints oficiais nessa area
- `api/admin/stats.php`
- `api/admin/feedback.php`
- `api/admin/report_actions.php`
- `api/admin/user_details.php`
- `api/admin/user_actions.php`
- `api/admin/list_tables.php`
- `api/admin/reset_db.php`
- `api/admin/settings.php`
- `api/admin/cache.php`
- `api/admin/logs.php`

## Compatibilidade legada relacionada
- `api/system/logs.php` -> bridge para `api/admin/logs.php`
- `api/cache/manage.php` -> bridge para `api/admin/cache.php`
- alias `settingsUpdate` -> `api/admin/settings.php`
