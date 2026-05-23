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

import type { UserProfile, UserSubscription } from '@types';

export const SUBSCRIPTION_TIME_ZONE = 'America/Sao_Paulo';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';
type SubscriptionWithProviderWindow = UserSubscription & {
  created_at?: string | number | null;
  createdAt?: string | number | null;
  provider_current_period_start?: string | number | null;
  provider_current_period_end?: string | number | null;
  next_billing_at?: string | number | null;
  next_renewal_date?: string | number | null;
};

interface ResolveProfileSubscriptionTimelineInput {
  billing?: UserProfile['billing'] | null;
  subscription?: SubscriptionWithProviderWindow | null;
  now?: Date;
}

export interface ResolvedProfileSubscriptionTimeline {
  termStartAt: Date | null;
  termEndAt: Date | null;
  renewalAt: Date | null;
  nextChargeAt: Date | null;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  progressPercent: number;
  daysSinceStart: number | null;
}

const ISO_DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_WITHOUT_TZ_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;
const BR_DATE_ONLY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const BR_DATE_TIME_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const UTC_OFFSET_SAO_PAULO_HOURS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const zonedDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SUBSCRIPTION_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const zonedDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SUBSCRIPTION_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const zonedCalendarFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SUBSCRIPTION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Interpreta datas da assinatura com prioridade para strings locais sem timezone.
 * O backend pode devolver datas ISO, BR e timestamps; a UI precisa normalizar tudo
 * no calendario de Sao Paulo antes de exibir ou calcular progresso.
 * @since v1.0.0
 */
export const parseSubscriptionDate = (value?: string | number | Date | null): Date | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const normalizedValue = value < 1_000_000_000_000 ? value * 1000 : value;
    const parsedFromNumber = new Date(normalizedValue);
    return Number.isNaN(parsedFromNumber.getTime()) ? null : parsedFromNumber;
  }

  const rawValue = String(value).trim();
  if (rawValue === '') {
    return null;
  }

  if (/^\d+$/.test(rawValue)) {
    const normalizedValue = Number(rawValue);
    return parseSubscriptionDate(normalizedValue);
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(rawValue)) {
    const parsedWithTimezone = new Date(rawValue);
    return Number.isNaN(parsedWithTimezone.getTime()) ? null : parsedWithTimezone;
  }

  const isoDateOnlyMatch = rawValue.match(ISO_DATE_ONLY_PATTERN);
  if (isoDateOnlyMatch) {
    const [, year, month, day] = isoDateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  }

  const isoDateTimeWithoutTimezoneMatch = rawValue.match(ISO_DATE_TIME_WITHOUT_TZ_PATTERN);
  if (isoDateTimeWithoutTimezoneMatch) {
    const [, year, month, day, hour, minute, second] = isoDateTimeWithoutTimezoneMatch;
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) + UTC_OFFSET_SAO_PAULO_HOURS,
      Number(minute),
      Number(second || 0),
    ));
  }

  const brDateOnlyMatch = rawValue.match(BR_DATE_ONLY_PATTERN);
  if (brDateOnlyMatch) {
    const [, day, month, year] = brDateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  }

  const brDateTimeMatch = rawValue.match(BR_DATE_TIME_PATTERN);
  if (brDateTimeMatch) {
    const [, day, month, year, hour, minute, second] = brDateTimeMatch;
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour || 0) + UTC_OFFSET_SAO_PAULO_HOURS,
      Number(minute || 0),
      Number(second || 0),
    ));
  }

  const fallbackDate = new Date(rawValue);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

/**
 * Formata datas no calendario de Sao Paulo para manter a mesma leitura do Stripe
 * e evitar deslocamento de dia quando a API retorna strings sem timezone.
 * @since v1.0.0
 */
export const formatDateInSaoPaulo = (value?: string | number | Date | null, fallback = 'Indeterminado'): string => {
  const parsedDate = parseSubscriptionDate(value);
  return parsedDate ? zonedDateFormatter.format(parsedDate) : fallback;
};

/**
 * Formata data e hora no horario de Sao Paulo para historicos e trilha operacional.
 * @since v1.0.0
 */
export const formatDateTimeInSaoPaulo = (value?: string | number | Date | null, fallback = 'Data nao informada'): string => {
  const parsedDate = parseSubscriptionDate(value);
  return parsedDate ? zonedDateTimeFormatter.format(parsedDate) : fallback;
};

const getZonedCalendarParts = (date: Date) => {
  const parts = zonedCalendarFormatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0);

  return { year, month, day };
};

const getCalendarDayOrdinal = (date: Date) => {
  const { year, month, day } = getZonedCalendarParts(date);
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
};

const getCalendarDayDifference = (start: Date, end: Date) => getCalendarDayOrdinal(end) - getCalendarDayOrdinal(start);
const addDaysInSaoPauloCalendar = (date: Date, dayDelta: number) => {
  const targetOrdinal = getCalendarDayOrdinal(date) + dayDelta;
  return new Date((targetOrdinal * MS_PER_DAY) + (12 * 60 * 60 * 1000));
};

const getDaysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();

/**
 * Move datas por meses preservando o dia no calendario de Sao Paulo.
 * @since v1.0.0
 */
const addMonthsInSaoPauloCalendar = (date: Date, monthDelta: number) => {
  const { year, month, day } = getZonedCalendarParts(date);
  const totalMonths = ((year * 12) + (month - 1)) + monthDelta;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const targetDay = Math.min(day, getDaysInMonth(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
};

const resolveBillingCycle = (
  billing: UserProfile['billing'] | null | undefined,
  subscription: SubscriptionWithProviderWindow | null | undefined,
): BillingCycle => {
  const intervalUnit = String(subscription?.plan?.interval_unit || '').toLowerCase();
  const intervalCount = Math.max(1, Number(subscription?.plan?.interval_count || 1));

  if (intervalUnit === 'year') {
    return 'annual';
  }

  if (intervalUnit === 'month' && intervalCount >= 12) {
    return 'annual';
  }

  if (intervalUnit === 'month' && intervalCount === 3) {
    return 'quarterly';
  }

  if (intervalUnit === 'month') {
    return 'monthly';
  }

  // Billing pode estar atrasado para ciclos curtos; usamos mensal como fallback visual.
  if (billing?.billingCycle === 'annual' || billing?.billingCycle === 'quarterly' || billing?.billingCycle === 'monthly') {
    return billing.billingCycle;
  }

  return 'monthly';
};

type ExpectedTermDuration =
  | { mode: 'months'; value: number; minimumExpectedDays: number }
  | { mode: 'days'; value: number; minimumExpectedDays: number };

const resolveExpectedTermDuration = (
  subscription: SubscriptionWithProviderWindow | null | undefined,
  billingCycle: BillingCycle,
): ExpectedTermDuration => {
  const intervalUnit = String(subscription?.plan?.interval_unit || '').toLowerCase();
  const intervalCount = Math.max(1, Number(subscription?.plan?.interval_count || 1));

  if (intervalUnit === 'day') {
    return {
      mode: 'days',
      value: intervalCount,
      minimumExpectedDays: Math.max(1, intervalCount - 1),
    };
  }

  if (intervalUnit === 'week') {
    const expectedDays = intervalCount * 7;
    return {
      mode: 'days',
      value: expectedDays,
      minimumExpectedDays: Math.max(1, expectedDays - 1),
    };
  }

  if (intervalUnit === 'month') {
    const monthCount = Math.max(1, intervalCount);
    return {
      mode: 'months',
      value: monthCount,
      minimumExpectedDays: monthCount >= 12 ? 330 : monthCount >= 3 ? 75 : 25,
    };
  }

  if (intervalUnit === 'year') {
    return {
      mode: 'months',
      value: Math.max(1, intervalCount) * 12,
      minimumExpectedDays: 330,
    };
  }

  if (billingCycle === 'annual') {
    return { mode: 'months', value: 12, minimumExpectedDays: 330 };
  }
  if (billingCycle === 'quarterly') {
    return { mode: 'months', value: 3, minimumExpectedDays: 75 };
  }

  return { mode: 'months', value: 1, minimumExpectedDays: 25 };
};

/**
 * Consolida o termo da assinatura com prioridade para os campos remotos do provider.
 * Isso corrige a leitura quando a base local estiver atrasada ou com datas curtas de parcela.
 * @since v1.0.0
 */
export const resolveProfileSubscriptionTimeline = ({
  billing,
  subscription,
  now = new Date(),
}: ResolveProfileSubscriptionTimelineInput): ResolvedProfileSubscriptionTimeline => {
  const billingCycle = resolveBillingCycle(billing, subscription);
  const expectedTermDuration = resolveExpectedTermDuration(subscription, billingCycle);
  const totalInstallments = Math.max(1, Number(subscription?.total_installments || 1));
  const isInstallmentTerm = totalInstallments > 1
    && expectedTermDuration.mode === 'months'
    && expectedTermDuration.value > 1;

  const providerStart = parseSubscriptionDate(subscription?.provider_current_period_start ?? null);
  const providerEnd = parseSubscriptionDate(subscription?.provider_current_period_end ?? null);
  const localStart = parseSubscriptionDate(subscription?.current_period_start ?? null);
  const localEnd = parseSubscriptionDate(subscription?.current_period_end ?? null);
  const createdAt = parseSubscriptionDate(subscription?.created_at ?? subscription?.createdAt ?? null);
  const nextChargeAt = parseSubscriptionDate(
    billing?.nextBilling
      ?? subscription?.next_renewal_date
      ?? subscription?.next_billing_at
      ?? ((localEnd && providerEnd && localEnd.getTime() !== providerEnd.getTime()) ? localEnd : null),
  );

  let termStartAt = isInstallmentTerm ? (localStart ?? providerStart ?? null) : (providerStart ?? localStart ?? null);
  let termEndAt = isInstallmentTerm ? (localEnd ?? providerEnd ?? null) : (providerEnd ?? localEnd ?? null);

  if (termStartAt && !termEndAt) {
    termEndAt = expectedTermDuration.mode === 'months'
      ? addMonthsInSaoPauloCalendar(termStartAt, expectedTermDuration.value)
      : addDaysInSaoPauloCalendar(termStartAt, expectedTermDuration.value);
  }

  if (!termStartAt && termEndAt) {
    termStartAt = expectedTermDuration.mode === 'months'
      ? addMonthsInSaoPauloCalendar(termEndAt, -expectedTermDuration.value)
      : addDaysInSaoPauloCalendar(termEndAt, -expectedTermDuration.value);
  }

  // Para ciclos curtos (dia/semana), prioriza a próxima cobrança quando o período local vier inconsistente.
  if (expectedTermDuration.mode === 'days' && termStartAt && nextChargeAt) {
    const expectedDays = expectedTermDuration.value;
    const nextChargeDays = getCalendarDayDifference(termStartAt, nextChargeAt);
    const currentTermDays = termEndAt ? getCalendarDayDifference(termStartAt, termEndAt) : null;
    const nextChargeLooksValid = nextChargeDays >= expectedTermDuration.minimumExpectedDays
      && nextChargeDays <= (expectedDays + 2);
    const termLooksOutlier = currentTermDays !== null && currentTermDays > (expectedDays + 2);

    if (nextChargeLooksValid && (termEndAt === null || termLooksOutlier)) {
      termEndAt = nextChargeAt;
    }
  }

  if (isInstallmentTerm) {
    const renewalIteration = Math.max(0, Number(subscription?.renewal_iteration || 0));
    const anchorStart = createdAt
      ? addMonthsInSaoPauloCalendar(createdAt, expectedTermDuration.value * renewalIteration)
      : null;
    const anchorEnd = anchorStart
      ? addMonthsInSaoPauloCalendar(anchorStart, expectedTermDuration.value)
      : null;

    if (
      anchorStart
      && anchorEnd
      && getCalendarDayDifference(anchorStart, now) >= 0
      && getCalendarDayDifference(now, anchorEnd) >= 0
    ) {
      termStartAt = anchorStart;
      termEndAt = anchorEnd;
    } else if (termEndAt) {
      const canonicalStart = addMonthsInSaoPauloCalendar(termEndAt, -expectedTermDuration.value);
      const currentTermDays = termStartAt ? getCalendarDayDifference(termStartAt, termEndAt) : 0;
      if (!termStartAt || currentTermDays < expectedTermDuration.minimumExpectedDays) {
        termStartAt = canonicalStart;
      }
    }

    if (termStartAt) {
      termEndAt = addMonthsInSaoPauloCalendar(termStartAt, expectedTermDuration.value);
    }
  }

  if (termStartAt && termEndAt) {
    const actualDays = getCalendarDayDifference(termStartAt, termEndAt);
    const exceedsShortCycleWindow = expectedTermDuration.mode === 'days'
      && actualDays > (expectedTermDuration.value + 2);
    if (actualDays <= 0 || actualDays < expectedTermDuration.minimumExpectedDays || exceedsShortCycleWindow) {
      termEndAt = expectedTermDuration.mode === 'months'
        ? addMonthsInSaoPauloCalendar(termStartAt, expectedTermDuration.value)
        : addDaysInSaoPauloCalendar(termStartAt, expectedTermDuration.value);
    }
  }

  const totalDays = termStartAt && termEndAt
    ? Math.max(1, getCalendarDayDifference(termStartAt, termEndAt))
    : 0;

  const daysSinceStart = termStartAt
    ? Math.max(0, getCalendarDayDifference(termStartAt, now))
    : null;

  const usedDays = totalDays > 0 && daysSinceStart !== null
    ? Math.min(totalDays, daysSinceStart)
    : 0;

  const remainingDays = termEndAt
    ? (
      termStartAt && getCalendarDayDifference(now, termStartAt) > 0
        ? totalDays
        : Math.max(0, getCalendarDayDifference(now, termEndAt))
    )
    : 0;

  const progressPercent = totalDays > 0
    ? Math.min(100, Math.max(0, Math.round((usedDays / totalDays) * 100)))
    : 0;

  return {
    termStartAt,
    termEndAt,
    renewalAt: termEndAt,
    nextChargeAt: nextChargeAt ?? termEndAt,
    totalDays,
    usedDays,
    remainingDays,
    progressPercent,
    daysSinceStart,
  };
};
