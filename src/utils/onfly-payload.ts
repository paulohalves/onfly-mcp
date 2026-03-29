/** Normalizes list responses shaped as `T[]` or `{ data: T[] }`. */
export function extractDataArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload !== null && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
}

function readRdvIdFromExpense(exp: unknown): number | undefined {
  if (exp === null || typeof exp !== 'object') {
    return undefined;
  }
  const e = exp as Record<string, unknown>;
  const direct = e.rdvId;
  if (typeof direct === 'number' && Number.isInteger(direct)) {
    return direct;
  }
  const rdv = e.rdv;
  if (rdv !== null && typeof rdv === 'object') {
    const id = (rdv as Record<string, unknown>).id;
    if (typeof id === 'number' && Number.isInteger(id)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Picks the highest RDV id seen in expense rows (works when expenses are recent and rdv id is monotonic).
 */
export function inferLatestRdvIdFromExpensesPayload(payload: unknown): number | undefined {
  const items = extractDataArray(payload);
  let best: number | undefined;
  for (const exp of items) {
    const id = readRdvIdFromExpense(exp);
    if (id !== undefined && (best === undefined || id > best)) {
      best = id;
    }
  }
  return best;
}
