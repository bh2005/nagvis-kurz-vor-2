#!/usr/bin/env bash
# =============================================================================
# NagVis 2 – OMD-Hook installieren
# =============================================================================
# Registriert NagVis 2 als OMD-Service in einer bestehenden OMD/Checkmk-Site.
# Danach: omd start <site> startet NagVis 2 automatisch mit.
#
# Verwendung:
#   sudo ./scripts/install-omd-hook.sh --site mysite
#   sudo ./scripts/install-omd-hook.sh --site mysite --nagvis2-dir /opt/nagvis2
#   sudo ./scripts/install-omd-hook.sh --site mysite --uninstall
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
info() { echo -e "${GREEN}[OMD]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "\033[0;31m[ERROR]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Als root ausführen: sudo $0"

SITE=""
NAGVIS2_DIR="/opt/nagvis2"
UNINSTALL=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site)         SITE="$2";        shift 2 ;;
    --nagvis2-dir)  NAGVIS2_DIR="$2"; shift 2 ;;
    --uninstall)    UNINSTALL=true;   shift ;;
    -h|--help)
      sed -n '4,12p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) die "Unbekannte Option: $1" ;;
  esac
done

[[ -n "$SITE" ]] || die "OMD-Site angeben: --site <sitename>"

# OMD-Root ermitteln
OMD_ROOT="/omd/sites/$SITE"
[[ -d "$OMD_ROOT" ]] || die "OMD-Site '$SITE' nicht gefunden: $OMD_ROOT"

HOOK_SRC="$SCRIPT_DIR/../omd/nagvis2"
HOOK_DST="$OMD_ROOT/etc/init.d/nagvis2"

if $UNINSTALL; then
  info "Entferne OMD-Hook..."
  # Service stoppen falls aktiv
  if [[ -f "$HOOK_DST" ]]; then
    su - "$SITE" -c "$HOOK_DST stop" 2>/dev/null || true
    rm -f "$HOOK_DST"
    info "Hook entfernt: $HOOK_DST"
  else
    info "Hook war nicht installiert."
  fi
  exit 0
fi

# Hook-Script prüfen
[[ -f "$HOOK_SRC" ]] || die "Hook-Script nicht gefunden: $HOOK_SRC"

# NagVis2-Installation prüfen
[[ -d "$NAGVIS2_DIR" ]] || warn "NagVis 2 nicht gefunden unter $NAGVIS2_DIR – Hook wird trotzdem installiert."

# Hook kopieren und NAGVIS2_DIR eintragen
info "Installiere OMD-Hook → $HOOK_DST"
mkdir -p "$OMD_ROOT/etc/init.d"
cp "$HOOK_SRC" "$HOOK_DST"

# NAGVIS2_DIR in Hook eintragen
sed -i "s|NAGVIS2_DIR=\"\${NAGVIS2_DIR:-/opt/nagvis2}\"|NAGVIS2_DIR=\"\${NAGVIS2_DIR:-$NAGVIS2_DIR}\"|" "$HOOK_DST"

# Berechtigungen
chmod 755 "$HOOK_DST"
chown "$SITE:$SITE" "$HOOK_DST"

info "Hook installiert: $HOOK_DST"

# Test: Status abfragen
info "Status-Test..."
su - "$SITE" -c "$HOOK_DST status" || true

echo ""
echo -e "${BOLD}${GREEN}OMD-Hook installiert.${NC}"
echo -e "  NagVis 2 startet jetzt mit: omd start $SITE"
echo -e "  Manuell starten:            omd start $SITE nagvis2"
echo -e "  Status:                     omd status $SITE"
