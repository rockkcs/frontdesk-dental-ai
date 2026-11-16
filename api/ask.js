// POST /api/ask  { q, patient }  ->  { reply, status, ticket_id, source, label }
// The matcher always produces the answer. The AI, when a key works, only rewords it.
const { answer } = require('../lib/engine');
const store = require('../lib/store');
const ai = require('../lib/ai');
const { body, send } = require('../lib/http');

const LABEL = 'Answered from the clinic file';

module.exports = async (req, res) => {
  const b = body(req);
  const q = String(b.q || (req.query && req.query.q) || '').trim().slice(0, 1000);
  const patient = String(b.patient || (req.query && req.query.patient) || 'anonymous').slice(0, 80);
  if (!q) return send(res, 400, { error: 'Please type a question.' });

  let clinic;
  try { clinic = await store.getClinic(); } catch (e) { clinic = require('../data/clinic-data.json'); }

  const r = answer(q, clinic);
  let reply = r.text;
  let source = 'file';

  // Only plain fact answers go to the AI. Emergency, no-advice, refusal, booking and not-sure replies never do.
  if (r.kind === 'answer') {
    try {
      const better = await ai.reword(q, r.text, r.facts, r.lang);
      if (better) { reply = better; source = 'ai'; }
    } catch (e) { /* keep the matcher's answer */ }
  }

  let ticket = { ticket_id: null, last_message_id: 0 };
  let storeError = null;
  try {
    ticket = await store.createTicket({ patient_id: patient, question: q, bot_reply: reply, status: r.status, kind: r.kind, requested_time: r.requested_time, lang: r.lang, source });
  } catch (e) {
    storeError = e.message;
    console.error('createTicket failed:', e.message);
  }

  send(res, 200, {
    reply,
    status: r.status,
    kind: r.kind,
    lang: r.lang,
    requested_time: r.requested_time,
    ticket_id: ticket.ticket_id,
    last_message_id: ticket.last_message_id,
    source,
    label: source === 'file' ? LABEL : null,
    store_error: storeError
  });
};
