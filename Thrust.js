
/* ====== JavaScript: Data, Router, Calendar, RSVP, Forum (localStorage) ====== */

// ---- Utilities ----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmtDate = (iso) => new Date(iso).toLocaleString();
const uid = () => Math.random().toString(36).slice(2, 10);

// ---- Storage Keys ----
const LS_KEYS = {
    EVENTS: 'ta.events',
    RSVPS: 'ta.rsvps',
    PROFILE: 'ta.profile',
    THREADS: 'ta.threads',
    ADMIN: 'ta.admin',
};

// ---- Demo seed data ----
const seedEvents = [
    { id: uid(), subject: 'Mathematics – Calculus Basics', tutor: 'Ms. Govender', venue: 'Room A1', start: '2025-09-10T14:00', end: '2025-09-10T16:00', price: 80, desc: 'Limits, derivatives, intro to integrals.' },
    { id: uid(), subject: 'Physics – Mechanics', tutor: 'Dr. Dlamini', venue: 'Lab 3', start: '2025-09-12T11:00', end: '2025-09-12T13:00', price: 100, desc: 'Forces, motion, energy conservation.' },
    { id: uid(), subject: 'Computer Science – Data Structures', tutor: 'Mr. Mokoena', venue: 'Online (Teams)', start: '2025-09-15T10:00', end: '2025-09-15T12:00', price: 0, desc: 'Arrays, stacks, queues, complexity.' },
];

function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// Initialize storage if empty
if (!load(LS_KEYS.EVENTS)) save(LS_KEYS.EVENTS, seedEvents);
if (!load(LS_KEYS.RSVPS)) save(LS_KEYS.RSVPS, []);
if (!load(LS_KEYS.THREADS)) save(LS_KEYS.THREADS, []);

// ---- Router (simple hash router) ----
const sections = {
    events: $('#view-events'),
    calendar: $('#view-calendar'),
    discussions: $('#view-discussions'),
    profile: $('#view-profile'),
    admin: $('#view-admin'),
};

function setActiveRoute(route) {
    Object.values(sections).forEach(s => s.classList.add('hide'));
    (sections[route] || sections.events).classList.remove('hide');
    $$('.route-link').forEach(a => a.classList.toggle('active', a.dataset.route === route));
    if (route === 'calendar') renderCalendar();
    if (route === 'events') renderEvents();
    if (route === 'discussions') renderThreads();
    if (route === 'profile') renderProfile();
    if (route === 'admin') renderAdminEvents();
}

window.addEventListener('hashchange', () => setActiveRoute(location.hash.replace('#', '') || 'events'));
// Initial route
setActiveRoute(location.hash.replace('#', '') || 'events');

// Nav link clicks
$$('.route-link').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault(); location.hash = a.dataset.route;
}));

// Tabs toggle between list/calendar
$('#tab-list').addEventListener('click', () => { location.hash = 'events'; });
$('#tab-calendar').addEventListener('click', () => { location.hash = 'calendar'; });
$('#tab-list-2').addEventListener('click', () => { location.hash = 'events'; });
$('#tab-calendar-2').addEventListener('click', () => { location.hash = 'calendar'; });

// ---- Events List + Filters ----
function renderEvents() {
    const container = $('#eventsContainer');
    const events = load(LS_KEYS.EVENTS, []);
    // Filters
    const q = $('#searchInput').value.toLowerCase();
    const subjectFilter = $('#filterSubject').value;
    const from = $('#dateFrom').value ? new Date($('#dateFrom').value) : null;
    const to = $('#dateTo').value ? new Date($('#dateTo').value) : null;

    const filtered = events.filter(ev => {
        const text = `${ev.subject} ${ev.venue} ${ev.tutor}`.toLowerCase();
        const passQ = !q || text.includes(q);
        const passSubj = !subjectFilter || ev.subject.toLowerCase().includes(subjectFilter.toLowerCase());
        const start = new Date(ev.start);
        const passFrom = !from || start >= from;
        const passTo = !to || start <= new Date(to.getTime() + 86399000);
        return passQ && passSubj && passFrom && passTo;
    });

    container.innerHTML = '';
    if (!filtered.length) {
        container.innerHTML = `<div class="muted">No events found. Try clearing filters.</div>`;
        return;
    }

    filtered.sort((a, b) => new Date(a.start) - new Date(b.start))
        .forEach(ev => {
            const div = document.createElement('div');
            div.className = 'event';
            div.innerHTML = `
            <div class="pill">${ev.subject.split('–')[0].trim()}</div>
            <h4>${ev.subject}</h4>
            <div class="muted">Tutor: ${ev.tutor}</div>
            <div class="muted">Venue: ${ev.venue}</div>
            <div class="muted">${fmtDate(ev.start)} – ${fmtDate(ev.end)}</div>
            <div class="muted">${ev.price ? 'R' + ev.price : 'Free'}</div>
            <div style="display:flex; gap:8px; margin-top:6px;">
              <button class="btn btn-primary" data-action="rsvp" data-id="${ev.id}">RSVP</button>
              <button class="btn btn-outline" data-action="details" data-id="${ev.id}">Details</button>
            </div>
          `;
            container.appendChild(div);
        });

    // Delegated clicks
    container.onclick = (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.action === 'rsvp') openRsvp(id);
        if (btn.dataset.action === 'details') showDetails(id);
    };
}

['searchInput', 'filterSubject', 'dateFrom', 'dateTo'].forEach(id => {
    const el = document.getElementById(id);
    el && el.addEventListener('input', renderEvents);
});
$('#clearFilters').addEventListener('click', () => {
    $('#searchInput').value = ''; $('#filterSubject').value = ''; $('#dateFrom').value = ''; $('#dateTo').value = ''; renderEvents();
});

function showDetails(id) {
    const ev = load(LS_KEYS.EVENTS, []).find(x => x.id === id); if (!ev) return;
    alert(`${ev.subject}\nTutor: ${ev.tutor}\nVenue: ${ev.venue}\nTime: ${fmtDate(ev.start)} – ${fmtDate(ev.end)}\nPrice: ${ev.price ? 'R' + ev.price : 'Free'}\n\n${ev.desc || ''}`);
}

// ---- Calendar ----
let calendarInstance = null;
function renderCalendar() {
    const el = document.getElementById('calendar');
    const events = load(LS_KEYS.EVENTS, []).map(ev => ({
        id: ev.id,
        title: ev.subject,
        start: ev.start,
        end: ev.end
    }));
    if (calendarInstance) { calendarInstance.destroy(); }
    calendarInstance = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
        events,
        eventClick: function (info) {
            info.jsEvent.preventDefault();
            openRsvp(info.event.id);
        }
    });
    calendarInstance.render();
}

// ---- RSVP Modal + Validation ----
function openRsvp(eventId) {
    const ev = load(LS_KEYS.EVENTS, []).find(x => x.id === eventId); if (!ev) return;
    $('#rsvpEventId').value = ev.id;
    $('#rsvpTitle').textContent = `RSVP • ${ev.subject}`;
    $('#rsvpDesc').textContent = `${ev.venue} • ${fmtDate(ev.start)} – ${fmtDate(ev.end)} • ${ev.price ? 'R' + ev.price : 'Free'}`;
    const profile = load(LS_KEYS.PROFILE, {});
    $('#rsvpName').value = profile.name || '';
    $('#rsvpEmail').value = profile.email || '';
    $('#rsvpSeats').value = '1';
    $('#rsvpPayment').value = 'cash';
    $('#rsvpMsg').textContent = '';

    //Hide identity fields if profile is saved
    if (profile.name && profile.email) {
        $('#rsvpIdentityFields').style.display = 'none';
    } else {
        $('#rsvpIdentityFields').style.display = 'flex';
    }

    $('#rsvpBackdrop').style.display = 'flex';
}

$('#closeRsvp').addEventListener('click', () => $('#rsvpBackdrop').style.display = 'none');
$('#rsvpBackdrop').addEventListener('click', (e) => { if (e.target.id === 'rsvpBackdrop') $('#rsvpBackdrop').style.display = 'none'; });

// Show/hide card box when payment method changes
$('#rsvpPayment').addEventListener('change', (e) => {
    if (e.target.value === 'card') {
        $('#cardPaymentBox').style.display = 'block';
    } else {
        $('#cardPaymentBox').style.display = 'none';
    }
});

$('#rsvpForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const profile = load(LS_KEYS.PROFILE, {});
    let name = $('#rsvpName').value.trim();
    let email = $('#rsvpEmail').value.trim();

    // ✅ If profile exists, use it
    if (profile.name && profile.email) {
        name = profile.name;
        email = profile.email;
    }

    const seats = ($('#rsvpSeats').value || '1').trim();
    const payment = $('#rsvpPayment').value;

    // Basic validation (only if no saved profile)
    if (!name || !email) {
        $('#rsvpMsg').textContent = 'Name and email are required.';
        return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        $('#rsvpMsg').textContent = 'Please enter a valid email.';
        return;
    }
    if (!/^\d+$/.test(seats) || parseInt(seats, 10) < 1) {
        $('#rsvpMsg').textContent = 'Seats must be a positive number.';
        return;
    }

    const eventId = $('#rsvpEventId').value;
    const rsvps = load(LS_KEYS.RSVPS, []);
    rsvps.push({ id: uid(), eventId, name, email, seats: parseInt(seats, 10), payment, ts: new Date().toISOString() });
    save(LS_KEYS.RSVPS, rsvps);

    $('#rsvpMsg').style.color = 'var(--success)';
    $('#rsvpMsg').textContent = 'RSVP confirmed! A confirmation has been recorded.';

    // Save profile only if it was entered here
    if (!profile.name || !profile.email) {
        save(LS_KEYS.PROFILE, { name, email });
    }

    setTimeout(() => {
        $('#rsvpBackdrop').style.display = 'none';
        renderProfile();
    }, 800);
});

function renderProfile() {
    const p = load(LS_KEYS.PROFILE, {});
    $('#profileName').value = p.name || '';
    $('#profileEmail').value = p.email || '';

    const rsvps = load(LS_KEYS.RSVPS, []);
    const events = load(LS_KEYS.EVENTS, []);
    const mine = p.email ? rsvps.filter(r => r.email === p.email) : [];
    const container = $('#myRsvps');
    container.innerHTML = '';

    if (!mine.length) {
        container.innerHTML = '<div class="muted">No RSVPs yet.</div>';
        return;
    }

    mine.forEach(r => {
        const ev = events.find(e => e.id === r.eventId);
        if (!ev) return;
        const card = document.createElement('div');
        card.className = 'event';
        card.innerHTML = `
      <h4>${ev.subject}</h4>
      <div class="muted">${fmtDate(ev.start)} – ${fmtDate(ev.end)} • ${ev.venue}</div>
      <div class="muted">Payment: ${r.payment} • Seats: ${r.seats}</div>
      <div class="muted">RSVP Date: ${fmtDate(r.ts)}</div>
    `;
        container.appendChild(card);
    });
}

// ✅ Save Profile only (no email)
$('#saveProfile').addEventListener('click', () => {
    const name = $('#profileName').value.trim();
    const email = $('#profileEmail').value.trim();

    if (!name || !email) {
        $('#profileSavedMsg').style.color = 'red';
        $('#profileSavedMsg').textContent = '⚠️ Please fill out your name and email.';
        return;
    }

    save(LS_KEYS.PROFILE, { name, email });

    $('#profileSavedMsg').style.color = 'green';
    $('#profileSavedMsg').textContent = '✅ Profile saved successfully!';
    renderProfile();
});
// ---- Admin Mode ----
function isAdminMode() {
    return load(LS_KEYS.ADMIN, { on: false }).on;
}
function setAdminMode(on) {
    save(LS_KEYS.ADMIN, { on });
    $('#adminModeStatus').textContent = `Admin: ${on ? 'ON' : 'OFF'}`;
    renderAdminEvents();
    renderThreads();
}

$('#togglePassword').addEventListener('click', () => {
    const input = $('#adminPassword');
    if (input.type === "password") {
        input.type = "text";
        $('#togglePassword').textContent = "🙈"; // change icon
    } else {
        input.type = "password";
        $('#togglePassword').textContent = "👁"; // change back
    }
});


$('#toggleAdminMode').addEventListener('click', () => {
    const pass = $('#adminPassword').value.trim();

    if (pass === "Admin75") {
        setAdminMode(true);
        alert("Admin mode activated ✅");
    } else {
        setAdminMode(false);
        alert("Invalid Admin code, please try again ❌");
    }
});

function renderAdminEvents() {
    const cont = $('#adminEvents'); cont.innerHTML = '';
    const events = load(LS_KEYS.EVENTS, []);
    events.sort((a, b) => new Date(a.start) - new Date(b.start)).forEach(ev => {
        const div = document.createElement('div'); div.className = 'event';
        div.innerHTML = `
          <h4>${ev.subject}</h4>
          <div class="muted">${ev.venue} • ${fmtDate(ev.start)} – ${fmtDate(ev.end)}</div>
          <div class="muted">Tutor: ${ev.tutor} • ${ev.price ? 'R' + ev.price : 'Free'}</div>
          <div style="display:flex; gap:8px; margin-top:6px;">
            <button class="btn btn-outline" data-action="edit" data-id="${ev.id}">Edit</button>
            <button class="btn btn-danger" data-action="delete" data-id="${ev.id}" ${isAdminMode() ? '' : 'disabled'}>Delete</button>
          </div>
        `;
        cont.appendChild(div);
    });

    cont.onclick = (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        const id = btn.dataset.id; const action = btn.dataset.action;
        const events = load(LS_KEYS.EVENTS, []);
        const current = events.find(x => x.id === id);
        if (action === 'edit') {
            if (!current) return;
            $('#eventId').value = current.id;
            $('#evSubject').value = current.subject;
            $('#evTutor').value = current.tutor;
            $('#evVenue').value = current.venue;
            $('#evStart').value = current.start;
            $('#evEnd').value = current.end;
            $('#evPrice').value = current.price || '';
            $('#evDesc').value = current.desc || '';
            location.hash = 'admin';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (action === 'delete') {
            if (!isAdminMode()) { alert('Admin mode is OFF. Enter password and toggle ON.'); return; }
            if (!confirm('Delete this event?')) return;
            const remaining = events.filter(x => x.id !== id);
            save(LS_KEYS.EVENTS, remaining);
            renderAdminEvents(); renderEvents(); renderCalendar();
        }
    };
}

$('#eventForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!isAdminMode()) { alert('Admin mode is OFF. Enter password and toggle ON.'); return; }
    const data = {
        id: $('#eventId').value || uid(),
        subject: $('#evSubject').value.trim(),
        tutor: $('#evTutor').value.trim(),
        venue: $('#evVenue').value.trim(),
        start: $('#evStart').value,
        end: $('#evEnd').value,
        price: parseFloat($('#evPrice').value) || 0,
        desc: $('#evDesc').value.trim(),
    };
    if (!data.subject || !data.tutor || !data.venue || !data.start || !data.end) { alert('Please fill all required fields.'); return; }
    const events = load(LS_KEYS.EVENTS, []);
    const idx = events.findIndex(x => x.id === data.id);
    if (idx >= 0) events[idx] = data; else events.push(data);
    save(LS_KEYS.EVENTS, events);
    // Reset form
    $('#eventForm').reset(); $('#eventId').value = '';
    renderAdminEvents(); renderEvents(); renderCalendar();
    alert('Event saved');
});
$('#cancelEdit').addEventListener('click', () => { $('#eventForm').reset(); $('#eventId').value = ''; });

// ---- Discussions (Threads + Replies + Media) ----
async function filesToDataUrls(files) {
    const tasks = Array.from(files).map(file => new Promise(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result }); reader.readAsDataURL(file);
    }));
    return Promise.all(tasks);
}
$('#newThreadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('#threadTitle').value.trim();
    const author = $('#threadAuthor').value.trim();
    const body = $('#threadBody').value.trim();
    const isQA = $('#moderationFlag').checked;
    if (!title || !author || !body) return;
    const attachments = await filesToDataUrls($('#threadFiles').files);
    const threads = load(LS_KEYS.THREADS, []);
    threads.unshift({ id: uid(), title, author, body, isQA, ts: new Date().toISOString(), attachments, replies: [] });
    save(LS_KEYS.THREADS, threads);
    $('#newThreadForm').reset();
    renderThreads();
});

function renderThreads() {
    const container = $('#threadsContainer'); container.innerHTML = '';
    const threads = load(LS_KEYS.THREADS, []);
    if (!threads.length) { container.innerHTML = '<div class="muted">No threads yet. Start the conversation!</div>'; return; }

    threads.forEach(t => {
        const el = document.createElement('div');
        el.className = 'thread' + (t.isQA ? ' qa-thread' : '');
        el.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div class="thread-title">${t.title}</div>
            <div class="muted">by ${t.author} • ${new Date(t.ts).toLocaleString()} ${t.isQA ? '• Q&A' : ''}</div>
          </div>
          <div>${t.body}</div>
          <div class="attachments">${(t.attachments || []).map(att => {
            if (att.type.startsWith('image/')) {
                return `<img alt="${att.name}" src="${att.data}" />`;
            } else if (att.type.startsWith('video/')) {
                return `<video src="${att.data}" controls></video>`;
            } else {
                // For documents (pdf, word, etc.)
                return `<a href="${att.data}" download="${att.name}" class="doc-link">📄 ${att.name}</a>`;
            }
        }).join('')
            }</div>
          <div id="replies-${t.id}">
            ${(t.replies || []).map(r => `
              <div class="reply">
                <strong>${r.author}</strong> <span class="muted">• ${new Date(r.ts).toLocaleString()}</span>
                <div>${r.body}</div>
              </div>
            `).join('')}
          </div>
          <form data-reply-form="${t.id}" style="display:flex; gap:8px; margin-top:6px;">
            <input type="text" placeholder="Your name" required style="flex:0 0 160px;" />
            <input type="text" placeholder="Write a reply..." required style="flex:1;" />
            <button class="btn btn-outline" type="submit">Reply</button>
            <button class="btn btn-danger" type="button" data-delete-thread="${t.id}" ${isAdminMode() ? '' : 'disabled'}>Delete</button>
          </form>
        `;
        container.appendChild(el);
    });


    // Reply handlers (delegation)
    container.addEventListener('submit', (e) => {
        const form = e.target.closest('form[data-reply-form]');
        if (!form) return;
        e.preventDefault();
        const threadId = form.getAttribute('data-reply-form');
        const [nameInput, bodyInput] = form.querySelectorAll('input');
        const name = nameInput.value.trim();
        const body = bodyInput.value.trim();
        if (!name || !body) return;
        const threads = load(LS_KEYS.THREADS, []);
        const t = threads.find(x => x.id === threadId); if (!t) return;
        t.replies.push({ author: name, body, ts: new Date().toISOString() });
        save(LS_KEYS.THREADS, threads);
        renderThreads();
    });

    // Delete thread (admin)
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-thread]'); if (!btn) return;
        if (!isAdminMode()) { alert('Admin mode is OFF. Enter password and toggle ON.'); return; }
        if (!confirm('Delete this thread?')) return;
        const id = btn.getAttribute('data-delete-thread');
        const threads = load(LS_KEYS.THREADS, []);
        save(LS_KEYS.THREADS, threads.filter(t => t.id !== id));
        renderThreads();
    });
}

// Initial renders
renderEvents();
