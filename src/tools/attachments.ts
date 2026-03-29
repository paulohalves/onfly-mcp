import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';

import { jsonTextResult, newClient } from './common.js';

export function registerAttachmentTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'get_attachment_by_receipt',
    {
      title: 'Get attachment by receipt id',
      description: 'GET /general/attachment/{receiptId} — expense receipt attachment.',
      inputSchema: {
        receipt_id: z
          .string()
          .min(1)
          .describe('Receipt id or attachment slug from the Onfly API'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ receipt_id }, extra) => {
      const client = newClient(extra, limiter);
      const path = `/general/attachment/${encodeURIComponent(receipt_id)}`;
      const data = await client.get(path, new URLSearchParams());
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_rdv_attachment',
    {
      title: 'Get RDV attachment',
      description:
        'GET /general/attachment/{table_type}/{rdv_id} — attachment namespace for an RDV (see Onfly docs).',
      inputSchema: {
        table_type: z.string().min(1),
        rdv_id: z.number().int(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ table_type, rdv_id }, extra) => {
      const client = newClient(extra, limiter);
      const path = `/general/attachment/${encodeURIComponent(table_type)}/${rdv_id}`;
      const data = await client.get(path, new URLSearchParams());
      return jsonTextResult(data);
    },
  );
}
