import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

export function registerTravelMutationTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'update_fly_order',
    {
      title: 'Update fly order',
      description: 'PUT /travel/order/fly-order/{id}.',
      inputSchema: {
        id: z.number().int(),
        body: bodyRecord,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ id, body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/travel/order/fly-order/${id}`, body);
      return jsonTextResult(data);
    },
  );
}
