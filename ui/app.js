const form = document.getElementById('searchForm');
const queryInput = document.getElementById('q');
const languageSelect = document.getElementById('language');
const engineInputs = Array.from(document.querySelectorAll('input[name="engine"]'));
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const suggestionsEl = document.getElementById('suggestions');
const searchTimeEl = document.getElementById('searchTime');
const totalResultsEl = document.getElementById('totalResults');

const defaultEngines = ['google', 'duckduckgo', 'bing'];

const setStatus = (message) => {
  statusEl.textContent = message;
};

const clearResults = () => {
  resultsEl.innerHTML = '';
};

const clearMeta = () => {
  searchTimeEl.textContent = '';
  totalResultsEl.textContent = '';
};

const renderMeta = (searchTime, totalResults) => {
  if (typeof searchTime === 'number') {
    searchTimeEl.textContent = `Search time: ${searchTime.toFixed(2)}s`;
  }
  if (typeof totalResults === 'number') {
    totalResultsEl.textContent = `Total results: ${totalResults}`;
  }
};

const renderSuggestions = (suggestions) => {
  suggestionsEl.innerHTML = '';
  if (!suggestions.length) {
    return;
  }

  suggestions.forEach((suggestion) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'suggestion-chip';
    chip.textContent = suggestion;
    chip.addEventListener('click', () => {
      queryInput.value = suggestion;
      form.dispatchEvent(new Event('submit'));
    });
    suggestionsEl.appendChild(chip);
  });
};

const renderResults = (items) => {
  clearResults();
  if (!items.length) {
    setStatus('No results found. Try another query.');
    return;
  }

  setStatus('Results ready.');
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
    meta.textContent = item.url;

    const snippet = document.createElement('p');
    snippet.className = 'snip';
    snippet.textContent = item.description || 'No snippet available.';

    const badgeRow = document.createElement('div');
    badgeRow.className = 'badge-row';
    if (item.engine) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = item.engine;
      badgeRow.appendChild(badge);
    }
    if (typeof item.score === 'number') {
      const score = document.createElement('span');
      score.className = 'score';
      score.textContent = `score ${item.score.toFixed(2)}`;
      badgeRow.appendChild(score);
    }

    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(snippet);
    content.appendChild(badgeRow);

    row.appendChild(content);
    card.appendChild(row);
    resultsEl.appendChild(card);
  });
};

const buildPayload = () => {
  const query = queryInput.value.trim();
  const selectedEngines = engineInputs.filter((input) => input.checked).map((input) => input.value);
  return {
    query,
    engines: selectedEngines.length ? selectedEngines : defaultEngines,
    page: 1,
    language: languageSelect.value,
  };
};

const handleSearch = async (event) => {
  event.preventDefault();
  const payload = buildPayload();
  if (!payload.query) {
    setStatus('Type a search query to begin.');
    clearResults();
    clearMeta();
    renderSuggestions([]);
    return;
  }

  setStatus('Searching local engines...');
  clearResults();
  clearMeta();
  renderSuggestions([]);

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Search failed.');
    }

    const data = await response.json();
    const results = data.results || [];
    renderMeta(data.search_time, data.total_results);
    renderResults(results);
    renderSuggestions(data.suggestions || []);
  } catch (error) {
    setStatus('Search failed. Ensure the Go and Python services are running locally.');
  }
};

form.addEventListener('submit', handleSearch);
queryInput.addEventListener('input', () => {
  if (!queryInput.value.trim()) {
    setStatus('');
    clearResults();
    clearMeta();
    renderSuggestions([]);
  }
});
