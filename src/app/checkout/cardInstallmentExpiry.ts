type CheckoutBillingPlan = {
  interval_unit?: string | null;
  interval_count?: number | null;
};

type ChargeInterval = {
  unit: 'day' | 'week' | 'month' | 'year';
  count: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const resolveCheckoutChargeInterval = (
  plan: CheckoutBillingPlan,
  installmentCount: number,
): ChargeInterval => {
  const safeInstallmentCount = Math.max(1, Math.trunc(installmentCount));
  const unit = String(plan.interval_unit || 'month').trim().toLowerCase();
  const count = Math.max(1, Math.trunc(Number(plan.interval_count || 1)));

  if (safeInstallmentCount <= 1) {
    return {
      unit: ['day', 'week', 'month', 'year'].includes(unit)
        ? unit as ChargeInterval['unit']
        : 'month',
      count,
    };
  }

  return { unit: 'month', count: 1 };
};

const addCalendarMonthsUtc = (source: Date, monthsToAdd: number): Date => {
  const target = new Date(source.getTime());
  const targetMonthIndex = (source.getUTCFullYear() * 12) + source.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(source.getUTCDate(), lastDayOfTargetMonth);

  target.setUTCDate(1);
  target.setUTCFullYear(targetYear, targetMonth, targetDay);
  return target;
};

export const getCheckoutLastInstallmentChargeAt = (
  plan: CheckoutBillingPlan,
  installmentCount: number,
  firstChargeAt: Date,
): Date => {
  const safeInstallmentCount = Math.max(1, Math.trunc(installmentCount));
  if (safeInstallmentCount === 1) return new Date(firstChargeAt.getTime());

  const interval = resolveCheckoutChargeInterval(plan, safeInstallmentCount);
  const repetitions = safeInstallmentCount - 1;

  if (interval.unit === 'month') {
    return addCalendarMonthsUtc(firstChargeAt, interval.count * repetitions);
  }

  if (interval.unit === 'year') {
    return addCalendarMonthsUtc(firstChargeAt, interval.count * repetitions * 12);
  }

  const days = interval.unit === 'week'
    ? interval.count * repetitions * 7
    : interval.count * repetitions;

  return new Date(firstChargeAt.getTime() + (days * DAY_MS));
};

const normalizeExpiryYear = (year: number | string | null | undefined): number => {
  const parsed = Number(year || 0);
  return parsed > 0 && parsed < 100 ? 2000 + parsed : parsed;
};

const getCardExpiryEndAtUtc = (
  expMonth: number | string | null | undefined,
  expYear: number | string | null | undefined,
): Date | null => {
  const month = Number(expMonth || 0);
  const year = normalizeExpiryYear(expYear);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    return null;
  }

  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
};

export const getMaximumInstallmentsCoveredByCard = ({
  plan,
  maxInstallments,
  expMonth,
  expYear,
  firstChargeAt,
}: {
  plan: CheckoutBillingPlan;
  maxInstallments: number;
  expMonth: number | string | null | undefined;
  expYear: number | string | null | undefined;
  firstChargeAt: Date;
}): number => {
  const safeMaximum = Math.max(1, Math.trunc(maxInstallments));
  const expiryEndAt = getCardExpiryEndAtUtc(expMonth, expYear);
  if (!expiryEndAt) return 1;

  let maximumCovered = 0;
  for (let installmentCount = 1; installmentCount <= safeMaximum; installmentCount += 1) {
    const lastChargeAt = getCheckoutLastInstallmentChargeAt(plan, installmentCount, firstChargeAt);
    if (lastChargeAt.getTime() <= expiryEndAt.getTime()) {
      maximumCovered = installmentCount;
    }
  }

  return Math.max(1, maximumCovered);
};
