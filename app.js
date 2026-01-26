const form = document.getElementById('searchForm');
const queryInput = document.getElementById('q');
const safeSelect = document.getElementById('safesearch');
const locationInput = document.getElementById('location');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const tabs = Array.from(document.querySelectorAll('.tab'));

const endpoint = 'https://xlnk-search.hf.space/search';
let activeTab = 'all';

const setStatus = (message) => {
  statusEl.textContent = message;
};

const buildQuery = (allowLocationOnly = false) => {
  const query = queryInput.value.trim();
  const location = locationInput.value.trim();
  if (!query) {
    return allowLocationOnly ? location : '';
  }
  if (!location) {
    return query;
  }
  return `${query} ${location}`;
};

const buildUrl = () => {
  const params = new URLSearchParams();
  params.set('q', buildQuery(true));
  params.set('format', 'json');
  params.set('safesearch', safeSelect.value);
  params.set('categories', activeTab === 'all' ? 'general' : activeTab);
  return `${endpoint}?${params.toString()}`;
};

const clearResults = () => {
  resultsEl.innerHTML = '';
};

const renderResults = (items) => {
  clearResults();
  if (!items.length) {
    setStatus('No results found. Try a broader query or switch tabs.');
    return;
  }
  setStatus(`${items.length} results loaded.`);
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card';

    const favicon = document.createElement('div');
    favicon.className = 'favicon';
    const faviconImg = document.createElement('img');
    let hostname = '';
    try {
      hostname = new URL(item.url).hostname;
    } catch (error) {
      hostname = '';
    }
    if (hostname) {
      faviconImg.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
      faviconImg.alt = `${hostname} logo`;
    } else {
      faviconImg.alt = 'Source logo';
    }
    favicon.appendChild(faviconImg);

    const row = document.createElement('div');
    row.className = 'card-row';

    const content = document.createElement('div');

    const title = document.createElement('h3');
    title.className = 'title';
    const link = document.createElement('a');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = item.title || item.url;
    title.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = item.pretty_url || item.url;

    const snippet = document.createElement('p');
    snippet.className = 'snip';
    snippet.textContent = item.content || 'No snippet available.';

    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(snippet);
    if (item.engine) {
      const engine = document.createElement('div');
      engine.className = 'engine';
      engine.textContent = `Source: ${item.engine}`;
      content.appendChild(engine);
    }

    row.appendChild(favicon);
    row.appendChild(content);
    const imageUrl = item.img_src || item.thumbnail || item.thumbnail_src;
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = item.title || 'Result thumbnail';
      img.className = 'thumb';
      row.appendChild(img);
    }
    card.appendChild(row);
    resultsEl.appendChild(card);
  });
};

const handleSearch = async (event) => {
  event.preventDefault();
  const query = buildQuery();
  if (!query) {
    setStatus('Type a search query to begin.');
    return;
  }
  setStatus('Searching the SearXNG endpoint...');
  clearResults();
  const url = buildUrl();
  try {
    const response = await fetch(url);
    const data = await response.json();
    const results = data.results || [];
    renderResults(results);
  } catch (error) {
    setStatus('Unable to reach the search service. Please try again.');
  }
};

form.addEventListener('submit', handleSearch);

queryInput.addEventListener('input', () => {
  if (!queryInput.value.trim()) {
    setStatus('');
    clearResults();
  }
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((btn) => btn.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.tab;
    if (buildQuery()) {
      handleSearch(new Event('submit'));
    }
  });
});
