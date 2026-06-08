FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x startup.sh

# Writes Google credential env vars to files, then starts the app
CMD ["/bin/bash", "startup.sh"]
