#!/bin/bash
set -e

# Materialize Google credentials from Secret Manager env vars
mkdir -p /app/secrets

if [ -n "$GOOGLE_CLIENT_SECRET_JSON" ]; then
    echo "$GOOGLE_CLIENT_SECRET_JSON" > /app/secrets/google-client-secret.json
fi

if [ -n "$GDRIVE_TOKEN_JSON" ]; then
    echo "$GDRIVE_TOKEN_JSON" > /app/secrets/gdrive_token.json
fi

# Cloud Run requires a process listening on $PORT.
# The LiveKit agent connects outbound to LiveKit Cloud and exposes no port,
# so we run a minimal health server in the background.
python3 -c "
import http.server, os, socketserver, threading
PORT = int(os.environ.get('PORT', 8080))
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{\"status\":\"ok\"}')
    def log_message(self, *args): pass
httpd = socketserver.TCPServer(('', PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()
import time; time.sleep(999999)
" &

# Run LiveKit agent (main process)
exec python voice/livekit_agent.py start
