import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import * as z from 'zod';

import type { TokenBucketLimiter } from '../api/rate-limiter.js';
import {
  decodeBase64ToBuffer,
  toOnflyWebAttachmentDataUrl,
} from '../utils/base64-upload.js';
import { brlMajorToMinorUnits } from '../utils/brl-amount.js';
import { getAuthenticatedEmployeeId } from '../utils/authenticated-user.js';
import { includeForExpense } from '../utils/include-defaults.js';
import { readCreatedEntityId } from '../utils/onfly-payload.js';
import { appendParam } from '../utils/query.js';
import { resolveExpenseRdvStatus } from '../utils/status-mapper.js';

import { jsonTextResult, newClient } from './common.js';

const attachmentFileSchema = z.object({
  file: z
    .string()
    .min(1)
    .describe(
      'Full data URL (data:image/jpeg;base64,...) or raw base64; must be the complete string (truncated data breaks upload).',
    ),
  filename: z.string().min(1).describe('Original name, e.g. PHOTO-2026-03-25-22-57-00.jpg'),
});

const mimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

function guessMimeTypeFromPath(filePath: string, fallback: string): string {
  const ext = extname(filePath).toLowerCase();
  return mimeByExtension[ext] ?? fallback;
}

const expenseStatusInput = z.union([
  z.number().int(),
  z.enum([
    'draft',
    'awaiting_approval',
    'awaiting_payment',
    'paid',
    'rejected',
    'archived',
  ]),
]);

export function registerExpenseTools(server: McpServer, limiter: TokenBucketLimiter): void {
  server.registerTool(
    'list_expenses',
    {
      title: 'List expenses',
      description:
        'List Onfly expenditures. Defaults to the authenticated user only (sends userId and user[] for reliable scoping). Set include_company_wide true for company-wide results (requires API permission). Status: numeric or draft, awaiting_approval, …',
      inputSchema: {
        start_date: z.string().optional().describe('YYYY-MM-DD'),
        end_date: z.string().optional().describe('YYYY-MM-DD'),
        status: expenseStatusInput.optional(),
        user_id: z
          .number()
          .int()
          .optional()
          .describe('Filter by employee id; overrides include_company_wide'),
        include_company_wide: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, do not restrict to the authenticated user'),
        rdv_id: z.number().int().optional(),
        page: z.number().int().optional().default(1),
        per_page: z.number().int().min(1).max(100).optional().default(20),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        title: 'List expenses',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (
      {
        start_date,
        end_date,
        status,
        user_id,
        include_company_wide,
        rdv_id,
        page,
        per_page,
        detail_level,
      },
      extra,
    ) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'startDate', start_date);
      appendParam(params, 'endDate', end_date);
      if (status !== undefined) {
        appendParam(params, 'status[]', resolveExpenseRdvStatus(status));
      }
      let filterUserId = user_id;
      if (filterUserId === undefined && !include_company_wide) {
        filterUserId = await getAuthenticatedEmployeeId(client);
      }
      if (filterUserId !== undefined) {
        appendParam(params, 'userId', filterUserId);
        appendParam(params, 'user[]', filterUserId);
      }
      if (rdv_id !== undefined) {
        appendParam(params, 'rdv[]', rdv_id);
      }
      appendParam(params, 'page', page);
      appendParam(params, 'perPage', per_page);
      appendParam(params, 'include', includeForExpense(detail_level));
      appendParam(params, 'sortBy', 'id');
      appendParam(params, 'sortOrder', 'DESC');
      const data = await client.get('/expense/expenditure', params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'get_expense',
    {
      title: 'Get expense',
      description: 'Get a single expenditure by id.',
      inputSchema: {
        id: z.number().int(),
        detail_level: z.enum(['basic', 'full']).optional().default('basic'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id, detail_level }, extra) => {
      const client = newClient(extra, limiter);
      const params = new URLSearchParams();
      appendParam(params, 'include', includeForExpense(detail_level));
      const data = await client.get(`/expense/expenditure/${id}`, params);
      return jsonTextResult(data);
    },
  );

  server.registerTool(
    'create_expense',
    {
      title: 'Create expense',
      description:
        'Create a manual expenditure (POST /expense/expenditure). Send either amount (centavos, e.g. 11000 = R$110) OR amount_brl (e.g. 110), not both. Response always includes success; on failure, error has the API status/body so the assistant can finish the turn. For “despesa no dia da última viagem” with RDV auto-resolved, use create_expense_on_latest_trip.',
      inputSchema: {
        date: z.string().describe('Expense date (YYYY-MM-DD)'),
        amount: z
          .number()
          .optional()
          .describe('Minor units (centavos for BRL). Use this or amount_brl, not both.'),
        amount_brl: z
          .number()
          .positive()
          .optional()
          .describe('Major BRL (reais); converted to centavos. Use this or amount, not both.'),
        description: z.string(),
        expenditure_type_id: z.number().int(),
        currency: z
          .string()
          .length(3)
          .optional()
          .default('BRL')
          .describe('ISO 4217, default BRL'),
        user_id: z
          .number()
          .int()
          .optional()
          .describe('Expense owner; defaults to authenticated employee id'),
        cost_center_id: z.number().int().optional(),
        rdv_id: z.number().int().optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (
      {
        date,
        amount,
        amount_brl,
        description,
        expenditure_type_id,
        currency,
        user_id,
        cost_center_id,
        rdv_id,
      },
      extra,
    ) => {
      const hasMinor = amount !== undefined;
      const hasBrl = amount_brl !== undefined;
      if (!hasMinor && !hasBrl) {
        return jsonTextResult({
          success: false,
          error: 'Provide amount (centavos) or amount_brl (reais).',
        });
      }
      if (hasMinor && hasBrl) {
        return jsonTextResult({
          success: false,
          error: 'Send only one of: amount or amount_brl.',
        });
      }
      const amountMinor = hasBrl ? brlMajorToMinorUnits(amount_brl!) : amount!;

      const client = newClient(extra, limiter);
      const ownerId = user_id ?? (await getAuthenticatedEmployeeId(client));
      const payload: Record<string, unknown> = {
        date,
        amount: amountMinor,
        description,
        currency,
        expenditureTypeId: expenditure_type_id,
        userId: ownerId,
      };
      if (cost_center_id !== undefined) {
        payload.costCenterId = cost_center_id;
      }
      if (rdv_id !== undefined) {
        payload.rdvId = rdv_id;
      }

      try {
        const data = await client.post('/expense/expenditure', payload);
        return jsonTextResult({
          success: true,
          expenditure_id: readCreatedEntityId(data),
          api: data,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonTextResult({
          success: false,
          error: message,
          hint:
            'Check RDV status (open vs submitted), cost center vs RDV, expenditure type id, and whether the API expects amount in centavos.',
        });
      }
    },
  );

  server.registerTool(
    'attach_to_expense',
    {
      title: 'Attach file to expense',
      description:
        'Web (default): same JSON as the Onfly SPA — `POST .../general/attachments/4/1/{expenditure_id}/true` with `{ "files": [ { "file": "<data URL or base64>", "filename": "..." } ] }`. Tool args use the same names as that JSON: **`file`** (value for `files[].file`) and **`filename`**, or **`files`** (DevTools array). For large files, prefer **`file_path`** so the server reads and encodes the file locally (avoids chat truncation). If web mode fails for single-file upload, the tool auto-retries legacy multipart and returns the fallback result. `collection_multipart` → multipart field `file` at `.../general/attachment/4/1/{id}`.',
      inputSchema: z
        .object({
          expenditure_id: z.number().int(),
          upload_mode: z
            .enum(['web_app_json', 'collection_multipart'])
            .optional()
            .default('web_app_json')
            .describe(
              'web_app_json → JSON body with `files` (browser). collection_multipart → legacy multipart.',
            ),
          files: z
            .array(attachmentFileSchema)
            .min(1)
            .max(20)
            .optional()
            .describe('Browser/DevTools shape. If set, single-attachment `file` is ignored.'),
          file: z
            .string()
            .min(1)
            .optional()
            .describe(
              'Single attachment: same as API `files[].file` — full data URL (`data:image/jpeg;base64,...`) or raw base64. Ignored when `files` is provided.',
            ),
          file_path: z
            .string()
            .min(1)
            .optional()
            .describe(
              'Local absolute/relative path to the file. Server reads bytes and builds data URL automatically. Ignored when `files` or `file` are provided.',
            ),
          filename: z
            .string()
            .min(1)
            .optional()
            .default('receipt.jpg')
            .describe('Original filename for the single-attachment case (`files[0].filename`).'),
          content_type: z
            .string()
            .min(1)
            .optional()
            .default('image/jpeg')
            .describe(
              'MIME when a `file` has no `data:` prefix (data URLs carry MIME in the header).',
            ),
        })
        .superRefine((v, ctx) => {
          const hasFiles = Boolean(v.files?.length);
          const hasSingle = Boolean(v.file?.length);
          const hasPath = Boolean(v.file_path?.length);
          if (!hasFiles && !hasSingle && !hasPath) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Provide `files` (non-empty), `file`, or `file_path`.',
              path: ['file'],
            });
          }
          if (v.upload_mode === 'collection_multipart' && hasFiles && v.files!.length > 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                'collection_multipart accepts one file; pass one `files` entry, `file` + `filename`, or `file_path`.',
              path: ['files'],
            });
          }
        }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args, extra) => {
      const { expenditure_id, upload_mode, files, file, file_path, filename, content_type } = args;
      const client = newClient(extra, limiter);

      let singleAttachmentPayload = file;
      let singleAttachmentFilename = filename;
      if (!files?.length && !singleAttachmentPayload && file_path) {
        try {
          const bytes = await readFile(file_path);
          const mime = guessMimeTypeFromPath(file_path, content_type);
          singleAttachmentPayload = `data:${mime};base64,${bytes.toString('base64')}`;
          if (filename === 'receipt.jpg') {
            singleAttachmentFilename = basename(file_path);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return jsonTextResult({
            success: false,
            error: `Could not read file_path: ${message}`,
          });
        }
      }

      const resolveMultipartSource = (): { rawInput: string; partFilename: string } => {
        if (files?.length) {
          const first = files[0]!;
          return { rawInput: first.file, partFilename: first.filename };
        }
        return { rawInput: singleAttachmentPayload!, partFilename: singleAttachmentFilename };
      };

      if (upload_mode === 'web_app_json') {
        const path = `/general/attachments/4/1/${expenditure_id}/true`;
        const filesPayload = files?.length
          ? files.map((f) => ({
              file: toOnflyWebAttachmentDataUrl(f.file, content_type),
              filename: f.filename,
            }))
          : [
              {
                file: toOnflyWebAttachmentDataUrl(singleAttachmentPayload!, content_type),
                filename: singleAttachmentFilename,
              },
            ];
        let totalBytes = 0;
        try {
          for (const entry of filesPayload) {
            const decoded = decodeBase64ToBuffer(entry.file);
            if (decoded.length === 0) {
              return jsonTextResult({
                success: false,
                error:
                  'One attachment decoded to empty bytes — base64/data URL is likely truncated or invalid.',
              });
            }
            totalBytes += decoded.length;
          }
        } catch {
          return jsonTextResult({
            success: false,
            error: 'Could not decode one of the attachments.',
          });
        }
        const payload = { files: filesPayload };
        try {
          const data = await client.post(path, payload);
          return jsonTextResult({
            success: true,
            upload_mode: 'web_app_json',
            path,
            api: data,
            bytes_uploaded: totalBytes,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (filesPayload.length !== 1) {
            return jsonTextResult({
              success: false,
              error: message,
              upload_mode: 'web_app_json',
              fallback_attempted: false,
              next_step:
                'Retry with upload_mode=collection_multipart and a single attachment, or send one file per request.',
            });
          }

          // Automatic fallback to legacy multipart avoids agent dead-ends on tenant-specific API behavior.
          const fallbackPath = `/general/attachment/4/1/${expenditure_id}`;
          try {
            const first = filesPayload[0]!;
            const fallbackBytes = decodeBase64ToBuffer(first.file);
            const fallbackMime =
              first.file.trim().toLowerCase().startsWith('data:') && first.file.includes(';')
                ? first.file.trim().slice(5, first.file.indexOf(';'))
                : content_type;
            const fallbackFile = new File([new Uint8Array(fallbackBytes)], first.filename, {
              type: fallbackMime,
            });
            const fallbackForm = new FormData();
            fallbackForm.append('file', fallbackFile, first.filename);

            const fallbackData = await client.postFormData(fallbackPath, fallbackForm);
            return jsonTextResult({
              success: true,
              upload_mode: 'collection_multipart',
              fallback_from: 'web_app_json',
              path: fallbackPath,
              api: fallbackData,
              bytes_uploaded: fallbackBytes.length,
              warning: `Primary upload failed in web_app_json: ${message}`,
            });
          } catch (fallbackErr) {
            const fallbackMessage =
              fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            return jsonTextResult({
              success: false,
              upload_mode: 'web_app_json',
              error: message,
              fallback_attempted: true,
              fallback_mode: 'collection_multipart',
              fallback_error: fallbackMessage,
              next_step:
                'Verify expenditure_id/token and try again with file_path to avoid truncated base64 payloads.',
            });
          }
        }
      }

      let buffer: Buffer;
      try {
        const src = resolveMultipartSource();
        buffer = decodeBase64ToBuffer(src.rawInput);
      } catch {
        return jsonTextResult({
          success: false,
          error: 'Could not decode base64 (invalid characters).',
        });
      }
      if (buffer.length === 0) {
        return jsonTextResult({
          success: false,
          error: 'Decoded file is empty.',
        });
      }

      const path = `/general/attachment/4/1/${expenditure_id}`;
      const { rawInput, partFilename } = resolveMultipartSource();
      const bytes = new Uint8Array(buffer);
      const fileMime =
        rawInput.trim().toLowerCase().startsWith('data:') && rawInput.includes(';')
          ? rawInput.trim().slice(5, rawInput.indexOf(';'))
          : content_type;
      const fileBlob = new File([bytes], partFilename, { type: fileMime });
      const form = new FormData();
      form.append('file', fileBlob, partFilename);

      try {
        const data = await client.postFormData(path, form);
        return jsonTextResult({
          success: true,
          upload_mode: 'collection_multipart',
          path,
          api: data,
          bytes_uploaded: buffer.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonTextResult({
          success: false,
          error: message,
          upload_mode: 'collection_multipart',
          hint: 'Try upload_mode web_app_json (path /general/attachments/.../true + JSON body) if multipart fails.',
        });
      }
    },
  );
}
