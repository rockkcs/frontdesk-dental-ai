// The shared store: tickets, chat messages and the clinic data.
// Talks to Supabase over plain HTTPS from the server only. The key never reaches the browser.
// If Supabase is not set up (for example on a laptop), it keeps things in memory so the app still runs.

const fileClinic = require('../data/clinic-data.json');

const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
// Only the first word is used, so a stray space or line break in the setting cannot break every request.
const KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim().split(/\s+/)[0];
const KEY_KIND = KEY.startsWith('sb_publishable_') ? 'publishable (wrong key: use the secret key)' : KEY.startsWith('sb_secret_') ? 'secret' : KEY ? 'legacy' : 'none';
const hasStore = () => Boolean(URL_ && KEY);
const STATUSES = ['answered', 'needs human', 'urgent', 'closed'];

async function db(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      method: opts.method || 'GET',
      headers: Object.assign(
        { apikey: KEY, 'Content-Type': 'application/json', Prefer: opts.prefer || 'return=representation' },
        // New-style secret keys (sb_secret_...) go only in the apikey header. Old JWT keys also go as Bearer.
        KEY.startsWith('sb_') ? {} : { Authorization: `Bearer ${KEY}` }
      ),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`store ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  } catch (err) {
    // Never pass a key back to a page: keep only a short, safe message.
    const msg = String(err && err.message || err).split(KEY).join('[key]').replace(/sb_(secret|publishable)_\S+|eyJ[\w.-]+/g, '[key]');
    throw new Error(msg.slice(0, 200));
  } finally {
    clearTimeout(timer);
  }
}

// ---- memory fallback (single process only) ----
const mem = globalThis.__fdMem || (globalThis.__fdMem = { tickets: [], messages: [], clinic: null, tid: 0, mid: 0 });
const nowIso = () => new Date().toISOString();

// ---- clinic data ----
async function getClinic() {
  if (!hasStore()) return mem.clinic || fileClinic;
  try {
    const rows = await db('fd_clinic?id=eq.1&select=data');
    if (rows && rows[0] && rows[0].data && typeof rows[0].data === 'object') return rows[0].data;
  } catch (err) {
    console.error('getClinic failed, using the file:', err.message);
  }
  return fileClinic;
}

async function saveClinic(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Clinic data must be a JSON object');
  if (!hasStore()) { mem.clinic = data; return data; }
  await db('fd_clinic?on_conflict=id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { id: 1, data, updated_at: nowIso() }
  });
  return data;
}

// ---- tickets ----
async function createTicket(t) {
  const row = {
    patient_id: String(t.patient_id || 'unknown').slice(0, 80),
    question: String(t.question || '').slice(0, 2000),
    bot_reply: String(t.bot_reply || '').slice(0, 4000),
    status: STATUSES.includes(t.status) ? t.status : 'needs human',
    kind: t.kind || null,
    requested_time: t.requested_time || null,
    lang: t.lang || 'en',
    source: t.source || 'file'
  };
  if (!hasStore()) {
    const ticket = { id: ++mem.tid, ...row, created_at: nowIso(), updated_at: nowIso() };
    mem.tickets.push(ticket);
    mem.messages.push({ id: ++mem.mid, ticket_id: ticket.id, patient_id: row.patient_id, sender: 'patient', text: row.question, created_at: nowIso() });
    const bot = { id: ++mem.mid, ticket_id: ticket.id, patient_id: row.patient_id, sender: 'bot', text: row.bot_reply, created_at: nowIso() };
    mem.messages.push(bot);
    return { ticket_id: ticket.id, last_message_id: bot.id };
  }
  const [ticket] = await db('fd_tickets', { method: 'POST', body: row });
  const msgs = await db('fd_messages', {
    method: 'POST',
    body: [
      { ticket_id: ticket.id, patient_id: row.patient_id, sender: 'patient', text: row.question },
      { ticket_id: ticket.id, patient_id: row.patient_id, sender: 'bot', text: row.bot_reply }
    ]
  });
  const last = Math.max(...msgs.map((m) => Number(m.id)));
  return { ticket_id: ticket.id, last_message_id: last };
}

// The patient's last few tickets, newest first. Used to remember an open booking and the last reply.
async function recentTickets(patientId) {
  if (!hasStore()) return mem.tickets.filter((t) => t.patient_id === patientId).slice(-10).reverse();
  return db(`fd_tickets?select=id,kind,status,requested_time,created_at&patient_id=eq.${encodeURIComponent(patientId)}&order=id.desc&limit=10`);
}

// Add one more question and reply to an existing ticket (and optionally change its booking time).
async function addToTicket(ticketId, patientId, question, reply, requestedTime) {
  const now = nowIso();
  if (!hasStore()) {
    const t = mem.tickets.find((x) => String(x.id) === String(ticketId));
    if (t) { t.updated_at = now; if (requestedTime) t.requested_time = requestedTime; }
    mem.messages.push({ id: ++mem.mid, ticket_id: Number(ticketId), patient_id: patientId, sender: 'patient', text: question, created_at: now });
    const bot = { id: ++mem.mid, ticket_id: Number(ticketId), patient_id: patientId, sender: 'bot', text: reply, created_at: now };
    mem.messages.push(bot);
    return { ticket_id: Number(ticketId), last_message_id: bot.id };
  }
  const patch = { updated_at: now };
  if (requestedTime) patch.requested_time = requestedTime;
  await db(`fd_tickets?id=eq.${encodeURIComponent(ticketId)}`, { method: 'PATCH', prefer: 'return=minimal', body: patch });
  const msgs = await db('fd_messages', {
    method: 'POST',
    body: [
      { ticket_id: Number(ticketId), patient_id: patientId, sender: 'patient', text: question },
      { ticket_id: Number(ticketId), patient_id: patientId, sender: 'bot', text: reply }
    ]
  });
  return { ticket_id: Number(ticketId), last_message_id: Math.max(...msgs.map((m) => Number(m.id))) };
}

async function listTickets() {
  if (!hasStore()) {
    return mem.tickets.slice().reverse().map((t) => ({
      ...t,
      replies: mem.messages.filter((m) => m.ticket_id === t.id && m.sender === 'staff')
    }));
  }
  const tickets = await db('fd_tickets?select=*&order=id.desc&limit=200');
  if (!tickets.length) return [];
  const ids = tickets.map((t) => t.id).join(',');
  const replies = await db(`fd_messages?select=id,ticket_id,text,created_at&sender=eq.staff&ticket_id=in.(${ids})&order=id.asc`);
  return tickets.map((t) => ({ ...t, replies: replies.filter((r) => String(r.ticket_id) === String(t.id)) }));
}

async function getTicket(id) {
  if (!hasStore()) return mem.tickets.find((t) => String(t.id) === String(id)) || null;
  const rows = await db(`fd_tickets?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

async function addStaffReply(ticketId, text) {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error('Ticket not found');
  const row = { ticket_id: ticket.id, patient_id: ticket.patient_id, sender: 'staff', text: String(text).slice(0, 4000) };
  if (!hasStore()) {
    const m = { id: ++mem.mid, ...row, created_at: nowIso() };
    mem.messages.push(m);
    ticket.updated_at = nowIso();
    return m;
  }
  const [m] = await db('fd_messages', { method: 'POST', body: row });
  await db(`fd_tickets?id=eq.${ticket.id}`, { method: 'PATCH', prefer: 'return=minimal', body: { updated_at: nowIso() } });
  return m;
}

async function setStatus(ticketId, status) {
  if (!STATUSES.includes(status)) throw new Error('Status must be one of: ' + STATUSES.join(', '));
  if (!hasStore()) {
    const t = mem.tickets.find((x) => String(x.id) === String(ticketId));
    if (!t) throw new Error('Ticket not found');
    t.status = status; t.updated_at = nowIso();
    return t;
  }
  const rows = await db(`fd_tickets?id=eq.${encodeURIComponent(ticketId)}`, { method: 'PATCH', body: { status, updated_at: nowIso() } });
  if (!rows.length) throw new Error('Ticket not found');
  return rows[0];
}

async function getMessages(patientId, afterId) {
  const after = Number(afterId) || 0;
  if (!hasStore()) return mem.messages.filter((m) => m.patient_id === patientId && m.id > after);
  return db(`fd_messages?select=id,ticket_id,sender,text,created_at&patient_id=eq.${encodeURIComponent(patientId)}&id=gt.${after}&order=id.asc&limit=300`);
}

module.exports = { KEY_KIND, recentTickets, addToTicket, hasStore, getClinic, saveClinic, createTicket, listTickets, addStaffReply, setStatus, getMessages, STATUSES };
