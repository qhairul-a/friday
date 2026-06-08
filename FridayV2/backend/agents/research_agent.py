from integrations.tavily import search_web


def run_research_agent(query: str) -> str:
    """Search the web for the given query and return a formatted summary with sources."""
    return search_web(query)
