export type CreateRdvAnnexesInput = {
  expenditures_id?: number[];
  fly_orders_id?: number[];
  hotel_orders_id?: number[];
  auto_orders_id?: number[];
  bus_orders_id?: number[];
};

export type BuildCreateRdvPayloadInput = {
  title: string;
  reason: string;
  user_id: number;
  cost_center_id: number;
  annexes?: CreateRdvAnnexesInput;
  tags_id?: number[];
  advance_payments_id?: number[];
  custom_fields?: Array<Record<string, unknown>>;
};

/**
 * Builds the JSON body for POST /expense/rdv (create travel expense report / RDV).
 */
export function buildCreateRdvPayload(input: BuildCreateRdvPayloadInput): Record<string, unknown> {
  const annexesIn = input.annexes ?? {};
  const payload: Record<string, unknown> = {
    title: input.title,
    reason: input.reason,
    userId: input.user_id,
    costCenterId: input.cost_center_id,
    annexes: {
      expendituresId: annexesIn.expenditures_id ?? [],
      flyOrdersId: annexesIn.fly_orders_id ?? [],
      hotelOrdersId: annexesIn.hotel_orders_id ?? [],
      autoOrdersId: annexesIn.auto_orders_id ?? [],
      busOrdersId: annexesIn.bus_orders_id ?? [],
    },
  };

  if (input.tags_id !== undefined && input.tags_id.length > 0) {
    payload.tagsId = input.tags_id;
  }
  if (input.advance_payments_id !== undefined && input.advance_payments_id.length > 0) {
    payload.advancePaymentsId = input.advance_payments_id;
  }
  if (input.custom_fields !== undefined && input.custom_fields.length > 0) {
    payload.customFields = input.custom_fields;
  }

  return payload;
}
