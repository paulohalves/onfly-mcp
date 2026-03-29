export type TripDatePreference = 'trip_start' | 'trip_end';

const START_KEYS = [
  'startDate',
  'start_date',
  'departureDate',
  'dateStart',
  'initialDate',
  'beginDate',
] as const;

const END_KEYS = [
  'endDate',
  'end_date',
  'arrivalDate',
  'dateEnd',
  'finishDate',
] as const;

const FALLBACK_KEYS = ['createdAt', 'updatedAt', 'created_at', 'updated_at'] as const;

function unwrapRecord(obj: unknown): Record<string, unknown> | undefined {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return undefined;
  }
  const rec = obj as Record<string, unknown>;
  const inner = rec.data;
  if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return rec;
}

function firstYyyyMmDd(obj: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const raw = obj[key];
    if (typeof raw !== 'string') {
      continue;
    }
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) {
      return m[1];
    }
  }
  return undefined;
}

/**
 * Picks YYYY-MM-DD for a new expense from an RDV payload (root or `{ data: { … } }`).
 */
export function pickExpenseDateFromRdv(
  rdv: unknown,
  preference: TripDatePreference,
): string | undefined {
  const o = unwrapRecord(rdv);
  if (!o) {
    return undefined;
  }
  if (preference === 'trip_end') {
    return (
      firstYyyyMmDd(o, END_KEYS) ??
      firstYyyyMmDd(o, START_KEYS) ??
      firstYyyyMmDd(o, FALLBACK_KEYS)
    );
  }
  return (
    firstYyyyMmDd(o, START_KEYS) ??
    firstYyyyMmDd(o, END_KEYS) ??
    firstYyyyMmDd(o, FALLBACK_KEYS)
  );
}
