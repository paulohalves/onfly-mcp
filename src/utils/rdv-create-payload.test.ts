import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCreateRdvPayload } from './rdv-create-payload.js';

describe('buildCreateRdvPayload', () => {
  it('maps required fields and default empty annexes', () => {
    const payload = buildCreateRdvPayload({
      title: 'Trip Q1',
      reason: 'Client visit',
      user_id: 158984,
      cost_center_id: 70998,
    });

    assert.equal(payload.title, 'Trip Q1');
    assert.equal(payload.reason, 'Client visit');
    assert.equal(payload.userId, 158984);
    assert.equal(payload.costCenterId, 70998);
    assert.deepEqual(payload.annexes, {
      expendituresId: [],
      flyOrdersId: [],
      hotelOrdersId: [],
      autoOrdersId: [],
      busOrdersId: [],
    });
    assert.equal('tagsId' in payload, false);
    assert.equal('advancePaymentsId' in payload, false);
    assert.equal('customFields' in payload, false);
  });

  it('merges partial annexes with defaults for omitted lists', () => {
    const payload = buildCreateRdvPayload({
      title: 't',
      reason: 'r',
      user_id: 1,
      cost_center_id: 2,
      annexes: { expenditures_id: [10, 20] },
    });

    const annexes = payload.annexes as Record<string, unknown>;
    assert.deepEqual(annexes.expendituresId, [10, 20]);
    assert.deepEqual(annexes.flyOrdersId, []);
    assert.deepEqual(annexes.hotelOrdersId, []);
    assert.deepEqual(annexes.autoOrdersId, []);
    assert.deepEqual(annexes.busOrdersId, []);
  });

  it('includes optional tags, advance payments, and custom fields when non-empty', () => {
    const payload = buildCreateRdvPayload({
      title: 't',
      reason: 'r',
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
});
