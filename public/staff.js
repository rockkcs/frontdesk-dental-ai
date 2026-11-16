// Staff page: the ticket list, replies, closing, ageing and priority, and the clinic data editor.
(function () {
  var queue = document.getElementById('ticket-queue');
  var sortSel = document.getElementById('sort-by');
  var nodes = {};       // ticket id -> element
  var latest = [];
  var OVERDUE_MIN = 120; // the "2 working hours" promise

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function ageMinutes(t) { return Math.max(0, Math.floor((Date.now() - new Date(t.created_at).getTime()) / 60000)); }
  function ageText(min) {
    if (min < 1) return 'just now';
    if (min < 60) return min + ' min';
    if (min < 1440) return Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
    return Math.floor(min / 1440) + ' d ' + Math.floor((min % 1440) / 60) + ' h';
  }
  function priorityOf(t, min) {
    if (t.status === 'closed') return 'low';
    if (t.status === 'urgent') return 'high';
    if (t.status === 'needs human') return min >= OVERDUE_MIN ? 'high' : 'medium';
    return 'low';
  }
  var RANK = { urgent: 0, 'needs human': 1, answered: 2, closed: 3 };

  function build(t) {
    var a = el('article', 'ticket');
    a.setAttribute('data-ticket', t.id);

    var head = el('header', 'ticket-head');
    head.appendChild(el('span', 'badge status'));
    head.appendChild(el('span', 'badge prio'));
    head.appendChild(el('span', 'age'));
    head.appendChild(el('span', 'tid', '#' + t.id));
    a.appendChild(head);

    var q = el('p', 'line q'); q.appendChild(el('b', null, 'Patient: ')); q.appendChild(el('span', 'q-text', t.question)); a.appendChild(q);
    var b = el('p', 'line a'); b.appendChild(el('b', null, 'Bot: ')); b.appendChild(el('span', 'a-text', t.bot_reply)); a.appendChild(b);
    var c = el('p', 'line contact'); c.appendChild(el('b', null, 'Contact: ')); c.appendChild(el('span', 'contact-text'));
    a.appendChild(c);
    if (t.requested_time) {
      var bk = el('p', 'line booking'); bk.appendChild(el('b', null, 'Booking request for: ')); bk.appendChild(el('span', 'booking-time', t.requested_time));
      a.setAttribute('data-booking-time', t.requested_time);
      a.appendChild(bk);
    }
    a.appendChild(el('div', 'thread'));

    var ta = el('textarea');
    ta.id = 'staff-reply';
    ta.rows = 2;
    ta.placeholder = 'Type a reply to this patient';
    ta.setAttribute('aria-label', 'Reply to ticket ' + t.id);
    a.appendChild(ta);

    var row = el('div', 'row');
    var send = el('button', 'send', 'Send reply'); send.id = 'staff-send'; send.type = 'button';
    var close = el('button', 'ghost close-btn', 'Close ticket'); close.type = 'button';
    var link = el('a', 'chat-link', 'Open chat'); link.href = '/?patient=' + encodeURIComponent(t.patient_id); link.target = '_blank'; link.rel = 'noopener';
    row.appendChild(send); row.appendChild(close); row.appendChild(link);
    a.appendChild(row);
    a.appendChild(el('p', 'note sent-note'));
    return a;
  }

  function paint(a, t) {
    var min = ageMinutes(t);
    var prio = priorityOf(t, min);
    var overdue = t.status === 'needs human' && min >= OVERDUE_MIN;
    a.setAttribute('data-status', t.status);
    a.setAttribute('data-priority', prio);
    a.setAttribute('data-age-minutes', min);
    a.setAttribute('data-overdue', overdue ? 'true' : 'false');
    a.setAttribute('data-patient', t.patient_id);
    a.querySelector('.badge.status').textContent = t.status;
    a.querySelector('.badge.prio').textContent = 'Priority: ' + prio;
    a.querySelector('.age').textContent = (t.status === 'urgent' || t.status === 'needs human' ? 'Waiting ' : 'Raised ') + ageText(min) + (overdue ? ' · overdue' : '');
    a.querySelector('.close-btn').hidden = t.status === 'closed';
    var contact = [t.patient_name, t.patient_phone].filter(Boolean).join(' · ');
    a.querySelector('.contact').hidden = !contact;
    a.querySelector('.contact-text').textContent = contact;
    if (t.patient_phone) a.setAttribute('data-phone', t.patient_phone);
    var bt = a.querySelector('.booking-time');
    if (bt && t.requested_time) bt.textContent = t.requested_time;
    var thread = a.querySelector('.thread');
    (t.replies || []).forEach(function (r) {
      if (thread.querySelector('[data-reply="' + r.id + '"]')) return;
      var p = el('p', 'line staff-line'); p.setAttribute('data-reply', r.id);
      p.appendChild(el('b', null, 'Staff: ')); p.appendChild(el('span', null, r.text));
      thread.appendChild(p);
    });
  }

  function sorted(list) {
    var copy = list.slice();
    if (sortSel.value === 'priority') {
      copy.sort(function (x, y) { return (RANK[x.status] - RANK[y.status]) || (new Date(x.created_at) - new Date(y.created_at)); });
    } else {
      copy.sort(function (x, y) { return Number(y.id) - Number(x.id); });
    }
    return copy;
  }

  function render(list, forceOrder) {
    latest = list;
    var order = sorted(list);
    var typing = document.activeElement && document.activeElement.id === 'staff-reply';
    order.forEach(function (t) {
      if (!nodes[t.id]) nodes[t.id] = build(t);
      paint(nodes[t.id], t);
    });
    // Put the cards in order. Skip moving things while someone is typing a reply.
    var current = Array.prototype.map.call(queue.children, function (c) { return c.getAttribute('data-ticket'); }).join(',');
    var wanted = order.map(function (t) { return String(t.id); }).join(',');
    if (current !== wanted && (!typing || forceOrder || sortSel.value === 'newest')) {
      if (sortSel.value === 'newest' && !forceOrder) {
        // only new cards go in, at the top; nothing that exists is moved
        for (var i = order.length - 1; i >= 0; i--) {
          var n = nodes[order[i].id];
          if (n.parentNode !== queue) queue.insertBefore(n, queue.firstChild);
        }
      } else {
        order.forEach(function (t) { queue.appendChild(nodes[t.id]); });
      }
    }
    var c = { urgent: 0, 'needs human': 0, answered: 0, closed: 0 };
    list.forEach(function (t) { if (c[t.status] != null) c[t.status]++; });
    document.getElementById('counts').textContent = 'Urgent ' + c.urgent + ' · Needs human ' + c['needs human'] + ' · Answered ' + c.answered + ' · Closed ' + c.closed;
    document.getElementById('empty').hidden = list.length > 0;
  }

  function load(forceOrder) {
    return fetch('/api/tickets').then(function (r) { return r.json(); }).then(function (d) {
      var err = document.getElementById('load-error');
      if (d.error) { err.textContent = 'Could not load tickets: ' + d.error; err.hidden = false; }
      else err.hidden = true;
      var note = document.getElementById('store-note');
      if (d.shared_store === false) { note.textContent = 'Note: the shared store is not connected, so tickets are kept in memory only.'; note.hidden = false; }
      else note.hidden = true;
      render(d.tickets || [], forceOrder);
    }).catch(function () {
      var err = document.getElementById('load-error');
      err.textContent = 'Could not reach the server. Trying again.'; err.hidden = false;
    });
  }

  queue.addEventListener('click', function (e) {
    var card = e.target.closest('[data-ticket]');
    if (!card) return;
    var id = card.getAttribute('data-ticket');
    var note = card.querySelector('.sent-note');
    if (e.target.closest('#staff-send')) {
      var ta = card.querySelector('#staff-reply');
      var text = ta.value.trim();
      if (!text) { note.textContent = 'Please type a reply first.'; return; }
      var btn = card.querySelector('#staff-send');
      btn.disabled = true;
      fetch('/api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket_id: id, text: text }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) throw new Error(d.error);
          ta.value = '';
          note.textContent = 'Reply sent to the patient.';
          return load();
        })
        .catch(function (err) { note.textContent = 'Could not send: ' + err.message; })
        .then(function () { btn.disabled = false; });
    } else if (e.target.closest('.close-btn')) {
      fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, status: 'closed' }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.error) throw new Error(d.error); note.textContent = 'Ticket closed.'; return load(); })
        .catch(function (err) { note.textContent = 'Could not close: ' + err.message; });
    }
  });

  sortSel.addEventListener('change', function () { render(latest, true); });
  load(true);
  setInterval(load, 5000);

  // ---------- clinic data editor ----------
  var fields = document.getElementById('clinic-fields');
  var jsonBox = document.getElementById('clinic-json');
  var statusEl = document.getElementById('clinic-status');
  var clinicData = null;

  function label(path) {
    return path.map(function (p) { return typeof p === 'number' ? '#' + (p + 1) : String(p).replace(/_/g, ' '); }).join(' › ');
  }
  function walk(node, path, out) {
    if (Array.isArray(node)) {
      if (node.every(function (x) { return typeof x !== 'object' || x === null; })) out.push({ path: path, value: node.join(', '), list: true });
      else node.forEach(function (x, i) { walk(x, path.concat(i), out); });
    } else if (node && typeof node === 'object') {
      Object.keys(node).forEach(function (k) { walk(node[k], path.concat(k), out); });
    } else {
      out.push({ path: path, value: node == null ? '' : String(node), list: false });
    }
  }
  function setAt(obj, path, value) {
    var cur = obj;
    for (var i = 0; i < path.length - 1; i++) cur = cur[path[i]];
    cur[path[path.length - 1]] = value;
  }
  function drawEditor(data) {
    clinicData = data;
    fields.textContent = '';
    var leaves = [];
    walk(data, [], leaves);
    leaves.forEach(function (leaf, i) {
      var wrap = el('label', 'field');
      wrap.appendChild(el('span', 'field-name', label(leaf.path)));
      var inp = leaf.value.length > 60 ? el('textarea') : el('input');
      if (inp.tagName === 'TEXTAREA') inp.rows = 2; else inp.type = 'text';
      inp.value = leaf.value;
      inp.setAttribute('data-path', JSON.stringify(leaf.path));
      inp.setAttribute('data-list', leaf.list ? '1' : '0');
      inp.name = 'f' + i;
      wrap.appendChild(inp);
      fields.appendChild(wrap);
    });
    jsonBox.value = JSON.stringify(data, null, 2);
    var name = data && data.clinic && data.clinic.name;
    if (name) document.getElementById('clinic-name').textContent = name + ' · Staff desk';
  }
  function save(data) {
    statusEl.textContent = 'Saving…';
    return fetch('/api/clinic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: data }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        drawEditor(d.data);
        statusEl.textContent = 'Saved. The bot now answers from the new data.';
      })
      .catch(function (err) { statusEl.textContent = 'Could not save: ' + err.message; });
  }
  document.getElementById('clinic-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!clinicData) return;
    var copy = JSON.parse(JSON.stringify(clinicData));
    Array.prototype.forEach.call(fields.querySelectorAll('[data-path]'), function (inp) {
      var path = JSON.parse(inp.getAttribute('data-path'));
      var v = inp.value;
      setAt(copy, path, inp.getAttribute('data-list') === '1' ? v.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : v);
    });
    save(copy);
  });
  document.getElementById('clinic-save-json').addEventListener('click', function () {
    var parsed;
    try { parsed = JSON.parse(jsonBox.value); } catch (err) { statusEl.textContent = 'The text is not valid JSON: ' + err.message; return; }
    save(parsed);
  });
  fetch('/api/clinic').then(function (r) { return r.json(); }).then(function (d) { if (d.data) drawEditor(d.data); }).catch(function () {});

  // ---------- light and dark ----------
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
})();
