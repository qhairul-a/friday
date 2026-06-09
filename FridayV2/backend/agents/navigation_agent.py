import urllib.parse
from integrations.tavily import search_web


def run_navigation_agent(destination: str, mode: str = "driving") -> str:
    """Search for a place and return a tappable Google Maps directions link."""
    info = search_web(f"{destination} Singapore address location")
    encoded = urllib.parse.quote_plus(destination)
    url = f"https://www.google.com/maps/dir/?api=1&destination={encoded}&travelmode={mode}"
    return f"📍 {destination}\n\n{info}\n\nDirections: {url}"
