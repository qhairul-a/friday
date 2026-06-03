"""
Web research integration for Friday.
Uses Tavily Search API — purpose-built for AI agents, returns clean structured results.
"""

import os
import httpx


def search_web(query: str, num_results: int = 5) -> str:
    """Tavily search. Returns numbered results with title, URL, and content snippet."""
    api_key = os.environ.get("TAVILY_API_KEY", "")
    if not api_key:
        return "Web search unavailable — TAVILY_API_KEY not configured."

    try:
        resp = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": query,
                "max_results": num_results,
                "search_depth": "basic",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return f"Web search failed: {e}"

    results = data.get("results", [])
    if not results:
        return f"No results found for '{query}'."

    lines = [f"Search results for '{query}':\n"]
    for i, r in enumerate(results, 1):
        snippet = r.get("content", "")[:300]
        lines.append(f"{i}. {r['title']}\n   {r['url']}\n   {snippet}\n")
    return "\n".join(lines)
