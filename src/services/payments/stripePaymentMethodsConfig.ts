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

import type { StripePaymentMethodSetting, StripePaymentMethodsSettings } from '@types';

export const STRIPE_PAYMENT_METHOD_CATALOG: StripePaymentMethodSetting[] = [
  {
    id: 'card',
    label: 'Cartão',
    stripeType: 'card',
    enabled: true,
    checkoutSupported: true,
    recurringSupported: true,
    removable: false,
    description: 'Cartão de crédito via Stripe. Método principal do checkout interno e da recorrência.',
  },
  {
    id: 'pix',
    label: 'PIX',
    stripeType: 'pix',
    enabled: false,
    checkoutSupported: true,
    recurringSupported: false,
    removable: false,
    description: 'PIX depende de capability ativa na Stripe e não substitui a recorrência por cartão.',
  },
  {
    id: 'boleto',
    label: 'Boleto',
    stripeType: 'boleto',
    enabled: false,
    checkoutSupported: false,
    recurringSupported: false,
    removable: false,
    description: 'Disponível na Stripe para fluxos compatíveis, mas não está implementado no checkout interno de assinatura.',
  },
  {
    id: 'apple_pay',
    label: 'Apple Pay',
    stripeType: 'card_wallet',
    enabled: false,
    checkoutSupported: false,
    recurringSupported: false,
    removable: false,
    description: 'Carteira Stripe baseada em cartão. Requer Payment Element ou fluxo wallet compatível.',
  },
  {
    id: 'google_pay',
    label: 'Google Pay',
    stripeType: 'card_wallet',
    enabled: false,
    checkoutSupported: false,
    recurringSupported: false,
    removable: false,
    description: 'Carteira Stripe baseada em cartão. Requer Payment Element ou fluxo wallet compatível.',
  },
];

export const DEFAULT_STRIPE_PAYMENT_METHODS_SETTINGS: StripePaymentMethodsSettings = {
  methods: STRIPE_PAYMENT_METHOD_CATALOG,
};

const normalizeId = (value: unknown): string => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_');

const normalizeMethod = (
  raw: Partial<StripePaymentMethodSetting> | undefined,
  fallback: StripePaymentMethodSetting,
): StripePaymentMethodSetting => ({
  ...fallback,
  ...(raw || {}),
  id: normalizeId(raw?.id || fallback.id) || fallback.id,
  label: String(raw?.label || fallback.label || '').trim() || fallback.label,
  stripeType: String(raw?.stripeType || fallback.stripeType || '').trim() || fallback.stripeType,
  enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : fallback.enabled,
  checkoutSupported: typeof raw?.checkoutSupported === 'boolean' ? raw.checkoutSupported : fallback.checkoutSupported,
  recurringSupported: typeof raw?.recurringSupported === 'boolean' ? raw.recurringSupported : fallback.recurringSupported,
  removable: typeof raw?.removable === 'boolean' ? raw.removable : fallback.removable,
  description: String(raw?.description || fallback.description || '').trim(),
});

/**
 * Normaliza a configuração de métodos Stripe mantendo defaults oficiais e customizações do admin.
 * @since v1.0.0
 */
export const normalizeStripePaymentMethodsSettings = (
  settings?: Partial<StripePaymentMethodsSettings> | null,
): StripePaymentMethodsSettings => {
  const incomingMethods = Array.isArray(settings?.methods) ? settings.methods : [];
  const byId = new Map<string, Partial<StripePaymentMethodSetting>>();

  incomingMethods.forEach((method) => {
    const id = normalizeId(method?.id);
    if (id) {
      byId.set(id, method);
    }
  });

  const normalizedDefaults = STRIPE_PAYMENT_METHOD_CATALOG.map((method) => normalizeMethod(byId.get(method.id), method));
  const customMethods = incomingMethods
    .filter((method) => {
      const id = normalizeId(method?.id);
      return id && !STRIPE_PAYMENT_METHOD_CATALOG.some((catalogMethod) => catalogMethod.id === id);
    })
    .map((method) => normalizeMethod(method, {
      id: normalizeId(method?.id) || `custom_${Date.now()}`,
      label: 'Método customizado',
      stripeType: 'custom',
      enabled: false,
      checkoutSupported: false,
      recurringSupported: false,
      removable: true,
      description: 'Método cadastrado pelo admin. Exige implementação compatível antes de aparecer no checkout.',
    }));

  return {
    methods: [...normalizedDefaults, ...customMethods],
  };
};

export const getEnabledStripePaymentMethods = (
  settings?: Partial<StripePaymentMethodsSettings> | null,
): StripePaymentMethodSetting[] => normalizeStripePaymentMethodsSettings(settings).methods.filter((method) => method.enabled);

export const isStripePaymentMethodEnabled = (
  settings: Partial<StripePaymentMethodsSettings> | null | undefined,
  methodId: string,
): boolean => getEnabledStripePaymentMethods(settings).some((method) => method.id === methodId);
