// GET  /api/tickets                 -> { tickets: [...] }
// POST /api/tickets { id, status }  -> change a ticket's status (for example to "closed")
const store = require('../lib/store');
const { body, send } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const b = body(req);
      const t = await store.setStatus(b.id, String(b.status || ''));
      return send(res, 200, { ok: true, ticket: t });
    }
    const tickets = await store.listTickets();
    send(res, 200, { tickets, shared_store: store.hasStore(), now: new Date().toISOString() });
  } catch (e) {
    console.error('tickets failed:', e.message);
    send(res, 500, { error: e.message, tickets: [] });
  }
};
