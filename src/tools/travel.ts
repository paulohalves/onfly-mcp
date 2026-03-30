import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForTravel } from '../utils/include-defaults.js';
import { extractDataArray } from '../utils/onfly-payload.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const travelType = z.enum(['fly', 'hotel', 'bus', 'auto']);

function orderPath(type: z.infer<typeof travelType>): string {
  return `/travel/order/${type}-order`;
}

/** Checks whether a travel order belongs to the given userId. */
function orderBelongsToUser(order: unknown, userId: number): boolean {
  if (!order || typeof order !== 'object') {
    return false;
  }
  const rec = order as Record<string, unknown>;

  // Primary: check travellers[].userId
  const travellers = rec.travellers;
  if (travellers && typeof travellers === 'object') {
    const inner = (travellers as Record<string, unknown>).data;
    const list = Array.isArray(inner) ? inner : Array.isArray(travellers) ? travellers : [];
    for (const t of list) {
      if (!t || typeof t !== 'object') {
        continue;
      }
      const uid = (t as Record<string, unknown>).userId;
      if (String(uid) === String(userId)) {
        return true;
      }
    }
  }

  // Fallback: check client.data.id
  const clientField = rec.client;
  if (clientField && typeof clientField === 'object') {
    const clientData = (clientField as Record<string, unknown>).data;
    if (clientData && typeof clientData === 'object') {
      const cid = (clientData as Record<string, unknown>).id;
      if (Number(cid) === userId) {
        return true;
      }
    }
  }

  return false;
}

export function registerTravelTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_travel_orders',
    {
      title: 'List travel orders (company-wide)',
      description:
        "List travel reservations company-wide: fly, hotel, bus, or auto. Returns orders for ALL employees — use list_my_travel_orders instead when looking for the current user's own trips.",
      inputSchema: {
        type: travelType,
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ type, start_date, end_date, detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'startDate', start_date);
      appendParam(params, 'endDate', end_date);
      appendParam(params, 'include', includeForTravel(detail_level));
      const data = await client.get(orderPath(type), params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_my_travel_orders',
    {
      title: 'List my travel orders',
      description:
        'List travel orders (fly/hotel/bus/auto) for the authenticated user only. ' +
        'Use this when the user asks about their own trips, last flight, recent bookings, etc. ' +
        'Resolves the current user via GET /employees/me, then paginates travel orders and filters ' +
        "by traveller userId — returning only this user's reservations sorted most-recent first. " +
        'Much more efficient than list_travel_orders (company-wide) for personal queries.',
      inputSchema: {
        type: travelType,
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("Max number of the user's orders to return (1-50, default 10)."),
        start_date: z
          .string()
          .optional()
          .describe('Filter by departure start date YYYY-MM-DD (inclusive).'),
        end_date: z
          .string()
          .optional()
          .describe('Filter by departure end date YYYY-MM-DD (inclusive).'),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ type, limit, start_date, end_date, detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const userId = await getAuthenticatedEmployeeId(client);

      const perPage = 50;
      const maxPages = 5;
      const matched: unknown[] = [];

      for (let page = 1; page <= maxPages && matched.length < limit; page++) {
        const params = new URLSearchParams();
        appendParam(params, 'startDate', start_date);
        appendParam(params, 'endDate', end_date);
        appendParam(params, 'include', includeForTravel(detail_level));
        appendParam(params, 'page', page);
        appendParam(params, 'perPage', perPage);
        appendParam(params, 'sortBy', 'id');
        appendParam(params, 'sortOrder', 'DESC');

        const payload = await client.get(orderPath(type), params);
        const rows = extractDataArray(payload);

        if (rows.length === 0) {
          break;
        }

        for (const row of rows) {
          if (orderBelongsToUser(row, userId)) {
            matched.push(row);
            if (matched.length >= limit) {
              break;
            }
          }
        }

        // If we got fewer rows than perPage, we've reached the last page.
        if (rows.length < perPage) {
          break;
        }
      }

      return jsonTextResult({
        user_id: userId,
        type,
        total_found: matched.length,
        data: matched,
      });
    },
  );

  server.registerTool(
    'get_travel_order',
    {
      title: 'Get travel order',
      description: 'Get one travel reservation by type and id.',
      inputSchema: {
        type: travelType,
        id: z.number().int(),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ type, id, detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', includeForTravel(detail_level));
      const data = await client.get(`${orderPath(type)}/${id}`, params);
      return jsonTextResult(data);
    },
  );
}
