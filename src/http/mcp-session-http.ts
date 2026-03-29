import type { Request } from 'express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

function normalizeSessionHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (Array.isArray(value) && value[0]) {
    return value[0];
  }
  return undefined;
}

export const mcpSessionHttp = {
  getSessionId(req: Request): string | undefined {
    const direct = normalizeSessionHeader(req.headers['mcp-session-id']);
    if (direct) {
      return direct;
    }
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === 'mcp-session-id') {
        return normalizeSessionHeader(value);
      }
    }
    return undefined;
  },

  bodyHasInitialize(body: unknown): boolean {
    if (Array.isArray(body)) {
      return body.some((item) => isInitializeRequest(item));
    }
    return isInitializeRequest(body);
  },
} as const;
