import { describe, expect, it } from 'vitest';
import { availabilityMinutes, initialPlan, withAvailabilityDefaults } from './plannerService';

describe('study planner availability windows', () => {
  it('counts midnight as the end of the selected day', () => {
    expect(availabilityMinutes({ start: '19:00', end: '00:00' })).toBe(300);
  });

  it('recognizes minute-only periods and disabled days', () => {
    expect(availabilityMinutes({ start: '20:10', end: '20:40' })).toBe(30);
    expect(availabilityMinutes({ start: '19:00', end: '19:00' })).toBe(0);
  });

  it('preserves legacy duration values in a valid same-day window', () => {
    const plan = initialPlan();
    plan.availability['1'] = 600;
    delete plan.availabilityWindows['1'];
    const normalized = withAvailabilityDefaults(plan);
    expect(normalized.availabilityWindows['1']).toEqual({ start: '14:00', end: '00:00' });
    expect(normalized.availability['1']).toBe(600);
  });

  it('rejects a reversed window instead of silently counting time', () => {
    expect(availabilityMinutes({ start: '20:00', end: '19:00' })).toBe(0);
  });
});
