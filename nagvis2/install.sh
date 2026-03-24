#!/usr/bin/env bash
# =============================================================================
# NagVis 2 – Install Script
# =============================================================================
# Installiert NagVis 2 aus einer nagvis2.zip-Datei oder dem aktuellen
# Verzeichnis auf einem Linux-System.
#
# Verwendung:
#   sudo ./install.sh [OPTIONEN]
#
# Optionen:
#   --zip FILE           Pfad zur nagvis2.zip  (Standard: nagvis2.zip im CWD)
#   --install-dir DIR    Zielverzeichnis        (Standard: /opt/nagvis2)
#   --user USER          Service-User           (Standard: nagvis2)
#   --port PORT          HTTP-Port              (Standard: 8008)
#   --auth-enabled       AUTH_ENABLED=true in .env setzen
#   --no-systemd         Systemd-Service NICHT installieren
#   --no-start           Service nach Install NICHT starten
#   --upgrade            Bestehende Installation aktualisieren
#   --uninstall          Installation entfernen
#   -h, --help           Diese Hilfe anzeigen
#
# Beispiele:
#   sudo ./install.sh
#   sudo ./install.sh --zip /tmp/nagvis2.zip --port 8080 --auth-enabled
#   sudo ./install.sh --upgrade --zip /tmp/nagvis2_new.zip
#   sudo ./install.sh --uninstall
# =============================================================================

set -euo pipefail

# ── Farben ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
header()  { echo -e "\n${BOLD}${BLUE}=== $* ===${NC}"; }
die()     { error "$*"; exit 1; }

# ── Standard-Werte ──────────────────────────────────────────────────────────
ZIP_FILE=""
INSTALL_DIR="/opt/nagvis2"
SERVICE_USER="nagvis2"
SERVICE_GROUP="nagvis2"
PORT=8008
AUTH_ENABLED=false
INSTALL_SYSTEMD=true
START_SERVICE=true
UPGRADE=false
UNINSTALL=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Argumente parsen ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --zip)           ZIP_FILE="$2";    shift 2 ;;
    --install-dir)   INSTALL_DIR="$2"; shift 2 ;;
    --user)          SERVICE_USER="$2"; SERVICE_GROUP="$2"; shift 2 ;;
    --port)          PORT="$2";        shift 2 ;;
    --auth-enabled)  AUTH_ENABLED=true; shift ;;
    --no-systemd)    INSTALL_SYSTEMD=false; shift ;;
    --no-start)      START_SERVICE=false; shift ;;
    --upgrade)       UPGRADE=true;     shift ;;
    --uninstall)     UNINSTALL=true;   shift ;;
    -h|--help)
      sed -n '4,30p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) die "Unbekannte Option: $1 (--help für Hilfe)" ;;
  esac
done

# ── Root-Check ───────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Dieses Script muss als root ausgeführt werden (sudo ./install.sh)"

# ── Deinstallation ───────────────────────────────────────────────────────────
if $UNINSTALL; then
  header "Deinstallation"
  if systemctl is-active --quiet nagvis2 2>/dev/null; then
    info "Service stoppen..."
    systemctl stop nagvis2
  fi
  if systemctl is-enabled --quiet nagvis2 2>/dev/null; then
    info "Service deaktivieren..."
    systemctl disable nagvis2
  fi
  [[ -f /etc/systemd/system/nagvis2.service ]] && rm -f /etc/systemd/system/nagvis2.service && systemctl daemon-reload
  if [[ -d "$INSTALL_DIR" ]]; then
    info "Installationsverzeichnis entfernen: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
  fi
  if id "$SERVICE_USER" &>/dev/null; then
    info "Service-User '$SERVICE_USER' entfernen..."
    userdel "$SERVICE_USER" 2>/dev/null || true
  fi
  echo -e "\n${GREEN}NagVis 2 wurde erfolgreich deinstalliert.${NC}"
  exit 0
fi

# ── Voraussetzungen prüfen ──────────────────────────────────────────────────
header "Voraussetzungen prüfen"

check_cmd() {
  command -v "$1" &>/dev/null || die "Befehl '$1' nicht gefunden. Bitte installieren: $2"
}
check_cmd python3 "apt install python3 / yum install python3"
check_cmd pip3    "apt install python3-pip / yum install python3-pip"
check_cmd unzip   "apt install unzip / yum install unzip"

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
if [[ $PYTHON_MAJOR -lt 3 ]] || { [[ $PYTHON_MAJOR -eq 3 ]] && [[ $PYTHON_MINOR -lt 11 ]]; }; then
  die "Python 3.11+ erforderlich (gefunden: $PYTHON_VERSION)"
fi
info "Python $PYTHON_VERSION ✓"

# ── ZIP-Datei bestimmen ──────────────────────────────────────────────────────
if [[ -z "$ZIP_FILE" ]]; then
  if [[ -f "$SCRIPT_DIR/nagvis2.zip" ]]; then
    ZIP_FILE="$SCRIPT_DIR/nagvis2.zip"
  elif [[ -f "$(pwd)/nagvis2.zip" ]]; then
    ZIP_FILE="$(pwd)/nagvis2.zip"
  fi
fi

# Wenn kein ZIP, prüfen ob wir direkt im Quellverzeichnis sind
SOURCE_DIR=""
if [[ -z "$ZIP_FILE" ]]; then
  if [[ -f "$SCRIPT_DIR/backend/main.py" ]]; then
    SOURCE_DIR="$SCRIPT_DIR"
    info "Kein ZIP angegeben – installiere aus Quellverzeichnis: $SOURCE_DIR"
  else
    die "Keine nagvis2.zip gefunden und kein Quellverzeichnis erkannt.\nBitte --zip /pfad/zu/nagvis2.zip angeben."
  fi
else
  [[ -f "$ZIP_FILE" ]] || die "ZIP-Datei nicht gefunden: $ZIP_FILE"
  info "ZIP-Datei: $ZIP_FILE"
fi

# ── Upgrade-Modus: Backup ───────────────────────────────────────────────────
if $UPGRADE && [[ -d "$INSTALL_DIR" ]]; then
  header "Upgrade – Backup"
  BACKUP_DIR="/tmp/nagvis2_backup_$(date +%Y%m%d_%H%M%S)"
  info "Datensicherung nach $BACKUP_DIR ..."
  mkdir -p "$BACKUP_DIR"
  # Nur Daten sichern, nicht venv/Code
  [[ -d "$INSTALL_DIR/backend/data" ]]  && cp -a "$INSTALL_DIR/backend/data"  "$BACKUP_DIR/"
  [[ -f "$INSTALL_DIR/backend/.env" ]]  && cp    "$INSTALL_DIR/backend/.env"  "$BACKUP_DIR/"
  info "Backup abgeschlossen: $BACKUP_DIR"

  # Service stoppen für Upgrade
  if systemctl is-active --quiet nagvis2 2>/dev/null; then
    info "Service stoppen für Upgrade..."
    systemctl stop nagvis2
  fi
fi

# ── User/Group anlegen ───────────────────────────────────────────────────────
header "Service-User '$SERVICE_USER'"
if ! getent group "$SERVICE_GROUP" &>/dev/null; then
  groupadd --system "$SERVICE_GROUP"
  info "Gruppe '$SERVICE_GROUP' angelegt."
else
  info "Gruppe '$SERVICE_GROUP' existiert bereits."
fi
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin \
          --gid "$SERVICE_GROUP" "$SERVICE_USER"
  info "User '$SERVICE_USER' angelegt."
else
  info "User '$SERVICE_USER' existiert bereits."
fi

# ── Installationsverzeichnis ─────────────────────────────────────────────────
header "Dateien installieren → $INSTALL_DIR"

if [[ -n "$ZIP_FILE" ]]; then
  # Temporäres Verzeichnis zum Entpacken
  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT

  info "Entpacke $ZIP_FILE ..."
  unzip -q "$ZIP_FILE" -d "$TMP_DIR"

  # Oberstes Verzeichnis im ZIP ermitteln (kann nagvis2/ o.ä. sein)
  ZIP_CONTENT=$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)
  if [[ -f "$ZIP_CONTENT/backend/main.py" ]]; then
    SOURCE_DIR="$ZIP_CONTENT"
  elif [[ -f "$TMP_DIR/backend/main.py" ]]; then
    SOURCE_DIR="$TMP_DIR"
  else
    die "Ungültige ZIP-Struktur – backend/main.py nicht gefunden."
  fi
fi

# Verzeichnis anlegen / aktualisieren
if $UPGRADE && [[ -d "$INSTALL_DIR" ]]; then
  info "Aktualisiere Code (Daten bleiben erhalten)..."
  # Code-Verzeichnisse ersetzen, Daten-Verzeichnis behalten
  rsync -a --delete \
    --exclude='backend/data/' \
    --exclude='backend/.env' \
    --exclude='backend/venv/' \
    "$SOURCE_DIR/" "$INSTALL_DIR/"
else
  mkdir -p "$INSTALL_DIR"
  info "Kopiere Dateien..."
  cp -a "$SOURCE_DIR/." "$INSTALL_DIR/"
fi

# ── Python venv ──────────────────────────────────────────────────────────────
header "Python Virtual Environment"
VENV_DIR="$INSTALL_DIR/backend/venv"

if $UPGRADE && [[ -d "$VENV_DIR" ]]; then
  info "Aktualisiere Python-Pakete..."
else
  info "Erstelle venv in $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
fi

info "Installiere/aktualisiere Abhängigkeiten..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$INSTALL_DIR/backend/requirements.txt"
info "Python-Pakete ✓"

# ── Datenverzeichnisse ───────────────────────────────────────────────────────
header "Datenverzeichnisse"
DATA_DIR="$INSTALL_DIR/backend/data"

for dir in "$DATA_DIR" "$DATA_DIR/maps" "$DATA_DIR/backgrounds" \
           "$DATA_DIR/thumbnails" "$DATA_DIR/kiosk" "$DATA_DIR/logs"; do
  mkdir -p "$dir"
  info "  $dir"
done

# Upgrade: Backup-Daten wiederherstellen (falls vorhanden und data/ leer/neu)
if $UPGRADE && [[ -n "${BACKUP_DIR:-}" ]]; then
  if [[ -d "$BACKUP_DIR/data" ]]; then
    info "Stelle Daten aus Backup wieder her..."
    cp -a "$BACKUP_DIR/data/." "$DATA_DIR/"
  fi
fi

# ── .env Konfiguration ───────────────────────────────────────────────────────
header "Konfiguration (.env)"
ENV_FILE="$INSTALL_DIR/backend/.env"

if [[ -f "$ENV_FILE" ]] && $UPGRADE; then
  info ".env bereits vorhanden – wird nicht überschrieben."
  # Upgrade: Backup-ENV zurückspielen falls .env weggefallen ist
  if [[ -f "${BACKUP_DIR:-/nonexistent}/.env" ]] && [[ ! -f "$ENV_FILE" ]]; then
    cp "$BACKUP_DIR/.env" "$ENV_FILE"
    info ".env aus Backup wiederhergestellt."
  fi
elif [[ ! -f "$ENV_FILE" ]]; then
  info "Erstelle .env aus .env.example ..."
  cp "$INSTALL_DIR/.env.example" "$ENV_FILE"

  # Secret Key generieren
  SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  sed -i "s|NAGVIS_SECRET=.*|NAGVIS_SECRET=$SECRET|" "$ENV_FILE"

  # Port setzen
  sed -i "s|^PORT=.*|PORT=$PORT|" "$ENV_FILE"

  # AUTH_ENABLED setzen
  if $AUTH_ENABLED; then
    sed -i "s|^AUTH_ENABLED=.*|AUTH_ENABLED=true|" "$ENV_FILE"
    info "AUTH_ENABLED=true gesetzt."
  fi

  # Produktions-Defaults setzen (kein Debug, kein DEMO)
  sed -i "s|^DEBUG=.*|DEBUG=false|"                     "$ENV_FILE"
  sed -i "s|^ENVIRONMENT=.*|ENVIRONMENT=production|"    "$ENV_FILE"
  sed -i "s|^DEMO_MODE=.*|DEMO_MODE=false|"             "$ENV_FILE"
  sed -i "s|^LOG_FORMAT=.*|LOG_FORMAT=text|"            "$ENV_FILE"

  info ".env erstellt: $ENV_FILE"
  warn "Bitte .env prüfen und ggf. anpassen (LIVESTATUS_*, CORS_ORIGINS, ...)"
else
  info ".env bereits vorhanden – bleibt unverändert."
fi

# ── Berechtigungen setzen ────────────────────────────────────────────────────
header "Datei-Berechtigungen"

# Installationsverzeichnis: root besitzt Code, nagvis2 darf lesen
chown -R "root:$SERVICE_GROUP" "$INSTALL_DIR"
find "$INSTALL_DIR" -type d -exec chmod 755 {} \;
find "$INSTALL_DIR" -type f -exec chmod 644 {} \;
find "$INSTALL_DIR" -name "*.sh" -exec chmod 755 {} \;

# Venv-Binaries ausführbar lassen
find "$VENV_DIR/bin" -type f -exec chmod 755 {} \;

# Datenverzeichnis: nagvis2 darf schreiben
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DATA_DIR"
chmod 750 "$DATA_DIR"
find "$DATA_DIR" -type d -exec chmod 750 {} \;
find "$DATA_DIR" -type f -exec chmod 640 {} \;

# .env: nur Service-User darf lesen (enthält Secrets!)
chown "$SERVICE_USER:$SERVICE_GROUP" "$ENV_FILE"
chmod 600 "$ENV_FILE"

info "Berechtigungen gesetzt ✓"
info "  $INSTALL_DIR/          → root:$SERVICE_GROUP  755/644"
info "  $DATA_DIR/             → $SERVICE_USER:$SERVICE_GROUP  750"
info "  $ENV_FILE              → $SERVICE_USER:$SERVICE_GROUP  600"

# ── Systemd Service ──────────────────────────────────────────────────────────
if $INSTALL_SYSTEMD; then
  header "Systemd Service"
  SERVICE_FILE="/etc/systemd/system/nagvis2.service"

  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=NagVis 2 – Monitoring Dashboard Backend
Documentation=https://github.com/bh2005/nagvis-kurz-vor-2
After=network.target
Wants=network.target

[Service]
Type=exec
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$INSTALL_DIR/backend
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=$ENV_FILE
ExecStart=$VENV_DIR/bin/uvicorn main:app \\
          --host 0.0.0.0 \\
          --port $PORT \\
          --workers 1 \\
          --no-access-log

# Sicherheits-Einschränkungen
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=$DATA_DIR
ProtectHome=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

# Neustart bei Fehler
Restart=on-failure
RestartSec=5s
StartLimitBurst=5
StartLimitIntervalSec=60

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable nagvis2
  info "Systemd-Service installiert und aktiviert: $SERVICE_FILE"

  if $START_SERVICE; then
    info "Service starten..."
    systemctl start nagvis2
    sleep 2
    if systemctl is-active --quiet nagvis2; then
      info "nagvis2.service läuft ✓"
    else
      warn "Service gestartet, aber Status unklar – prüfen mit: systemctl status nagvis2"
    fi
  fi
fi

# ── Zusammenfassung ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║       NagVis 2 erfolgreich installiert!              ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}URL:${NC}              http://$(hostname -I | awk '{print $1}'):$PORT"
echo -e "  ${BOLD}Swagger UI:${NC}       http://$(hostname -I | awk '{print $1}'):$PORT/api/v1/docs"
echo -e "  ${BOLD}Installiert in:${NC}   $INSTALL_DIR"
echo -e "  ${BOLD}Konfiguration:${NC}    $ENV_FILE"
echo -e "  ${BOLD}Daten:${NC}            $DATA_DIR"
echo ""
if $INSTALL_SYSTEMD; then
  echo -e "  ${BOLD}Service-Befehle:${NC}"
  echo -e "    systemctl status  nagvis2"
  echo -e "    systemctl restart nagvis2"
  echo -e "    journalctl -u nagvis2 -f"
  echo ""
fi
if $AUTH_ENABLED; then
  echo -e "  ${YELLOW}AUTH_ENABLED=true gesetzt.${NC}"
  echo -e "  Ersten Admin-User anlegen:"
  echo -e "    curl -X POST http://localhost:$PORT/api/v1/auth/users \\"
  echo -e "      -H 'Content-Type: application/json' \\"
  echo -e "      -d '{\"username\":\"admin\",\"password\":\"SICHER123!\",\"role\":\"admin\"}'"
  echo ""
fi
echo -e "  ${YELLOW}Nächste Schritte:${NC}"
echo -e "    1. $ENV_FILE prüfen und anpassen"
echo -e "    2. Backend in Burger-Menü → Backends verwalten konfigurieren"
if $INSTALL_SYSTEMD && ! $START_SERVICE; then
  echo -e "    3. systemctl start nagvis2"
fi
echo ""
