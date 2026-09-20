import { NormalizedAvailability, LazadaCheckResult } from '../types.js';

export function normalizeAvailability(result: LazadaCheckResult): NormalizedAvailability {
  if (result.error) {
    return 'UNKNOWN';
  }

  const raw = result.rawStatus.toUpperCase();

  if (result.isAvailable || raw === 'IN_STOCK' || raw === 'AVAILABLE') {
    return 'IN_STOCK';
  }

  if (raw === 'OUT_OF_STOCK' || raw === 'SOLD_OUT' || raw === 'UNAVAILABLE') {
    return 'OUT_OF_STOCK';
  }

  return 'UNKNOWN';
}

export function isRestockTransition(
  previousState: NormalizedAvailability,
  newState: NormalizedAvailability
): boolean {
  return previousState === 'OUT_OF_STOCK' && newState === 'IN_STOCK';
}
