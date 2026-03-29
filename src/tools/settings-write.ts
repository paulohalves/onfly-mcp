import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

export function registerSettingsWriteTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'create_cost_center',
    {
      title: 'Create cost center',
      description: 'POST /settings/cost-center.',
      inputSchema: { body: bodyRecord },
      annotations: write(false),
    },
    async ({ body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.post('/settings/cost-center', body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'update_cost_center',
    {
      title: 'Update cost center',
      description: 'PUT /settings/cost-center/{id}.',
      inputSchema: {
        id: z.number().int(),
        body: bodyRecord,
      },
      annotations: write(false),
    },
    async ({ id, body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/settings/cost-center/${id}`, body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'delete_cost_center',
    {
      title: 'Delete cost center',
      description: 'DELETE /settings/cost-center/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: write(true),
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.delete(`/settings/cost-center/${id}`);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_tag',
    {
      title: 'Create tag',
      description: 'POST /settings/tag.',
      inputSchema: { body: bodyRecord },
      annotations: write(false),
    },
    async ({ body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.post('/settings/tag', body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'update_custom_field',
    {
      title: 'Update custom field',
      description: 'PUT /settings/custom-fields/{id}.',
      inputSchema: {
        id: z.number().int(),
        body: bodyRecord,
      },
      annotations: write(false),
    },
    async ({ id, body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/settings/custom-fields/${id}`, body);
      return jsonTextResult(data);
    },
  );
}

function write(destructive: boolean) {
  return {
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: false,
    openWorldHint: false,
  } as const;
}
