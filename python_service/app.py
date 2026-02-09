from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from flask import Flask, jsonify, request

app = Flask(__name__)

STOP_WORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "about",
    "into",
    "your",
}
SPAM_HINTS = {"ads", "promo", "tracking"}


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [token for token in tokens if token not in STOP_WORDS]


def normalize_url(raw_url: str) -> str:
    if not raw_url:
        return ""

    url_candidate = raw_url.strip()
    if "://" not in url_candidate:
        url_candidate = f"https://{url_candidate}"

    parsed = urlparse(url_candidate)
    scheme = (parsed.scheme or "https").lower()
    netloc = parsed.netloc.lower()
    path = parsed.path or "/"

    if not netloc:
        return ""

    if scheme == "http" and netloc.endswith(":80"):
        netloc = netloc[:-3]
    if scheme == "https" and netloc.endswith(":443"):
        netloc = netloc[:-4]

    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query)
        if not key.lower().startswith("utm_") and key.lower() not in {"ref", "ref_src"}
    ]
    normalized_query = urlencode(filtered_query, doseq=True)
    normalized_path = path.rstrip("/") or "/"

    return urlunparse((scheme, netloc, normalized_path, "", normalized_query, ""))


def is_junk(result: dict) -> bool:
    url = (result.get("url") or "").strip()
    title = (result.get("title") or "").strip()
    if not url or not title:
        return True
    if url.startswith(("javascript:", "mailto:")):
        return True
    if len(title) < 3:
        return True
    lower_url = url.lower()
    return any(hint in lower_url for hint in SPAM_HINTS)


def score_result(result: dict, terms: list[str]) -> float:
    text = f"{result.get('title', '')} {result.get('description', '')}".lower()
    matches = sum(1 for term in terms if term in text)
    relevance = matches / max(len(terms), 1)
    base_score = float(result.get("score") or 0.0)
    return base_score + relevance * 10


def build_suggestions(query: str, terms: list[str], results: list[dict]) -> list[str]:
    suggestions: list[str] = []
    seen = set(terms)

    for result in results:
        for token in tokenize(result.get("title", "")):
            if token not in seen:
                suggestions.append(f"{query} {token}")
                seen.add(token)
                if len(suggestions) == 3:
                    return suggestions

    if not suggestions and terms:
        suggestions.append(f"{terms[0]} overview")

    return suggestions


@app.post("/process")
def process_results():
    payload = request.get_json(silent=True) or {}
    query = (payload.get("query") or "").strip()
    raw_results = payload.get("results") or []

    if not query:
        return jsonify({"error": "query is required"}), 400

    terms = tokenize(query)

    deduped: dict[str, dict] = {}
    for result in raw_results:
        if not isinstance(result, dict) or is_junk(result):
            continue

        normalized_url = normalize_url(result.get("url", ""))
        if not normalized_url:
            continue

        result["url"] = normalized_url
        result["score"] = score_result(result, terms)

        existing = deduped.get(normalized_url)
        if not existing or result["score"] > existing.get("score", 0):
            deduped[normalized_url] = result

    improved_results = sorted(deduped.values(), key=lambda item: item.get("score", 0), reverse=True)
    suggestions = build_suggestions(query, terms, improved_results)

    # Data flow: return cleaned, scored results back to Go as JSON.
    return jsonify({"results": improved_results, "suggestions": suggestions})


if __name__ == "__main__":
    app.run(host="localhost", port=5001)
