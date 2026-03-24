# Beitrag leisten zu NagVis2

Vielen Dank, dass du NagVis2 verbessern möchtest! 💙  
Das Projekt lebt von der Community – jeder Beitrag (Code, Docs, Bug-Reports, neue Backends…) ist willkommen.

## Wie du mitmachst

1. **Issue erstellen**  
   - Für Bugs, Feature-Wünsche oder Fragen immer zuerst ein Issue anlegen.
   - Bitte nutze die vorhandenen Templates (Bug Report / Feature Request).

2. **Fork & Branch**
   ```bash
   git clone https://github.com/deinname/nagvis-kurz-vor-2.git
   git checkout -b feature/mein-cooles-feature
   ```

3. **Code-Style**
   - **Backend**: `ruff format && ruff check --fix` + `pytest`
   - **Frontend**: Vanilla JS + kommende TypeScript-Regeln (siehe `frontend/.eslintrc`)
   - Commits im [Conventional Commits](https://www.conventionalcommits.org/de/) Format:
     `feat: Icinga2 Connector hinzugefügt`  
     `fix: WebSocket Reconnect Bug`

4. **Tests**
   - Backend-Tests müssen weiterhin grün sein (`pytest`).
   - Bei Frontend-Änderungen bitte Playwright-Test hinzufügen (wird bald Pflicht).

5. **Pull Request**
   - Ziel-Branch: `main`
   - Titel und Beschreibung klar und mit Issue-Link
   - CI muss durchlaufen
   - Mindestens ein Reviewer (aktuell nur @bh2005)

## Was besonders gesucht wird

- Neue Connectoren (Prometheus, Netdata, …)
- Checkmk-spezifische Gadgets (BI, Event Console, Custom Graphs)
- Frontend-Tests
- Dokumentation & Übersetzungen
- Performance-Optimierungen

## Fragen?

Einfach im Issue oder im Checkmk-Forum (Thread „NagVis 2 Beta“) fragen.  
Wir beißen nicht – versprochen! 🐍

---
