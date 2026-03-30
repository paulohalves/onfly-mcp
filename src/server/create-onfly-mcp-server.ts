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
      instructions: [
        'Onfly corporate travel & expenses. Use English tool arguments. User-facing replies may follow the user language.',
        "TRAVEL: For questions about the authenticated user's own flights/hotels/bookings (e.g. my last flight, my trips, qual meu ultimo voo), ALWAYS call list_my_travel_orders - it filters by the authenticated user automatically. Never use company-wide list_travel_orders for personal queries; it returns 3000+ records from all employees and cannot efficiently answer per-user questions.",
        "EXPENSES/RDV: To open a brand-new travel expense report (RDV), use create_rdv (title, reason, cost_center_id). For questions about the user's own last trip or latest RDV, call get_my_latest_rdv first instead of guessing from company-wide list_rdvs. To add an expense dated on that trip and linked to its RDV, prefer create_expense_on_latest_trip (amount_brl). If you already have date, rdv_id, and ids from context, create_expense works too: use amount_brl: 110 OR amount: 11000 (centavos), never omit both. Always read the tool JSON: success false means the expense was not created - quote error, hint, and next_step to the user verbatim when present, and suggest fixes (RDV closed, wrong cost center, etc.).",
        "RECEIPTS: For receipt uploads, prefer the web-app flow: POST .../general/attachments/4/1/{expenditure_id}/true with JSON {files:[{file:data:image/...;base64,...,filename:...}]}. Use attach_to_expense with file + filename (or files) by default. Onfly HTTP does NOT accept file_path; that arg is MCP-only. In-chat images: never /mnt/user-data/... as file_path; send file as data URL/base64. Only use upload_mode: collection_multipart when explicitly needed. If any write tool returns success=false, run one best-effort retry then report errors and next steps.",
      ].join(' '),
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
