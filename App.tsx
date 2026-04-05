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

import React from 'react';
import { AppProviders } from './src/providers/AppProviders';
import { AppRouter } from './src/router/index';

/**
 * Entrada principal da aplicaÃ§Ã£o.
 * MantÃ©m a raiz enxuta e delega a composiÃ§Ã£o global para mÃ³dulos especÃ­ficos.
 */
const App: React.FC = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);

export default App;
