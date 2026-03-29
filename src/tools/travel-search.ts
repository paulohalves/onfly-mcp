import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const queryValues = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])),
]);

const optionalQuery = z.record(z.string(), queryValues).optional();

function appendQueryRecord(params: URLSearchParams, record: Record<string, z.infer<typeof queryValues>>): void {
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      appendParam(params, key, value);
      continue;
    }
    params.set(key, String(value));
  }
}

export function registerTravelSearchTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'search_hotel_destinations',
    {
      title: 'Search hotel destinations',
      description: 'GET /geolocation/search-destination — resolve destination before hotel search.',
      inputSchema: {
        query: z.record(z.string(), queryValues).optional().default({}),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendQueryRecord(params, query);
      const data = await client.get('/geolocation/search-destination', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'search_hotels',
    {
      title: 'Search hotels',
      description:
        'GET /hotel/search — availability search; pass API query keys in `query` (see Onfly docs).',
      inputSchema: { query: optionalQuery.describe('e.g. destinationId, checkIn, checkOut, adults') },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      if (query) {
        appendQueryRecord(params, query);
      }
      const data = await client.get('/hotel/search', params);
      return jsonTextResult(data);
    },
  );
}
