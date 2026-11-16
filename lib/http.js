// Small helpers shared by the server functions.
function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}
function send(res, code, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).json(data);
}
module.exports = { body, send };
