// GET /api/messages?patient=ID&after=N -> that patient's chat messages newer than N
const store = require('../lib/store');
const { send } = require('../lib/http');

module.exports = async (req, res) => {
  const patient = String((req.query && req.query.patient) || '').slice(0, 80);
  if (!patient) return send(res, 400, { error: 'patient is needed', messages: [] });
  try {
    const messages = await store.getMessages(patient, req.query.after);
    send(res, 200, { messages });
  } catch (e) {
    console.error('messages failed:', e.message);
    send(res, 500, { error: e.message, messages: [] });
  }
};
