# fera-search-demo-2

Local-only metasearch demo with a Go speed layer, a Python quality layer, and a static UI served from Go.

## Folder structure

```
.
├── main.go
├── search.go
├── go.mod
├── ui
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── python_service
    ├── app.py
    └── requirements.txt
```

## Architecture

- **Go backend (speed layer)**: `http://localhost:8080`
  - Serves the static UI from `./ui`.
  - Exposes `POST /api/search`.
  - Fans out concurrent engine queries, aggregates raw results, and forwards JSON to Python.
- **Python service (quality layer)**: `http://localhost:5001`
  - Endpoint `POST /process` for dedupe, URL normalization, scoring, and filtering.
  - Returns improved results plus suggestions.
- **Frontend UI**: HTML/CSS/JS served locally by Go.
  - Calls `/api/search` with JSON only.
  - Displays results, engine badge, and search time.

## Example JSON flow (Go ↔ Python)

Go → Python request:

```json
{
  "query": "local search",
  "results": [
    {
      "title": "Google index • overview for local search",
      "url": "https://google.local/search?q=local+search&page=1&lang=en",
      "description": "Local Google results covering local search with language EN.",
      "engine": "google",
      "score": 0
    }
  ]
}
```

Python → Go response:

```json
{
  "results": [
    {
      "title": "Google index • overview for local search",
      "url": "https://google.local/search?q=local+search&page=1&lang=en",
      "description": "Local Google results covering local search with language EN.",
      "engine": "google",
      "score": 9.5
    }
  ],
  "suggestions": ["local search guide"]
}
```

## Run locally

1. Start the Python quality layer:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r python_service/requirements.txt
python python_service/app.py
```

2. Start the Go speed layer:

```bash
go run .
```

3. Open the UI at `http://localhost:8080`.

Everything runs on localhost only and all inter-service communication is JSON.
