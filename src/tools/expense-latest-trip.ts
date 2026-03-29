import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { brlMajorToMinorUnits } from '../utils/brl-amount.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForRdv } from '../utils/include-defaults.js';
import { fetchLatestRdvForUser } from '../utils/latest-rdv.js';
import { readCreatedEntityId } from '../utils/onfly-payload.js';
import { appendParam } from '../utils/query.js';
import { pickExpenseDateFromRdv } from '../utils/rdv-trip-date.js';

import { jsonTextResult, newClient } from './common.js';

export function registerExpenseLatestTripTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'create_expense_on_latest_trip',
    {
      title: 'Create expense on latest trip (RDV)',
      description:
        'Creates an expenditure linked to your most recent RDV: resolves latest RDV (same rules as get_my_latest_rdv), derives expense date from RDV trip_start or trip_end, converts amount_brl to centavos for the API, POST /expense/expenditure. Call list_expense_types first to pick expenditure_type_id (e.g. transport).',
      inputSchema: {
        amount_brl: z
          .number()
          .positive()
          .describe('Amount in reais (major units), e.g. 110 for R$ 110.00'),
        description: z.string().min(1),
        expenditure_type_id: z
          .number()
          .int()
          .describe('From list_expense_types / Onfly settings (transport category)'),
        trip_date: z
          .enum(['trip_start', 'trip_end'])
          .optional()
          .default('trip_start')
          .describe('Use RDV start or end date when date_override is omitted'),
        date_override: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('YYYY-MM-DD; skips RDV date extraction'),
        attach_to_rdv: z
          .boolean()
          .optional()
          .default(true)
          .describe('Sets rdvId on the new expense'),
        rdv_id: z
          .number()
          .int()
          .optional()
          .describe('Target RDV instead of latest; still need date if date_override omitted'),
        currency: z.string().length(3).optional().default('BRL'),
        cost_center_id: z.number().int().optional(),
        user_id: z.number().int().optional(),
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
        amount_brl,
        description,
        expenditure_type_id,
        trip_date,
        date_override,
        attach_to_rdv,
        rdv_id: rdv_id_input,
        currency,
        cost_center_id,
        user_id,
      },
      extra,
    ) => {
      const client = newClient(extra, limiter);
      let rdvId: number;
      let rdvPayload: unknown;

      if (rdv_id_input !== undefined) {
        const params = new URLSearchParams();
        appendParam(params, 'include', includeForRdv('basic'));
        rdvPayload = await client.get(`/expense/rdv/${rdv_id_input}`, params);
        rdvId = rdv_id_input;
      } else {
        const latest = await fetchLatestRdvForUser(client, 'basic');
        if (!latest.ok) {
          return jsonTextResult({ error: latest.detail });
        }
        rdvId = latest.rdv_id;
        rdvPayload = latest.rdv;
      }

      const preference = trip_date === 'trip_end' ? 'trip_end' : 'trip_start';
      const expenseDate =
        date_override ?? pickExpenseDateFromRdv(rdvPayload, preference);
      if (expenseDate === undefined) {
        return jsonTextResult({
          error:
            'Could not derive YYYY-MM-DD from RDV; pass date_override. Ensure the RDV includes date fields or use get_rdv with full include.',
          rdv_id: rdvId,
        });
      }

      const ownerId = user_id ?? (await getAuthenticatedEmployeeId(client));
      const amountMinor = brlMajorToMinorUnits(amount_brl);
      const payload: Record<string, unknown> = {
        date: expenseDate,
        amount: amountMinor,
        description,
        expenditureTypeId: expenditure_type_id,
        userId: ownerId,
        currency,
      };
      if (cost_center_id !== undefined) {
        payload.costCenterId = cost_center_id;
      }
      if (attach_to_rdv) {
        payload.rdvId = rdvId;
      }

      try {
        const created = await client.post('/expense/expenditure', payload);
        return jsonTextResult({
          success: true,
          expenditure_id: readCreatedEntityId(created),
          created,
          context: {
            rdv_id: rdvId,
            expense_date: expenseDate,
            amount_brl,
            amount_minor_units: amountMinor,
            attach_to_rdv,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonTextResult({
          success: false,
          error: message,
          context: {
            rdv_id: rdvId,
            expense_date: expenseDate,
            amount_brl,
            amount_minor_units: amountMinor,
            attach_to_rdv,
          },
        });
      }
    },
  );
}
