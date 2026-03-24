#!/usr/bin/env bash
# =============================================================================
# NagVis 2 – TLS-Setup Script
# =============================================================================
# Erzeugt entweder ein Self-Signed-Zertifikat oder richtet Let's Encrypt ein.
#
# Verwendung:
#   sudo ./scripts/setup-tls.sh                        # Self-Signed
#   sudo ./scripts/setup-tls.sh --certbot nagvis.example.com  # Let's Encrypt
#   sudo ./scripts/setup-tls.sh --certbot nagvis.example.com --email admin@example.com
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
info() { echo -e "${GREEN}[TLS]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
die()  { echo -e "\033[0;31m[ERROR]${NC} $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Als root ausführen: sudo $0"

MODE="selfsigned"
DOMAIN=""
EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --certbot) MODE="certbot"; DOMAIN="$2"; shift 2 ;;
    --email)   EMAIL="$2"; shift 2 ;;
    -h|--help)
      echo "Verwendung: sudo $0 [--certbot DOMAIN [--email MAIL]]"
      exit 0 ;;
    *) die "Unbekannte Option: $1" ;;
  esac
done

TLS_DIR="/etc/nagvis2/tls"
mkdir -p "$TLS_DIR"

if [[ "$MODE" == "selfsigned" ]]; then
  # ── Self-Signed Zertifikat ───────────────────────────────────────────────
  info "Erstelle Self-Signed-Zertifikat (10 Jahre)..."

  HOSTNAME_FQDN=$(hostname -f 2>/dev/null || hostname)
  IP=$(hostname -I | awk '{print $1}')

  # OpenSSL-Konfiguration mit SAN
  OPENSSL_CNF=$(mktemp)
  trap 'rm -f "$OPENSSL_CNF"' EXIT
  cat > "$OPENSSL_CNF" <<EOF
[req]
default_bits       = 4096
prompt             = no
default_md         = sha256
distinguished_name = dn
x509_extensions    = v3_ca

[dn]
C  = DE
ST = Hessen
O  = NagVis 2
CN = $HOSTNAME_FQDN

[v3_ca]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:true
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectAltName         = @alt_names

[alt_names]
DNS.1 = $HOSTNAME_FQDN
DNS.2 = localhost
IP.1  = $IP
IP.2  = 127.0.0.1
EOF

  openssl req -x509 -newkey rsa:4096 -sha256 \
    -days 3650 \
    -nodes \
    -keyout "$TLS_DIR/nagvis2.key" \
    -out    "$TLS_DIR/nagvis2.crt" \
    -config "$OPENSSL_CNF" 2>/dev/null

  chmod 600 "$TLS_DIR/nagvis2.key"
  chmod 644 "$TLS_DIR/nagvis2.crt"

  info "Zertifikat erstellt:"
  info "  CRT: $TLS_DIR/nagvis2.crt"
  info "  KEY: $TLS_DIR/nagvis2.key"
  warn "Self-Signed → Browser zeigt Zertifikatswarnung (für Produktion certbot verwenden)"

  # nginx.conf.prod prüfen ob Self-Signed-Pfade aktiviert sind
  NGINX_CONF="/etc/nginx/sites-available/nagvis2"
  if [[ -f "$NGINX_CONF" ]]; then
    # Let's Encrypt-Zeilen auskommentieren, Self-Signed einkommentieren
    sed -i \
      -e 's|^    ssl_certificate     /etc/letsencrypt|    # ssl_certificate     /etc/letsencrypt|' \
      -e 's|^    ssl_certificate_key /etc/letsencrypt|    # ssl_certificate_key /etc/letsencrypt|' \
      -e 's|^    # ssl_certificate     /etc/nagvis2|    ssl_certificate     /etc/nagvis2|' \
      -e 's|^    # ssl_certificate_key /etc/nagvis2|    ssl_certificate_key /etc/nagvis2|' \
      "$NGINX_CONF"
    info "nginx-Konfiguration auf Self-Signed umgestellt."
  fi

elif [[ "$MODE" == "certbot" ]]; then
  # ── Let's Encrypt via Certbot ────────────────────────────────────────────
  [[ -n "$DOMAIN" ]] || die "Domain angeben: --certbot nagvis.example.com"
  command -v certbot &>/dev/null || die "certbot nicht gefunden: apt install certbot python3-certbot-nginx"

  info "Let's Encrypt Zertifikat für $DOMAIN anfordern..."
  CERTBOT_ARGS=(--nginx -d "$DOMAIN" --non-interactive --agree-tos)
  [[ -n "$EMAIL" ]] && CERTBOT_ARGS+=(--email "$EMAIL") || CERTBOT_ARGS+=(--register-unsafely-without-email)

  certbot "${CERTBOT_ARGS[@]}"
  info "Zertifikat ausgestellt. Certbot richtet Auto-Renewal ein."
fi

# ── nginx testen und neu laden ────────────────────────────────────────────────
if command -v nginx &>/dev/null; then
  info "nginx-Konfiguration prüfen..."
  nginx -t && systemctl reload nginx && info "nginx neu geladen ✓"
fi

echo ""
echo -e "${BOLD}${GREEN}TLS-Setup abgeschlossen.${NC}"
echo -e "  NagVis 2 erreichbar unter: https://$(hostname -f 2>/dev/null || hostname)/"
