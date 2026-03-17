# NagVis 2 (Beta)

**Moderne, schnelle und wartbare Web-Oberfläche für Nagios / Checkmk / Icinga**

Eine komplette Neuentwicklung von NagVis mit:
- FastAPI-Backend + WebSocket-Livestatus
- Vanilla-JS-Frontend (kein Framework, super leicht)
- Vollständigem Edit-Mode, Gadgets, Weathermap-Linien und Kiosk-Rotation

---

## ✨ Features

- **Echtzeit-Updates** via WebSocket (Livestatus)
- **Edit-Mode** mit Drag & Drop, Layer-System, Linien & Textboxen
- **Gadgets** (Radial, Linear, Sparkline, Thermometer, Flow, Raw-Number)
- **Weathermap-Linien** mit automatischer Status-Farbe
- **Kiosk-Modus** mit Token-Login und automatischer Rotation
- **Snap-In-Panels** (Hosts, Events, Maps, Layer)
- **Docker-fähig** (getrennte Container oder alles-in-einem)
- **Theme-Switch** (Dark/Light) + vollständige Responsiveness

---

## 🚀 Schnellstart (empfohlen)

### Mit Docker (am einfachsten)

```bash
cd beta/nagvis2

# Erster Start (baut die Images)
docker compose up --build -d

# Danach reicht:
docker compose up -d
```

Öffne im Browser: **http://localhost:8080**

---

### Manuelle Installation (ohne Docker)

1. Backend starten:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```

2. Frontend + nginx:
   ```bash
   # nginx.conf liegt bereits im Root
   nginx -c nginx.conf
   ```

---

## 📁 Ordnerstruktur

```text
beta/nagvis2/
├── backend/              # FastAPI + Livestatus-Logik
├── frontend/             # Vanilla JS + HTML + CSS
│   ├── index.html
│   ├── css/
│   ├── assets/
│   └── js/               # bereits aufgesplittet
├── data/                 # Persistente Daten (Maps, Backgrounds, Tokens)
├── nginx.conf
├── docker-compose.yml
├── Dockerfile.backend
└── README.md
```

---

## ⚙️ Konfiguration

- Alle wichtigen Einstellungen kommen über `.env` (siehe `.env.example` – wird noch angelegt)
- Kiosk-Token-Login via `?kiosk=DEIN_TOKEN`
- Docker-Volumes: `./data` bleibt persistent

---

## 📸 Screenshots

*(kommen bald – aktuell in Entwicklung)*

---

## 🛠 Entwicklung & Mitwirken

1. Forken
2. `docker compose up --build` (empfohlen)
3. Änderungen im `frontend/js/` oder `backend/` vornehmen
4. Pull Request

---

## 📄 License

Dieses Projekt steht unter der **MIT License** – siehe [LICENSE](LICENSE) Datei.

---

**Projektstatus:** Beta (funktioniert stabil, aber noch in aktiver Weiterentwicklung)

---

**Autor:** bh2005  
**Version:** 2.0 Beta (März 2026)

---

