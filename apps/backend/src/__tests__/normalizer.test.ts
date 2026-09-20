import { describe, it, expect } from 'vitest';
import { normalizeAvailability, isRestockTransition } from '../services/normalizer.js';

describe('Availability Normalizer', () => {
  it('normalizes IN_STOCK raw statuses to IN_STOCK state', () => {
    const res = normalizeAvailability({
      isAvailable: true,
      rawStatus: 'IN_STOCK',
      checkDurationMs: 12
    });
    expect(res).toBe('IN_STOCK');
  });

  it('normalizes OUT_OF_STOCK raw statuses to OUT_OF_STOCK state', () => {
    const res = normalizeAvailability({
      isAvailable: false,
      rawStatus: 'OUT_OF_STOCK',
      checkDurationMs: 15
    });
    expect(res).toBe('OUT_OF_STOCK');
  });

  it('normalizes error results to UNKNOWN state', () => {
    const res = normalizeAvailability({
      isAvailable: false,
      rawStatus: 'HTTP_500',
      checkDurationMs: 45,
      error: 'HTTP error 500'
    });
    expect(res).toBe('UNKNOWN');
  });

  it('detects restock transition ONLY when OUT_OF_STOCK -> IN_STOCK', () => {
    expect(isRestockTransition('OUT_OF_STOCK', 'IN_STOCK')).toBe(true);
    expect(isRestockTransition('IN_STOCK', 'IN_STOCK')).toBe(false);
    expect(isRestockTransition('IN_STOCK', 'OUT_OF_STOCK')).toBe(false);
    expect(isRestockTransition('UNKNOWN', 'IN_STOCK')).toBe(false);
  });
});
