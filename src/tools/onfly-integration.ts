import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

export function registerOnflyIntegrationTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'put_integration_metadata',
    {
      title: 'Put integration metadata',
      description:
        'PUT /integration/metadata/{hash} — sync ERP metadata (User, CostCenter, Tag) per Onfly API.',
      inputSchema: {
        hash: z.string().min(1),
        body: bodyRecord,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ hash, body }, extra) => {
      const client = newClient(extra, limiter);
      const path = `/integration/metadata/${encodeURIComponent(hash)}`;
      const data = await client.put(path, body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_integration_expenditure',
    {
      title: 'Create integration expenditure',
      description: 'POST /integration/expenditure — card/integration expense payload.',
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
      const data = await client.post('/integration/expenditure', body);
      return jsonTextResult(data);
    },
  );
}
