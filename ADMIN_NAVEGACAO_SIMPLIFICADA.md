# Admin Navegacao Simplificada

## Arquitetura final

### Nivel 1

1. Painel
2. Operacao
3. Financeiro
4. Suporte
5. Configuracoes

### Nivel 2

#### Painel

- Dashboard
- Alertas
- Saude do billing

#### Operacao

- Questoes
- Importador
- Filtros
- Usuarios
- Materiais
- Rankings
- Denuncias

#### Financeiro

- Transacoes
- Assinaturas
- Reembolsos
- Planos e cupons
- Automacao

#### Suporte

- Feedback
- Threads

#### Configuracoes

- Geral
- Modulos
- Seguranca
- Integracoes
- Email
- Ads
- Performance
- Logs

## Componentes alterados

- `C:/dev/concursomestre/src/app/admin/components/shared/useAdminPageController.tsx`
- `C:/dev/concursomestre/src/app/admin/components/shared/AdminPageContent.tsx`
- `C:/dev/concursomestre/src/app/admin/components/shared/AdminShellLayout.tsx`
- `C:/dev/concursomestre/src/app/admin/components/shared/AdminPageHeader.tsx`
- `C:/dev/concursomestre/src/app/admin/components/finance/AdminFinance.tsx`
- `C:/dev/concursomestre/src/app/admin/components/settings/LogViewer.tsx`

## Ganhos de UX

- menos tabs concorrentes.
- header por dominio.
- confirmacoes destrutivas centralizadas.
- feedback visual so apos persistencia.
- health do billing concentrado no Painel.
- logs com blur corrigido.

## Compatibilidade preservada

- `page.tsx` continua shell fino.
- deep links por `tab` e `section` continuam.
- services oficiais continuam como camada de acesso.

## Pendencias restantes

- segunda passada visual extra em Financeiro ainda pode melhorar a densidade.
- alguns labels antigos ainda precisam limpeza fina.
- saude do billing em producao real depende do runner E2E continuar sendo executado.
