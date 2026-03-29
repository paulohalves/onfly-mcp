import type { OnflyApiClient } from '../api/client.js';

/** Recognized id fields on employee-like records (API may use id, userId, etc.). */
const ID_KEYS = ['id', 'employeeId', 'userId', 'ownerId'] as const;

function readIdFromRecord(obj: unknown): number | undefined {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }
  const rec = obj as Record<string, unknown>;
  for (const key of ID_KEYS) {
    const raw = rec[key];
    if (typeof raw === 'number' && Number.isInteger(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && /^\d+$/.test(raw)) {
      return Number.parseInt(raw, 10);
    }
  }
  return undefined;
}

/**
 * Onfly may return the employee at the root or wrapped (e.g. `{ data: { id, ... } }`).
 */
export function extractEmployeeIdFromPayload(payload: unknown): number | undefined {
  const direct = readIdFromRecord(payload);
  if (direct !== undefined) {
    return direct;
  }

  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const rec = payload as Record<string, unknown>;
  const inner = rec.data;

  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    const fromData = readIdFromRecord(inner);
    if (fromData !== undefined) {
      return fromData;
    }
  }

  if (Array.isArray(inner) && inner.length > 0) {
    return readIdFromRecord(inner[0]);
  }

  return undefined;
}

function describePayload(payload: unknown): string {
  if (payload === null) {
    return 'null';
  }
  if (typeof payload !== 'object') {
    return typeof payload;
  }
  if (Array.isArray(payload)) {
    return `array(len=${payload.length})`;
  }
  const keys = Object.keys(payload);
  return `object(keys=${keys.join(', ') || '(empty)'})`;
}

export async function getAuthenticatedEmployeeId(client: OnflyApiClient): Promise<number> {
  const me = await client.get('/employees/me', new URLSearchParams());
  const id = extractEmployeeIdFromPayload(me);
  if (id === undefined) {
    throw new Error(
      `Could not read employee id from GET /employees/me (${describePayload(me)}). ` +
        `Use include_company_wide: true for list_expenses if your token has no user context (e.g. client_credentials).`,
    );
  }
  return id;
}
