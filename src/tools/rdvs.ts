import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForRdv } from '../utils/include-defaults.js';
import { appendParam } from '../utils/query.js';
import { resolveExpenseRdvStatus } from '../utils/status-mapper.js';

import { jsonTextResult, newClient } from './common.js';

const rdvStatusInput = z.union([
  z.number().int(),
  z.enum([
    'draft',
    'awaiting_approval',
    'awaiting_payment',
    'paid',
    'rejected',
    'archived',
  ]),
]);

export function registerRdvTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_rdvs',
    {
      title: 'List RDVs',
      description:
        'List Onfly RDVs. Defaults to the authenticated user only. Set include_company_wide true for company-wide lists (requires API permission).',
      inputSchema: {
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        status: rdvStatusInput.optional(),
        user_id: z
          .number()
          .int()
          .optional()
          .describe('Filter by employee id; overrides include_company_wide'),
        include_company_wide: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, do not restrict to the authenticated user'),
        page: z.number().int().optional().default(1),
        per_page: z.number().int().min(1).max(100).optional().default(20),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (
      {
        start_date,
        end_date,
        status,
        user_id,
        include_company_wide,
        page,
        per_page,
        detail_level,
      },
      extra,
    ) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'startDate', start_date);
      appendParam(params, 'endDate', end_date);
      if (status !== undefined) {
        appendParam(params, 'status[]', resolveExpenseRdvStatus(status));
      }
      let filterUserId = user_id;
      if (filterUserId === undefined && !include_company_wide) {
        filterUserId = await getAuthenticatedEmployeeId(client);
      }
      appendParam(params, 'userId', filterUserId);
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'include', includeForRdv(detail_level));
      appendParam(params, 'sortBy', 'id');
      appendParam(params, 'sortOrder', 'DESC');
      const data = await client.get('/expense/rdv', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_rdv',
    {
      title: 'Get RDV',
      description: 'Get one RDV by id.',
      inputSchema: {
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
    async ({ id, detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', includeForRdv(detail_level));
      const data = await client.get(`/expense/rdv/${id}`, params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'submit_rdv_for_approval',
    {
      title: 'Submit RDV for approval',
      description: 'Submit an RDV to the Onfly approval flow (API: POST /expense/rdv).',
      inputSchema: {
        rdv_id: z.number().int(),
        expenditure_ids: z.array(z.number().int()).optional(),
        tag_ids: z.array(z.number().int()).optional(),
        cost_center_id: z.number().int().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ rdv_id, expenditure_ids, tag_ids, cost_center_id }, extra) => {
      const client = newClient(extra, limiter);
      const payload: Record<string, unknown> = { rdvId: rdv_id };
      if (expenditure_ids?.length) {
        payload.expendituresId = expenditure_ids;
      }
      if (tag_ids?.length) {
        payload.tagsId = tag_ids;
      }
      if (cost_center_id !== undefined) {
        payload.costCenterId = cost_center_id;
      }
      const data = await client.post('/expense/rdv', payload);
      return jsonTextResult(data);
    },
  );
}
