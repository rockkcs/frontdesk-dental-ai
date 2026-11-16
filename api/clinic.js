// GET  /api/clinic          -> the clinic data the bot answers from
// POST /api/clinic { data } -> staff save an edited copy; the very next answer uses it
const store = require('../lib/store');
const { body, send } = require('../lib/http');

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST' || req.method === 'PUT') {
      const b = body(req);
      let data = b.data;
      if (typeof data === 'string') data = JSON.parse(data);
      await store.saveClinic(data);
      return send(res, 200, { ok: true, data });
    }
    send(res, 200, { data: await store.getClinic(), shared_store: store.hasStore() });
  } catch (e) {
    console.error('clinic failed:', e.message);
    send(res, 400, { error: e.message });
  }
};
