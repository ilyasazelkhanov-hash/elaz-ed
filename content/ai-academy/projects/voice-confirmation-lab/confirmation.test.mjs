import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceConfirmation } from './confirmation.mjs';

function fixture() {
  const lab = new VoiceConfirmation();
  let at = 0;
  const ref = { actionId: 'ticket', revision: 1, offerId: 'offer-1' };
  const send = (type, extra = {}) => lab.apply({ type, at: at++, ...ref, ...extra });
  send('set_action', { action: { id: 'ticket', revision: 1, description: 'Учебная карточка' } });
  send('offer', { validForMs: 100 });
  const heard = () => { send('generated'); return send('playback_completed', { remainingVoicedSamples: 0 }); };
  const confirm = () => send('confirm', { actor: 'student', explicit: true });
  return { lab, send, heard, confirm };
}

test('complete offer and explicit confirmation permit exactly one simulated execution', () => {
  const { lab, send, heard, confirm } = fixture(); heard(); assert.equal(confirm().ok, true);
  assert.equal(send('execute').code, 'simulated_once');
  assert.equal(send('execute').code, 'already_executed');
  assert.equal(lab.snapshot().executions.length, 1);
});
test('generated transcript alone is not evidence of playback', () => {
  const { lab, send, confirm } = fixture(); send('generated');
  assert.equal(confirm().code, 'offer_not_played'); assert.equal(send('execute').ok, false);
  assert.equal(lab.snapshot().executions.length, 0);
});
test('playback completion requires generated offer and zero remaining samples', () => {
  const { send, confirm } = fixture();
  assert.equal(send('playback_completed', { remainingVoicedSamples: 0 }).ok, false);
  send('generated'); assert.equal(send('playback_completed', { remainingVoicedSamples: 12 }).ok, false);
  assert.equal(confirm().ok, false);
});
test('silence and handoff cannot confer consent', () => {
  const { lab, send, heard } = fixture(); heard(); send('tick'); send('handoff');
  assert.equal(send('execute').code, 'confirmation_required'); assert.equal(lab.snapshot().executions.length, 0);
});
test('false or absent explicit confirmation is rejected', () => {
  for (const explicit of [false, undefined, 'yes', 1]) {
    const { send, heard } = fixture(); heard();
    assert.equal(send('confirm', { actor: 'student', explicit }).ok, false);
    assert.equal(send('execute').ok, false);
  }
});
test('a different actor cannot confirm', () => {
  const { send, heard } = fixture(); heard();
  assert.equal(send('confirm', { actor: 'model', explicit: true }).ok, false);
});
test('interruption invalidates a generated offer', () => {
  const { send, confirm } = fixture(); send('generated'); send('interrupted');
  assert.equal(send('playback_completed', { remainingVoicedSamples: 0 }).ok, false);
  assert.equal(confirm().code, 'offer_invalidated');
});
test('interruption after consent prevents execution', () => {
  const { send, heard, confirm } = fixture(); heard(); confirm(); send('interrupted');
  assert.equal(send('execute').code, 'offer_invalidated');
});
test('late handoff following interruption never executes', () => {
  const { lab, send, heard, confirm } = fixture(); heard(); confirm(); send('interrupted'); send('handoff');
  assert.equal(lab.snapshot().executions.length, 0); assert.equal(send('execute').ok, false);
});
test('a changed action revision invalidates old playback and consent', () => {
  const { send, heard, confirm } = fixture(); heard(); confirm();
  send('set_action', { action: { id: 'ticket', revision: 2, description: 'Изменённая карточка' } });
  assert.equal(send('execute').code, 'stale_or_unknown_offer');
  assert.equal(send('confirm', { revision: 2, actor: 'student', explicit: true }).ok, false);
});
test('same revision cannot silently replace description', () => {
  const { lab, send } = fixture();
  assert.equal(send('set_action', { action: { id: 'ticket', revision: 1, description: 'Другие условия' } }).ok, false);
  assert.equal(lab.snapshot().action.description, 'Учебная карточка');
});
test('replacement offer requires fresh playback and confirmation', () => {
  const { send, heard, confirm } = fixture(); heard(); confirm(); send('offer', { offerId: 'offer-2', validForMs: 100 });
  assert.equal(confirm().ok, false);
  assert.equal(send('execute', { offerId: 'offer-2' }).code, 'confirmation_required');
});
test('offer identifiers cannot be reused', () => {
  const { send } = fixture(); assert.equal(send('offer', { validForMs: 100 }).code, 'offer_id_must_be_unique');
});
test('confirmation arriving at expiry is rejected', () => {
  const { send, heard } = fixture(); heard();
  assert.equal(send('confirm', { at: 101, actor: 'student', explicit: true }).code, 'offer_expired');
});
test('execution must occur before expiry even when earlier consent exists', () => {
  const { send, heard, confirm } = fixture(); heard(); confirm();
  assert.equal(send('execute', { at: 101 }).code, 'offer_expired');
});
test('stale version and wrong offer identifiers never confer consent', () => {
  const { send, heard } = fixture(); heard();
  assert.equal(send('confirm', { revision: 0, actor: 'student', explicit: true }).ok, false);
  assert.equal(send('confirm', { offerId: 'missing', actor: 'student', explicit: true }).ok, false);
});
test('repeated handoff and execution signals do not duplicate completed work', () => {
  const { lab, send, heard, confirm } = fixture(); heard(); confirm(); send('execute');
  for (let i = 0; i < 4; i++) { send('handoff'); send('execute'); }
  assert.equal(lab.snapshot().executions.length, 1);
  assert.equal(send('offer', { offerId: 'offer-2', validForMs: 100 }).code, 'action_already_executed');
});
test('time cannot move backwards or become non-finite', () => {
  const { lab, send } = fixture(); assert.equal(send('tick', { at: 0 }).ok, false);
  assert.equal(lab.apply({ type: 'tick', at: Infinity }).ok, false);
});
test('snapshots and action inputs cannot mutate internal state', () => {
  const { lab } = fixture(); const copy = lab.snapshot(); copy.action.revision = 99; copy.offer.playbackCompleted = true;
  assert.equal(lab.snapshot().action.revision, 1); assert.equal(lab.snapshot().offer.playbackCompleted, false);
});
test('bounded expiry and invalid actions are rejected', () => {
  const { send } = fixture();
  assert.equal(send('offer', { offerId: 'offer-2', validForMs: 30_001 }).ok, false);
  assert.equal(send('set_action', { action: { id: 'ticket', revision: NaN, description: 'x' } }).ok, false);
});

test('explicit refusal after approval revokes pending execution', () => {
  const { send, heard, confirm } = fixture(); heard(); confirm();
  assert.equal(send('confirm', { actor: 'student', explicit: false }).code, 'declined_requires_new_offer');
  assert.equal(send('execute').ok, false);
});
test('authorized cancellation revokes consent while other actor cannot cancel', () => {
  const { send, heard, confirm } = fixture(); heard(); confirm();
  assert.equal(send('cancel', { actor: 'model' }).ok, false);
  assert.equal(send('cancel', { actor: 'student' }).ok, true);
  assert.equal(send('execute').ok, false);
});

test('mutating the supplied action object cannot change the offered action', () => {
  const lab = new VoiceConfirmation();
  const action = { id: 'ticket', revision: 1, description: 'Исходные условия' };
  lab.apply({ type: 'set_action', at: 0, action }); action.description = 'Новые условия';
  assert.equal(lab.snapshot().action.description, 'Исходные условия');
});
test('completed action cannot be undone by a later cancellation event', () => {
  const { lab, send, heard, confirm } = fixture(); heard(); confirm(); send('execute');
  assert.equal(send('cancel', { actor: 'student' }).code, 'offer_executed');
  assert.equal(lab.snapshot().executions.length, 1);
});

test('unknown event cannot advance time, expire consent or mutate the trace', () => {
  const { lab, send, heard, confirm } = fixture(); heard(); confirm();
  const before = lab.snapshot();
  assert.deepEqual(send('typo_event', { at: 1000 }), { ok: false, code: 'unknown_event' });
  assert.deepEqual(lab.snapshot(), before);
  assert.equal(send('execute').code, 'simulated_once');
});
test('malformed event containers do not mutate time or consent', () => {
  const { lab, send, heard, confirm } = fixture(); heard(); confirm();
  const before = lab.snapshot();
  const array = Object.assign([], { type: 'tick', at: 1000 });
  const customPrototype = Object.assign(Object.create({}), { type: 'tick', at: 1000 });
  for (const event of [null, undefined, 'tick', 1, array, customPrototype]) {
    assert.deepEqual(lab.apply(event), { ok: false, code: 'invalid_event' });
    assert.deepEqual(lab.snapshot(), before);
  }
  assert.equal(send('execute').code, 'simulated_once');
});
test('plain null-prototype event remains supported', () => {
  const lab = new VoiceConfirmation();
  const event = Object.assign(Object.create(null), { type: 'tick', at: 0 });
  assert.deepEqual(lab.apply(event), { ok: true, code: 'time_advanced' });
});
