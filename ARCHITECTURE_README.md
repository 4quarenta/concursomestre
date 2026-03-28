# README - Nova Arquitetura

## 🏗️ Arquitetura do Projeto

Este projeto utiliza uma **arquitetura híbrida** durante o período de transição:

### ✅ Nova Arquitetura (Para Novas Features)
```
src/features/
├── [feature]/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── services/
│   ├── types.ts
│   └── index.ts
```

**Use para:** Todas as novas funcionalidades

### ⚠️ Arquitetura Legada (Manter)
```
context/         - Contextos antigos (ainda em uso)
services/        - Serviços antigos (ainda em uso)
components/      - Componentes antigos (ainda em uso)
```

**Não modificar:** Código legado ainda usado pelas páginas existentes

---

## 📚 Documentação

### Guias Principais
- **`new_features_guide.md`** - Como criar novas features
- **`quick_reference.md`** - Referência rápida de imports
- **`migration_guide.md`** - Guia de migração (futuro)
- **`architecture_summary.md`** - Visão geral completa

### Estrutura
- **`project_structure.md`** - Árvore de diretórios
- **`cleanup_plan.md`** - Plano de limpeza
- **`LEGACY.md`** - Arquivos legados marcados

---

## 🚀 Como Usar

### Para Novas Features
```typescript
// Importar de features
import { useQuestions } from '@features/questions';
import { useComments } from '@features/comments';
import { useNotifications } from '@features/notifications';

// Usar hooks compartilhados
import { useDebounce, useIntersectionObserver } from '@shared';

// Usar API centralizada
import { apiClient, ENDPOINTS } from '@core/api';
```

### Para Código Existente
```typescript
// Continuar usando contextos antigos
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
```

---

## 💾 Backups

- `backup_pre_phase2_20260205_201628` - Antes da Fase 2
- `backup_complete_20260205_204044` - Backup completo (127 arquivos)

---

## ✅ Status

- **Fase 1-4:** ✅ Completas
- **Fase 5:** ✅ Cleanup inicial realizado
- **Nova Arquitetura:** ✅ Pronta para uso
- **Código Legado:** ⚠️ Mantido para compatibilidade

---

## 🎯 Próximos Passos

1. **Criar novas features** usando `src/features/`
2. **Seguir padrões** estabelecidos
3. **Documentar** conforme desenvolve
4. **Testar** isoladamente

**Consulte `new_features_guide.md` para começar!** 🚀
