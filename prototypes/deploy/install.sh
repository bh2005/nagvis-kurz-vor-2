#!/bin/bash
# NagVis 2 – Installations-Skript
# ═══════════════════════════════════════════════════════════════
#
# Erkennt automatisch ob OMD/Checkmk oder Standalone-Umgebung
# vorliegt und installiert den passenden Service.
#
# Verwendung:
#   sudo bash deploy/install.sh [OPTIONEN]
#
# Optionen:
#   --site SITE     OMD-Site-Name (default: auto-detect)
#   --dir DIR       NagVis-2-Installationsverzeichnis
#                   (default: /opt/nagvis2 oder $OMD_ROOT/nagvis2)
#   --port PORT     Bind-Port (default: 8080)
#   --host HOST     Bind-Adresse (default: 127.0.0.1)
#   --user USER     Systemd: Systembenutzer (default: nagvis2)
#   --mode MODE     Erzwingt 'systemd' oder 'omd' (default: auto)
#   --uninstall     Deinstalliert NagVis 2
#   --help          Diese Hilfe
#
# Beispiele:
#   sudo bash deploy/install.sh
#   sudo bash deploy/install.sh --site cmk --port 8080
#   sudo bash deploy/install.sh --mode systemd --user www-data
#   sudo bash deploy/install.sh --uninstall
#
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Farben ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
info() { echo -e "${CYAN}→${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET} $*"; }
err()  { echo -e "${RED}✗${RESET} $*" >&2; }
die()  { err "$*"; exit 1; }
hr()   { echo -e "${BOLD}────────────────────────────────────────${RESET}"; }

# ── Defaults ──────────────────────────────────────────────────
OPT_SITE=""
OPT_DIR=""
OPT_PORT="8080"
OPT_HOST="127.0.0.1"
OPT_USER="nagvis2"
OPT_MODE="auto"
OPT_UNINSTALL=false

# ── Argument-Parsing ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --site)       OPT_SITE="$2";      shift 2 ;;
        --dir)        OPT_DIR="$2";       shift 2 ;;
        --port)       OPT_PORT="$2";      shift 2 ;;
        --host)       OPT_HOST="$2";      shift 2 ;;
        --user)       OPT_USER="$2";      shift 2 ;;
        --mode)       OPT_MODE="$2";      shift 2 ;;
        --uninstall)  OPT_UNINSTALL=true; shift   ;;
        --help|-h)
            sed -n '/^# Verwendung:/,/^# ══/p' "$0" | grep '^#' | sed 's/^# \?//'
            exit 0 ;;
        *) die "Unbekannte Option: $1. Benutze --help." ;;
    esac
done

# ── Root-Check ────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || die "Bitte als root ausführen: sudo bash $0"

# ── Skript-Verzeichnis ermitteln (= Repo-Root/deploy) ─────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# ── Umgebungserkennung ────────────────────────────────────────
detect_mode() {
    if [[ "$OPT_MODE" != "auto" ]]; then
        echo "$OPT_MODE"
        return
    fi

    # OMD erkennen: omd-Befehl vorhanden und Site-Verzeichnis existiert
    if command -v omd &>/dev/null; then
        echo "omd"
    elif systemctl --version &>/dev/null 2>&1; then
        echo "systemd"
    else
        die "Weder OMD noch systemd gefunden. Benutze --mode um den Modus manuell zu setzen."
    fi
}

MODE=$(detect_mode)

# ── OMD-Site ermitteln ────────────────────────────────────────
detect_site() {
    if [[ -n "$OPT_SITE" ]]; then
        echo "$OPT_SITE"
        return
    fi
    # Aktive Sites auflisten
    local sites; sites=$(omd sites 2>/dev/null | awk 'NR>1 && $3=="running" {print $1}' | head -1)
    if [[ -z "$sites" ]]; then
        sites=$(omd sites 2>/dev/null | awk 'NR>1 {print $1}' | head -1)
    fi
    if [[ -z "$sites" ]]; then
        die "Keine OMD-Site gefunden. Benutze --site SITE."
    fi
    echo "$sites"
}

# ═══════════════════════════════════════════════════════════════
# UNINSTALL
# ═══════════════════════════════════════════════════════════════
if $OPT_UNINSTALL; then
    hr
    echo -e "${BOLD}NagVis 2 – Deinstallation${RESET}"
    hr

    if [[ "$MODE" == "omd" ]]; then
        SITE=$(detect_site)
        HOOKFILE="/omd/sites/${SITE}/etc/rc.d/85-nagvis2"
        if [[ -f "$HOOKFILE" ]]; then
            omd stop "$SITE" nagvis2 2>/dev/null || true
            rm -f "$HOOKFILE"
            ok "OMD-Hook entfernt: $HOOKFILE"
        else
            warn "OMD-Hook nicht gefunden: $HOOKFILE"
        fi
    else
        systemctl stop nagvis2 2>/dev/null || true
        systemctl disable nagvis2 2>/dev/null || true
        rm -f /etc/systemd/system/nagvis2.service
        systemctl daemon-reload
        ok "Systemd-Service deinstalliert"
    fi

    echo ""
    ok "Deinstallation abgeschlossen."
    echo -e "  ${YELLOW}Hinweis:${RESET} Daten und Konfiguration wurden nicht gelöscht."
    exit 0
fi

# ═══════════════════════════════════════════════════════════════
# INSTALLATION
# ═══════════════════════════════════════════════════════════════
hr
echo -e "${BOLD}NagVis 2 – Installation${RESET}"
hr
info "Modus:      $MODE"

# ── Verzeichnis festlegen ─────────────────────────────────────
if [[ -z "$OPT_DIR" ]]; then
    if [[ "$MODE" == "omd" ]]; then
        SITE=$(detect_site)
        OPT_DIR="/omd/sites/${SITE}/nagvis2"
    else
        OPT_DIR="/opt/nagvis2"
    fi
fi

info "Installationsverzeichnis: $OPT_DIR"
info "Port:       $OPT_PORT"
info "Host:       $OPT_HOST"
echo ""

# ── Verzeichnis anlegen / Repo kopieren ───────────────────────
if [[ "$OPT_DIR" != "$REPO_DIR" ]]; then
    info "Kopiere Repo nach $OPT_DIR …"
    mkdir -p "$OPT_DIR"
    rsync -a --exclude='.git' --exclude='__pycache__' \
          --exclude='*.pyc' --exclude='.venv' \
          "${REPO_DIR}/" "${OPT_DIR}/"
    ok "Repo kopiert"
fi

# ── Python-Venv anlegen ───────────────────────────────────────
VENV="${OPT_DIR}/.venv"
if [[ ! -d "$VENV" ]]; then
    info "Erzeuge Python-Venv …"
    python3 -m venv "$VENV"
    ok "Venv: $VENV"
fi

info "Installiere Python-Abhängigkeiten …"
"${VENV}/bin/pip" install -q --upgrade pip
"${VENV}/bin/pip" install -q -r "${OPT_DIR}/requirements.txt"
ok "Abhängigkeiten installiert"

# ── Daten-Verzeichnisse ───────────────────────────────────────
mkdir -p "${OPT_DIR}/data/maps" "${OPT_DIR}/data/backgrounds"
ok "Daten-Verzeichnisse angelegt"

# ═══════════════════════════════════════════════════════════════
# OMD-HOOK
# ═══════════════════════════════════════════════════════════════
install_omd_hook() {
    SITE=$(detect_site)
    OMD_ROOT="/omd/sites/${SITE}"
    HOOKDIR="${OMD_ROOT}/etc/rc.d"
    HOOKFILE="${HOOKDIR}/85-nagvis2"
    SECRET_FILE="${OMD_ROOT}/etc/nagvis2/secret"
    ENV_FILE="${OMD_ROOT}/etc/nagvis2/env"

    info "OMD-Site:   $SITE  ($OMD_ROOT)"

    mkdir -p "$HOOKDIR"
    cp "${SCRIPT_DIR}/omd-hook/nagvis2" "$HOOKFILE"
    chmod +x "$HOOKFILE"
    ok "OMD-Hook installiert: $HOOKFILE"

    # Secret erzeugen
    mkdir -p "$(dirname "$SECRET_FILE")"
    if [[ ! -f "$SECRET_FILE" ]]; then
        python3 -c "import secrets; print(secrets.token_hex(32))" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
        ok "Secret erzeugt: $SECRET_FILE"
    else
        ok "Secret bereits vorhanden: $SECRET_FILE"
    fi

    # Env-Datei für den Hook schreiben
    cat > "$ENV_FILE" << ENVEOF
# NagVis 2 – OMD-Umgebungsvariablen
NAGVIS2_DIR=${OPT_DIR}
NAGVIS2_HOST=${OPT_HOST}
NAGVIS2_PORT=${OPT_PORT}
NAGVIS2_WORKERS=1
ENVEOF
    chmod 640 "$ENV_FILE"
    ok "Env-Datei: $ENV_FILE"

    # Besitz an Site-User übergeben
    chown -R "${SITE}:${SITE}" "$OPT_DIR" 2>/dev/null || \
        warn "chown auf $SITE fehlgeschlagen – ggf. manuell anpassen"

    echo ""
    hr
    ok "Installation abgeschlossen"
    hr
    echo ""
    echo -e "  Starten:    ${CYAN}omd start ${SITE}${RESET}"
    echo -e "  Nur NagVis: ${CYAN}omd start ${SITE} nagvis2${RESET}"
    echo -e "  Status:     ${CYAN}omd status ${SITE}${RESET}"
    echo -e "  Logs:       ${CYAN}tail -f ${OMD_ROOT}/var/log/nagvis2.log${RESET}"
    echo ""
    echo -e "  URL:        ${CYAN}http://localhost:${OPT_PORT}${RESET}"
}

# ═══════════════════════════════════════════════════════════════
# SYSTEMD SERVICE
# ═══════════════════════════════════════════════════════════════
install_systemd() {
    SECRET_FILE="/etc/nagvis2/secret"
    SERVICE_FILE="/etc/systemd/system/nagvis2.service"

    # System-User anlegen falls nicht vorhanden
    if ! id -u "$OPT_USER" &>/dev/null; then
        info "Erzeuge System-User: $OPT_USER"
        useradd --system --no-create-home \
                --home-dir "$OPT_DIR" \
                --shell /bin/false \
                --comment "NagVis 2 Service" \
                "$OPT_USER"
        ok "User angelegt: $OPT_USER"
    else
        ok "User vorhanden: $OPT_USER"
    fi

    # Secret erzeugen
    mkdir -p /etc/nagvis2
    if [[ ! -f "$SECRET_FILE" ]]; then
        python3 -c "import secrets; print(secrets.token_hex(32))" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
        chown "$OPT_USER" "$SECRET_FILE"
        ok "Secret erzeugt: $SECRET_FILE"
    else
        ok "Secret bereits vorhanden: $SECRET_FILE"
    fi

    # Service-Unit erzeugen (aus Template + Variablen)
    info "Schreibe systemd-Unit: $SERVICE_FILE"
    cat > "$SERVICE_FILE" << UNITEOF
[Unit]
Description=NagVis 2 – Monitoring Visualization (FastAPI/uvicorn)
Documentation=https://github.com/your-org/nagvis2
After=network.target

[Service]
Type=simple
User=${OPT_USER}
Group=${OPT_USER}
WorkingDirectory=${OPT_DIR}
Environment=NAGVIS_SECRET=$(cat "$SECRET_FILE")
Environment=NAGVIS_HOST=${OPT_HOST}
Environment=NAGVIS_PORT=${OPT_PORT}
ExecStart=${VENV}/bin/python -m uvicorn main:app \
    --host ${OPT_HOST} \
    --port ${OPT_PORT} \
    --workers 1 \
    --log-level info \
    --access-log
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=on-failure
RestartSec=5s
StartLimitBurst=5
StartLimitIntervalSec=60s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${OPT_DIR}/data ${OPT_DIR}/frontend /omd/sites
StandardOutput=journal
StandardError=journal
SyslogIdentifier=nagvis2

[Install]
WantedBy=multi-user.target
UNITEOF
    ok "Service-Unit geschrieben"

    # Besitz setzen
    chown -R "$OPT_USER:$OPT_USER" "$OPT_DIR"
    ok "Besitz gesetzt: $OPT_USER"

    # systemd aktivieren
    systemctl daemon-reload
    systemctl enable nagvis2
    systemctl start nagvis2
    ok "Systemd-Service aktiviert und gestartet"

    echo ""
    hr
    ok "Installation abgeschlossen"
    hr
    echo ""
    echo -e "  Status:   ${CYAN}systemctl status nagvis2${RESET}"
    echo -e "  Logs:     ${CYAN}journalctl -u nagvis2 -f${RESET}"
    echo -e "  Stop:     ${CYAN}systemctl stop nagvis2${RESET}"
    echo ""
    echo -e "  URL:      ${CYAN}http://localhost:${OPT_PORT}${RESET}"
}

# ── Dispatcher ────────────────────────────────────────────────
case "$MODE" in
    omd)      install_omd_hook ;;
    systemd)  install_systemd  ;;
    *) die "Unbekannter Modus: $MODE. Benutze --mode omd oder --mode systemd." ;;
esac