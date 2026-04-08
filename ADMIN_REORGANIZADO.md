/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

# ADMIN_REORGANIZADO

## Nova arquitetura de tabs e secoes

### Visao Geral

- Dashboard
- KPIs
- alertas operacionais

### Operacao

- Questoes
- Filtros
- Usuarios
- Materiais

### Moderacao

- Rankings
- Denuncias

### Financeiro

- Balance
- Transactions
- Refunds
- Prices
- Marketing
- Automation

### Suporte

- Feedback

### Configuracoes

- General
- Modules
- Security
- Integrations
- Email
- Ads
- Performance

## Componentes criados ou ajustados

- `C:\dev\concursomestre\src\app\admin\components\shared\useAdminPageController.tsx`
- `C:\dev\concursomestre\src\app\admin\components\shared\AdminPageContent.tsx`
- `C:\dev\concursomestre\src\components\shared\layout\DashboardSidebar.tsx`
- `C:\dev\concursomestre\src\app\admin\components\shared\AdminConfirmDialog.tsx`
- `C:\dev\concursomestre\src\app\admin\components\finance\AdminFinance.tsx`
- `C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx`
- `C:\dev\concursomestre\src\app\admin\page.tsx`

## Areas quebradas em subcomponentes

- shell da pagina separado do controller
- conteudo separado por dominio
- finance e settings passaram a operar por subsecao
- confirmacoes destrutivas centralizadas

## Melhorias de UX

- navegacao agrupada por dominio real
- badges por dominio critico
- confirmacao modal padronizada
- save explicito nas configuracoes
- feedback so apos persistencia
- finance sem CTA visual fake

## Contratos preservados

- `page.tsx` continua shell fino
- telas continuam consumindo services oficiais
- providers globais continuam alimentando datasets compartilhados
- rotas/admin query params continuam funcionando

## Pendencias restantes

- extracao adicional de subcomponentes em `AdminFinance.tsx`: desejavel
- extracao adicional de subcomponentes em `AdminSettings.tsx`: desejavel
- trilha de auditoria admin por acao ainda precisa crescer em alguns dominios fora do financeiro
