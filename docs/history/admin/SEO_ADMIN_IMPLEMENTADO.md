# SEO Admin Implementado

## Arquitetura

Frontend:
- [C:\dev\concursomestre\src\app\admin\components\settings\AdminSeoSettingsSection.tsx](C:\dev\concursomestre\src\app\admin\components\settings\AdminSeoSettingsSection.tsx)
- [C:\dev\concursomestre\src\app\admin\components\settings\seoSettings.ts](C:\dev\concursomestre\src\app\admin\components\settings\seoSettings.ts)
- [C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx](C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx)

Backend:
- [C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminSettingsService.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminSettingsService.php)
- [C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminSettingsValidator.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\validators\AdminSettingsValidator.php)
- [C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminSettingsController.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\controllers\AdminSettingsController.php)
- [C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php](C:\xampp\htdocs\questao-pro-backend\modules\admin\routes.php)

## Onde fica

Admin:
- `Configurações > SEO`

## Campos suportados

### SEO global

- `site_title`
- `meta_description`
- `canonical_base_url`
- `robots_default`
- `default_og_title`
- `default_og_description`
- `default_og_image`
- `default_twitter_title`
- `default_twitter_description`
- `default_twitter_image`

### Verificações

- `google_site_verification`
- `bing_site_verification`

### Controles operacionais

- `noindex_non_production`
- `enable_sitemap`
- `enable_robots_txt_control`

### Páginas institucionais

- `landing`
- `plans`
- `faq`
- `changelog`
- `privacy`
- `terms`

Cada página suporta:
- `title`
- `meta_description`
- `canonical_url`
- `og_title`
- `og_description`
- `og_image`
- `robots_override`

## Como salvar

- o SEO fica no estado local de `AdminSettings`
- o save é explícito pelo botão padrão da tela
- o frontend usa o service oficial de settings
- o backend valida antes de persistir
- o backend salva em `system_settings` no domínio oficial do admin

## Validações aplicadas

- limite de `title`
- limite de `meta_description`
- URLs opcionais validadas
- `robots` limitado aos valores suportados

## Preview

Implementado:
- preview de SERP
- preview simples de Open Graph
- score de completude SEO

## Auditoria

- mudanças de SEO entram no log administrativo geral de `settings.update`
- o payload de auditoria registra as chaves alteradas

## Limitações

- não existe, nesta rodada, geração visual real de imagem OG
- `refresh sitemap` não foi exposto porque não havia rotina oficial pronta no backend
- o card de SEO no Painel usa score de completude, não crawl externo real
