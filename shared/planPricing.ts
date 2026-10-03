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

export interface PlanPricingValues {
  monthly?: number;
  quarterly?: number;
  annual?: number;
  quarterlyDiscountPercent?: number;
  annualDiscountPercent?: number;
}

const safeNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const centsRoundUp = (value: number): number => Math.ceil((safeNumber(value) - Number.EPSILON) * 100);

export const roundPlanPriceUp = (value: number): number => {
  const roundedCents = centsRoundUp(value);
  // Math.ceil can return -0 for an input of zero after the epsilon adjustment.
  // Normalize it so pt-BR formatting never renders a free plan as "-0,00".
  return roundedCents > 0 ? roundedCents / 100 : 0;
};

export const formatPlanPriceNumber = (value: number): string => (
  roundPlanPriceUp(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
);

export const formatPlanPrice = (value: number): string => `R$ ${formatPlanPriceNumber(value)}`;

export const resolveEqualInstallmentPrice = (cycleAmount: number, installmentCount: number) => {
  const count = Math.max(1, Math.floor(safeNumber(installmentCount)));
  const cycleCents = centsRoundUp(cycleAmount);
  const installmentCents = count > 1
    ? Math.ceil((cycleCents - Number.EPSILON) / count)
    : cycleCents;

  return {
    installmentAmount: installmentCents / 100,
    cycleAmount: (installmentCents * count) / 100,
  };
};

const clampDiscountPercent = (value: unknown): number => Math.min(100, safeNumber(value));

const discountedInstallmentCycle = (monthlyCents: number, count: number, discountPercent: number) => {
  const installmentCents = Math.max(0, Math.ceil(
    (monthlyCents * (100 - discountPercent)) / 100 - Number.EPSILON,
  ));

  return (installmentCents * count) / 100;
};

export const normalizePlanPricing = <T extends PlanPricingValues>(config: T): T & Required<PlanPricingValues> => {
  const monthlyCents = centsRoundUp(safeNumber(config.monthly));
  const quarterlyDiscountPercent = clampDiscountPercent(config.quarterlyDiscountPercent);
  const annualDiscountPercent = clampDiscountPercent(config.annualDiscountPercent);

  return {
    ...config,
    monthly: monthlyCents / 100,
    quarterly: discountedInstallmentCycle(monthlyCents, 3, quarterlyDiscountPercent),
    annual: discountedInstallmentCycle(monthlyCents, 12, annualDiscountPercent),
    quarterlyDiscountPercent,
    annualDiscountPercent,
  } as T & Required<PlanPricingValues>;
};
