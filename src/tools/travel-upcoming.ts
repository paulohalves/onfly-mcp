import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { OnflyApiClient } from '../api/client.js';
import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import type { DetailLevel } from '../utils/include-defaults.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForTravel } from '../utils/include-defaults.js';
import { extractDataArray } from '../utils/onfly-payload.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';
import { orderBelongsToUser, orderPath } from './travel.js';

const travelOrderType = z.enum(['fly', 'hotel', 'bus', 'auto']);

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveStartDate(input?: string): string {
  return input ?? todayUtcYmd();
}

function readScalarDate(value: unknown): string | undefined {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return undefined;
}

function extractTripDate(order: unknown): string | undefined {
  if (!order || typeof order !== 'object') {
    return undefined;
  }
  const rec = order as Record<string, unknown>;
  const keys = ['checkIn', 'departureDate', 'startDate', 'date'] as const;
  for (const key of keys) {
    const d = readScalarDate(rec[key]);
    if (d !== undefined) {
      return d;
    }
  }
  return undefined;
}

function readOrderId(order: unknown): number {
  if (!order || typeof order !== 'object') {
    return 0;
  }
  const raw = (order as Record<string, unknown>).id;
  if (typeof raw === 'number' && Number.isInteger(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    return Number.parseInt(raw, 10);
  }
  return 0;
}

function compareUpcomingOrders(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const dateA = extractTripDate(a) ?? '9999-12-31';
  const dateB = extractTripDate(b) ?? '9999-12-31';
  const cmp = dateA.localeCompare(dateB);
  if (cmp !== 0) {
    return cmp;
  }
  return readOrderId(a) - readOrderId(b);
}

async function fetchMyUpcomingForType(
  client: OnflyApiClient,
  userId: number,
  type: z.infer<typeof travelOrderType>,
  limitPerType: number,
  startDate: string,
  endDate: string | undefined,
  detailLevel: DetailLevel,
): Promise<Array<Record<string, unknown>>> {
  const perPage = 50;
  const maxPages = 5;
  const matched: unknown[] = [];

  for (let page = 1; page <= maxPages && matched.length < limitPerType; page += 1) {
    const params = new URLSearchParams();
    appendParam(params, 'startDate', startDate);
    appendParam(params, 'endDate', endDate);
    appendParam(params, 'include', includeForTravel(detailLevel));
    appendParam(params, 'page', page);
    appendParam(params, 'perPage', perPage);
    appendParam(params, 'sortBy', 'id');
    appendParam(params, 'sortOrder', 'ASC');

    const payload = await client.get(orderPath(type), params);
    const rows = extractDataArray(payload);

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (!orderBelongsToUser(row, userId)) {
        continue;
      }
      matched.push(row);
      if (matched.length >= limitPerType) {
        break;
      }
    }

    if (rows.length < perPage) {
      break;
    }
  }

  return matched.map((row) => ({
    ...(row as Record<string, unknown>),
    order_type: type,
  }));
}

export function registerTravelUpcomingTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_my_upcoming_trips',
    {
      title: 'List my upcoming trips',
      description:
        'List upcoming travel reservations (fly/hotel/bus/auto) for the authenticated user only. ' +
        'Defaults start_date to today (UTC YYYY-MM-DD) and merges all selected types in one response, sorted by trip date ascending. ' +
        'Use for questions like next trips, próximas viagens, or future bookings.',
      inputSchema: {
        types: z
          .array(travelOrderType)
          .optional()
          .default(['fly', 'hotel', 'bus', 'auto'])
          .describe('Which order types to include'),
        start_date: z
          .string()
          .optional()
          .describe('YYYY-MM-DD inclusive lower bound; defaults to today (UTC)'),
        end_date: z.string().optional().describe('YYYY-MM-DD inclusive upper bound'),
        limit_per_type: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe('Max orders per type after user filter'),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ types, start_date, end_date, limit_per_type, detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const userId = await getAuthenticatedEmployeeId(client);
      const resolvedStart = resolveStartDate(start_date);

      const perTypeResults = await Promise.all(
        types.map((type) =>
          fetchMyUpcomingForType(
            client,
            userId,
            type,
            limit_per_type,
            resolvedStart,
            end_date,
            detail_level,
          ),
        ),
      );

      const combined = perTypeResults.flat();
      combined.sort(compareUpcomingOrders);

      return jsonTextResult({
        user_id: userId,
        start_date: resolvedStart,
        types,
        total_found: combined.length,
        data: combined,
      });
    },
  );
}
