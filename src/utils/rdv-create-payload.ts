export type CreateRdvAnnexesInput = {
  expenditures_id?: number[];
  fly_orders_id?: number[];
  hotel_orders_id?: number[];
  auto_orders_id?: number[];
  bus_orders_id?: number[];
};

export type BuildCreateRdvPayloadInput = {
  title: string;
  /** API accepts `null` when omitted by caller. */
  reason?: string | null;
  user_id: number;
  cost_center_id: number;
  annexes?: CreateRdvAnnexesInput;
  tags_id?: number[];
  advance_payments_id?: number[];
  custom_fields?: Array<Record<string, unknown>>;
  blue_requests_id?: number[];
  /** YYYY-MM-DD → `startTripDate` */
  start_trip_date?: string;
  /** YYYY-MM-DD → `endTripDate` */
  end_trip_date?: string;
  /** When omitted and any trip date is set, defaults to `true` (manual trip window). */
  is_manual_trip_automation?: boolean;
};

/**
 * Builds the JSON body for POST /expense/rdv (create travel expense report / RDV).
 * Matches Onfly create payload: empty arrays for tags, advances, custom fields, blue requests;
 * optional trip window via `startTripDate` / `endTripDate` and `isManualTripAutomation`.
 */
export function buildCreateRdvPayload(input: BuildCreateRdvPayloadInput): Record<string, unknown> {
  const annexesIn = input.annexes ?? {};
  const payload: Record<string, unknown> = {
    title: input.title,
    reason: input.reason ?? null,
    userId: input.user_id,
    costCenterId: input.cost_center_id,
    tagsId: input.tags_id ?? [],
    advancePaymentsId: input.advance_payments_id ?? [],
    customFields: input.custom_fields ?? [],
    blueRequestsId: input.blue_requests_id ?? [],
    annexes: {
      expendituresId: annexesIn.expenditures_id ?? [],
      flyOrdersId: annexesIn.fly_orders_id ?? [],
      hotelOrdersId: annexesIn.hotel_orders_id ?? [],
      autoOrdersId: annexesIn.auto_orders_id ?? [],
      busOrdersId: annexesIn.bus_orders_id ?? [],
    },
  };

  if (input.start_trip_date !== undefined) {
    payload.startTripDate = input.start_trip_date;
  }
  if (input.end_trip_date !== undefined) {
    payload.endTripDate = input.end_trip_date;
  }

  if (input.is_manual_trip_automation !== undefined) {
    payload.isManualTripAutomation = input.is_manual_trip_automation;
  } else if (input.start_trip_date !== undefined || input.end_trip_date !== undefined) {
    payload.isManualTripAutomation = true;
  }

  return payload;
}
