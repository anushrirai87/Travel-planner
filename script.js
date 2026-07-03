'use strict';

/* ==========================================================================
   Wayfarer — AI Travel Planner
   Vanilla JS. No frameworks. LocalStorage persistence. Groq API only.
   ========================================================================== */

/* ---------- Constants ---------- */
const LS_KEYS = {
  apiKey: 'wayfarer_groq_api_key',
  theme: 'wayfarer_theme',
  trips: 'wayfarer_saved_trips',
  history: 'wayfarer_history'
};
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const INTERESTS = [
  'Beaches', 'Mountains', 'Museums', 'Nature', 'Shopping', 'Nightlife',
  'Food', 'Adventure', 'Wildlife', 'Photography', 'History', 'Temples',
  'Festivals', 'Trekking'
];

/* ---------- State ---------- */
let selectedInterests = new Set();
let currentPlanMarkdown = '';
let currentPlanMeta = null;

/* ---------- Utility: storage ---------- */
function getJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function setJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}
function uid() {
  return 'trip_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/* ==========================================================================
   Toasts
   ========================================================================== */
const toastStack = document.getElementById('toastStack');
const ICONS = {
  success: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 10.3l2.3 2.3 4.7-5.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4.5M10 13.5v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M10 9v4.5M10 6.5v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};
function toast(message, type = 'info', duration = 3800) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${ICONS[type] || ICONS.info}<span>${escapeHTML(message)}</span>`;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, duration);
}
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ==========================================================================
   Theme (dark / light)
   ========================================================================== */
function initTheme() {
  const saved = localStorage.getItem(LS_KEYS.theme);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(LS_KEYS.theme, next);
});
initTheme();

/* ==========================================================================
   Navbar: scroll progress, mobile menu, active link
   ========================================================================== */
const scrollProgress = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
  const h = document.documentElement;
  const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
  scrollProgress.style.width = (isFinite(scrolled) ? scrolled : 0) + '%';

  document.getElementById('scrollTopBtn').style.opacity = h.scrollTop > 400 ? '1' : '0.4';
}, { passive: true });

const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  const isOpen = mobileMenu.classList.toggle('open');
  hamburger.setAttribute('aria-expanded', String(isOpen));
});
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobileMenu.classList.remove('open');
}));

document.getElementById('scrollTopBtn').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ==========================================================================
   Hero CTAs
   ========================================================================== */
document.getElementById('startPlanningBtn').addEventListener('click', () => {
  document.getElementById('planner').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => document.getElementById('destination').focus(), 500);
});
document.getElementById('navCta').addEventListener('click', () => {
  document.getElementById('planner').scrollIntoView({ behavior: 'smooth' });
});
document.getElementById('viewTripsBtn').addEventListener('click', () => {
  document.getElementById('trips').scrollIntoView({ behavior: 'smooth' });
});

/* Live ticket preview */
const ticketDest = document.getElementById('ticketDest');
const ticketDays = document.getElementById('ticketDays');
const ticketStyle = document.getElementById('ticketStyle');
const ticketBudget = document.getElementById('ticketBudget');
function updateTicketPreview() {
  const dest = document.getElementById('destination').value.trim();
  const days = document.getElementById('days').value;
  const style = document.getElementById('travelStyle').value;
  const budget = document.getElementById('budget').value;
  const currency = document.getElementById('currency').value;
  ticketDest.textContent = dest ? dest.slice(0, 3).toUpperCase() : '???';
  ticketDays.textContent = days ? `${days} days` : '— days';
  ticketStyle.textContent = style || '—';
  ticketBudget.textContent = budget ? `${currency} ${Number(budget).toLocaleString()}` : '—';
}
['destination', 'days', 'travelStyle', 'budget', 'currency'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateTicketPreview);
  document.getElementById(id).addEventListener('change', updateTicketPreview);
});
updateTicketPreview();

/* ==========================================================================
   Interest chips
   ========================================================================== */
const interestChips = document.getElementById('interestChips');
INTERESTS.forEach(label => {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = label;
  chip.addEventListener('click', () => {
    if (selectedInterests.has(label)) {
      selectedInterests.delete(label);
      chip.classList.remove('selected');
    } else {
      selectedInterests.add(label);
      chip.classList.add('selected');
    }
  });
  interestChips.appendChild(chip);
});

/* ==========================================================================
   Word counter
   ========================================================================== */
const notes = document.getElementById('notes');
const wordCounter = document.getElementById('wordCounter');
notes.addEventListener('input', () => {
  const words = notes.value.trim().split(/\s+/).filter(Boolean).length;
  wordCounter.textContent = `${words} word${words === 1 ? '' : 's'}`;
});

/* ==========================================================================
   Settings modal / API key management
   ========================================================================== */
const settingsBackdrop = document.getElementById('settingsBackdrop');
const apiKeyInput = document.getElementById('apiKeyInput');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const apiHint = document.getElementById('apiHint');

function openSettings() {
  settingsBackdrop.classList.add('open');
  apiKeyInput.value = localStorage.getItem(LS_KEYS.apiKey) || '';
  refreshApiStatus();
}
function closeSettings() { settingsBackdrop.classList.remove('open'); }

document.getElementById('settingsLink').addEventListener('click', (e) => { e.preventDefault(); openSettings(); });
document.getElementById('settingsLinkMobile').addEventListener('click', (e) => { e.preventDefault(); mobileMenu.classList.remove('open'); openSettings(); });
document.getElementById('closeSettings').addEventListener('click', closeSettings);
settingsBackdrop.addEventListener('click', (e) => { if (e.target === settingsBackdrop) closeSettings(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });

document.getElementById('toggleKeyVisibility').addEventListener('click', () => {
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

function refreshApiStatus() {
  const key = localStorage.getItem(LS_KEYS.apiKey);
  if (!key) {
    statusDot.className = 'status-dot';
    statusText.textContent = 'No API key saved';
    apiHint.classList.remove('ok');
    apiHint.querySelector('span').textContent = 'Add your Groq API key in Settings before generating a plan.';
  } else {
    statusDot.className = 'status-dot ok';
    statusText.textContent = 'API key saved (untested)';
    apiHint.classList.add('ok');
    apiHint.querySelector('span').textContent = 'Groq API key is set. You\u2019re ready to generate a plan.';
  }
}

document.getElementById('saveKeyBtn').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) { toast('Enter an API key first.', 'error'); return; }
  localStorage.setItem(LS_KEYS.apiKey, key);
  refreshApiStatus();
  toast('API key saved to this browser.', 'success');
});
document.getElementById('removeKeyBtn').addEventListener('click', () => {
  localStorage.removeItem(LS_KEYS.apiKey);
  apiKeyInput.value = '';
  refreshApiStatus();
  toast('API key removed.', 'info');
});
document.getElementById('testKeyBtn').addEventListener('click', async () => {
  const key = (apiKeyInput.value || localStorage.getItem(LS_KEYS.apiKey) || '').trim();
  if (!key) { toast('Enter an API key first.', 'error'); return; }
  statusDot.className = 'status-dot pending';
  statusText.textContent = 'Testing connection…';
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        max_tokens: 5
      })
    });
    if (res.ok) {
      statusDot.className = 'status-dot ok';
      statusText.textContent = 'Connected — API key is valid';
      toast('Connection successful.', 'success');
    } else {
      const errText = await safeErrorMessage(res);
      statusDot.className = 'status-dot bad';
      statusText.textContent = 'Connection failed: ' + errText;
      toast('Could not connect: ' + errText, 'error');
    }
  } catch (e) {
    statusDot.className = 'status-dot bad';
    statusText.textContent = 'Network error while testing connection';
    toast('Network error. Check your connection.', 'error');
  }
});
refreshApiStatus();

async function safeErrorMessage(res) {
  try {
    const data = await res.json();
    return data?.error?.message || `HTTP ${res.status}`;
  } catch (e) {
    return `HTTP ${res.status}`;
  }
}

/* ==========================================================================
   Form validation
   ========================================================================== */
function validateForm() {
  let valid = true;
  const destField = document.getElementById('destination').closest('.field');
  const daysField = document.getElementById('days').closest('.field');

  const dest = document.getElementById('destination').value.trim();
  const days = Number(document.getElementById('days').value);

  if (!dest) { destField.classList.add('invalid'); valid = false; } else destField.classList.remove('invalid');
  if (!days || days < 1 || days > 60) { daysField.classList.add('invalid'); valid = false; } else daysField.classList.remove('invalid');

  return valid;
}

/* ==========================================================================
   Prompt construction
   ========================================================================== */
function buildPrompt(data) {
  return `You are an expert travel planner. Based on the user's preferences, generate a complete travel plan in Markdown format.

User preferences:
- Destination: ${data.destination}
- Starting location: ${data.startLocation || 'Not specified'}
- Duration: ${data.days} days
- Travelers: ${data.travelers}
- Budget: ${data.budget ? `${data.currency} ${data.budget}` : 'Not specified'}
- Travel style: ${data.travelStyle}
- Transportation preference: ${data.transportation}
- Accommodation preference: ${data.accommodation}
- Interests: ${data.interests.length ? data.interests.join(', ') : 'General sightseeing'}
- Food preference: ${data.foodPreference}
- Additional notes: ${data.notes || 'None'}

Include the following sections, in this order, each as a Markdown heading (##):
1. Overview
2. Best Time to Visit
3. Weather
4. Estimated Budget
5. Daily Itinerary (a clear day-by-day breakdown for all ${data.days} days)
6. Top Attractions
7. Hotel Recommendations
8. Restaurant Suggestions
9. Famous Local Food
10. Transportation Tips
11. Shopping Recommendations
12. Safety Precautions
13. Packing Checklist
14. Emergency Contacts
15. Useful Local Phrases
16. Money-Saving Tips
17. Travel Summary

Use tables where useful (e.g. budget breakdown, daily itinerary). Keep the tone friendly and practical. Return only well-formatted Markdown, with no preamble before the first heading.`;
}

/* ==========================================================================
   Loading overlay
   ========================================================================== */
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingBarFill = document.getElementById('loadingBarFill');
const loadingText = document.getElementById('loadingText');
const loadingSubtext = document.getElementById('loadingSubtext');
const LOADING_MESSAGES = [
  'Planning your dream vacation…',
  'Consulting local guides…',
  'Mapping the best routes…',
  'Checking the weather ahead…',
  'Finding hidden local favorites…',
  'Packing your itinerary with detail…'
];
let loadingInterval, loadingMsgInterval, loadingProgress;

function startLoading() {
  loadingOverlay.classList.add('active');
  loadingProgress = 0;
  loadingBarFill.style.width = '0%';
  let msgIndex = 0;
  loadingText.textContent = LOADING_MESSAGES[0];
  loadingSubtext.textContent = 'This usually takes 15–30 seconds.';

  loadingInterval = setInterval(() => {
    loadingProgress = Math.min(loadingProgress + Math.random() * 9, 92);
    loadingBarFill.style.width = loadingProgress + '%';
  }, 350);

  loadingMsgInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % LOADING_MESSAGES.length;
    loadingText.textContent = LOADING_MESSAGES[msgIndex];
  }, 1800);
}
function stopLoading(success = true) {
  clearInterval(loadingInterval);
  clearInterval(loadingMsgInterval);
  loadingBarFill.style.width = '100%';
  setTimeout(() => {
    loadingOverlay.classList.remove('active');
  }, success ? 250 : 0);
}

/* ==========================================================================
   Generate plan (form submit)
   ========================================================================== */
const plannerForm = document.getElementById('plannerForm');
const generateBtn = document.getElementById('generateBtn');
const outputSection = document.getElementById('outputSection');
const outputBody = document.getElementById('outputBody');
const outputTitle = document.getElementById('outputTitle');

plannerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) {
    toast('Please fix the highlighted fields.', 'error');
    return;
  }
  const apiKey = localStorage.getItem(LS_KEYS.apiKey);
  if (!apiKey) {
    toast('Add your Groq API key in Settings first.', 'error');
    openSettings();
    return;
  }

  const data = {
    destination: document.getElementById('destination').value.trim(),
    startLocation: document.getElementById('startLocation').value.trim(),
    days: document.getElementById('days').value,
    travelers: document.getElementById('travelers').value,
    budget: document.getElementById('budget').value,
    currency: document.getElementById('currency').value,
    travelStyle: document.getElementById('travelStyle').value,
    transportation: document.getElementById('transportation').value,
    accommodation: document.getElementById('accommodation').value,
    interests: Array.from(selectedInterests),
    foodPreference: document.getElementById('foodPreference').value,
    notes: document.getElementById('notes').value.trim()
  };

  await generatePlan(data, apiKey);
});

document.getElementById('actRegenerate').addEventListener('click', () => {
  if (!currentPlanMeta) return;
  const apiKey = localStorage.getItem(LS_KEYS.apiKey);
  if (!apiKey) { toast('Add your Groq API key in Settings first.', 'error'); openSettings(); return; }
  generatePlan(currentPlanMeta, apiKey);
});

async function generatePlan(data, apiKey) {
  generateBtn.disabled = true;
  startLoading();

  try {
    const prompt = buildPrompt(data);
    const res = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: 'You are an expert, detail-oriented travel planner who writes clean, well-structured Markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (!res.ok) {
      const msg = await safeErrorMessage(res);
      throw new Error(msg);
    }

    const json = await res.json();
    const markdown = json?.choices?.[0]?.message?.content?.trim();
    if (!markdown) throw new Error('Empty response from Groq API.');

    currentPlanMarkdown = markdown;
    currentPlanMeta = data;

    renderPlan(markdown, data);
    saveToHistory(data, markdown);
    stopLoading(true);

    outputSection.hidden = false;
    setTimeout(() => outputSection.scrollIntoView({ behavior: 'smooth' }), 300);
    toast('Your itinerary is ready!', 'success');

  } catch (err) {
    stopLoading(false);
    const message = err.message || 'Something went wrong.';
    if (message.toLowerCase().includes('fetch')) {
      toast('Network error — check your internet connection.', 'error');
    } else {
      toast('API error: ' + message, 'error');
    }
  } finally {
    generateBtn.disabled = false;
  }
}

function renderPlan(markdown, data) {
  outputTitle.textContent = `Your ${data.days}-day trip to ${data.destination}`;
  if (window.marked) {
    outputBody.innerHTML = marked.parse(markdown);
  } else {
    outputBody.innerHTML = `<pre style="white-space:pre-wrap;">${escapeHTML(markdown)}</pre>`;
  }
}

/* ==========================================================================
   Output actions: copy / print / txt / pdf / save / share
   ========================================================================== */
document.getElementById('actCopy').addEventListener('click', async () => {
  if (!currentPlanMarkdown) return;
  try {
    await navigator.clipboard.writeText(currentPlanMarkdown);
    toast('Plan copied to clipboard.', 'success');
  } catch (e) {
    toast('Could not copy — try selecting the text manually.', 'error');
  }
});

document.getElementById('actPrint').addEventListener('click', () => {
  if (!currentPlanMarkdown) return;
  window.print();
});

document.getElementById('actTxt').addEventListener('click', () => {
  if (!currentPlanMarkdown) return;
  downloadFile(`${slugify(currentPlanMeta.destination)}-itinerary.txt`, currentPlanMarkdown, 'text/plain');
  toast('Downloaded as TXT.', 'success');
});

document.getElementById('actPdf').addEventListener('click', () => {
  if (!currentPlanMarkdown) return;
  toast('Opening print dialog — choose "Save as PDF" as the destination.', 'info');
  setTimeout(() => window.print(), 400);
});

document.getElementById('actSave').addEventListener('click', () => {
  if (!currentPlanMarkdown || !currentPlanMeta) return;
  const trips = getJSON(LS_KEYS.trips, []);
  const trip = {
    id: uid(),
    destination: currentPlanMeta.destination,
    days: currentPlanMeta.days,
    budget: currentPlanMeta.budget,
    currency: currentPlanMeta.currency,
    travelStyle: currentPlanMeta.travelStyle,
    markdown: currentPlanMarkdown,
    createdAt: Date.now()
  };
  trips.unshift(trip);
  setJSON(LS_KEYS.trips, trips);
  renderTrips();
  toast('Trip saved to My Trips.', 'success');
});

document.getElementById('actShare').addEventListener('click', async () => {
  if (!currentPlanMarkdown) return;
  const shareData = {
    title: `Trip to ${currentPlanMeta.destination}`,
    text: currentPlanMarkdown.slice(0, 500)
  };
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (e) { /* user cancelled */ }
  } else {
    try {
      await navigator.clipboard.writeText(currentPlanMarkdown);
      toast('Sharing isn\u2019t supported here — plan copied instead.', 'info');
    } catch (e) {
      toast('Sharing isn\u2019t supported on this browser.', 'error');
    }
  }
});

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function slugify(str) {
  return (str || 'trip').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* ==========================================================================
   Saved trips
   ========================================================================== */
const tripsGrid = document.getElementById('tripsGrid');
const tripsEmpty = document.getElementById('tripsEmpty');
const statTrips = document.getElementById('statTrips');

function renderTrips() {
  const trips = getJSON(LS_KEYS.trips, []);
  statTrips.textContent = trips.length;
  tripsGrid.querySelectorAll('.trip-card').forEach(el => el.remove());

  if (!trips.length) { tripsEmpty.style.display = ''; return; }
  tripsEmpty.style.display = 'none';

  trips.forEach(trip => {
    const card = document.createElement('div');
    card.className = 'trip-card glass';
    card.innerHTML = `
      <div class="trip-dest">${escapeHTML(trip.destination)}</div>
      <div class="trip-meta">
        <span>Created <strong>${new Date(trip.createdAt).toLocaleDateString()}</strong></span>
        <span>Duration <strong>${escapeHTML(String(trip.days))} days</strong></span>
        <span>Budget <strong>${trip.budget ? escapeHTML(trip.currency + ' ' + trip.budget) : '—'}</strong></span>
      </div>
      <div class="trip-actions">
        <button class="action-btn" data-view="${trip.id}">View</button>
        <button class="action-btn" data-delete="${trip.id}">Delete</button>
      </div>`;
    tripsGrid.appendChild(card);
  });

  tripsGrid.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => viewTrip(btn.dataset.view));
  });
  tripsGrid.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteTrip(btn.dataset.delete));
  });
}

function viewTrip(id) {
  const trips = getJSON(LS_KEYS.trips, []);
  const trip = trips.find(t => t.id === id);
  if (!trip) return;
  currentPlanMarkdown = trip.markdown;
  currentPlanMeta = { destination: trip.destination, days: trip.days, currency: trip.currency, budget: trip.budget, travelStyle: trip.travelStyle };
  renderPlan(trip.markdown, currentPlanMeta);
  outputSection.hidden = false;
  outputSection.scrollIntoView({ behavior: 'smooth' });
}

function deleteTrip(id) {
  let trips = getJSON(LS_KEYS.trips, []);
  trips = trips.filter(t => t.id !== id);
  setJSON(LS_KEYS.trips, trips);
  renderTrips();
  toast('Trip deleted.', 'info');
}

/* ==========================================================================
   History
   ========================================================================== */
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historySearch = document.getElementById('historySearch');

function saveToHistory(data, markdown) {
  const history = getJSON(LS_KEYS.history, []);
  history.unshift({
    id: uid(),
    destination: data.destination,
    days: data.days,
    travelStyle: data.travelStyle,
    markdown,
    createdAt: Date.now()
  });
  setJSON(LS_KEYS.history, history.slice(0, 100));
  renderHistory();
}

function renderHistory(filter = '') {
  const history = getJSON(LS_KEYS.history, []);
  const filtered = filter
    ? history.filter(h => h.destination.toLowerCase().includes(filter.toLowerCase()))
    : history;

  historyList.querySelectorAll('.history-item').forEach(el => el.remove());

  if (!filtered.length) {
    historyEmpty.style.display = '';
    historyEmpty.querySelector('p').textContent = filter
      ? `No history matches "${filter}".`
      : 'No history yet. Your generated plans will appear here automatically.';
    return;
  }
  historyEmpty.style.display = 'none';

  filtered.forEach(item => {
    const row = document.createElement('div');
    row.className = 'history-item glass';
    row.innerHTML = `
      <div class="history-item-main">
        <div class="history-icon">
          <svg viewBox="0 0 20 20" fill="none"><path d="M2.5 10 10 2.5 17.5 10 14 10 14 17.5 6 17.5 6 10Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        </div>
        <div>
          <div class="history-dest">${escapeHTML(item.destination)}</div>
          <div class="history-sub">${escapeHTML(String(item.days))} days · ${escapeHTML(item.travelStyle)} · ${new Date(item.createdAt).toLocaleString()}</div>
        </div>
      </div>
      <div class="history-actions">
        <button class="action-btn" data-hview="${item.id}">View</button>
      </div>`;
    historyList.appendChild(row);
  });

  historyList.querySelectorAll('[data-hview]').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = getJSON(LS_KEYS.history, []).find(x => x.id === btn.dataset.hview);
      if (!h) return;
      currentPlanMarkdown = h.markdown;
      currentPlanMeta = { destination: h.destination, days: h.days, travelStyle: h.travelStyle, currency: 'INR', budget: '' };
      renderPlan(h.markdown, currentPlanMeta);
      outputSection.hidden = false;
      outputSection.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

historySearch.addEventListener('input', () => renderHistory(historySearch.value.trim()));
document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (!getJSON(LS_KEYS.history, []).length) { toast('History is already empty.', 'info'); return; }
  setJSON(LS_KEYS.history, []);
  renderHistory();
  toast('History cleared.', 'info');
});

/* ==========================================================================
   Init
   ========================================================================== */
renderTrips();
renderHistory();