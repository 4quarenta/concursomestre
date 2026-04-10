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
import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/index';

/**
 * Entrada principal da aplicacao.
 * Mantem a casca global enxuta e delega o fluxo real para providers e router oficiais.
 *
 * @since 1.0.0
 */
const App: React.FC = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);

export default App;
