#!/usr/bin/env bash
# =============================================================================
# NagVis 2 – Build Script
# Erstellt nagvis2-<version>.zip für die Weitergabe / install.sh
# =============================================================================
# Verwendung:
#   ./build.sh                     # Version aus changelog.txt
#   ./build.sh --version v2.1.0    # Explizite Version
#   ./build.sh --out /tmp          # Ausgabeverzeichnis
#   ./build.sh --no-docs           # MkDocs-Build überspringen
# =============================================================================

set -euo pipefail

# ── Farben ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${GREEN}[BUILD]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }

# ── Defaults ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR"
VERSION=""
BUILD_DOCS=true

# ── Argumente ─────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)  VERSION="$2";  shift 2 ;;
    --out)      OUT_DIR="$2";  shift 2 ;;
    --no-docs)  BUILD_DOCS=false; shift ;;
    -h|--help)
      sed -n '4,10p' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *) echo "Unbekannte Option: $1"; exit 1 ;;
  esac
done

# ── Version bestimmen ─────────────────────────────────────────────────────────
if [[ -z "$VERSION" ]]; then
  # Erste Zeile aus changelog.txt die mit "[v" beginnt
  CHANGELOG="$SCRIPT_DIR/changelog.txt"
  if [[ -f "$CHANGELOG" ]]; then
    VERSION=$(grep -m1 '^\[v' "$CHANGELOG" | sed 's/^\[\(v[^]]*\)\].*/\1/' || true)
  fi
  # Fallback: git tag
  if [[ -z "$VERSION" ]]; then
    VERSION=$(git -C "$SCRIPT_DIR" describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0-dev")
  fi
fi
VERSION="${VERSION#v}"   # führendes 'v' entfernen für Dateinamen
ZIP_NAME="nagvis2-${VERSION}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"

info "Version:    $VERSION"
info "Ausgabe:    $ZIP_PATH"

# ── MkDocs-Hilfe bauen (optional) ─────────────────────────────────────────────
if $BUILD_DOCS; then
  if command -v mkdocs &>/dev/null; then
    info "MkDocs-Hilfe bauen..."
    (cd "$SCRIPT_DIR" && mkdocs build --quiet)
    info "MkDocs ✓"
  else
    warn "mkdocs nicht gefunden – Hilfe-System wird ohne HTML-Docs gebaut."
    warn "  pip install mkdocs-material  um mkdocs zu installieren."
  fi
fi

# ── Temporäres Verzeichnis ─────────────────────────────────────────────────────
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
STAGE="$TMP_DIR/nagvis2"
mkdir -p "$STAGE"

# ── Dateien kopieren ──────────────────────────────────────────────────────────
info "Dateien sammeln..."

# Root-Dateien
for f in \
    install.sh \
    build.sh \
    .env.example \
    docker-compose.yml \
    nginx.conf \
    nginx.conf.prod \
    mime.types \
    mkdocs.yml \
    README.md \
    changelog.md \
    changelog.txt \
    FEATURES.md \
    structure.md \
    package.json; do
  [[ -f "$SCRIPT_DIR/$f" ]] && cp "$SCRIPT_DIR/$f" "$STAGE/"
done

# Frontend (vollständig, ohne Entwicklungsartefakte)
if [[ -d "$SCRIPT_DIR/frontend" ]]; then
  rsync -a \
    --exclude='node_modules/' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    "$SCRIPT_DIR/frontend/" "$STAGE/frontend/"
fi

# Backend (ohne venv, data, __pycache__, .pyc, .env)
if [[ -d "$SCRIPT_DIR/backend" ]]; then
  rsync -a \
    --exclude='venv/' \
    --exclude='data/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='*.pyo' \
    --exclude='.env' \
    --exclude='.pytest_cache/' \
    --exclude='*.egg-info/' \
    --exclude='dist/' \
    --exclude='build/' \
    --exclude='coverage.xml' \
    --exclude='.coverage' \
    --exclude='htmlcov/' \
    "$SCRIPT_DIR/backend/" "$STAGE/backend/"
fi

# Docs (Markdown-Quellen + MkDocs-Output falls gebaut)
if [[ -d "$SCRIPT_DIR/docs" ]]; then
  rsync -a "$SCRIPT_DIR/docs/" "$STAGE/docs/"
fi

# Helm-Charts
if [[ -d "$SCRIPT_DIR/helm" ]]; then
  rsync -a "$SCRIPT_DIR/helm/" "$STAGE/helm/"
fi

# Scripts (ohne __pycache__)
if [[ -d "$SCRIPT_DIR/scripts" ]]; then
  rsync -a --exclude='__pycache__/' "$SCRIPT_DIR/scripts/" "$STAGE/scripts/"
fi

# ── Version in install.sh und .env.example eintragen ─────────────────────────
if [[ -f "$STAGE/install.sh" ]]; then
  # Kommentarzeile am Anfang mit Version ergänzen
  sed -i "2a # Version: $VERSION  –  gebaut am $(date -u '+%Y-%m-%d %H:%M UTC')" "$STAGE/install.sh"
fi

# ── install.sh ausführbar machen ──────────────────────────────────────────────
[[ -f "$STAGE/install.sh" ]] && chmod 755 "$STAGE/install.sh"
[[ -f "$STAGE/build.sh"   ]] && chmod 755 "$STAGE/build.sh"
find "$STAGE/scripts" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true

# ── ZIP erstellen ─────────────────────────────────────────────────────────────
info "Erstelle $ZIP_NAME ..."
mkdir -p "$OUT_DIR"
(cd "$TMP_DIR" && zip -r -q "$ZIP_PATH" "nagvis2/")

# ── Prüfsummen ────────────────────────────────────────────────────────────────
SHA256=$(sha256sum "$ZIP_PATH" | awk '{print $1}')
echo "$SHA256  $ZIP_NAME" > "$ZIP_PATH.sha256"
info "SHA256: $SHA256"

# ── Größe ─────────────────────────────────────────────────────────────────────
SIZE=$(du -sh "$ZIP_PATH" | cut -f1)

echo ""
echo -e "${BOLD}${GREEN}✓ Build abgeschlossen${NC}"
echo -e "  ZIP:     $ZIP_PATH  ($SIZE)"
echo -e "  SHA256:  $ZIP_PATH.sha256"
echo ""
echo -e "  Installieren mit:"
echo -e "    sudo ./install.sh --zip $ZIP_PATH"
echo -e "    sudo ./install.sh --zip $ZIP_PATH --auth-enabled --port 8008"
