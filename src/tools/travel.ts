import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { includeForTravel } from '../utils/include-defaults.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const travelType = z.enum(['fly', 'hotel', 'bus', 'auto']);

function orderPath(type: z.infer<typeof travelType>): string {
  return `/travel/order/${type}-order`;
}

export function registerTravelTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_travel_orders',
    {
      title: 'List travel orders',
      description:
        'List travel reservations: fly, hotel, bus, or auto (GET /travel/order/{type}-order).',
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
