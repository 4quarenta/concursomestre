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
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Bootstrap oficial do frontend.
 * Conecta a arvore React ao `#root` e mantem a inicializacao fora das telas de dominio.
 *
 * @since 1.0.0
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
