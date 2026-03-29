export type DetailLevel = 'basic' | 'full';

const expenseInclude = {
  basic: 'costCenter,rdv,expenditureType,user',
  full: 'costCenter,rdv,expenditureType,user,group,document',
} as const;

const rdvInclude = {
  basic: 'owner,costCenter,tags',
  full: 'owner,costCenter,tags,expenditures,expenditureType',
} as const;

const travelInclude = {
  basic: 'travellers,costCenter',
  full: 'travellers,costCenter,tags,approvalGroups',
} as const;

const profileInclude = {
  basic: 'company',
  full: 'company,fieldsUsed.field,permissions,preference',
} as const;

export function includeForExpense(level: DetailLevel): string {
  return expenseInclude[level];
}

export function includeForRdv(level: DetailLevel): string {
  return rdvInclude[level];
}

export function includeForTravel(level: DetailLevel): string {
  return travelInclude[level];
}

export function includeForProfile(level: DetailLevel): string {
  return profileInclude[level];
}
