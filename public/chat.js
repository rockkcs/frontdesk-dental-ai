// Patient chat page. Plain JavaScript, no framework.
(function () {
  var log = document.getElementById('chat-log');
  var historyBox = document.getElementById('history');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var sendBtn = document.getElementById('chat-send');
  var params = new URLSearchParams(window.location.search);

  // ---- who is this patient? A random id kept in the browser. No login. ----
  function makeId() { return 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  var patient = params.get('patient');
  if (!patient) {
    try { patient = window.localStorage.getItem('fd_patient'); } catch (e) { patient = null; }
    if (!patient) {
      patient = makeId();
      try { window.localStorage.setItem('fd_patient', patient); } catch (e) { /* stays in memory */ }
    }
  }

  var lastId = 0;            // newest message id we have seen
  var myTickets = {};        // tickets made in this page view
  var shown = {};            // message ids already on screen
  var busy = false;

  function bubble(cls, text) {
    var el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  }
  function scrollDown() { log.scrollTop = log.scrollHeight; window.scrollTo(0, document.body.scrollHeight); }

  function addStaff(m, where) {
    if (shown[m.id]) return;
    shown[m.id] = true;
    var el = bubble('msg bot-msg staff-msg', m.text);
    var tag = document.createElement('small');
    tag.className = 'who';
    tag.textContent = 'Clinic staff';
    el.insertBefore(document.createTextNode(' '), el.firstChild);
    el.insertBefore(tag, el.firstChild);
    el.setAttribute('data-ticket-ref', m.ticket_id);
    where.appendChild(el);
  }

  // ---- ask a question ----
  function ask(q) {
    q = String(q || '').trim();
    if (!q || busy) return;
    busy = true;
    sendBtn.disabled = true;
    log.appendChild(bubble('msg user-msg', q));
    var typing = bubble('msg typing', 'Typing…');
    log.appendChild(typing);
    scrollDown();

    fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q, patient: patient }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        typing.remove();
        if (d && d.silent) return; // the chat already said goodbye
        if (!d || !d.reply) throw new Error((d && d.error) || 'No reply');
        var el = bubble('msg bot-msg', d.reply);
        el.setAttribute('data-status', d.status || '');
        if (d.ticket_id) { el.setAttribute('data-ticket-ref', d.ticket_id); myTickets[d.ticket_id] = true; }
        if (d.label) {
          var lab = document.createElement('small');
          lab.className = 'source-label';
          lab.textContent = d.label;
          el.appendChild(document.createTextNode(' '));
          el.appendChild(lab);
        }
        log.appendChild(el);
        if (d.last_message_id) lastId = Math.max(lastId, Number(d.last_message_id));
      })
      .catch(function () {
        typing.remove();
        log.appendChild(bubble('msg error-msg', 'Sorry, something went wrong on our side. Please try again, or call the clinic.'));
      })
      .then(function () {
        busy = false;
        sendBtn.disabled = false;
        scrollDown();
        if (!historyLoaded) loadHistory();
      });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value;
    input.value = '';
    ask(q);
    input.focus();
  });

  document.getElementById('quick-replies').addEventListener('click', function (e) {
    var b = e.target.closest('.quick-reply');
    if (b) ask(b.getAttribute('data-q'));
  });

  // ---- earlier messages go at the top, so the newest answer is always the last bot message ----
  var historyLoaded = false;
  function loadHistory() {
    historyLoaded = true;
    return fetch('/api/messages?patient=' + encodeURIComponent(patient) + '&after=0')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.messages || []).forEach(function (m) {
          lastId = Math.max(lastId, Number(m.id));
          if (myTickets[m.ticket_id] && m.sender !== 'staff') return; // already on screen
          if (m.sender === 'staff') {
            // a staff reply to a question asked in this page view belongs under it
            addStaff(m, myTickets[m.ticket_id] ? log : historyBox);
          } else if (!shown[m.id]) {
            shown[m.id] = true;
            historyBox.appendChild(bubble(m.sender === 'patient' ? 'msg user-msg' : 'msg bot-msg', m.text));
          }
        });
      })
      .catch(function () { /* history is a nice-to-have */ });
  }

  // ---- staff replies: check every 3 seconds ----
  function poll() {
    if (!historyLoaded) return;
    fetch('/api/messages?patient=' + encodeURIComponent(patient) + '&after=' + lastId)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var added = false;
        (d.messages || []).forEach(function (m) {
          lastId = Math.max(lastId, Number(m.id));
          if (m.sender === 'staff' && !shown[m.id]) { addStaff(m, log); added = true; }
        });
        if (added) scrollDown();
      })
      .catch(function () { /* try again next time */ });
  }
  setInterval(poll, 3000);

  // ---- clinic name in the header ----
  fetch('/api/clinic').then(function (r) { return r.json(); }).then(function (d) {
    var name = d && d.data && d.data.clinic && d.data.clinic.name;
    if (name) { document.getElementById('clinic-name').textContent = name; document.title = name + ' | Front Desk'; }
  }).catch(function () {});

  // ---- light and dark ----
  var toggle = document.getElementById('theme-toggle');
  function currentTheme() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paintToggle() { toggle.textContent = currentTheme() === 'dark' ? 'Light' : 'Dark'; }
  try { var saved = window.localStorage.getItem('fd_theme'); if (saved) document.documentElement.setAttribute('data-theme', saved); } catch (e) {}
  paintToggle();
  toggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { window.localStorage.setItem('fd_theme', next); } catch (e) {}
    paintToggle();
  });

  // ---- ?q=<question> asks once when the page opens ----
  var q = params.get('q');
  if (q && q.trim()) ask(q);
  else loadHistory();
})();
