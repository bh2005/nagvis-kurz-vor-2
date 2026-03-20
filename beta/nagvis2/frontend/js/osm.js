// NagVis 2 – osm.js
// OpenStreetMap Canvas-Modus via Leaflet.js.
// Nodes werden als Custom-HTML-Marker platziert (x = Breitengrad lat, y = Längengrad lng).
'use strict';

window.NV2_OSM = (() => {

  let _map        = null;   // L.map-Instanz
  let _tileLayer  = null;
  let _markers    = {};     // object_id → L.Marker
  let _editActive = false;

  const DEFAULT_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const DEFAULT_LAT  = 51.0;
  const DEFAULT_LNG  = 10.0;
  const DEFAULT_ZOOM = 6;

  // ── Marker-HTML aufbauen (gleiche Struktur wie canvas-Nodes) ───────────
  function _buildIconHtml(obj) {
    const size     = obj.size ?? 32;
    const iconset  = obj.iconset ?? 'std_small';
    const shapeSvg = (typeof ICONSET_SHAPE !== 'undefined')
      ? (ICONSET_SHAPE[iconset] ?? ICONSET_SHAPE.std_small ?? '')
      : '';
    const { src: statusSrc } = (typeof iconSrc === 'function')
      ? iconSrc(iconset, null)
      : { src: '' };
    const _e   = typeof esc === 'function' ? esc : s => String(s ?? '');
    const lbl  = _e(obj.label || obj.name || '');
    const name = _e(obj.type === 'service'
      ? `${obj.host_name}::${obj.name}`
      : obj.name);
    const showLbl = obj.show_label !== false;
    const typeBadge = { service: 'svc', hostgroup: 'hg', servicegroup: 'sg', map: 'map' };
    const pill = typeBadge[obj.type]
      ? `<span class="nv2-type-pill">${typeBadge[obj.type]}</span>` : '';
    const shapeImg = (shapeSvg && typeof svgToDataUri === 'function')
      ? `<img class="nv2-icon-shape" src="${svgToDataUri(shapeSvg)}" alt=""
              width="${size}" height="${size}"
              style="position:absolute;inset:0;pointer-events:none">`
      : '';
    return `<div class="nv2-osm-marker nv2-node nv2-unknown"
                 data-object-id="${_e(obj.object_id)}"
                 data-name="${name}"
                 data-type="${_e(obj.type)}">
      ${pill}
      <div class="nv2-ring" style="width:${size}px;height:${size}px;position:relative">
        <img class="nv2-icon" src="${statusSrc}" alt=""
             width="${size}" height="${size}" style="position:absolute;inset:0">
        ${shapeImg}
        <span class="nv2-badge" aria-label="UNKNOWN">?</span>
      </div>
      ${showLbl ? `<div class="nv2-label" title="${lbl}">${lbl}</div>` : ''}
    </div>`;
  }

  // ── Tooltip + Kontext-Menü an inneres Element hängen ───────────────────
  function _attachHandlers(marker, obj) {
    marker.on('add', () => {
      const el = marker.getElement()?.querySelector('.nv2-osm-marker');
      if (!el) return;
      if (typeof showTooltip === 'function') {
        el.addEventListener('mouseenter', () => showTooltip(el, obj));
        el.addEventListener('mouseleave', () => {
          if (typeof hideTooltip === 'function') hideTooltip();
        });
      }
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        e.stopPropagation();
        if (_editActive && typeof showNodeContextMenu === 'function')
          showNodeContextMenu(e, el, obj);
        else if (!_editActive && typeof showViewContextMenu === 'function')
          showViewContextMenu(e, el, obj);
      });
    });
  }

  // ── Drag-Handler für Edit-Mode ─────────────────────────────────────────
  function _enableDrag(marker, obj) {
    marker.dragging?.enable();
    marker.off('dragend');
    marker.on('dragend', async () => {
      const pos = marker.getLatLng();
      obj.x = pos.lat;
      obj.y = pos.lng;
      if (typeof api === 'function'
          && typeof activeMapId !== 'undefined' && activeMapId) {
        await api(`/api/maps/${activeMapId}/objects/${obj.object_id}`,
          { method: 'PATCH', body: JSON.stringify({ x: pos.lat, y: pos.lng }) });
      }
    });
  }

  // ── Öffentliche API ────────────────────────────────────────────────────
  return {

    isActive() { return _map !== null; },

    init(cfg, objects) {
      if (!window.L) {
        console.error('[NV2_OSM] Leaflet (L) nicht geladen – OSM-Modus nicht verfügbar');
        return;
      }
      if (_map) this.destroy();

      const container = document.getElementById('osm-map');
      if (!container) { console.error('[NV2_OSM] #osm-map nicht im DOM'); return; }

      const lat  = cfg?.lat  ?? DEFAULT_LAT;
      const lng  = cfg?.lng  ?? DEFAULT_LNG;
      const zoom = cfg?.zoom ?? DEFAULT_ZOOM;
      const tile = cfg?.tile_url || DEFAULT_TILE;

      _map = L.map(container, { zoomControl: true, attributionControl: true });
      _tileLayer = L.tileLayer(tile, {
        maxZoom: 19,
        attribution: tile.includes('openstreetmap.org')
          ? '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
          : '',
      }).addTo(_map);
      _map.setView([lat, lng], zoom);

      // Kartenposition nach Bewegen automatisch in activeMapCfg persistieren
      let _saveTid;
      _map.on('moveend zoomend', () => {
        clearTimeout(_saveTid);
        _saveTid = setTimeout(() => {
          if (typeof activeMapCfg !== 'undefined' && activeMapCfg?.canvas) {
            const c = _map.getCenter();
            activeMapCfg.canvas.lat  = c.lat;
            activeMapCfg.canvas.lng  = c.lng;
            activeMapCfg.canvas.zoom = _map.getZoom();
          }
        }, 600);
      });

      // Edit-Mode-Klick auf freie Karte → Objekt-Dialog öffnen
      _map.on('click', e => {
        if (!_editActive) return;
        window.pendingPos = {
          x: e.latlng.lat.toFixed(6),
          y: e.latlng.lng.toFixed(6),
        };
        if (typeof openDlg === 'function') openDlg('dlg-add-object');
      });

      _markers = {};
      (objects ?? []).forEach(obj => this.addNode(obj));
    },

    destroy() {
      if (!_map) return;
      _map.remove();
      _map        = null;
      _tileLayer  = null;
      _markers    = {};
      _editActive = false;
    },

    addNode(obj) {
      if (!_map) return;
      // In OSM-Modus: obj.x = lat, obj.y = lng
      const lat = parseFloat(obj.x) || DEFAULT_LAT;
      const lng = parseFloat(obj.y) || DEFAULT_LNG;

      const size = obj.size ?? 32;
      const icon = L.divIcon({
        html:       _buildIconHtml(obj),
        className:  '',            // kein Leaflet-Standard-Klassen-Overhead
        iconAnchor: [size / 2, size / 2],
        iconSize:   [size + 60, size + 24],  // Platz für Label
      });
      const marker = L.marker([lat, lng], { icon, draggable: _editActive });
      marker.addTo(_map);
      _markers[obj.object_id] = marker;
      _attachHandlers(marker, obj);
      if (_editActive) _enableDrag(marker, obj);
    },

    removeNode(objectId) {
      const m = _markers[objectId];
      if (m && _map) { m.remove(); delete _markers[objectId]; }
    },

    // Status-Update für einen einzelnen Marker (wird von applyStatuses via
    // querySelectorAll('[data-name=...]') automatisch aufgerufen, alternativ direkt)
    updateNodeStatus(objectId, stateLabel, acknowledged, inDowntime) {
      const m = _markers[objectId];
      if (!m) return;
      const el = m.getElement()?.querySelector('.nv2-osm-marker');
      if (el && typeof applyNodeStatus === 'function') {
        applyNodeStatus(el, stateLabel, acknowledged, inDowntime);
      }
    },

    // Edit-Mode umschalten – Marker-Dragging aktivieren/deaktivieren
    setEditMode(active) {
      _editActive = active;
      if (!_map) return;
      const objs = (typeof activeMapCfg !== 'undefined')
        ? (activeMapCfg?.objects ?? []) : [];
      Object.entries(_markers).forEach(([oid, marker]) => {
        if (active) {
          const obj = objs.find(o => o.object_id === oid);
          if (obj) _enableDrag(marker, obj);
        } else {
          marker.dragging?.disable();
          marker.off('dragend');
        }
      });
    },

    // Nach Container-Größenänderung aufrufen (z.B. Kiosk-Modus)
    invalidate() {
      _map?.invalidateSize();
    },

  };

})();
