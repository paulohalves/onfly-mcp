import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

export type McpExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export function getAccessToken(extra: McpExtra): string {
  const token = extra.authInfo?.token;
  if (!token) {
    throw new Error('Missing access token');
  }
  return token;
}
