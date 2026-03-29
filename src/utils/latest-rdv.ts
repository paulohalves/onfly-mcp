import type { OnflyApiClient } from '../api/client.js';

import { getAuthenticatedEmployeeId } from './authenticated-user.js';
import { includeForExpense, includeForRdv, type DetailLevel } from './include-defaults.js';
import { extractDataArray, inferLatestRdvIdFromExpensesPayload } from './onfly-payload.js';
import { appendParam } from './query.js';

export type LatestRdvOk =
  | { ok: true; resolved_via: 'rdv_list'; rdv_id: number; rdv: unknown }
  | { ok: true; resolved_via: 'expense_fallback'; rdv_id: number; rdv: unknown };

export type LatestRdvResult = LatestRdvOk | { ok: false; detail: string };

function readRdvId(record: unknown): number | undefined {
  if (!record || typeof record !== 'object') {
    return undefined;
  }
  const id = (record as Record<string, unknown>).id;
  return typeof id === 'number' && Number.isInteger(id) ? id : undefined;
}

function firstListRow(listPayload: unknown): unknown | undefined {
  const rows = extractDataArray(listPayload);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function fetchLatestRdvForUser(
  client: OnflyApiClient,
  detailLevel: DetailLevel,
): Promise<LatestRdvResult> {
  const userId = await getAuthenticatedEmployeeId(client);
  const listParams = new URLSearchParams();
  appendParam(listParams, 'userId', userId);
  appendParam(listParams, 'user[]', userId);
  appendParam(listParams, 'page', 1);
  appendParam(listParams, 'perPage', 1);
  appendParam(listParams, 'include', includeForRdv(detailLevel));
  appendParam(listParams, 'sortBy', 'id');
  appendParam(listParams, 'sortOrder', 'DESC');
  const listPayload = await client.get('/expense/rdv', listParams);
  const fromList = firstListRow(listPayload);
  if (fromList !== undefined) {
    const id = readRdvId(fromList);
    if (id === undefined) {
      return { ok: false, detail: 'Latest RDV row had no id field.' };
    }
    return { ok: true, resolved_via: 'rdv_list', rdv_id: id, rdv: fromList };
  }
  const expParams = new URLSearchParams();
  appendParam(expParams, 'userId', userId);
  appendParam(expParams, 'user[]', userId);
  appendParam(expParams, 'page', 1);
  appendParam(expParams, 'perPage', 80);
  appendParam(expParams, 'include', includeForExpense(detailLevel));
  appendParam(expParams, 'sortBy', 'id');
  appendParam(expParams, 'sortOrder', 'DESC');
  const expensePayload = await client.get('/expense/expenditure', expParams);
  const inferredId = inferLatestRdvIdFromExpensesPayload(expensePayload);
  if (inferredId === undefined) {
    return {
      ok: false,
      detail:
        'No RDV in list and no RDV linked on recent expenses. Check dates, permissions, or pass rdv_id.',
    };
  }
  const rdvParams = new URLSearchParams();
  appendParam(rdvParams, 'include', includeForRdv(detailLevel));
  const rdv = await client.get(`/expense/rdv/${inferredId}`, rdvParams);
  return { ok: true, resolved_via: 'expense_fallback', rdv_id: inferredId, rdv };
}
