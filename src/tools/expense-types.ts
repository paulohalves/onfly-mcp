import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

export function registerExpenseTypeTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_expense_types',
    {
      title: 'List expense types',
      description: 'GET /expense/expenditure-type.',
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
      const data = await client.get('/expense/expenditure-type', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_expense_type',
    {
      title: 'Create expense type',
      description: 'POST /expense/expenditure-type.',
      inputSchema: { body: bodyRecord },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.post('/expense/expenditure-type', body);
      return jsonTextResult(data);
    },
  );
}
