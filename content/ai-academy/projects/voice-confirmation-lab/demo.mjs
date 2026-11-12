import { VoiceConfirmation } from './confirmation.mjs';

const lab = new VoiceConfirmation();
const ref = { actionId: 'teaching-ticket', revision: 1, offerId: 'offer-1' };
const events = [
  { type: 'set_action', at: 0, action: { id: ref.actionId, revision: 1, description: 'Создать вымышленную карточку ремонта. Внешняя отправка отсутствует.' } },
  { type: 'offer', at: 1, ...ref, validForMs: 1000 },
  { type: 'generated', at: 2, ...ref },
  { type: 'confirm', at: 3, ...ref, actor: 'student', explicit: true },
  { type: 'interrupted', at: 4, ...ref },
  { type: 'handoff', at: 5, ...ref },
  { type: 'execute', at: 6, ...ref },
  { type: 'offer', at: 7, ...ref, offerId: 'offer-2', validForMs: 1000 },
  { type: 'generated', at: 8, ...ref, offerId: 'offer-2' },
  { type: 'playback_completed', at: 9, ...ref, offerId: 'offer-2', remainingVoicedSamples: 0 },
  { type: 'confirm', at: 10, ...ref, offerId: 'offer-2', actor: 'student', explicit: true },
  { type: 'handoff', at: 11, ...ref, offerId: 'offer-2' },
  { type: 'execute', at: 12, ...ref, offerId: 'offer-2' },
  { type: 'execute', at: 13, ...ref, offerId: 'offer-2' },
];
for (const event of events) lab.apply(event);
console.log(JSON.stringify({ mode: 'synthetic_offline', ...lab.snapshot() }, null, 2));
