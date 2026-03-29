import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { TokenBucketLimiter } from '../api/rate-limiter.js';
import { registerApprovalTools } from '../tools/approvals.js';
import { registerEmployeeTools } from '../tools/employees.js';
import { registerExpenseTools } from '../tools/expenses.js';
import { registerRdvTools } from '../tools/rdvs.js';
import { registerTravelTools } from '../tools/travel.js';

/** One bucket per process — aligns with Onfly global throttle for this integration. */
const sharedOnflyLimiter = new TokenBucketLimiter();

export function createOnflyMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'onfly',
      version: '1.0.0',
    },
    {
      instructions:
        'Onfly corporate travel & expenses. Use English tool arguments. User-facing replies may follow the user language.',
    },
  );

  registerEmployeeTools(server, sharedOnflyLimiter);
  registerExpenseTools(server, sharedOnflyLimiter);
  registerRdvTools(server, sharedOnflyLimiter);
  registerApprovalTools(server, sharedOnflyLimiter);
  registerTravelTools(server, sharedOnflyLimiter);

  return server;
}
