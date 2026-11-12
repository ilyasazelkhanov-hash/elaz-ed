/** Original offline teaching model. Events are synthetic, NOT trusted audio/auth evidence. */
const eventTypes = new Set([
  'set_action', 'offer', 'tick', 'handoff', 'execute', 'generated',
  'playback_completed', 'interrupted', 'cancel', 'confirm',
]);
const plainRecord = value => value !== null && typeof value === 'object'
  && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export class VoiceConfirmation {
  #action = null;
  #offer = null;
  #time = -1;
  #offerIds = new Set();
  #executions = new Map();
  #trace = [];
  #actor;
  #maxValidityMs;

  constructor({ actor = 'student', maxValidityMs = 30_000 } = {}) {
    if (!text(actor) || !Number.isSafeInteger(maxValidityMs) || maxValidityMs <= 0) throw new TypeError('invalid_configuration');
    this.#actor = actor;
    this.#maxValidityMs = maxValidityMs;
  }

  snapshot() {
    return structuredClone({ action: this.#action, offer: this.#offer, executions: [...this.#executions.values()], trace: this.#trace });
  }

  apply(event) {
    // Reject malformed/unknown input before it can advance the clock or expire consent.
    if (!plainRecord(event)) return { ok: false, code: 'invalid_event' };
    if (!eventTypes.has(event.type)) return { ok: false, code: 'unknown_event' };
    if (!Number.isSafeInteger(event.at) || event.at < 0 || event.at < this.#time) {
      return { ok: false, code: 'invalid_or_backwards_time' };
    }
    this.#time = event.at;
    if (this.#offer && ['awaiting_playback', 'awaiting_confirmation', 'confirmed'].includes(this.#offer.state) && event.at >= this.#offer.expiresAt) {
      this.#offer.state = 'expired';
    }
    let result;
    const finish = (ok, code) => ({ ok, code });
    if (event.type === 'set_action') {
      const action = event.action;
      if (!action || !text(action.id) || !text(action.description) || !Number.isSafeInteger(action.revision) || action.revision < 1) {
        result = finish(false, 'invalid_action');
      } else if (this.#action && (action.id !== this.#action.id || action.revision <= this.#action.revision)) {
        // One task per controller. Every edit, including a description edit, needs a new revision.
        result = finish(false, 'revision_must_increase');
      } else {
        if (this.#offer && this.#offer.state !== 'executed') this.#offer.state = 'invalidated';
        this.#action = { id: action.id, revision: action.revision, description: action.description };
        result = finish(true, 'action_set');
      }
    } else if (event.type === 'offer') {
      if (!this.#matchesAction(event)) result = finish(false, 'stale_action');
      else if (!text(event.offerId) || this.#offerIds.has(event.offerId)) result = finish(false, 'offer_id_must_be_unique');
      else if (!Number.isSafeInteger(event.validForMs) || event.validForMs <= 0 || event.validForMs > this.#maxValidityMs || !Number.isSafeInteger(event.at + event.validForMs)) result = finish(false, 'invalid_validity');
      else if (this.#executions.has(this.#key())) result = finish(false, 'action_already_executed');
      else {
        this.#offerIds.add(event.offerId);
        this.#offer = { id: event.offerId, actionId: this.#action.id, revision: this.#action.revision, description: this.#action.description, expiresAt: event.at + event.validForMs, generated: false, playbackCompleted: false, state: 'awaiting_playback' };
        result = finish(true, 'offer_created');
      }
    } else if (event.type === 'tick') {
      result = finish(true, this.#offer?.state === 'expired' ? 'offer_expired' : 'time_advanced');
    } else if (!this.#matchesOffer(event)) {
      result = finish(false, 'stale_or_unknown_offer');
    } else if (event.type === 'handoff') {
      // A model/tool/fallback signal is never a person's permission and never executes work.
      result = finish(true, 'handoff_recorded_no_action');
    } else if (event.type === 'execute' && this.#offer.state === 'executed') {
      result = finish(true, 'already_executed');
    } else if (['expired', 'invalidated', 'executed'].includes(this.#offer.state)) {
      result = finish(false, `offer_${this.#offer.state}`);
    } else if (event.type === 'generated') {
      this.#offer.generated = true;
      result = finish(true, 'transcript_is_not_playback');
    } else if (event.type === 'playback_completed') {
      if (!this.#offer.generated || event.remainingVoicedSamples !== 0) result = finish(false, 'playback_not_complete');
      else {
        this.#offer.playbackCompleted = true;
        if (this.#offer.state !== 'confirmed') this.#offer.state = 'awaiting_confirmation';
        result = finish(true, 'synthetic_playback_completed');
      }
    } else if (event.type === 'interrupted') {
      this.#offer.state = 'invalidated';
      this.#offer.playbackCompleted = false;
      result = finish(true, 'interruption_requires_new_offer');
    } else if (event.type === 'cancel') {
      if (event.actor !== this.#actor) result = finish(false, 'authorized_actor_required');
      else { this.#offer.state = 'invalidated'; result = finish(true, 'cancelled_requires_new_offer'); }
    } else if (event.type === 'confirm') {
      if (event.actor === this.#actor && event.explicit === false) {
        this.#offer.state = 'invalidated';
        result = finish(false, 'declined_requires_new_offer');
      } else if (event.actor !== this.#actor || event.explicit !== true) result = finish(false, 'explicit_authorized_actor_required');
      else if (!this.#offer.playbackCompleted) result = finish(false, 'offer_not_played');
      else {
        this.#offer.state = 'confirmed';
        result = finish(true, 'confirmed_exact_offer');
      }
    } else if (event.type === 'execute') {
      if (this.#offer.state !== 'confirmed') result = finish(false, 'confirmation_required');
      else {
        this.#executions.set(this.#key(), { actionId: this.#action.id, revision: this.#action.revision, offerId: this.#offer.id, at: event.at, outcome: 'simulated_only' });
        this.#offer.state = 'executed';
        result = finish(true, 'simulated_once');
      }
    } else result = finish(false, 'unknown_event');
    this.#trace.push({ at: event.at, event: text(event.type) ? event.type : 'invalid', code: result.code, state: this.#offer?.state ?? 'no_offer', executions: this.#executions.size });
    return result;
  }

  #key() { return `${this.#action.id}:${this.#action.revision}`; }
  #matchesAction(event) { return this.#action && event.actionId === this.#action.id && event.revision === this.#action.revision; }
  #matchesOffer(event) { return this.#matchesAction(event) && this.#offer && event.offerId === this.#offer.id && event.revision === this.#offer.revision; }
}

function text(value) { return typeof value === 'string' && value.trim().length > 0 && value.length <= 300; }
