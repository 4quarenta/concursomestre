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
 * Tipos locais da feature de checkout.
 * Eles descrevem estados de UI e apoio visual sem mover regra financeira
 * para o frontend. Sao consumidos pela pagina shell e pelos componentes da feature.
 * @since v1.0.0
 */
export type CheckoutStep = 'identification' | 'payment' | 'success';

/**
 * Define o modo de autenticacao usado dentro do fluxo comercial do checkout.
 * @since v1.0.0
 */
export type CheckoutAuthMode = 'login' | 'register';

/**
 * Controla qual experiencia de pagamento Stripe esta ativa na camada visual.
 * @since v1.0.0
 */
export type CheckoutPaymentOption = 'saved_card' | 'new_card';

/**
 * Descreve como o CTA secundario do resumo deve acionar o fluxo de pagamento.
 * @since v1.0.0
 */
export type CheckoutSummaryActionMode = 'submit_saved_card' | 'submit_new_card' | 'redirect_checkout';
