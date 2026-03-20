# NagVis 2 – Kiosk-Modus Handbuch

## Was ist der Kiosk-Modus?

Der Kiosk-Modus richtet sich an Leitwarten, NOC-Bildschirme und TV-Displays. Er zeigt Maps im Vollbild, rotiert automatisch zwischen mehreren Maps und blendet alle Bearbeitungs-Elemente aus.

---

## Zwei Wege in den Kiosk-Modus

### 1. Manueller Kiosk (Vollbild)

Taste **F11** oder Topbar-Button **⛶** während eine Map geöffnet ist.

- Nur die aktuelle Map wird angezeigt
- Edit-Mode, Kontextmenüs und Burger-Menü sind gesperrt
- Beenden: **Esc** oder **F11** erneut drücken

### 2. Token-Kiosk (automatische Rotation)

Für Displays ohne Tastatur oder Maus. Zugriff über eine Token-URL:

```
https://nagvis.example.com/?kiosk=<24-zeichen-token>
```

- Rotiert automatisch zwischen konfigurierten Maps
- Fortschrittsbalken am unteren Rand zeigt verbleibende Zeit
- Kein Login, kein Edit-Mode, keine Kontextmenüs
- Funktioniert auch ohne Backend (Demo-Modus / localStorage-Fallback)

---

## Kiosk-User anlegen

1. Burger-Menü → **⬛ Kiosk-User verwalten**
2. **Neuen User anlegen**
3. Felder ausfüllen:

| Feld | Beschreibung |
|---|---|
| **Name / Label** | Bezeichnung für den Kiosk-Platz (z.B. „Leitwarte TV-1") |
| **Intervall (Sek.)** | Anzeigedauer pro Map (Standard: 30 Sekunden) |
| **Maps** | Auswahl der anzuzeigenden Maps (Reihenfolge per Drag & Drop) |

4. Nach dem Speichern wird die **Token-URL** angezeigt → kopieren und an den Kiosk-Browser übergeben

---

## Token-URL an Browser übergeben

```
# Direkt im Browser öffnen
https://nagvis.local/?kiosk=abc123def456ghi789jkl012

# Oder als Startseite im Autostart-Browser (z.B. Chromium im Kiosk-Mode)
chromium-browser --kiosk "https://nagvis.local/?kiosk=abc123def456ghi789jkl012"
```

---

## Verhalten im Token-Kiosk

### Startvorgang

1. Browser öffnet Token-URL
2. Token wird gegen Backend geprüft (`GET /api/kiosk-users/resolve?token=...`)
3. Bei gültigem Token: Kiosk-Modus startet sofort, erste Map wird geladen
4. Bei ungültigem Token: rote Fehlermeldung

### Rotation

- Maps wechseln automatisch nach dem konfigurierten Intervall
- Grüner Fortschrittsbalken am unteren Rand zeigt verbleibende Zeit
- Reihenfolge entspricht der konfigurierten Map-Liste

### Fehlerverhalten

| Situation | Verhalten |
|---|---|
| Backend nicht erreichbar | Fallback auf `localStorage` (Demo-Modus) |
| Ungültiger Token | Rote Fehlerseite, keine Map-Anzeige |
| Leere Maps-Liste | Status-Meldung, keine Rotation |
| Map nicht gefunden | Map wird übersprungen, nächste wird geladen |

---

## Kiosk-User bearbeiten / löschen

Burger-Menü → **⬛ Kiosk-User verwalten**:
- **✎ Bearbeiten** – Label, Intervall und Maps ändern
- **🗑 Löschen** – User und Token werden entfernt (Token-URL wird ungültig)
- **📋 Token-URL** – URL erneut anzeigen / kopieren

---

## Persistenz

Kiosk-User werden serverseitig gespeichert:

```
backend/data/kiosk_users.json
```

```json
[
  {
    "id": "a1b2c3d4",
    "token": "abc123def456ghi789jkl012",
    "label": "Leitwarte TV-1",
    "maps": ["datacenter-hh", "network-overview"],
    "order": ["datacenter-hh", "network-overview"],
    "interval": 30
  }
]
```

Im Demo-Modus (kein Backend) werden Kiosk-User im Browser-`localStorage` gespeichert (`nv2-kiosk-users`).

---

## Benutzereinstellungen für Kiosk

Burger-Menü → ⚙ Einstellungen → **Kiosk-Modus Optionen**:

| Option | Beschreibung |
|---|---|
| Sidebar ausblenden | Sidebar im Kiosk-Modus verstecken |
| Topbar ausblenden | Topbar im Kiosk-Modus verstecken |
| Auto-Refresh | Status alle X Sekunden neu laden |
| Refresh-Intervall | 30s / 1min / 2min / 5min |

---

## Zoom & Pan im Kiosk-Modus

Zoom und Pan funktionieren im Kiosk-Modus identisch zum normalen Betrieb:

- Alle Objekte (Nodes, SVG-Linien, Weathermap-Linien) werden gemeinsam skaliert und verschoben
- Mausrad oder Trackpad zum Zoomen
- Gedrückt halten + ziehen zum Schwenken

> **Hinweis:** Nach dem Verlassen des Kiosk-Modus (Esc) bleibt der Zoom-Zustand erhalten.

---

## Sicherheitshinweise

- Token-URLs sollten **nicht öffentlich** geteilt werden – sie gewähren Lesezugriff auf die konfigurierten Maps
- Tokens sind 24 Zeichen lang (alphanumerisch, zufällig generiert)
- Ein Token gewährt keinen Schreibzugriff (kein Edit-Mode)
- Token-URLs sollten **nicht** in Browser-Historien öffentlicher Rechner landen
- Bei Verdacht auf Missbrauch: User löschen und neu anlegen (neuer Token)
