import urllib.parse


def run_navigation_agent(destination: str, mode: str = "driving") -> str:
    """Return a tappable Google Maps directions link for the given destination."""
    encoded = urllib.parse.quote_plus(destination)
    url = f"https://www.google.com/maps/dir/?api=1&destination={encoded}&travelmode={mode}"
    return f"Here's your {mode} directions to {destination}:\n{url}"
