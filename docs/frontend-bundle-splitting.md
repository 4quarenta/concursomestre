## Frontend Bundle Splitting

### Objetivo
- Reduzir o chunk principal do frontend.
- Fazer o navegador baixar cada tela sob demanda.
- Separar vendors pesados por dominio técnico para melhorar cache e carregamento inicial.

### Mudancas
- `src/router/publicRoutes.tsx`
  - paginas públicas migradas para `React.lazy`.
- `src/router/privateRoutes.tsx`
  - paginas autenticadas migradas para `React.lazy`.
- `src/router/adminRoutes.tsx`
  - rota administrativa migrada para `React.lazy`.
- `src/router/index.tsx`
  - `Routes` agora roda dentro de `React.Suspense`.
  - foi adicionado fallback visual de carregamento para transicao de rota.
- `vite.config.ts`
  - `build.rollupOptions.output.manualChunks` agora separa:
    - `react-vendor`
    - `motion-icons`
    - `charts`
    - `pdf`
    - `stripe`
    - `integrations`

### Resultado observado
- O build anterior concentrava um chunk principal perto de `2.7 MB`.
- Apos lazy loading por rota, o principal caiu para cerca de `814 kB`.
- Apos o split manual de vendors, o build passou a distribuir os pesos entre chunks dedicados, sem warning de chunk acima do limite padrao do Vite.

### Validação
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- smoke `200` em `http://localhost:3000/#/`
