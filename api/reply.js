// POST /api/reply { ticket_id, text } -> a staff reply that shows up in that patient's chat
const store = require('../lib/store');
const { body, send } = require('../lib/http');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
  const b = body(req);
  const text = String(b.text || '').trim();
  if (!b.ticket_id || !text) return send(res, 400, { error: 'A ticket and a reply are needed.' });
  try {
    const m = await store.addStaffReply(b.ticket_id, text);
    send(res, 200, { ok: true, message: m });
  } catch (e) {
    console.error('reply failed:', e.message);
    send(res, 500, { error: e.message });
  }
};
