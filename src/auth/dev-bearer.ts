import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { NextFunction, Request, Response } from 'express';

import { config } from '../config.js';

type McpRequest = Request & { auth?: AuthInfo };

function parseBearerHeader(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  const [type, raw] = header.split(' ');
  if (!raw || type.toLowerCase() !== 'bearer') {
    return undefined;
  }
  return raw.trim();
}

export function devOnflyAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fromHeader = parseBearerHeader(req.headers.authorization);
  const token = fromHeader || config.devAccessToken || undefined;
  if (!token) {
    res.status(401).json({
      error: 'Missing bearer token. Send Authorization: Bearer <token> or set ONFLY_DEV_ACCESS_TOKEN.',
    });
    return;
  }

  (req as McpRequest).auth = {
    token,
    clientId: 'onfly-mcp-dev',
    scopes: ['*'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  next();
}
