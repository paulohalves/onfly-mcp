import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';
import { resolveApprovalStatus } from '../utils/status-mapper.js';

import { jsonTextResult, newClient } from './common.js';

const approvalStatusInput = z.union([
  z.number().int(),
  z.enum(['awaiting_approval', 'approved', 'rejected']),
]);

export function registerApprovalTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_approvals',
    {
      title: 'List approvals',
      description: 'List approval items (expenses, trips, advances, etc.) in Onfly.',
      inputSchema: {
        status: z.array(approvalStatusInput).optional(),
        types: z.array(z.number().int()).optional(),
        categories: z.array(z.number().int()).optional(),
        per_page: z.number().int().min(1).max(100).optional().default(20),
        sort_order: z.enum(['ASC', 'DESC']).optional().default('DESC'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ status, types, categories, per_page, sort_order }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      if (status?.length) {
        const ids = status.map((s) => resolveApprovalStatus(s));
        appendParam(params, 'status[]', ids);
      }
      if (types?.length) {
        appendParam(params, 'types[]', types);
      }
      if (categories?.length) {
        appendParam(params, 'categories[]', categories);
      }
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'sortOrder', sort_order);
      const data = await client.get('/general/approval', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'approve_request',
    {
      title: 'Approve request',
      description:
        'Approve an item by approval slug from list_approvals (POST /general/approval/approve/{slug}).',
      inputSchema: {
        slug: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ slug }, extra) => {
      const client = newClient(extra, limiter);
      const path = `/general/approval/approve/${encodeURIComponent(slug)}`;
      const data = await client.post(path, {});
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'reprove_request',
    {
      title: 'Reject request',
      description:
        'Reject an item by approval slug (POST /general/approval/reprove/{slug}).',
      inputSchema: {
        slug: z.string().min(1),
        reason: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ slug, reason }, extra) => {
      const client = newClient(extra, limiter);
      const path = `/general/approval/reprove/${encodeURIComponent(slug)}`;
      const data = await client.post(path, { reason });
      return jsonTextResult(data);
    },
  );
}
