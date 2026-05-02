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
 * Fachada oficial dos serviços de questões e extracao por IA.
 */
export type { GeneratedOriginalQuestion, OriginalQuestionModality, PageExtractionResult } from './aiService';
export { aiService } from './aiService';
export { isPlatformOriginalQuestion, isQuestionCanceled, readQuestionBooleanFlag } from './questionFlags';
export { questionService } from './questionService';
