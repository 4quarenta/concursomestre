# Scripts Operacionais

Esta pasta concentra scripts manuais, diagnósticos e utilitários que não fazem parte do runtime principal da API.

## Estrutura

- `checks/`
  - verificações rápidas de esquema, filtros, planos e consistência
- `debug/`
  - scripts de inspeção local e suporte técnico
- `manual-tests/`
  - testes manuais e utilitários ad hoc
- `migrations/`
  - migrações e patches manuais/legados
- `maintenance/`
  - rotinas administrativas de manutenção e reset
- `seed/`
  - carga inicial e seeds operacionais
- `setup/`
  - bootstrap e suporte de instalação local

## Regra

Nenhum desses scripts deve concentrar regra principal de domínio usada pelo runtime da aplicação.
Arquivos de runtime continuam pertencendo a:

- `public/`
- `modules/`
- `shared/`
- `config/`
- `database/`
