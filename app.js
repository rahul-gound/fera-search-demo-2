const form = document.getElementById('searchForm');
const queryInput = document.getElementById('q');
const safeSelect = document.getElementById('safesearch');
const locationInput = document.getElementById('location');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const tabs = Array.from(document.querySelectorAll('.tab'));
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const historyBtn = document.getElementById('historyBtn');
const historyPanel = document.getElementById('historyPanel');
const historyToggle = document.getElementById('historyToggle');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

const SEARCH_ENDPOINT = 'https://himanshu-711-fera-search-proxy.hf.space/search';
let activeTab = 'all';

/* ── IndexedDB History ─────────────────────────────────── */
var DB_NAME = "fera-search";
var STORE = "history";

function openDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}

async function addHistory(query, tab) {
  if (!historyToggle.checked) return;
  var db = await openDB();
  var tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).add({ query: query, tab: tab, time: Date.now() });
}

async function getHistory() {
  var db = await openDB();
  return new Promise(function (resolve, reject) {
    var tx = db.transaction(STORE, 'readonly');
    var req = tx.objectStore(STORE).getAll();
    req.onsuccess = function () { resolve(req.result.reverse()); };
    req.onerror = function () { reject(req.error); };
  });
}

async function clearHistory() {
  var db = await openDB();
  var tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).clear();
}

async function renderHistory() {
  historyList.innerHTML = '';
  try {
    var items = await getHistory();
    if (!items.length) {
      historyList.innerHTML = '<p class="empty-msg">No search history yet.</p>';
      return;
    }
    items.forEach(function (item) {
      var el = document.createElement('button');
      el.className = 'history-item';
      el.type = 'button';
      var d = new Date(item.time);
      el.innerHTML =
        '<span class="history-query">' + escapeHtml(item.query) + '</span>' +
        '<span class="history-meta">' + escapeHtml(item.tab) + ' &middot; ' + d.toLocaleDateString() + '</span>';
      el.addEventListener('click', function () {
        queryInput.value = item.query;
        var tabBtn = tabs.find(function (b) { return b.dataset.tab === item.tab; });
        if (tabBtn) {
          tabs.forEach(function (b) { b.classList.remove('active'); });
          tabBtn.classList.add('active');
          activeTab = item.tab;
        }
        closePanel(historyPanel);
        handleSearch(new Event('submit'));
      });
      historyList.appendChild(el);
    });
  } catch (_e) {
    historyList.innerHTML = '<p class="empty-msg">Unable to load history.</p>';
  }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ── Settings persistence (localStorage) ───────────────── */
function loadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem('fera-settings'));
    if (!s) return;
    if (s.safesearch !== undefined) safeSelect.value = s.safesearch;
    if (s.location !== undefined) locationInput.value = s.location;
    if (s.historyEnabled !== undefined) historyToggle.checked = s.historyEnabled;
  } catch (_e) { /* ignore */ }
}

function saveSettings() {
  localStorage.setItem('fera-settings', JSON.stringify({
    safesearch: safeSelect.value,
    location: locationInput.value,
    historyEnabled: historyToggle.checked
  }));
}

/* ── Panels ────────────────────────────────────────────── */
function openPanel(panel) {
  panel.classList.remove('hidden');
}

function closePanel(panel) {
  panel.classList.add('hidden');
}

document.querySelectorAll('[data-close]').forEach(function (el) {
  el.addEventListener('click', function () {
    var panel = document.getElementById(el.getAttribute('data-close'));
    if (panel) closePanel(panel);
  });
});

settingsBtn.addEventListener('click', function () {
  openPanel(settingsPanel);
});

historyBtn.addEventListener('click', function () {
  renderHistory();
  openPanel(historyPanel);
});

safeSelect.addEventListener('change', saveSettings);
locationInput.addEventListener('input', saveSettings);
historyToggle.addEventListener('change', saveSettings);

clearHistoryBtn.addEventListener('click', async function () {
  await clearHistory();
  renderHistory();
});

/* ── Search ────────────────────────────────────────────── */
const setStatus = function (message) {
  statusEl.textContent = message;
};

const buildQuery = function (allowLocationOnly) {
  var query = queryInput.value.trim();
  var location = locationInput.value.trim();
  if (!query) return allowLocationOnly ? location : '';
  if (!location) return query;
  return query + ' ' + location;
};

const buildUrl = function () {
  var params = new URLSearchParams();
  params.set('q', buildQuery(true));
  params.set('safesearch', safeSelect.value);
  params.set('categories', activeTab === 'all' ? 'general' : activeTab);
  return SEARCH_ENDPOINT + '?' + params.toString();
};

const clearResults = function () {
  resultsEl.innerHTML = '';
};

const renderResults = function (items) {
  clearResults();
  if (!items.length) {
    setStatus('No results found. Try a broader query or switch tabs.');
    return;
  }
  setStatus(items.length + ' results loaded.');
  items.forEach(function (item) {
    var card = document.createElement('article');
    card.className = 'card';

    var row = document.createElement('div');
    row.className = 'card-row';

    var content = document.createElement('div');
    content.className = 'card-content';

    var title = document.createElement('h3');
    title.className = 'title';
    var link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.title || item.url;
    title.appendChild(link);

    var meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = item.pretty_url || item.url;

    var snippet = document.createElement('p');
    snippet.className = 'snip';
    snippet.textContent = item.content || '';

    content.appendChild(title);
    content.appendChild(meta);
    if (snippet.textContent) content.appendChild(snippet);

    if (item.engine) {
      var engine = document.createElement('span');
      engine.className = 'engine';
      engine.textContent = item.engine;
      content.appendChild(engine);
    }

    var imageUrl = item.img_src || item.thumbnail || item.thumbnail_src;
    if (imageUrl) {
      var img = document.createElement('img');
      img.src = imageUrl;
      img.alt = item.title || 'Result thumbnail';
      img.className = 'thumb';
      row.appendChild(img);
    }

    row.appendChild(content);
    card.appendChild(row);
    resultsEl.appendChild(card);
  });
};

const handleSearch = async function (event) {
  event.preventDefault();
  var query = buildQuery();
  if (!query) {
    setStatus('Type a search query to begin.');
    return;
  }

  setStatus('Searching…');
  clearResults();
  var url = buildUrl();

  await addHistory(query, activeTab);

  try {
    var response = await fetch(url);
    var data = await response.json();
    var results = data.results || [];
    renderResults(results);
  } catch (_error) {
    setStatus('Unable to reach the search service. Please try again.');
  }
};

form.addEventListener('submit', handleSearch);

queryInput.addEventListener('input', function () {
  if (!queryInput.value.trim()) {
    setStatus('');
    clearResults();
  }
});

tabs.forEach(function (tab) {
  tab.addEventListener('click', function () {
    tabs.forEach(function (btn) { btn.classList.remove('active'); });
    tab.classList.add('active');
    activeTab = tab.dataset.tab;

    if (buildQuery()) {
      handleSearch(new Event('submit'));
    }
  });
});

/* ── URL param support ─────────────────────────────────── */
function applyUrlParamsAndSearch() {
  var params = new URLSearchParams(window.location.search);

  var q = (params.get('q') || '').trim();
  if (q) queryInput.value = q;

  var loc = (params.get('location') || '').trim();
  if (loc) locationInput.value = loc;

  var ss = (params.get('safesearch') || '').trim();
  if (ss && Array.from(safeSelect.options).some(function (o) { return o.value === ss; })) {
    safeSelect.value = ss;
  }

  var tabParam = (params.get('tab') || '').trim().toLowerCase();
  if (tabParam) {
    var TAB_MAP = {
      all: 'all', general: 'all', web: 'all',
      image: 'images', images: 'images', img: 'images', photo: 'images', photos: 'images', pics: 'images',
      video: 'videos', videos: 'videos',
      news: 'news'
    };
    tabParam = TAB_MAP[tabParam] || tabParam;
    var btn = tabs.find(function (b) { return (b.dataset.tab || '').toLowerCase() === tabParam; });
    if (btn) {
      tabs.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
    } else {
      activeTab = tabParam;
      tabs.forEach(function (b) { b.classList.remove('active'); });
    }
  }

  if (q) {
    handleSearch(new Event('submit'));
  }
}

/* ── Init ──────────────────────────────────────────────── */
loadSettings();
window.addEventListener('DOMContentLoaded', applyUrlParamsAndSearch);
