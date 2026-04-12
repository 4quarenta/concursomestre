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
  provider_current_period_start?: string | number | null;
  provider_current_period_end?: string | number | null;
  next_billing_at?: string | number | null;
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
  if (billing?.billingCycle === 'annual' || billing?.billingCycle === 'quarterly' || billing?.billingCycle === 'monthly') {
    return billing.billingCycle;
  }

  if (subscription?.plan?.interval_unit === 'year') {
    return 'annual';
  }

  if (subscription?.plan?.interval_count === 3) {
    return 'quarterly';
  }

  return 'monthly';
};

const getExpectedCycleMonths = (billingCycle: BillingCycle) => {
  if (billingCycle === 'annual') return 12;
  if (billingCycle === 'quarterly') return 3;
  return 1;
};

const getMinimumExpectedDays = (billingCycle: BillingCycle) => {
  if (billingCycle === 'annual') return 330;
  if (billingCycle === 'quarterly') return 75;
  return 25;
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
  const expectedMonths = getExpectedCycleMonths(billingCycle);

  const providerStart = parseSubscriptionDate(subscription?.provider_current_period_start ?? null);
  const providerEnd = parseSubscriptionDate(subscription?.provider_current_period_end ?? null);
  const localStart = parseSubscriptionDate(subscription?.current_period_start ?? null);
  const localEnd = parseSubscriptionDate(subscription?.current_period_end ?? null);
  const nextChargeAt = parseSubscriptionDate(
    billing?.nextBilling
      ?? subscription?.next_billing_at
      ?? ((localEnd && providerEnd && localEnd.getTime() !== providerEnd.getTime()) ? localEnd : null),
  );

  let termStartAt = providerStart ?? localStart ?? null;
  let termEndAt = providerEnd ?? localEnd ?? null;

  if (termStartAt && !termEndAt) {
    termEndAt = addMonthsInSaoPauloCalendar(termStartAt, expectedMonths);
  }

  if (!termStartAt && termEndAt) {
    termStartAt = addMonthsInSaoPauloCalendar(termEndAt, -expectedMonths);
  }

  if (termStartAt && termEndAt) {
    const actualDays = getCalendarDayDifference(termStartAt, termEndAt);
    if (actualDays <= 0 || actualDays < getMinimumExpectedDays(billingCycle)) {
      termEndAt = addMonthsInSaoPauloCalendar(termStartAt, expectedMonths);
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
