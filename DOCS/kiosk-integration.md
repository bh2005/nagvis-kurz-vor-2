# Kiosk-Rotations-System – Integrations-Anleitung

## Übersicht der geänderten Dateien

| Datei | Aktion |
|-------|--------|
| `main.py` | Ersetzen (komplett neue Version) |
| `js/app.js` | 5 Einfügepunkte (Patch-Datei) |
| `css/styles.css` | Am Ende anhängen |
| `index.html` | 1 Zeile im Burger-Menü |

---

## 1. main.py → komplett ersetzen

Datei `main.py` durch die neue Version `main.py` (aus diesem Paket) ersetzen.

**Was neu ist:**
- `/api/kiosk-users` GET/POST/PUT/DELETE
- `/api/kiosk-users/resolve?token=...` (kein Auth-Token nötig – ist in AUTH_SKIP_PATHS)
- `data/kiosk_users.json` als persistenter Speicher
- `KIOSK_FILE = Path("data/kiosk_users.json")`

---

## 2. js/app.js → 5 Einfügepunkte

### BLOCK 1 – State-Variablen
**Suche nach:**
```js
let sidebarCollapsed = false;
```
**Danach einfügen** (aus `app.js.kiosk-patch.js`, Abschnitt BLOCK 1):
```js
// ── Kiosk-Rotations-System ──
let _kioskUsers      = [];
let _kioskSession    = null;
let _kioskRotTimer   = null;
let _kioskRotIdx     = 0;
let _kioskProgress   = null;
```

---

### BLOCK 2 – Init (Token-Check)
**Suche nach** (in der DOMContentLoaded-Funktion):
```js
restoreSidebar();
```
**Direkt danach einfügen** (BLOCK 2 aus Patch):
```js
const _urlKioskToken = new URLSearchParams(location.search).get('kiosk');
if (_urlKioskToken) {
  _initKioskSession(_urlKioskToken);
} else {
  _loadKioskUsers();
}
```

---

### BLOCK 3 – Kiosk-Funktionen
**Suche nach:**
```js
// ═══════════════════════════════════════════════════════════════════════
//  KIOSK-MODUS
```
**Direkt VOR diesem Kommentar** den gesamten BLOCK 3 aus der Patch-Datei einfügen.
(Alle Funktionen von `_loadKioskUsers()` bis `window.openKioskUsersDlg = openKioskUsersDlg;`)

---

### BLOCK 4 – Demo-Mode API
**Suche nach** (in der `api()`-Funktion, im `_demoMode`-Block):
```js
if (path === '/api/health') return { status:'ok', demo_mode:true };
console.warn('[NV2] Demo: unhandled API call', method, path);
```
**Zwischen diesen beiden Zeilen** den BLOCK 5 aus der Patch-Datei einfügen.

---

## 3. css/styles.css → Am Ende anhängen

Inhalt von `styles.css.kiosk-additions.css` ans Ende von `styles.css` kopieren.

---

## 4. index.html → Burger-Menü

**Suche nach:**
```html
<button class="burger-item" onclick="openConnectionsDlg(); closeBurgerMenu()">
  <span class="burger-ico">🔌</span> Verbindungen verwalten
</button>
```
**Danach einfügen:**
```html
<button class="burger-item" onclick="openKioskUsersDlg(); closeBurgerMenu()">
  <span class="burger-ico">⬛</span> Kiosk-User verwalten
</button>
```

---

## Funktionsweise nach dem Patch

### Admin-Flow
1. Burger-Menü → "Kiosk-User verwalten"
2. User anlegen: Name, Intervall (Sek.), Maps auswählen
3. Token-URL wird angezeigt → kopieren und an Kiosk-Bildschirm übergeben

### Kiosk-Flow
1. Browser öffnet `https://nagvis.local/?kiosk=<token>`
2. Token wird gegen Backend (oder localStorage im Demo-Mode) geprüft
3. Bei Erfolg: Bearbeitungs-UI wird ausgeblendet, Rotation startet sofort
4. Grüner Fortschrittsbalken am unteren Rand zeigt verbleibende Zeit
5. Rotation wechselt automatisch nach konfiguriertem Intervall

### Verhalten
| Situation | Ergebnis |
|-----------|----------|
| Ungültiger Token | Rote Fehlerseite |
| Backend nicht erreichbar | Fallback auf localStorage |
| Demo-Mode | Alles funktioniert, Token in localStorage |
| Kein Edit-Mode | `window.showNodeContextMenu = () => {}` |
| F11 | Vollbild toggle funktioniert weiterhin |
| Maps-Whitelist leer | Status-Meldung, keine Rotation |

---

## Gespeicherte Daten

**Backend:** `data/kiosk_users.json`
```json
[
  {
    "id": "a1b2c3d4",
    "token": "dein-geheimer-token-24-zeichen",
    "label": "Leitwarte TV-1",
    "maps": ["datacenter-a", "network-overview"],
    "order": ["datacenter-a", "network-overview"],
    "interval": 30
  }
]
```

**Frontend-Fallback:** `localStorage['nv2-kiosk-users']` (gleiche Struktur)