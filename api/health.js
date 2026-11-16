// GET /api/health -> quick check of what is switched on (never shows a key)
const store = require('../lib/store');
const ai = require('../lib/ai');
const { send } = require('../lib/http');

module.exports = async (req, res) => {
  let storeOk = false;
  let storeError = null;
  if (store.hasStore()) {
    try { await store.listTickets(); storeOk = true; } catch (e) { storeError = e.message; }
  }
  send(res, 200, { ok: true, ai_key_present: ai.hasAI(), store_configured: store.hasStore(), store_working: storeOk, store_error: storeError });
};
