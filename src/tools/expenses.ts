import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForExpense } from '../utils/include-defaults.js';
import { appendParam } from '../utils/query.js';
import { resolveExpenseRdvStatus } from '../utils/status-mapper.js';

import { jsonTextResult, newClient } from './common.js';

const expenseStatusInput = z.union([
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

export function registerExpenseTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_expenses',
    {
      title: 'List expenses',
      description:
        'List Onfly expenditures. Defaults to the authenticated user only. Set include_company_wide true for company-wide results (requires API permission). Status: numeric or draft, awaiting_approval, …',
      inputSchema: {
        start_date: z.string().optional().describe('YYYY-MM-DD'),
        end_date: z.string().optional().describe('YYYY-MM-DD'),
        status: expenseStatusInput.optional(),
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
        rdv_id: z.number().int().optional(),
        page: z.number().int().optional().default(1),
        per_page: z.number().int().min(1).max(100).optional().default(20),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        title: 'List expenses',
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
        rdv_id,
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
      if (rdv_id !== undefined) {
        appendParam(params, 'rdv[]', rdv_id);
      }
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'include', includeForExpense(detail_level));
      appendParam(params, 'sortBy', 'id');
      appendParam(params, 'sortOrder', 'DESC');
      const data = await client.get('/expense/expenditure', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_expense',
    {
      title: 'Get expense',
      description: 'Get a single expenditure by id.',
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
      appendParam(params, 'include', includeForExpense(detail_level));
      const data = await client.get(`/expense/expenditure/${id}`, params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_expense',
    {
      title: 'Create expense',
      description:
        'Create a manual expenditure for the authenticated user (userId from GET /employees/me unless user_id is set). currency defaults to BRL. Amount is usually in minor units (e.g. centavos for BRL: 11000 = R$ 110.00).',
      inputSchema: {
        date: z.string().describe('Expense date (YYYY-MM-DD)'),
        amount: z
          .number()
          .describe('Amount per Onfly API (typically minor units / centavos for BRL)'),
        description: z.string(),
        expenditure_type_id: z.number().int(),
        currency: z
          .string()
          .length(3)
          .optional()
          .default('BRL')
          .describe('ISO 4217, default BRL'),
        user_id: z
          .number()
          .int()
          .optional()
          .describe('Expense owner; defaults to authenticated employee id'),
        cost_center_id: z.number().int().optional(),
        rdv_id: z.number().int().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (
      {
        date,
        amount,
        description,
        expenditure_type_id,
        currency,
        user_id,
        cost_center_id,
        rdv_id,
      },
      extra,
    ) => {
      const client = newClient(extra, limiter);
      const ownerId = user_id ?? (await getAuthenticatedEmployeeId(client));
      const payload: Record<string, unknown> = {
        date,
        amount,
        description,
        expenditureTypeId: expenditure_type_id,
        userId: ownerId,
        currency,
      };
      if (cost_center_id !== undefined) {
        payload.costCenterId = cost_center_id;
      }
      if (rdv_id !== undefined) {
        payload.rdvId = rdv_id;
      }
      const data = await client.post('/expense/expenditure', payload);
      return jsonTextResult(data);
    },
  );
}
