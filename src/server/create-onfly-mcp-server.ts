import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { TokenBucketLimiter } from '../api/rate-limiter.js';
import { registerAdvancePaymentTools } from '../tools/advance-payments.js';
import { registerApprovalTools } from '../tools/approvals.js';
import { registerAttachmentTools } from '../tools/attachments.js';
import { registerBlueTools } from '../tools/blue.js';
import { registerCreditsTools } from '../tools/credits.js';
import { registerEmployeeDirectoryTools } from '../tools/employees-directory.js';
import { registerEmployeeMutationTools } from '../tools/employees-mutations.js';
import { registerEmployeeTools } from '../tools/employees.js';
import { registerExpenseTypeTools } from '../tools/expense-types.js';
import { registerExpenseTools } from '../tools/expenses.js';
import { registerOnflyIntegrationTools } from '../tools/onfly-integration.js';
import { registerRdvTools } from '../tools/rdvs.js';
import { registerSettingsReadTools } from '../tools/settings-read.js';
import { registerSettingsWriteTools } from '../tools/settings-write.js';
import { registerTravelMutationTools } from '../tools/travel-mutations.js';
import { registerTravelSearchTools } from '../tools/travel-search.js';
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
  registerEmployeeDirectoryTools(server, sharedOnflyLimiter);
  registerEmployeeMutationTools(server, sharedOnflyLimiter);
  registerSettingsReadTools(server, sharedOnflyLimiter);
  registerSettingsWriteTools(server, sharedOnflyLimiter);
  registerExpenseTypeTools(server, sharedOnflyLimiter);
  registerExpenseTools(server, sharedOnflyLimiter);
  registerRdvTools(server, sharedOnflyLimiter);
  registerApprovalTools(server, sharedOnflyLimiter);
  registerAdvancePaymentTools(server, sharedOnflyLimiter);
  registerTravelTools(server, sharedOnflyLimiter);
  registerTravelSearchTools(server, sharedOnflyLimiter);
  registerTravelMutationTools(server, sharedOnflyLimiter);
  registerBlueTools(server, sharedOnflyLimiter);
  registerOnflyIntegrationTools(server, sharedOnflyLimiter);
  registerCreditsTools(server, sharedOnflyLimiter);
  registerAttachmentTools(server, sharedOnflyLimiter);

  return server;
}
