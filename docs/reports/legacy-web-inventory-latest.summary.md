# Legacy Web Inventory

- **Generated at:** 2026-04-18T18:23:10.270Z
- **Branch:** 4quarenta/next-version
- **Legacy source files:** 294
- **Next source files:** 94
- **Exact route overlap:** 26
- **Legacy-only route roots:** 8

## Exact Overlap

- `admin`
- `auth`
- `changelog`
- `checkout`
- `concursos`
- `confirm-email`
- `dashboard`
- `elite`
- `faq`
- `flashcards`
- `lei-comentada`
- `marketplace`
- `material`
- `notifications`
- `partner-dashboard`
- `planos`
- `practice`
- `privacy`
- `profile`
- `promo`
- `question`
- `ranking`
- `reset-password`
- `simulation`
- `support`
- `terms`

## Legacy Only

- `bank-analysis`
- `landing`
- `landing-campaign`
- `performance-subjects`
- `plans`
- `questions`
- `ranking-detail`
- `reader`

## Next Only

- `l`
- `performance`
- `question-sitemap`
- `question-sitemap-page.xml`
- `question-sitemap.xml`
- `read`
- `subscription`
- `x-ray`

## Alias Candidates

- `plans` -> `planos`: rota comercial antiga versus canonical comercial atual
- `landing` -> `l`: landings publicas antigas versus slug publico curto no Next
- `landing-campaign` -> `promo`: campanhas comerciais antigas versus pagina promocional dedicada
- `performance-subjects` -> `performance`: segmento legado especifico versus agrupamento por dominio no App Router
- `reader` -> `read`: nome antigo do leitor versus rota canonicamente reduzida no Next

## Legacy Service Domains

- `admin`
- `api`
- `auth`
- `bank-analysis`
- `billing`
- `changelog`
- `comments`
- `dashboard`
- `filters`
- `marketing`
- `marketplace`
- `materials`
- `notifications`
- `offers`
- `payments`
- `plans`
- `profile`
- `progress`
- `questions`
- `rankings`
- `reports`
- `seo`
- `simulations`
- `statistics`
- `subscriptions`
- `support`
- `system`
- `transactions`

## Legacy Shared Components

- `feedback`
- `layout`
- `marketing`
- `overlays`
- `ui`

## Recommendations

- tratar as rotas em overlap exato como candidatas naturais a desativacao futura no legado
- manter as rotas legacy-only sob ownership explicito antes de qualquer limpeza estrutural
- usar os alias candidates para revisar nomes de rota que mudaram durante a migracao
- priorizar a auditoria do legado nos dominios que ainda concentram admin, autenticacao e contratos comerciais

