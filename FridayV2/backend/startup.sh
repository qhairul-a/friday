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

if [ -n "$GARMIN_TOKEN_JSON" ]; then
    mkdir -p /app/secrets/garmin_tokens
    echo "$GARMIN_TOKEN_JSON" > /app/secrets/garmin_tokens/garmin_tokens.json
fi

exec python main.py
