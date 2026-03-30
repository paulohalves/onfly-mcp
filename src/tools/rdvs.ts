import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForRdv } from '../utils/include-defaults.js';
import { fetchLatestRdvForUser } from '../utils/latest-rdv.js';
import { readCreatedEntityId } from '../utils/onfly-payload.js';
import { buildCreateRdvPayload } from '../utils/rdv-create-payload.js';
import { appendParam } from '../utils/query.js';
import { resolveExpenseRdvStatus } from '../utils/status-mapper.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

const rdvAnnexesSchema = z
  .object({
    expenditures_id: z.array(z.number().int()).optional(),
    fly_orders_id: z.array(z.number().int()).optional(),
    hotel_orders_id: z.array(z.number().int()).optional(),
    auto_orders_id: z.array(z.number().int()).optional(),
    bus_orders_id: z.array(z.number().int()).optional(),
  })
  .optional();

const customFieldItemSchema = z.record(z.string(), z.unknown());

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
        'List Onfly RDVs. Defaults to the authenticated user only (sends userId and user[] — the API often expects user[]). For “my last trip / último RDV”, prefer get_my_latest_rdv. Set include_company_wide true for company-wide lists (requires API permission).',
      inputSchema: {
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        status: rdvStatusInput.optional(),
        user_id: z
          .number()
          .int()
          .optional()
          .describe(
            'Filter by employee id; when set with include_company_wide true, still scopes to this user',
          ),
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
      if (filterUserId !== undefined) {
        appendParam(params, 'userId', filterUserId);
        appendParam(params, 'user[]', filterUserId);
      }
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
    'get_my_latest_rdv',
    {
      title: 'Get my latest RDV (last travel report)',
      description:
        'Returns the authenticated user’s most recent travel expense report (RDV). Uses GET /expense/rdv with user filters; if none are returned, infers an RDV id from recent GET /expense/expenditure and loads GET /expense/rdv/{id}. For “última viagem / last trip report”.',
      inputSchema: {
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const result = await fetchLatestRdvForUser(client, detail_level);
      if (!result.ok) {
        return jsonTextResult({ resolved_via: 'none', detail: result.detail });
      }
      return jsonTextResult({
        resolved_via: result.resolved_via,
        ...(result.resolved_via === 'expense_fallback' ? { inferred_rdv_id: result.rdv_id } : {}),
        rdv: result.rdv,
      });
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

  server.registerTool(
    'update_rdv',
    {
      title: 'Update RDV',
      description: 'PUT /expense/rdv/{id} — body per Onfly API.',
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
      const data = await client.put(`/expense/rdv/${id}`, body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_rdv',
    {
      title: 'Create RDV (travel expense report)',
      description:
        'Creates a new travel expense report (prestação de contas / RDV) via POST /expense/rdv (Onfly “POST Criar RDV”). Requires title, reason, cost_center_id. user_id defaults to the authenticated employee. Optional annexes link expenditures and travel orders; tags_id, advance_payments_id, custom_fields follow the API — custom fields may be required by your company policy.',
      inputSchema: {
        title: z.string().min(1),
        reason: z.string().min(1),
        cost_center_id: z.number().int(),
        user_id: z.number().int().optional(),
        annexes: rdvAnnexesSchema,
        tags_id: z.array(z.number().int()).optional(),
        advance_payments_id: z.array(z.number().int()).optional(),
        custom_fields: z.array(customFieldItemSchema).optional(),
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
        title,
        reason,
        cost_center_id,
        user_id,
        annexes,
        tags_id,
        advance_payments_id,
        custom_fields,
      },
      extra,
    ) => {
      const client = newClient(extra, limiter);
      const ownerId = user_id ?? (await getAuthenticatedEmployeeId(client));
      const payload = buildCreateRdvPayload({
        title,
        reason,
        user_id: ownerId,
        cost_center_id,
        annexes,
        tags_id,
        advance_payments_id,
        custom_fields,
      });
      try {
        const data = await client.post('/expense/rdv', payload);
        return jsonTextResult({
          success: true,
          rdv_id: readCreatedEntityId(data),
          api: data,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonTextResult({
          success: false,
          error: message,
          hint:
            'Verify cost_center_id, user_id, annexed expenditure/order ids, and any required customFields for your tenant.',
        });
      }
    },
  );
}

