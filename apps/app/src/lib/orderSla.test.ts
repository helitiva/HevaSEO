import { describe, it, expect } from 'vitest';
import { slaToDays, deadlineFromSla } from './orderSla';

describe('slaToDays', () => {
  it.each([
    ['~2 days', 2],
    ['2–3 days', 3],
    ['2-3 days', 3],
    ['7–10 days', 10],
    ['10 days', 10],
    ['2–3 weeks', 21],
    ['~3 weeks', 21],
    ['3–4 weeks', 28],
  ])('%s → %i days', (sla, days) => {
    expect(slaToDays(sla)).toBe(days);
  });

  it('returns null for non-concrete or empty SLAs', () => {
    expect(slaToDays('By scope')).toBeNull();
    expect(slaToDays('')).toBeNull();
    expect(slaToDays(null)).toBeNull();
    expect(slaToDays(undefined)).toBeNull();
  });
});

describe('deadlineFromSla', () => {
  it('adds the SLA days to the base date', () => {
    const from = new Date('2026-07-01T00:00:00Z');
    expect(deadlineFromSla('2–3 days', from)).toBe(new Date('2026-07-04T00:00:00Z').toISOString());
    expect(deadlineFromSla('2 weeks', from)).toBe(new Date('2026-07-15T00:00:00Z').toISOString());
  });
  it('returns null when the SLA has no concrete estimate', () => {
    expect(deadlineFromSla('By scope')).toBeNull();
  });
});
