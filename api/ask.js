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

  // What happened earlier in this chat (only for a real chat, never for the shared "anonymous" id).
  const ctx = {};
  if (patient !== 'anonymous') {
    try {
      const recent = await store.recentTickets(patient);
      const ob = recent.find((t) => (t.kind === 'booking' || t.kind === 'booking_update') && t.status === 'needs human' && Date.now() - new Date(t.created_at).getTime() < 7 * 86400000);
      if (ob) ctx.openBooking = { id: ob.id, requested_time: ob.requested_time && ob.requested_time !== 'not given' ? ob.requested_time : null, phone: ob.patient_phone || null, name: ob.patient_name || null };
      if (recent[0]) ctx.lastKind = recent[0].kind;
    } catch (e) { /* no context: answer as a fresh chat */ }
  }

  const r = answer(q, clinic, ctx);
  if (r.silent) return send(res, 200, { silent: true, reply: '', status: r.status, kind: r.kind, ticket_id: null, last_message_id: 0, source: 'file', label: null });
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
  let status = r.status;
  try {
    // Name and phone number: keep them on the booking ticket. If the same number already has
    // another open booking (from any chat), close this one as a duplicate and point to that one.
    if (r.contact && r.contact.phone) {
      const own = r.ticket_ref || null;
      const other = await store.findOpenBookingByPhone(r.contact.phone, own);
      if (other) {
        const T = require('../lib/lang').T[r.lang] || require('../lib/lang').T.en;
        reply = T.duplicateBooking(other.id);
        // The day and time move to the open ticket only if it has none yet. A name fills a missing name.
        const otherHasTime = other.requested_time && other.requested_time !== 'not given';
        const newTime = own ? (ctx.openBooking && ctx.openBooking.requested_time) : (r.requested_time !== 'not given' ? r.requested_time : null);
        if (r.contact.name && !other.patient_name) await store.updateTicket(other.id, { patient_name: r.contact.name });
        if (own) await store.updateTicket(own, { patient_name: r.contact.name || undefined, patient_phone: r.contact.phone, status: 'closed' });
        ticket = await store.addToTicket(other.id, patient, q, reply, !otherHasTime && newTime ? newTime : null);
        status = 'needs human';
        return send(res, 200, { reply, status, kind: 'duplicate_booking', lang: r.lang, requested_time: r.requested_time, ticket_id: other.id, last_message_id: ticket.last_message_id, source, label: LABEL, store_error: null });
      }
      if (own) await store.updateTicket(own, { patient_name: r.contact.name || undefined, patient_phone: r.contact.phone });
    }
    if (r.ticket_ref) {
      ticket = await store.addToTicket(r.ticket_ref, patient, q, reply, r.kind === 'booking_update' ? r.requested_time : null);
    } else {
      ticket = await store.createTicket({ patient_id: patient, question: q, bot_reply: reply, status: r.status, kind: r.kind, requested_time: r.requested_time, lang: r.lang, source, patient_name: r.contact && r.contact.name, patient_phone: r.contact && r.contact.phone });
    }
  } catch (e) {
    storeError = e.message;
    console.error('createTicket failed:', e.message);
  }

  send(res, 200, {
    reply,
    status,
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
