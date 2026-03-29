export const expenseRdvStatusMap = {
  draft: 1,
  awaiting_approval: 2,
  awaiting_payment: 3,
  paid: 4,
  rejected: 5,
  archived: 6,
} as const;

export type ExpenseRdvStatusKey = keyof typeof expenseRdvStatusMap;

export function resolveExpenseRdvStatus(value: number | ExpenseRdvStatusKey): number {
  if (typeof value === 'number') {
    return value;
  }
  return expenseRdvStatusMap[value];
}

export const approvalItemStatusMap = {
  awaiting_approval: 1,
  approved: 2,
  rejected: 3,
} as const;

export type ApprovalItemStatusKey = keyof typeof approvalItemStatusMap;

export function resolveApprovalStatus(value: number | ApprovalItemStatusKey): number {
  if (typeof value === 'number') {
    return value;
  }
  return approvalItemStatusMap[value];
}
