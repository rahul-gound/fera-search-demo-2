const form = document.getElementById('searchForm');
const queryInput = document.getElementById('q');
const safeSelect = document.getElementById('safesearch');
const locationInput = document.getElementById('location');
const langSelect = document.getElementById('lang');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const tabs = Array.from(document.querySelectorAll('.tab'));

const endpoint = 'https://xlnk-search.hf.space/search';
let activeTab = 'all';

const setStatus = (message) => {
  statusEl.textContent = message;
};

const buildUrl = () => {
  const params = new URLSearchParams();
  const query = queryInput.value.trim();
  params.set('q', query);
  params.set('format', 'json');
  params.set('safesearch', safeSelect.value);
  params.set('language', langSelect.value);
  if (locationInput.value.trim()) {
    params.set('location', locationInput.value.trim());
  }
  if (activeTab !== 'all') {
    params.set('categories', activeTab);
  }
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

    const imageUrl = item.img_src || item.thumbnail || item.thumbnail_src;
    if (imageUrl) {
      const img = document.createElement('img');
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

const handleSearch = async (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();
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
  });
});
