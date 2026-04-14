# ============================================================
# NagVis 2 – Backend Docker Image
# Build-Kontext: ./backend
# ============================================================

FROM python:3.13-slim

# Tini: sauberes Signal-Handling (SIGTERM → Graceful Shutdown)
RUN apt-get update \
    && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Unprivilegierter Runtime-User
# GID 1000 = cmk-Gruppe im monitoring-Container (für Livestatus-Socket-Zugriff)
RUN groupadd -g 1000 cmk-live \
    && useradd -r -u 1000 -m -G cmk-live nagvis

# WICHTIG: /app/backend als WORKDIR damit BASE_DIR.parent == /app
# → Frontend wird bei /app/frontend erwartet (Volume oder COPY)
WORKDIR /app/backend

# Python-Abhängigkeiten zuerst (Layer-Caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source-Code
COPY . .

# Datenverzeichnisse anlegen + Berechtigungen setzen
# seed_maps/ liegt AUSSERHALB des Volumes → immer im Image verfügbar
RUN mkdir -p data/maps data/backgrounds data/kiosk data/thumbnails \
    && chown -R nagvis:nagvis /app/backend/data \
    && chown -R nagvis:nagvis /app/backend/seed_maps

USER nagvis

EXPOSE 8008

# Healthcheck nutzt den Liveness-Probe-Endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python3 -c \
        "import urllib.request; urllib.request.urlopen('http://localhost:8008/health/live')" \
        || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8008", \
     "--workers", "1", \
     "--no-access-log"]
