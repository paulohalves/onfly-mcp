import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';

import { jsonTextResult, newClient } from './common.js';

const bodyRecord = z.record(z.string(), z.unknown());

export function registerEmployeeMutationTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'invite_employee',
    {
      title: 'Invite employee',
      description: 'POST /employees/invite.',
      inputSchema: { body: bodyRecord.describe('JSON body per Onfly API') },
      annotations: writeAnn(false),
    },
    async ({ body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.post('/employees/invite', body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_employee',
    {
      title: 'Create employee',
      description: 'POST /employees/create.',
      inputSchema: { body: bodyRecord },
      annotations: writeAnn(false),
    },
    async ({ body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.post('/employees/create', body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'update_employee',
    {
      title: 'Update employee',
      description: 'PUT /employees/{id}.',
      inputSchema: {
        id: z.number().int(),
        body: bodyRecord,
      },
      annotations: writeAnn(false),
    },
    async ({ id, body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/employees/${id}`, body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'update_employee_preference',
    {
      title: 'Update employee preference',
      description: 'PUT /employees/{id}/preference.',
      inputSchema: {
        id: z.number().int(),
        body: bodyRecord,
      },
      annotations: writeAnn(false),
    },
    async ({ id, body }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.put(`/employees/${id}/preference`, body);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'deactivate_employee',
    {
      title: 'Deactivate employee',
      description: 'DELETE /employees/{id}.',
      inputSchema: { id: z.number().int() },
      annotations: writeAnn(true),
    },
    async ({ id }, extra) => {
      const client = newClient(extra, limiter);
      const data = await client.delete(`/employees/${id}`);
      return jsonTextResult(data);
    },
  );
}

function writeAnn(destructive: boolean) {
  return {
    readOnlyHint: false,
    destructiveHint: destructive,
    idempotentHint: false,
    openWorldHint: false,
  } as const;
}
