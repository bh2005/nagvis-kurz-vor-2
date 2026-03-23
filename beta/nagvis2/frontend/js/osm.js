// NagVis 2 – osm.js
// OpenStreetMap Canvas-Modus via Leaflet.js + Leaflet.markercluster.
// Nodes werden als Custom-HTML-Marker platziert (x = Breitengrad lat, y = Längengrad lng).
// Beim Rauszoomen werden Nodes zu Status-Bubbles geclustert.
'use strict';

window.NV2_OSM = (() => {

  let _map          = null;   // L.map-Instanz
  let _tileLayer    = null;
  let _clusterGroup = null;   // L.markerClusterGroup (View-Modus)
  let _markers      = {};     // object_id → L.Marker
  let _objects      = {};     // object_id → obj (für Rebuild bei Mode-Wechsel)
  let _editActive   = false;

  const DEFAULT_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const DEFAULT_LAT  = 51.0;
  const DEFAULT_LNG  = 10.0;
  const DEFAULT_ZOOM = 6;

  // Status-Gewichtung für Cluster-Farbe (höher = schlimmer)
  const _STATE_RANK = {
    'up': 0, 'ok': 0,
    'warning': 1, 'warn': 1,
    'unknown': 2, 'unkn': 2,
    'critical': 3, 'crit': 3,
    'down': 3, 'unreachable': 3,
  };
  // Farben passend zum NagVis-Farbschema
  const _CLUSTER_COLORS   = ['#52b052', '#d4b800', '#d47800', '#d43030'];
  const _CLUSTER_BORDERS  = ['#3a8f3a', '#a88e00', '#a85a00', '#a81010'];

  // ── Cluster-Icon erzeugen ────────────────────────────────────────────────
  function _clusterIcon(cluster) {
    const markers = cluster.getAllChildMarkers();
    let worst = 0;
    for (const m of markers) {
      const rank = _STATE_RANK[(m._nv2State ?? '').toLowerCase()] ?? 0;
      if (rank > worst) worst = rank;
    }
    const color  = _CLUSTER_COLORS[worst];
    const border = _CLUSTER_BORDERS[worst];
    const count  = markers.length;
    const size   = count < 10 ? 36 : count < 100 ? 44 : 52;
    const fs     = size < 44 ? 13 : 15;
    return L.divIcon({
      html: `<div style="
        width:${size}px;height:${size}px;
        background:${color};border:3px solid ${border};
        border-radius:50%;display:flex;align-items:center;justify-content:center;
        color:#fff;font-weight:700;font-size:${fs}px;
        box-shadow:0 2px 8px rgba(0,0,0,.45);
        font-family:inherit;
      ">${count}</div>`,
      className:  '',
      iconSize:   [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }

  // ── Cluster-Gruppe erstellen ─────────────────────────────────────────────
  function _makeClusterGroup() {
    return L.markerClusterGroup({
      iconCreateFunction: _clusterIcon,
      maxClusterRadius:   80,      // px bis zum Zusammenfassen
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom:   true,   // bei max. Zoom aufspinnen statt zoomen
      animate:             true,
    });
  }

  // ── Marker-HTML aufbauen (gleiche Struktur wie canvas-Nodes) ─────────────
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

  // ── Tooltip + Kontext-Menü ────────────────────────────────────────────────
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

  // ── Drag-Handler für Edit-Mode ────────────────────────────────────────────
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

  // ── Marker erstellen (ohne Hinzufügen zur Karte) ──────────────────────────
  function _createMarker(obj) {
    const lat  = parseFloat(obj.x) || DEFAULT_LAT;
    const lng  = parseFloat(obj.y) || DEFAULT_LNG;
    const size = obj.size ?? 32;
    const icon = L.divIcon({
      html:       _buildIconHtml(obj),
      className:  '',
      iconAnchor: [size / 2, size / 2],
      iconSize:   [size + 60, size + 24],
    });
    const marker = L.marker([lat, lng], { icon, draggable: false });
    marker._nv2State = 'unknown';   // für Cluster-Farb-Berechnung
    _attachHandlers(marker, obj);
    return marker;
  }

  // ── Öffentliche API ────────────────────────────────────────────────────────
  return {

    isActive() { return _map !== null; },

    init(cfg, objects) {
      if (!window.L) {
        console.error('[NV2_OSM] Leaflet (L) nicht geladen – OSM-Modus nicht verfügbar');
        return;
      }
      if (!window.L.MarkerClusterGroup) {
        console.warn('[NV2_OSM] Leaflet.markercluster nicht geladen – Clustering deaktiviert');
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

      // Cluster-Gruppe anlegen und zur Karte hinzufügen
      _clusterGroup = window.L.MarkerClusterGroup
        ? _makeClusterGroup()
        : L.layerGroup();   // Fallback wenn Plugin nicht geladen
      _clusterGroup.addTo(_map);

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
      _objects = {};
      (objects ?? []).forEach(obj => this.addNode(obj));
    },

    destroy() {
      if (!_map) return;
      _map.remove();
      _map          = null;
      _tileLayer    = null;
      _clusterGroup = null;
      _markers      = {};
      _objects      = {};
      _editActive   = false;
    },

    addNode(obj) {
      if (!_map) return;
      _objects[obj.object_id] = obj;
      const marker = _createMarker(obj);
      _markers[obj.object_id] = marker;

      if (_editActive) {
        // Im Edit-Modus: direkt zur Karte (kein Clustering – Drag muss funktionieren)
        marker.addTo(_map);
        _enableDrag(marker, obj);
      } else {
        _clusterGroup.addLayer(marker);
      }
    },

    removeNode(objectId) {
      const m = _markers[objectId];
      if (m && _map) {
        _clusterGroup.removeLayer(m);
        m.remove();
        delete _markers[objectId];
        delete _objects[objectId];
      }
    },

    // Status-Update: Marker-DOM aktualisieren + Cluster-Farbe neu berechnen
    updateNodeStatus(objectId, stateLabel, acknowledged, inDowntime) {
      const m = _markers[objectId];
      if (!m) return;

      // Zustand für Cluster-Icon merken
      m._nv2State = stateLabel ?? 'unknown';

      // DOM des Markers aktualisieren (nur wenn sichtbar)
      const el = m.getElement()?.querySelector('.nv2-osm-marker');
      if (el && typeof applyNodeStatus === 'function') {
        applyNodeStatus(el, stateLabel, acknowledged, inDowntime);
      }

      // Cluster-Icon neu zeichnen (refreshClusters ist markercluster-API)
      if (_clusterGroup?.refreshClusters) {
        _clusterGroup.refreshClusters(m);
      }
    },

    // Edit-Mode umschalten
    // View → Edit: Cluster-Gruppe entfernen, Marker direkt + draggable
    // Edit → View: direkte Marker entfernen, Cluster-Gruppe wieder befüllen
    setEditMode(active) {
      _editActive = active;
      if (!_map) return;

      if (active) {
        // Cluster-Gruppe leeren und verstecken
        _clusterGroup.clearLayers();

        // Alle Marker direkt zur Karte hinzufügen (draggable)
        const objs = _objects;
        Object.entries(_markers).forEach(([oid, marker]) => {
          const obj = objs[oid];
          marker.addTo(_map);
          if (obj) _enableDrag(marker, obj);
        });
      } else {
        // Direkte Marker von der Karte nehmen
        Object.values(_markers).forEach(marker => {
          marker.dragging?.disable();
          marker.off('dragend');
          _map.removeLayer(marker);
        });

        // Alle Marker wieder in die Cluster-Gruppe
        _clusterGroup.clearLayers();
        Object.values(_markers).forEach(marker => {
          _clusterGroup.addLayer(marker);
        });
      }
    },

    // Nach Container-Größenänderung aufrufen (z.B. Kiosk-Modus)
    invalidate() {
      _map?.invalidateSize();
    },

  };

})();
