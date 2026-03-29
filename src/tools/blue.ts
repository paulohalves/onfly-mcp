import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import { appendParam } from '../utils/query.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

export function registerBlueTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_blue_transactions',
    {
      title: 'List Blue card transactions',
      description: 'GET /blue/transaction.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(20),
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
      const data = await client.get('/blue/transaction', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_blue_internal_transactions',
    {
      title: 'List Blue internal transactions',
      description: 'GET /blue/transaction/internal.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(20),
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
      const data = await client.get('/blue/transaction/internal', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'list_blue_cards',
    {
      title: 'List Blue cards',
      description: 'GET /blue/card.',
      inputSchema: {
        page: z.number().int().optional().default(1),
        per_page: z.number().int().optional().default(20),
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
      const data = await client.get('/blue/card', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_blue_card',
    {
      title: 'Get Blue card',
      description: 'GET /blue/card/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.get(`/blue/card/${id}`, new URLSearchParams());
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'update_blue_card_balance',
    {
      title: 'Update Blue card balance',
      description: 'PUT /blue/card/{id}/balance — financial operation; body per Onfly API.',
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
      const data = await client.put(`/blue/card/${id}/balance`, body);
      return jsonTextResult(data);
    },
  );
}
