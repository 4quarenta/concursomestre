# Home Featured Organization Assets

Policy: `OFFICIAL_ORGANIZATION_LOGOS_POLICY = USE_ALL_OFFICIAL_LOGOS`.
An organization is the canonical filter taxonomy `filters.type = 'orgao'`; the Home configuration persists `filterId` (the logical `filter_id`) and reads the current name and slug from `filters`.
The assets are stored locally under `public/assets/organizations/`; runtime never hotlinks the institutional source. Rendering is restricted to organization cards and the neutral icon remains only as a technical tolerance fallback.

## Provenance

All retrieved assets are byte-preserving. The source URL is retained for provenance; the public path is the local ConcursoMestre path.

| Organization | Source URL | Source domain | Type | Retrieved | Original/normalized MIME | Dimensions | SHA-256 | Public path | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Polícia Federal | https://www.gov.br/pf/pt-br/principios-fundamentais/simbolos-da-policia-federal-2/emblema.png/view | gov.br | OFFICIAL | 2026-08-31 | image/png / image/png | 451x566 | `273d85c40c377bf273f98666a660cf9e784911f780c5cba747cdb8b48f3c8652` | `/assets/organizations/policia-federal.png` | READY |
| INSS | https://www.gov.br/previdencia/pt-br/media/logo-inss.png/view | gov.br | OFFICIAL | 2026-08-31 | image/png / image/png | 1920x661 | `c6f769b6a48221b048defbc2a00343b1dd3d1fe0cdfb1e7d79cc32dddc1fc908` | `/assets/organizations/inss.png` | READY |
| Receita Federal do Brasil | https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/institucional/arquivos-e-imagens/logo-rfb.jpg/view | gov.br | OFFICIAL | 2026-08-31 | image/jpeg / image/jpeg | 350x220 | `4e3ca389c6ddab8b0443e98c4e3a906e847d4c62a9702f6d981348cf593b685c` | `/assets/organizations/receita-federal.jpg` | READY |
| Banco Central do Brasil | https://www.bcb.gov.br/Adm/Edital/concorrencia/DEMAP0722020/arq11_DEMAP072020.pdf | bcb.gov.br | OFFICIAL | 2026-08-31 | image/png / image/png | 1650x1247 | `846d312f2e5d6cf7686c577a63c2fc3f40b95615e3dd7ed8a38767718c13adae` | `/assets/organizations/banco-central.png` | READY |
| Polícia Rodoviária Federal | https://www.gov.br/prf/pt-br/imagens/portal_prf.png | gov.br | OFFICIAL | 2026-08-31 | image/png / image/png | 1920x856 | `3e49d270fc8c7778f5d23cf47f205297fd8c46c831e993794beecbd65955e719` | `/assets/organizations/policia-rodoviaria-federal.png` | READY |
| Banco do Brasil | https://www.gov.br/mcom/pt-br/assuntos/5g/seminarios-5g.br/imagens/LOGOBBAZUL.png/view | gov.br | OFFICIAL | 2026-08-31 | image/png / image/png | 600x334 | `d0fcbf0fadd9e4c98377a1dbf5c1a99d44f4f91c50267721029aa6332a15f654` | `/assets/organizations/banco-do-brasil.png` | READY |
| Tribunal de Contas da União | https://portal.tcu.gov.br/publicacoes-institucionais/cartilha-manual-ou-tutorial/programa-de-identidade-visual-do-tcu-manual-de-aplicacao-da-marca-versao-20 | tcu.gov.br | OFFICIAL | 2026-08-31 | image/png / image/png | 2801x584 | `d26bd5a1203662959a0fbf7028bf1d5b3c66531292837b5246a94c64aa0407db` | `/assets/organizations/tcu.png` | READY |
| Justiça Eleitoral / Tribunal Superior Eleitoral | https://www.tse.jus.br/@@site-logo/logo.jpg | tse.jus.br | OFFICIAL | 2026-08-31 | image/jpeg / image/jpeg | 1200x628 | `f52b04e67ba5b8600111682c4a208a8c5477c0de56a61fc38cd7c6bdbeafcde3` | `/assets/organizations/justica-eleitoral.jpg` | READY |

`usage_context = ORGANIZATION_IDENTIFICATION` for every entry. Each asset is associated with the canonical filter taxonomy by `filterId`; the TSE/Justiça Eleitoral file is the official TSE portal logo asset. It is stored byte-for-byte locally; the institutional host returned HTTP 200 through the Node runtime used for acquisition, while the PowerShell client was blocked by the edge layer.

## Rehearsals

The eight prepared files pass local storage upload/round-trip rehearsal with private permissions and local URLs. The database rehearsal remains compatible with the existing `filters.type = 'orgao'` public projection and records no external runtime URL. The exact MySQL/Percona 8.4 production-build rehearsal is a separate gate and remains unproven in this environment.

## Centralized notice

The shared footer contains one notice: the marks belong to their respective holders and are shown only for identification and reference; display does not imply institutional affiliation or endorsement.
