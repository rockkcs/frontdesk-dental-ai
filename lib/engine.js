// The answer engine. Pure code: no network, no AI, no store.
// Input: the patient's question and the clinic data. Output: a reply and a ticket status.
// Every fact is read from the clinic data at reply time. Nothing about any clinic is typed in here.

const { detectLang, toEnglishHints, T } = require('./lang');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT = { mon: 'monday', tue: 'tuesday', tues: 'tuesday', wed: 'wednesday', thu: 'thursday', thur: 'thursday', thurs: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday' };

// Words that mean the same thing are folded into one word.
const CANON = {
  kid: 'children', child: 'children', children: 'children', baby: 'children', son: 'children', daughter: 'children',
  toddler: 'children', pediatric: 'children', paediatric: 'children', infant: 'children', minor: 'children',
  teeth: 'tooth', cost: 'price', fee: 'price', charge: 'price', rate: 'price', pricing: 'price', priced: 'price', expensive: 'price', costly: 'price',
  timing: 'hour', time: 'hour', open: 'hour', opening: 'hour', close: 'hour', closing: 'hour', closed: 'hour', shut: 'hour', schedule: 'hour',
  insurer: 'insurance', insured: 'insurance', mediclaim: 'insurance',
  pay: 'payment', paying: 'payment', paid: 'payment',
  clean: 'cleaning', whiten: 'whitening', bleaching: 'whitening', bleach: 'whitening',
  location: 'address', located: 'address', locate: 'address', direction: 'address', where: 'address', map: 'address',
  landmark: 'address', near: 'address', nearby: 'address', reach: 'address',
  speak: 'language', spoken: 'language',
  call: 'phone', contact: 'phone', telephone: 'phone', mobile: 'phone', landline: 'phone',
  park: 'parking', car: 'parking', vehicle: 'parking', bike: 'parking', scooter: 'parking',
  consult: 'consultation', checkup: 'consultation',
  book: 'appointment', booking: 'appointment', reschedule: 'appointment', cancel: 'appointment', cancellation: 'appointment', postpone: 'appointment',
  sterile: 'sterilisation', sterilization: 'sterilisation', sterilise: 'sterilisation', sterilised: 'sterilisation', sterilize: 'sterilisation', sterilized: 'sterilisation', hygiene: 'sterilisation', hygienic: 'sterilisation',
  installment: 'emi', instalment: 'emi', rct: 'canal',
  dr: 'doctor', dentist: 'doctor', doc: 'doctor', specialist: 'doctor', surgeon: 'doctor', physician: 'doctor',
  holiday: 'holiday', festival: 'holiday'
};

const STOP = new Set(('a an the is are am was were be been being do does did you your yours i me my mine we our ours us it its this that these those ' +
  'to of in on at for from with by and or but if so as can could would should will shall may might have has had having get got gets please pls plz kindly ' +
  'tell know want need like there here what which when how much many any some all also just about hi hello hey thanks thank ok okay sir madam mam maam yes no not dont cant ' +
  'im ive id see sees seen take takes taken taking give gives provide provides offer accept accepts available availability treat treats come comes go goes going ' +
  'sure then than too very really more most up out into over after before during while does done doing make makes let sorry good new old one their them they he she his her him ' +
  'u ur r wanna gonna s t d ll re ve m o am pm oclock').split(' '));

// Words that are normal in a question and never name a thing the clinic sells.
const COMMON_RAW = ('today tomorrow now week weekend weekday weekdays month year minute minutes price hour doctor doctors appointment number list detail details info information ' +
  'question help long far big small best visit work working problem issue thing way kind type different same first last next day days date money rupee rupees rs inr total full ' +
  'extra free without within per each only still yet again back right home family friend wife husband mother father mom dad brother sister age adult senior man woman male female ' +
  'start begin end finish wait waiting bring carry send share show say said ask asking check look find use using try think feel hope wish possible required require necessary ' +
  'must mandatory allowed option options choice mode method process procedure service services treatment treatments facility building floor place area city clinic hospital dental tooth ' +
  'morning afternoon evening night early late soon quickly usually normally generally currently actually done session sessions sitting sittings duration total exact exactly approx ' +
  'approximately around roughly range minimum maximum starting least patient patients people person someone anyone everybody myself yourself own both either whether who whom whose why ' +
  'address phone payment insurance language parking children emergency holiday lunch break public name called available every daily always never ever sometime sometimes ' +
  'tell let know mean means meaning explain say advance prior meet meeting consultation rule rules policy policies term terms condition conditions').split(' ');

const VAGUE = new Set(['visit', 'first', 'name', 'public', 'break', 'day', 'in', 'rule']);
const ADJ = new Set(['single', 'metal', 'ceramic', 'full', 'partial', 'basic', 'standard', 'simple', 'normal', 'regular']);
const GENERIC = new Set(['tooth', 'dental', 'treatment', 'service', 'procedure', 'doctor', 'and', 'lead', 'clinic']);

function norm(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/x[\s-]?rays?/g, 'xray')
    .replace(/walk[\s_-]?ins?\b/g, 'walkin')
    .replace(/check[\s-]?ups?/g, 'checkup')
    .replace(/whats\s?app/g, 'whatsapp')
    .replace(/e[\s-]?mail/g, 'email')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}

function stem(t) {
  if (DAY_SHORT[t]) t = DAY_SHORT[t];
  if (CANON[t]) return CANON[t];
  let s = t;
  if (s.length > 4 && s.endsWith('ies')) s = s.slice(0, -3) + 'y';
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  return CANON[s] || s;
}

// Content words of a text, folded. Numbers and filler words are dropped.
function tokens(text) {
  return norm(text).split(' ').filter(Boolean)
    .filter((t) => !STOP.has(t) && !/^\d+%?$/.test(t) && t !== '%')
    .map(stem);
}
const COMMON = new Set(COMMON_RAW.map(stem));

function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
function labelOf(key) { return cap(String(key).replace(/_/g, ' ').replace(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g, (d) => cap(d))); }
function asText(v) {
  if (Array.isArray(v)) return v.map(asText).join(', ');
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${labelOf(k)}: ${asText(x)}`).join('; ');
  return String(v);
}
function endDot(s) { s = String(s).trim(); return /[.!?।]$/.test(s) ? s : s + '.'; }

// Which days a text like "Monday to Saturday" or "Tuesday, Thursday" covers.
function daysCovered(text) {
  const n = norm(String(text).replace(/_/g, ' '));
  if (/\b(daily|every day|everyday|all days|all week|7 days)\b/.test(n)) return new Set(DAYS);
  const words = n.split(' ').map((w) => DAY_SHORT[w] || w.replace(/s$/, ''));
  const out = new Set();
  for (let i = 0; i < words.length; i++) {
    const a = DAYS.indexOf(words[i]);
    if (a < 0) continue;
    out.add(DAYS[a]);
    if ((words[i + 1] === 'to' || words[i + 1] === 'through' || words[i + 1] === 'till' || words[i + 1] === 'until') && DAYS.indexOf(words[i + 2]) >= 0) {
      let b = DAYS.indexOf(words[i + 2]);
      for (let d = a; ; d = (d + 1) % 7) { out.add(DAYS[d]); if (d === b) break; }
    }
  }
  if (/\bweekdays?\b/.test(n)) DAYS.slice(0, 5).forEach((d) => out.add(d));
  if (/\bweekends?\b/.test(n)) DAYS.slice(5).forEach((d) => out.add(d));
  return out;
}

function todayIndex(offsetDays) {
  // Clinic time is India time.
  const now = new Date(Date.now() + 5.5 * 3600 * 1000 + (offsetDays || 0) * 86400 * 1000);
  return (now.getUTCDay() + 6) % 7; // monday = 0
}

// ---------- safety checks (run before the matcher) ----------

function isEmergency(n) {
  if (/\b(cant|cannot|can not|unable to|not able to|hard to|difficult to|difficulty|trouble|struggling to|problem)\s+(in\s+)?(breath\w*|swallow\w*)/.test(n)) return true;
  if (/breathing (problem|trouble|difficulty|issue)|short(ness)? of breath|breathless|chok(e|ing)|suffocat/.test(n)) return true;
  if (/\b(swell\w*|swollen)\b/.test(n) && /\b(face|neck|jaw|cheek|eye|throat|tongue)\b/.test(n)) return true;
  if (/\bbleed\w*|\bblood\b/.test(n) && /\b(heavy|heavily|lot|lots|wont stop|not stop\w*|doesnt stop|does not stop|isnt stopping|non ?stop|continuous\w*|profuse\w*|too much|cant stop|cannot stop|unstoppable|badly|severe\w*)\b/.test(n)) return true;
  if (/\b(unconscious|fainted|fainting|passed out|collapsed|seizure|knocked out|accident|broken jaw|fractured jaw|severe injury|dying)\b/.test(n)) return true;
  if (/\b(emergency|urgent|urgently)\b/.test(n)) {
    const asking = /\b(number|phone|contact|line|open|sunday|holiday|holidays|hour|hours|timing|timings|time|do you|handle|what|which|whatsapp)\b/.test(n);
    if (!asking) return true;
  }
  return false;
}

function isOverrideOrDiscount(n) {
  if (/\b(ignore|forget|disregard|bypass|override|break|change|skip|drop)\s+((all|your|the|my|previous|above|these|those|any|of)\s+)*(rule|instruction|prompt|polic|guideline|restriction)/.test(n)) return true;
  if (/system prompt|jailbreak|developer mode|pretend (you|to)|you are now|act as|new instructions?|no rules/.test(n)) return true;
  if (/discount|\d\s?%|percent off|\bconcession|\bcoupon|\bpromo|\bvoucher|\bbargain|negotiat|\bcheaper\b|(reduce|lower|cut|drop|waive)\s+(the\s+|my\s+|your\s+)?(price|cost|fee|bill|charge|rate)|best price|special (price|offer|deal)|\b(give|any|some|got|have|running)\s+(me\s+)?(an?\s+|some\s+|any\s+)?offers?\b|\boffers? (going|running)|for free\b|free of cost|\bless price|\bkam\b/.test(n)) return true;
  return false;
}

function hasSymptom(n) {
  return /\bpain\w*|\bhurt\w*|\bache\b|\baching|toothache|headache|\bswollen|\bswell\w*|\bbleed\w*|\bsensitiv\w*|\binfect\w*|\bpus\b|\babscess|\bfever|pain ?killer|\bmedicine|\bmedication|\btablets?\b|\bpills?\b|\bantibiotic|paracetamol|ibuprofen|\bnumb\b|throbbing|\bsore\b|\bulcer|loose tooth|broken tooth|\bchipped|\bcracked|\bcavity|\bcavities|\bdiagnos|should i take|home remed|\bremedy|\bsymptom|bad breath|\bdecay|\bburning|\binjur/.test(n);
}

// ---------- booking ----------

function parseWhen(raw) {
  const s = String(raw).toLowerCase();
  const parts = [];
  const day = s.match(/\b(day after tomorrow|today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/);
  if (day) parts.push(cap(DAY_SHORT[day[1]] || day[1]));
  const date = s.match(/\b(\d{1,2})(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/) || s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(st|nd|rd|th)?\b/) || s.match(/\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b/);
  if (date) parts.push(date[0]);
  const time = s.match(/\b\d{1,2}([:.]\d{2})?\s?(am|pm|a\.m\.|p\.m\.)/) || s.match(/\b\d{1,2}[:.]\d{2}\b/) || s.match(/\bat\s+(\d{1,2})(\s*o'?clock)?\b/) || s.match(/\b\d{1,2}\s*o'?clock\b/);
  if (time) parts.push(time[0].replace(/^at\s+/, '').trim());
  const part = s.match(/\b(morning|afternoon|evening|night)\b/);
  if (part && !time) parts.push(part[1]);
  return parts.length ? parts.join(' ') : null;
}

function bookingRequest(n, raw) {
  if (!/\b(book|booking|appointment|appointments|slot|reserve|schedule)\b/.test(n)) return null;
  if (/\b(cancel\w*|reschedul\w*|postpone|move my|change my|policy|charge|charges|fee)\b/.test(n)) return null;
  const when = parseWhen(raw);
  const want = /\b(i want|i need|i would like|id like|i wanna|i wish|can you book|could you book|please book|pls book|book me|book an?|book my|book for|need an? appointment|want an? appointment|make an? appointment|fix an? appointment|get an? appointment|schedule an?|can i get an? appointment|can i come)\b/.test(n);
  const howTo = /\b(how (do|can|to|should)|what is the (process|way)|walkin)\b/.test(n);
  if (when || (want && !howTo)) return { when };
  return null;
}
function visitRequest(n, raw) {
  // "Can I come tomorrow at 5 pm?" is a booking request even without the word "book".
  if (!/\b(can i|could i|may i|shall i|i want to|i will|ill|i would like to|i need to|let me)\s+(come|visit|drop in|drop by|see the doctor|meet the doctor|come in)\b/.test(n)) return null;
  const when = parseWhen(raw);
  return when ? { when } : null;
}

// ---------- the matcher ----------

function softenFirstWord(text, protect) {
  // "Cashless with ..." -> "cashless with ..." when it follows a label. Names and short forms are left alone.
  const m = String(text).match(/^([A-Za-z]+)(\b.*)$/s);
  if (!m) return text;
  const w = m[1];
  if (w.length < 2 || w[1] !== w[1].toLowerCase() || protect.has(w.toLowerCase())) return text;
  return w.charAt(0).toLowerCase() + w.slice(1) + m[2];
}

function buildEntries(data) {
  const entries = [];
  const protect = new Set();
  const doctors = Array.isArray(data.doctors) ? data.doctors : [];
  const services = Array.isArray(data.services) ? data.services : [];
  doctors.forEach((d) => norm(d.name).split(' ').forEach((w) => protect.add(w)));
  norm((data.clinic && data.clinic.name) || '').split(' ').forEach((w) => protect.add(w));
  DAYS.forEach((d) => protect.add(d));

  // hours
  Object.entries(data.hours || {}).forEach(([key, value]) => {
    const days = daysCovered(key);
    const strong = new Set(tokens(key.replace(/_/g, ' ')));
    if (days.size) { strong.add('hour'); days.forEach((d) => strong.add(d)); }
    entries.push({ type: 'hours', key, label: labelOf(key), value: asText(value), days, strong, rareSrc: '' });
  });

  // clinic details
  Object.entries(data.clinic || {}).forEach(([key, value]) => {
    const strong = new Set(tokens(key.replace(/_/g, ' ')));
    entries.push({ type: 'clinic', key, label: labelOf(key), value: asText(value), strong, rareSrc: asText(value) });
  });

  // policies
  Object.entries(data.policies || {}).forEach(([key, value]) => {
    const strong = new Set(tokens(key.replace(/_/g, ' ')));
    entries.push({ type: 'policy', key, label: labelOf(key), value: asText(value), strong, rareSrc: asText(value) });
  });

  // any other top-level text (for example emergency_rules). bot_rules and notes are never shown.
  Object.entries(data).forEach(([key, value]) => {
    if (['hours', 'clinic', 'policies', 'doctors', 'services', 'note', 'notes', 'bot_rules'].includes(key)) return;
    if (typeof value !== 'string') return;
    const strong = new Set(tokens(key.replace(/_/g, ' ')));
    strong.delete('rule');
    entries.push({ type: 'policy', key, label: labelOf(key), value, strong, rareSrc: '' });
  });

  // services
  services.forEach((s) => {
    const name = String(s.name || '');
    const mainPart = name.replace(/\(.*?\)/g, ' ');
    const inBrackets = (name.match(/\((.*?)\)/g) || []).join(' ');
    let main = new Set(tokens(mainPart).filter((t) => !GENERIC.has(t)));
    if (!main.size) main = new Set(tokens(mainPart));
    const alias = new Set(tokens(inBrackets).filter((t) => !GENERIC.has(t) && !COMMON.has(t) && !ADJ.has(t)));
    const strong = new Set([...main, ...alias]);
    entries.push({ type: 'service', item: s, name, strong, main, alias, all: new Set(tokens(name)), rareSrc: '' });
  });

  // doctors
  doctors.forEach((d) => {
    const nameTok = new Set(tokens(d.name).filter((t) => t !== 'doctor'));
    const roleTok = new Set(tokens(d.role || '').filter((t) => !GENERIC.has(t) && !COMMON.has(t) || t === 'children'));
    entries.push({ type: 'doctor', item: d, strong: nameTok, role: roleTok, days: daysCovered(d.days || ''), rareSrc: '' });
  });

  // "rare" words: words in a policy or clinic text that appear in no other entry.
  const count = new Map();
  entries.forEach((e) => {
    const seen = new Set([...tokens(e.rareSrc || ''), ...(e.strong || []), ...(e.role || []), ...(e.all || [])]);
    e._seen = seen;
    seen.forEach((t) => count.set(t, (count.get(t) || 0) + 1));
  });
  entries.forEach((e) => {
    e.rare = new Set();
    if (e.type !== 'policy' && e.type !== 'clinic') return;
    tokens(e.rareSrc || '').forEach((t) => {
      if (t.length >= 3 && count.get(t) === 1 && !COMMON.has(t) && !e.strong.has(t) && !DAYS.includes(t)) e.rare.add(t);
    });
  });
  return { entries, protect, doctors, services };
}

function renderService(e, L) {
  const s = e.item;
  let out = L.service({ name: s.name, price: asText(s.price != null ? s.price : '') });
  if (s.price == null) out = `${s.name}.`;
  if (s.duration) out += L.duration(asText(s.duration));
  if (s.note) out += ' ' + endDot(asText(s.note));
  Object.entries(s).forEach(([k, v]) => {
    if (!['name', 'price', 'duration', 'note'].includes(k)) out += ' ' + endDot(`${labelOf(k)}: ${asText(v)}`);
  });
  return out;
}
function renderDoctor(e, L) {
  const d = e.item;
  let out = L.doctor({ name: d.name, role: asText(d.role || ''), days: asText(d.days || '') });
  Object.entries(d).forEach(([k, v]) => {
    if (!['name', 'role', 'days'].includes(k)) out += ' ' + endDot(`${labelOf(k)}: ${asText(v)}`);
  });
  return out;
}
function factsOfService(e) { return [e.item.name, e.item.price, e.item.duration].filter(Boolean).map(asText); }
function factsOfDoctor(e) { return [e.item.name, e.item.days].filter(Boolean).map(asText); }

function match(question, data, L) {
  const { entries, protect } = buildEntries(data);
  const n = norm(question);
  let qTok = tokens(question);

  // today / tomorrow -> a real day name
  const askedDays = new Set();
  if (/\btoday\b|\btonight\b|\bnow\b/.test(n)) askedDays.add(DAYS[todayIndex(0)]);
  if (/\btomorrow\b/.test(n)) askedDays.add(DAYS[todayIndex(1)]);
  qTok.forEach((t) => { if (DAYS.includes(t)) askedDays.add(t); });
  if (/\bweekends?\b/.test(n)) { askedDays.add('saturday'); askedDays.add('sunday'); }
  const q = new Set([...qTok, ...askedDays]);

  const doctorIntent = q.has('doctor') || /\bwho\b/.test(n);
  const priceIntent = q.has('price') || /\bhow much\b/.test(n);
  const hourIntent = q.has('hour');
  const listServices = /\b(services?|treatments?|procedures?|price list|rate card|all prices|prices)\b/.test(n);

  const scored = [];
  for (const e of entries) {
    var clear = true;
    let strongHits = [...e.strong].filter((t) => q.has(t));
    let score = 0;
    let used = new Set();
    if (e.type === 'service') {
      const mainHits = [...e.main].filter((t) => q.has(t));
      const aliasHits = [...e.alias].filter((t) => q.has(t));
      const frac = e.main.size ? mainHits.length / e.main.size : 0;
      if (frac >= 0.5) score = 4 * frac;
      if (aliasHits.length) score = Math.max(score, 3.5);
      if (score > 0) { score += priceIntent ? 0.5 : 0; [...e.all].forEach((t) => q.has(t) && used.add(t)); }
    } else if (e.type === 'doctor') {
      const roleHits = [...e.role].filter((t) => q.has(t));
      if (strongHits.length) { score = 3 * strongHits.length; strongHits.forEach((t) => used.add(t)); }
      if (doctorIntent && roleHits.length) { score += 2 * roleHits.length + 1; roleHits.forEach((t) => used.add(t)); }
      e._roleHits = roleHits;
      if (score > 0) [...askedDays].forEach((d) => used.add(d));
    } else if (e.type === 'hours') {
      const dayHit = [...askedDays].some((d) => e.days.has(d));
      const nonDay = strongHits.filter((t) => !DAYS.includes(t) && t !== 'hour');
      if (e.days.size) {
        if (dayHit) score = 4;
        else if (hourIntent && askedDays.size === 0) score = 2;
      }
      if (nonDay.length) score = Math.max(score, 2 * nonDay.length + (hourIntent ? 1 : 0) + 1);
      if (score > 0) { strongHits.forEach((t) => used.add(t)); if (hourIntent) used.add('hour'); askedDays.forEach((d) => e.days.has(d) && used.add(d)); }
    } else {
      const rareHits = [...e.rare].filter((t) => q.has(t));
      score = 2 * strongHits.length + 1.5 * rareHits.length;
      strongHits.forEach((t) => used.add(t)); rareHits.forEach((t) => used.add(t));
      var clear = rareHits.length > 0 || strongHits.some((t) => !VAGUE.has(t));
    }
    if (score > 0) scored.push({ e, score, used, clear: e.type === 'policy' || e.type === 'clinic' ? clear : true });
  }

  // "Which doctors are available on Tuesday?": no name or role given, so go by the day.
  if (doctorIntent && askedDays.size && !scored.some((x) => x.e.type === 'doctor')) {
    entries.filter((e) => e.type === 'doctor' && [...askedDays].some((d) => e.days.has(d)))
      .forEach((e) => scored.push({ e, score: 4.5, used: new Set(askedDays) }));
  }

  // A doctor question should not pull in the price of the same thing, unless a price was asked.
  let pool = scored;
  const doctorHit = pool.some((x) => x.e.type === 'doctor');
  if (doctorIntent && doctorHit) pool = pool.filter((x) => x.e.type !== 'hours');
  if (doctorIntent && doctorHit && !priceIntent) pool = pool.filter((x) => x.e.type !== 'service');
  if (priceIntent && pool.some((x) => x.e.type === 'service')) pool = pool.filter((x) => x.e.type !== 'doctor');

  pool.sort((a, b) => b.score - a.score);
  let chosen = [];
  if (pool.length) {
    const top = pool[0].score;
    chosen = pool.filter((x) => x.score >= 0.6 * top).slice(0, 4);
    // A clearly named policy or clinic detail rides along ("EMI on implants?").
    pool.forEach((x) => {
      if (chosen.length < 4 && !chosen.includes(x) && (x.e.type === 'policy' || x.e.type === 'clinic') && x.clear && x.score >= 2 && [...x.e.strong].some((t) => q.has(t) && !COMMON.has(t))) chosen.push(x);
    });
  }

  const INTENT = new Set(['price', 'hour', 'doctor', 'service', 'treatment', 'procedure', 'list', 'appointment']);
  const leftover = (sel) => {
    const used = new Set();
    sel.forEach((x) => x.used.forEach((t) => used.add(t)));
    if (sel.length) pool.forEach((x) => x.used.forEach((t) => used.add(t)));
    return [...new Set(qTok)].filter((t) => !used.has(t) && !COMMON.has(t) && !INTENT.has(t) && !DAYS.includes(t));
  };

  // Nothing matched: try list answers or a doctor's role, else not sure.
  if (!chosen.length) {
    const left = leftover([]);
    if (left.length === 0 && doctorIntent && !priceIntent) {
      let docs = entries.filter((e) => e.type === 'doctor');
      const day = [...askedDays][0];
      if (day) docs = docs.filter((e) => e.days.has(day));
      if (docs.length) {
        const head = day ? L.doctorsOn(cap(day)) : L.allDoctors();
        return { text: head + '\n' + docs.map((e) => renderDoctor(e, L)).join('\n\n'), facts: docs.flatMap(factsOfDoctor), topic: 'doctors' };
      }
    }
    if (left.length === 0 && (listServices || priceIntent)) {
      const sv = entries.filter((e) => e.type === 'service');
      if (sv.length) return { text: L.allServices() + '\n' + sv.map((e) => renderService(e, L)).join('\n\n'), facts: sv.flatMap(factsOfService), topic: 'services' };
    }
    if (!priceIntent) {
      const byRole = entries.filter((e) => e.type === 'doctor' && e._roleHits && e._roleHits.length);
      if (byRole.length) {
        const sel = byRole.map((e) => ({ e, used: new Set(e._roleHits) }));
        if (leftover(sel).length === 0) return { text: byRole.map((e) => renderDoctor(e, L)).join('\n\n'), facts: byRole.flatMap(factsOfDoctor), topic: 'doctors' };
      }
    }
    return null;
  }

  // A price was asked but no service matched: only a policy may answer it.
  if (priceIntent && !chosen.some((x) => x.e.type === 'service' || x.e.type === 'policy')) return null;

  // Words we could not place. For services, doctors and timings this means "do not guess".
  const strict = chosen.some((x) => ['service', 'doctor', 'hours'].includes(x.e.type));
  if (strict && leftover(chosen).length) return null;
  // A policy matched only by a vague word ("visit", "first") is not enough if other words are unplaced.
  if (!strict && chosen.every((x) => !x.clear) && leftover(chosen).length) return null;

  const texts = [];
  const facts = [];
  const day = [...askedDays][0];
  for (const { e } of chosen) {
    if (e.type === 'service') { texts.push(renderService(e, L)); facts.push(...factsOfService(e)); }
    else if (e.type === 'doctor') { texts.push(renderDoctor(e, L)); facts.push(...factsOfDoctor(e)); }
    else if (e.type === 'hours') {
      if (e.days.size && day && e.days.has(day)) texts.push(L.day(cap(day), e.value));
      else texts.push(endDot(`${e.label}: ${e.value}`));
      facts.push(e.value);
    } else if (e.type === 'clinic') { texts.push(endDot(L.kv(e.label, e.value))); facts.push(e.value); }
    else { texts.push(endDot(L.kv(e.label, softenFirstWord(e.value, protect)))); facts.push(...(e.value.match(/(Rs\.?\s?)?\d[\d,.:]*\d|\d/g) || [])); }
  }
  return { text: texts.join('\n\n'), facts, topic: chosen[0].e.type };
}

// ---------- is the asked day and time inside the clinic's hours? ----------
function toMinutes(h, m, ap) {
  h = Number(h); m = Number(m || 0);
  ap = (ap || '').toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + m;
}
// Returns null when the slot looks fine or cannot be judged; otherwise what to tell the patient.
function slotProblem(text, data) {
  const s = String(text).toLowerCase();
  const hours = (data && data.hours) || {};
  // the day asked for
  let day = null;
  const dm = s.match(/\b(day after tomorrow|today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/);
  if (dm) {
    if (dm[1] === 'day after tomorrow') day = DAYS[todayIndex(2)];
    else if (dm[1] === 'today' || dm[1] === 'tonight') day = DAYS[todayIndex(0)];
    else if (dm[1] === 'tomorrow') day = DAYS[todayIndex(1)];
    else day = DAY_SHORT[dm[1]] || dm[1];
  }
  // the time asked for
  let mins = null;
  const tm = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/) || s.match(/\b(\d{1,2})[:.](\d{2})\b/) || s.match(/\bat\s+(\d{1,2})\b/) || s.match(/\b(\d{1,2})\s*o'?clock\b/) || s.match(/\b(\d{1,2})\s*(?:बजे|గంటలకు|గంటలు)/);
  if (tm) {
    let ap = tm[3];
    const h = Number(tm[1]);
    if (!ap) ap = h >= 13 ? '' : h >= 8 && h <= 11 ? 'am' : 'pm'; // "at 3" means 3 pm at a clinic
    if (h <= 24) mins = toMinutes(h, tm[2], ap);
  }
  if (!day && mins == null) return null;
  // the hours that apply to that day (or to every day, if no day was given)
  const entries = Object.entries(hours).map(([k, v]) => ({ key: k, label: labelOf(k), value: asText(v), days: daysCovered(k) })).filter((e) => e.days.size);
  if (!entries.length) return null;
  const pick = day ? entries.filter((e) => e.days.has(day)) : entries;
  const describe = (e) => `${e.label}: ${e.value}`;
  if (day && !pick.length) return null;
  const ranges = (v) => {
    const out = [];
    const re = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\s*(?:to|-|–|till|until)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/gi;
    let m;
    while ((m = re.exec(v))) out.push([toMinutes(m[1], m[2], m[3]), toMinutes(m[4], m[5], m[6])]);
    return out;
  };
  const bad = [];
  for (const e of pick) {
    const v = e.value.toLowerCase();
    const r = ranges(e.value);
    if (/\bclosed\b/.test(v) && !r.length) { bad.push(e); continue; }
    if (/emergenc/.test(v)) { bad.push(e); continue; }
    if (mins != null && r.length && !r.some(([a, b]) => mins >= a && mins < b)) { bad.push(e); continue; }
    if (day || mins == null) return null; // a normal day, inside the hours
    if (r.some(([a, b]) => mins >= a && mins < b)) return null; // no day given, but the time fits some day
  }
  if (!bad.length) return null;
  return { hours: (day ? bad : pick).map(describe).join('; ') };
}

// ---------- name and phone number ----------
// Finds one phone number (Indian mobile, landline or +country code) and a name in a short message.
function findContact(raw) {
  const s = String(raw);
  const m = s.match(/(?:\+?\d[\d\s().-]{7,17}\d)/);
  if (!m) return null;
  let digits = m[0].replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 13) return null;
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  const landline = /^0/.test(m[0].trim());
  const phone = !landline && digits.length === 10 && /^[6-9]/.test(digits) ? digits.slice(0, 5) + ' ' + digits.slice(5) : m[0].trim();
  // The name is what is left once the number, booking words, days, times and filler words are removed.
  // When the message has several parts ("Book Monday 5 pm, Anil 98..."), only the part holding the number is used.
  const parts = s.split(/[,.;\n|]+/);
  let hold = s;
  for (const p of parts) if (p.includes(m[0].trim().slice(0, 6))) { hold = p; break; }
  const name = nameFrom(hold, m[0].trim()) || nameFrom(s, m[0].trim());
  return { name: name || null, phone, digits };
}
function nameFrom(text, num) {
  const at = text.indexOf(num);
  let rest = (at >= 0 ? text.slice(0, at) + ' ' + text.slice(at + num.length) : text.replace(/[\d+()-]/g, ' '))
    .replace(/\d{1,2}([:.]\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/gi, ' ')
    .replace(/\b(my|name|is|its|it's|this|i am|i'm|im|and|number|phone|mobile|contact|no|num|ph|mob|call|me|on|at|here|the|please|pls|thanks|thank you|ok|okay|yes|sure|sir|madam|mr|mrs|ms|book|booking|appointment|appointments|slot|visit|for|want|need|would|like|to|an?|i|today|tomorrow|tonight|morning|afternoon|evening|night|am|pm|o'?clock|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b\.?/gi, ' ')
    .replace(/(मेरा|नाम|है|और|नंबर|फ़ोन|फोन|मोबाइल|నా|పేరు|మరియు|నంబర్|ఫోన్)/g, ' ')
    .replace(/[^\p{L}\p{M}\s.'-]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
  const words = rest.split(' ').filter((w) => w.length > 1 && !/^[.'-]+$/.test(w)).slice(0, 4);
  let name = words.join(' ');
  if (name && /[a-z]/i.test(name)) name = name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return name;
}

// ---------- small talk ----------
const POLITE = new Set(('no nope nah not ok okay okk k kk fine sure alright allright cool great good nice perfect noted got it understood ' +
  'thanks thank thankyou thanx thx ty tq you u very much so lot a lots many all for your the help that is thats it nothing else more ' +
  'bye goodbye see later take care have day night yes yeah yep yup please pls sir madam mam maam then and now done welcome hmm hm ' +
  'dhanyavad dhanyawad shukriya theek thik hai already booked i did we ' +
  // sounds and short replies: "oh ok", "ha ok", "acha", "i see", "right", "got it"
  'oh ah aha ha haa han haan ho hoo uh um umm hm hmm acha accha achha acchha achcha thikhai okie oki okey okays kay ' +
  'see right correct true exactly sounds understand understood clear noted cool wow superb awesome excellent ' +
  'will wait waiting let know then fine just alright').split(' '));
function smallTalk(raw) {
  const s = String(raw).toLowerCase().replace(/[’']/g, '').trim();
  // Hindi and Telugu polite words, written in their own script
  const hiTe = s.replace(/[\s.,!?।]+/g, ' ').trim();
  if (/^((ओह|अच्छा|अच्छा जी|हाँ|हां|हम्म|ओ|ఓ|ఓహ్|అలాగా|అవును) )?(धन्यवाद|शुक्रिया|बहुत धन्यवाद|ठीक है|ओके|नहीं|नहीं धन्यवाद|नहीं शुक्रिया|बस|अलविदा|अच्छा|हाँ|हां|ఓకే|ధన్యవాదాలు|సరే|వద్దు|వద్దు ధన్యవాదాలు|చాలా ధన్యవాదాలు|బై|అలాగే|అలాగా)( (जी|ధన్యవాదాలు|धन्यवाद|है))?$/.test(hiTe)) {
    if (/(नहीं|बस|अलविदा|వద్దు|బై)/.test(hiTe)) return 'bye';
    if (!/(धन्यवाद|शुक्रिया|ధన్యవాదాలు)/.test(hiTe)) return 'ack';
    return 'thanks';
  }
  // "ohhh", "okkkk", "hmmm", "soooo" -> one or two of the repeated letter
  const words = s.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
    .map((w) => (POLITE.has(w) ? w : w.replace(/(.)\1{2,}/g, '$1$1')))
    .map((w) => (POLITE.has(w) ? w : w.replace(/(.)\1+/g, '$1')));
  if (!words.length || words.length > 8) return null;
  if (!words.every((w) => POLITE.has(w))) return null;
  const has = (re) => re.test(' ' + words.join(' ') + ' ');
  if (has(/ (no|nope|nah|nothing|bye|goodbye|thats all|that is all|thats it|that is it|take care|see you|take care|good night|have a) /)) return 'bye';
  if (has(/ (thank|thanks|thankyou|thanx|thx|ty|tq|dhanyavad|dhanyawad|shukriya) /)) return 'thanks';
  return 'ack';
}

// ---------- the one function everything else calls ----------

// ctx (optional): what happened earlier in this patient's chat.
//   ctx.openBooking = { id, requested_time } when a booking request is still open
//   ctx.lastKind    = the kind of the bot's previous reply ('bye', 'no_advice', ...)
function answer(question, data, ctx) {
  ctx = ctx || {};
  const raw = String(question || '').trim().slice(0, 1000);
  const lang = detectLang(raw);
  const L = T[lang] || T.en;
  const hints = lang === 'en' ? '' : toEnglishHints(raw, lang);
  const full = (raw + ' ' + hints).trim();
  const n = norm(full);
  const clinic = (data && data.clinic) || {};
  const emergencyNumber = clinic.emergency_phone || clinic.emergency || clinic.emergency_number || '';
  const phone = clinic.phone || clinic.whatsapp || '';
  const base = { lang, facts: [], requested_time: null };

  if (!raw) return { ...base, text: L.greet(clinic.name), status: 'answered', kind: 'greeting' };

  // 1. emergency
  if (isEmergency(n)) {
    return { ...base, text: emergencyNumber ? L.urgent(emergencyNumber) : L.urgentNoNum(), status: 'urgent', kind: 'urgent', facts: [emergencyNumber].filter(Boolean) };
  }
  // 2. "ignore your rules" and discounts
  if (isOverrideOrDiscount(n)) return { ...base, text: L.refuse(), status: 'answered', kind: 'refuse' };

  // 3. name and phone number for an open booking request
  const contact = findContact(raw);
  const ob0 = ctx.openBooking;
  if (contact && ob0 && !ob0.phone && raw.length <= 120 && !bookingRequest(n, full)) {
    const text = L.contactSaved(contact.name, contact.phone, ob0.id) + (contact.name ? '' : L.contactNeedName());
    return { ...base, text, status: 'needs human', kind: 'contact', ticket_ref: ob0.id, contact };
  }
  if (ob0 && ob0.phone && !ob0.name && !contact && /^[\p{L}\p{M}\s.'-]{2,40}$/u.test(raw.trim()) && raw.trim().split(/\s+/).length <= 4 && !smallTalk(raw)) {
    const name = raw.trim().split(/\s+/).map((w) => /[a-z]/i.test(w) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w).join(' ');
    return { ...base, text: L.contactSaved(name, ob0.phone, ob0.id), status: 'needs human', kind: 'contact', ticket_ref: ob0.id, contact: { name, phone: ob0.phone, digits: ob0.phone.replace(/\D/g, '') } };
  }

  // 4. booking request
  const symptom = hasSymptom(n);
  const booking = bookingRequest(n, full) || visitRequest(n, full);
  if (booking && ctx.openBooking) {
    // A booking request is already open: do not open another one.
    const ob = ctx.openBooking;
    if (booking.when && booking.when !== ob.requested_time) {
      const prob = slotProblem(full, data);
      const text = prob ? L.outsideHours(booking.when, prob.hours, emergencyNumber, ob.id, !ob.phone) : L.bookingUpdated(booking.when, ob.id);
      return { ...base, text, status: 'needs human', kind: 'booking_update', requested_time: booking.when + (prob ? ' (outside hours)' : ''), ticket_ref: ob.id };
    }
    return { ...base, text: L.bookingPending(ob.id) + (ob.phone ? '' : L.askContact()), status: 'needs human', kind: 'booking_pending', requested_time: ob.requested_time, ticket_ref: ob.id };
  }
  if (booking) {
    // A day or time outside the clinic's hours (or an emergencies-only day): still send the request, but say so.
    const prob = booking.when ? slotProblem(full, data) : null;
    if (prob) {
      const text = (symptom ? L.bookingSymptom() : '') + L.outsideHours(booking.when, prob.hours, emergencyNumber, null, !contact);
      return { ...base, text, status: 'needs human', kind: 'booking', requested_time: booking.when + ' (outside hours)', contact: contact || null };
    }
    const text = (symptom ? L.bookingSymptom() : '') + (contact ? (booking.when ? L.booking(booking.when) : L.bookingNoTime()) : L.bookingAsk(booking.when));
    return { ...base, text, status: 'needs human', kind: 'booking', requested_time: booking.when || 'not given', contact: contact || null };
  }
  // 4. pain and symptoms: no advice
  if (symptom) return { ...base, text: L.symptom(phone), status: 'answered', kind: 'no_advice' };

  // 5. greetings
  if (/^(hi+|hello+|hey+|helo|namaste|namaskar|good (morning|afternoon|evening|day))( there| doctor| team)?$/.test(n)) return { ...base, text: L.greet(clinic.name), status: 'answered', kind: 'greeting' };
  // Small talk: a message made only of polite words ("No thank you", "Ok thanks a lot", "bye").
  const small = smallTalk(raw);
  if (small) {
    // The chat has already said goodbye: stay quiet instead of chatting on.
    if (ctx.lastKind === 'bye') return { ...base, text: '', status: 'answered', kind: 'silent', silent: true };
    // Booking already sent with a name and number: "Ok" just gets a friendly reply.
    if (small === 'ack' && ctx.openBooking && ctx.openBooking.phone) return { ...base, text: L.thanks(), status: 'answered', kind: 'thanks' };
    if (small === 'ack' && ctx.openBooking) return { ...base, text: L.bookingPending(ctx.openBooking.id) + L.askContact(), status: 'needs human', kind: 'booking_pending', requested_time: ctx.openBooking.requested_time, ticket_ref: ctx.openBooking.id };
    // "Yes" right after "Shall I send a booking request?" means book it.
    if (small === 'ack' && ctx.lastKind === 'no_advice' && /\b(yes|yeah|yep|yup|sure|ok|okay|please|pls)\b/i.test(raw)) {
      return { ...base, text: L.bookingAsk(null), status: 'needs human', kind: 'booking', requested_time: 'not given' };
    }
    return { ...base, text: L[small](), status: 'answered', kind: small };
  }

  // 6. facts from the clinic data
  let m = null;
  try { m = match(full, data || {}, L); } catch (err) { m = null; }
  if (m) return { ...base, text: m.text, status: 'answered', kind: 'answer', facts: m.facts.filter(Boolean), topic: m.topic };

  // 7. not in the file
  return { ...base, text: L.notSure(), status: 'needs human', kind: 'not_sure' };
}

module.exports = { slotProblem, findContact, answer, norm, tokens, daysCovered, parseWhen };
