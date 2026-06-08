from tavily import TavilyClient

from core.config import settings


def search_web(query: str, max_results: int = 5) -> str:
    """Search the web using Tavily and return a formatted summary with sources."""
    try:
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        response = client.search(query, include_answer=True, max_results=max_results)

        answer = response.get("answer", "")
        results = response.get("results", [])

        if not answer and not results:
            return f"No results found for '{query}'."

        lines = []
        if answer:
            lines.append(answer)

        if results:
            lines.append("\nSources:")
            for i, r in enumerate(results, 1):
                title = r.get("title", "Untitled")
                url = r.get("url", "")
                lines.append(f"{i}. {title} — {url}")

        return "\n".join(lines)
    except Exception as e:
        return f"Search failed: {e}"
