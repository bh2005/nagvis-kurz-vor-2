FROM python:3.12-slim

WORKDIR /app

# System-Deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python-Deps zuerst (Layer-Cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App-Code
COPY . .

# Verzeichnisse anlegen
RUN mkdir -p data/maps data/backgrounds data/kiosk

# Frontend-Dateien werden via Volume eingebunden (siehe docker-compose.yml)
# oder alternativ direkt hier COPY-t:
# COPY ../frontend ./frontend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]