import express, { type Express } from 'express';
import {
  hostHeaderValidation,
  localhostHostValidation,
} from '@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js';

/**
 * Same as MCP SDK `createMcpExpressApp`, but uses a larger JSON limit — the SDK default
 * (`express.json()` ~100kb) rejects attachment payloads and can leave clients timing out.
 */
export function createOnflyMcpExpressApp(
  options: {
    host?: string;
    allowedHosts?: string[];
    /** Tool args with base64 attachments; default 18mb when not passed from config. */
    jsonBodyLimit?: string;
  } = {},
): Express {
  const { host = '127.0.0.1', allowedHosts, jsonBodyLimit = '18mb' } = options;
  const app = express();
  app.use(express.json({ limit: jsonBodyLimit }));

  if (allowedHosts) {
    app.use(hostHeaderValidation(allowedHosts));
  } else {
    const localhostHosts = ['127.0.0.1', 'localhost', '::1'];
    if (localhostHosts.includes(host)) {
      app.use(localhostHostValidation());
    } else if (host === '0.0.0.0' || host === '::') {
      console.warn(
        `Warning: Server is binding to ${host} without DNS rebinding protection. ` +
          'Consider using the allowedHosts option to restrict allowed hosts, ' +
          'or use authentication to protect your server.',
      );
    }
  }
  return app;
}
