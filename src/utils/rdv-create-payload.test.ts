import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCreateRdvPayload } from './rdv-create-payload.js';

describe('buildCreateRdvPayload', () => {
  it('maps required fields, reason null, and default empty collections', () => {
    const payload = buildCreateRdvPayload({
      title: 'Trip Q1',
      user_id: 158984,
      cost_center_id: 70998,
    });

    assert.equal(payload.title, 'Trip Q1');
    assert.equal(payload.reason, null);
    assert.equal(payload.userId, 158984);
    assert.equal(payload.costCenterId, 70998);
    assert.deepEqual(payload.tagsId, []);
    assert.deepEqual(payload.advancePaymentsId, []);
    assert.deepEqual(payload.customFields, []);
    assert.deepEqual(payload.blueRequestsId, []);
    assert.deepEqual(payload.annexes, {
      expendituresId: [],
      flyOrdersId: [],
      hotelOrdersId: [],
      autoOrdersId: [],
      busOrdersId: [],
    });
    assert.equal('startTripDate' in payload, false);
    assert.equal('endTripDate' in payload, false);
    assert.equal('isManualTripAutomation' in payload, false);
  });

  it('preserves non-null reason and merges partial annexes', () => {
    const payload = buildCreateRdvPayload({
      title: 't',
      reason: 'Client visit',
      user_id: 1,
      cost_center_id: 2,
      annexes: { expenditures_id: [10, 20] },
    });

    assert.equal(payload.reason, 'Client visit');
    const annexes = payload.annexes as Record<string, unknown>;
    assert.deepEqual(annexes.expendituresId, [10, 20]);
    assert.deepEqual(annexes.flyOrdersId, []);
  });

  it('includes tags, advance payments, and custom fields when provided', () => {
    const payload = buildCreateRdvPayload({
      title: 't',
      user_id: 1,
      cost_center_id: 2,
      tags_id: [26689],
      advance_payments_id: [100000809],
      custom_fields: [{ customFieldId: 121, fieldType: 1, value: 'BRL', id: null }],
    });

    assert.deepEqual(payload.tagsId, [26689]);
    assert.deepEqual(payload.advancePaymentsId, [100000809]);
    assert.ok(Array.isArray(payload.customFields));
    assert.equal((payload.customFields as unknown[]).length, 1);
  });

  it('sets trip dates and defaults isManualTripAutomation when dates are present', () => {
    const payload = buildCreateRdvPayload({
      title: 'Teste',
      user_id: 73094,
      cost_center_id: 364664,
      start_trip_date: '2026-04-01',
      end_trip_date: '2026-04-03',
    });

    assert.equal(payload.startTripDate, '2026-04-01');
    assert.equal(payload.endTripDate, '2026-04-03');
    assert.equal(payload.isManualTripAutomation, true);
  });

  it('respects explicit is_manual_trip_automation false', () => {
    const payload = buildCreateRdvPayload({
      title: 't',
      user_id: 1,
      cost_center_id: 2,
      start_trip_date: '2026-04-01',
      is_manual_trip_automation: false,
    });

    assert.equal(payload.isManualTripAutomation, false);
  });
});
