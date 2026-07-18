'use client';

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

interface SetupGateProps {
  children: React.ReactNode;
}

/**
 * O setup nao participa do bootstrap publico da aplicacao. O instalador e
 * acessado explicitamente e o backend devolve 404 assim que a instalacao fecha.
 *
 * @since 1.0.0
 */
export const SetupGate: React.FC<SetupGateProps> = ({ children }) => {
  return <>{children}</>;
};

export default SetupGate;
