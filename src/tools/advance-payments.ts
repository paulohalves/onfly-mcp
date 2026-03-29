import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

const readAnn = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function writeAnn(destructive: boolean) {
  return {
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: false,
    openWorldHint: false,
  } as const;
}

export function registerAdvancePaymentTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_advance_payments',
    {
      title: 'List advance payments',
      description: 'GET /expense/advance-payment.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(20),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        user_id: z.number().int().optional(),
        include: z.string().optional(),
      },
      annotations: readAnn,
    },
    async ({ page, per_page, start_date, end_date, user_id, include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'startDate', start_date);
      appendParam(params, 'endDate', end_date);
      appendParam(params, 'userId', user_id);
      appendParam(params, 'include', include);
      const data = await client.get('/expense/advance-payment', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_advance_payment',
    {
      title: 'Get advance payment',
      description: 'GET /expense/advance-payment/{id}.',
      inputSchema: {
        id: z.number().int(),
        include: z.string().optional(),
      },
      annotations: readAnn,
    },
    async ({ id, include }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', include);
      const data = await client.get(`/expense/advance-payment/${id}`, params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'update_advance_payment',
    {
      title: 'Update advance payment',
      description: 'PUT /expense/advance-payment/{id}.',
      inputSchema: {
        id: z.number().int(),
        body: bodyRecord,
      },
      annotations: writeAnn(false),
    },
    async ({ id, body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/expense/advance-payment/${id}`, body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'archive_advance_payment',
    {
      title: 'Archive advance payment',
      description: 'PUT /expense/advance-payment/archive/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: writeAnn(false),
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/expense/advance-payment/archive/${id}`, {});
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'delete_advance_payment',
    {
      title: 'Delete advance payment',
      description: 'DELETE /expense/advance-payment/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: writeAnn(true),
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.delete(`/expense/advance-payment/${id}`);
      return jsonTextResult(data);
    },
  );
}
