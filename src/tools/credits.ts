import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

export function registerCreditsTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_credits_by_consumer',
    {
      title: 'List credits by consumer',
      description: 'GET /credits/groupByConsumer.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(50),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ page, per_page }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      const data = await client.get('/credits/groupByConsumer', params);
      return jsonTextResult(data);
    },
  );
}
