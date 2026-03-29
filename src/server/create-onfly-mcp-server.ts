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
import { registerExpenseLatestTripTools } from '../tools/expense-latest-trip.js';
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
        'Onfly corporate travel & expenses. Use English tool arguments. User-facing replies may follow the user language. For questions about the user’s own last trip / latest travel expense report (RDV), call get_my_latest_rdv first instead of guessing from company-wide list_rdvs. To add an expense dated on that trip and linked to its RDV, prefer create_expense_on_latest_trip (amount_brl). If you already have date, rdv_id, and ids from context, create_expense works too: use amount_brl: 110 OR amount: 11000 (centavos), never omit both. Always read the tool JSON: success false means the expense was not created—quote error to the user and suggest fixes (RDV closed, wrong cost center, etc.). To attach a receipt image to an expenditure, call attach_to_expense with **`file`** and **`filename`** (same as Onfly JSON `files[].file` and `files[].filename`)—full data URL `data:image/jpeg;base64,...` or raw base64—or pass a **`files`** array mirroring the browser payload. For large files, prefer **`file_path`** so the server reads and encodes locally (avoids truncated tool arguments). The default mode sends JSON `{"files":[...]}` to the web API; do not assume `{ image: ... }`. If any write tool returns success=false, do not stop: run one best-effort retry strategy and then report both errors and next steps.',
    },
  );

  registerEmployeeTools(server, sharedOnflyLimiter);
  registerEmployeeDirectoryTools(server, sharedOnflyLimiter);
  registerEmployeeMutationTools(server, sharedOnflyLimiter);
  registerSettingsReadTools(server, sharedOnflyLimiter);
  registerSettingsWriteTools(server, sharedOnflyLimiter);
  registerExpenseTypeTools(server, sharedOnflyLimiter);
  registerExpenseTools(server, sharedOnflyLimiter);
  registerExpenseLatestTripTools(server, sharedOnflyLimiter);
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
