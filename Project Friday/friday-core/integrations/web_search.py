"""
Web research integration for Friday.
Uses DuckDuckGo (free, no API key required) for search.
Uses httpx for page fetching (already a project dependency).
"""

import re

import httpx


def search_web(query: str, num_results: int = 5) -> str:
    """DuckDuckGo text search. Returns numbered results with title, URL, and snippet."""
    from duckduckgo_search import DDGS

    try:
        results = list(DDGS().text(query, max_results=num_results))
    except Exception as e:
        return f"Web search failed: {e}"

    if not results:
        return f"No results found for '{query}'."

    lines = [f"Web search results for '{query}':\n"]
    for i, r in enumerate(results, 1):
        lines.append(f"{i}. {r['title']}\n   {r['href']}\n   {r['body']}\n")
    return "\n".join(lines)


def fetch_page(url: str, max_chars: int = 3000) -> str:
    """Fetch and extract readable plain text from a URL. Strips HTML tags and scripts."""
    try:
        resp = httpx.get(
            url,
            timeout=10,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; Friday/1.0)"},
        )
        resp.raise_for_status()
    except Exception as e:
        return f"Could not fetch {url}: {e}"

    text = resp.text
    text = re.sub(r"<script[^>]*>.*?</script>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>",   "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if len(text) > max_chars:
        return text[:max_chars] + "…"
    return text
