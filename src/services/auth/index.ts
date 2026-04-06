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

/**
 * Fachada oficial dos serviços de autenticação e reputação.
 * Nesta fase ela centraliza auth, conta e reputação fora da zona legada.
 */
export { accountService } from './accountService';
export { authFlowService } from './authFlowService';
export * from './session';
export type { ReputationData } from './reputationService';
export { reputationService } from './reputationService';
