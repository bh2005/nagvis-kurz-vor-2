// NagVis 2 – history.js
// Undo/Redo-History-Stack + Clipboard für Copy/Paste/Duplicate.
// Wird VOR map-core.js und nodes.js geladen, damit alle Module
// window.NV2_HISTORY?.push(...) und window.NV2_CLIPBOARD nutzen können.
'use strict';

// ═══════════════════════════════════════════════════════════════════════
//  UNDO / REDO
// ═══════════════════════════════════════════════════════════════════════

window.NV2_HISTORY = (() => {
  const MAX = 50;           // max. Schritte im Stack
  let _undo = [];           // [entry, …]  – neuester zuletzt
  let _redo = [];

  // ── Entry-Format ──────────────────────────────────────────────────
  // {
  //   type  : 'move' | 'resize' | 'props' | 'delete' | 'add'  (optional, default='move')
  //   mapId : string
  //   items : [{ objectId, endpoint?, before, after, fullObj? }]
  // }
  // endpoint: 'pos' (default) | 'props'
  // fullObj : vollständiges Objekt – wird bei 'delete' gespeichert für Undo/Recreate

  function push(entry) {
    if (!entry?.items?.length) return;
    _undo.push(entry);
    if (_undo.length > MAX) _undo.shift();
    _redo = [];           // Redo-Stack löschen bei neuer Aktion
    _updateUI();
  }

  async function undo() {
    const entry = _undo.pop();
    if (!entry) return;
    await _apply(entry, 'undo');
    _redo.push(entry);
    _updateUI();
  }

  async function redo() {
    const entry = _redo.pop();
    if (!entry) return;
    await _apply(entry, 'redo');
    _undo.push(entry);
    _updateUI();
  }

  // ── Interne Ausführung ────────────────────────────────────────────

  async function _apply(entry, direction) {
    const mapId = entry.mapId ?? window.activeMapId;
    if (!mapId) return;

    if (entry.type === 'delete' && direction === 'undo') {
      // Gelöschte Objekte wiederherstellen
      for (const item of entry.items) {
        const recreated = await api(`/api/maps/${mapId}/objects`, 'POST', item.fullObj);
        if (recreated) {
          const el = createNode(recreated);
          if (el && window.editActive) { makeDraggable(el); makeResizable(el); }
          // object_id hat sich geändert – Entry updaten damit späteres Redo stimmt
          item.fullObj = recreated;
          item.newObjectId = recreated.object_id;
        }
      }
      return;
    }

    if (entry.type === 'delete' && direction === 'redo') {
      // Nochmal löschen
      for (const item of entry.items) {
        const id = item.newObjectId ?? item.objectId;
        await api(`/api/maps/${mapId}/objects/${id}`, 'DELETE');
        document.querySelector(`[data-object-id="${id}"]`)?.remove();
        // SVG-Linien-Wrapper
        document.getElementById(`nv2-${id}`)?.remove();
      }
      return;
    }

    if (entry.type === 'add' && direction === 'undo') {
      // Hinzugefügtes Objekt löschen
      for (const item of entry.items) {
        await api(`/api/maps/${mapId}/objects/${item.objectId}`, 'DELETE');
        document.querySelector(`[data-object-id="${item.objectId}"]`)?.remove();
        document.getElementById(`nv2-${item.objectId}`)?.remove();
      }
      return;
    }

    if (entry.type === 'add' && direction === 'redo') {
      // Nochmal anlegen
      for (const item of entry.items) {
        const recreated = await api(`/api/maps/${mapId}/objects`, 'POST', item.fullObj);
        if (recreated) {
          const el = createNode(recreated);
          if (el && window.editActive) { makeDraggable(el); makeResizable(el); }
          item.objectId = recreated.object_id;
          item.fullObj  = recreated;
        }
      }
      return;
    }

    // Standard: move / resize / props – before↔after tauschen
    const data = direction === 'undo'
      ? entry.items.map(i => ({ ...i, payload: i.before }))
      : entry.items.map(i => ({ ...i, payload: i.after  }));

    await Promise.all(data.map(async item => {
      const endpoint = item.endpoint ?? 'pos';
      const result   = await api(`/api/maps/${mapId}/objects/${item.objectId}/${endpoint}`, 'PATCH', item.payload);
      if (!result && result !== null) return;   // null = API-Fehler im Demo-Modus ok
      // DOM-Element aktualisieren
      _applyPayloadToDOM(item.objectId, endpoint, item.payload);
    }));
  }

  // ── DOM-Spiegel ──────────────────────────────────────────────────

  function _applyPayloadToDOM(objectId, endpoint, payload) {
    const el = document.querySelector(`[data-object-id="${objectId}"]`);
    if (!el) return;

    if (endpoint === 'pos') {
      if (payload.x  != null) el.style.left = `${payload.x}%`;
      if (payload.y  != null) el.style.top  = `${payload.y}%`;
      // Linie (SVG-Elemente)
      const lineVis = document.getElementById(`nv2-${objectId}`)?.querySelector('line.wm-seg-from')
                   ?? document.querySelector(`[data-object-id="${objectId}"]`);
      if (payload.x2 != null || payload.y2 != null) {
        const svg = document.getElementById(`nv2-${objectId}`);
        if (svg) {
          const segFrom = svg.querySelector('.wm-seg-from');
          const segTo   = svg.querySelector('.wm-seg-to');
          const x1 = payload.x  ?? parseFloat(segFrom?.getAttribute('x1'));
          const y1 = payload.y  ?? parseFloat(segFrom?.getAttribute('y1'));
          const x2 = payload.x2 ?? parseFloat(segTo  ?.getAttribute('x2'));
          const y2 = payload.y2 ?? parseFloat(segTo  ?.getAttribute('y2'));
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          if (segFrom) { segFrom.setAttribute('x1',`${x1}%`); segFrom.setAttribute('y1',`${y1}%`); segFrom.setAttribute('x2',`${mx}%`); segFrom.setAttribute('y2',`${my}%`); }
          if (segTo)   { segTo  .setAttribute('x1',`${mx}%`); segTo  .setAttribute('y1',`${my}%`); segTo  .setAttribute('x2',`${x2}%`); segTo  .setAttribute('y2',`${y2}%`); }
          const hit = svg.querySelector('.wm-hit');
          if (hit) { hit.setAttribute('x1',`${x1}%`); hit.setAttribute('y1',`${y1}%`); hit.setAttribute('x2',`${x2}%`); hit.setAttribute('y2',`${y2}%`); }
        }
      }
    }

    if (endpoint === 'props') {
      if (payload.size != null) {
        const isNode   = ['host','service','hostgroup','servicegroup','map'].includes(el.dataset.type);
        const isGadget = el.dataset.type === 'gadget';
        if (typeof applySize === 'function') applySize(el, null, payload.size, isNode, isGadget);
      }
      if (payload.text  != null) el.textContent = payload.text;
      if (payload.color != null) el.style.color = payload.color;
      if (payload.bg_color != null) el.style.background = payload.bg_color;
      if (payload.font_size != null) el.style.fontSize  = `${payload.font_size}px`;
      if (payload.bold != null) el.style.fontWeight = payload.bold ? '700' : '400';
    }
  }

  // ── Toolbar-Anzeige ──────────────────────────────────────────────

  function _updateUI() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) { btnUndo.disabled = _undo.length === 0; btnUndo.title = `Rückgängig (Ctrl+Z)${_undo.length ? ` · ${_undo.length}` : ''}`; }
    if (btnRedo) { btnRedo.disabled = _redo.length === 0; btnRedo.title = `Wiederholen (Ctrl+Y)${_redo.length ? ` · ${_redo.length}` : ''}`; }
  }

  // ── Öffentliche API ──────────────────────────────────────────────

  return { push, undo, redo };
})();


// ═══════════════════════════════════════════════════════════════════════
//  CLIPBOARD – Copy / Paste / Duplicate
// ═══════════════════════════════════════════════════════════════════════

window.NV2_CLIPBOARD = (() => {
  let _items = [];    // [fullObjCopy, …]
  const PASTE_OFFSET = 3;   // % Versatz beim Einfügen

  // ── Kopieren ─────────────────────────────────────────────────────
  function copy() {
    if (!window.selectedNodes?.size) return;
    _items = [...window.selectedNodes].map(el => {
      const objectId = el.dataset.objectId;
      const obj = window.activeMapCfg?.objects?.find(o => o.object_id === objectId);
      return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }).filter(Boolean);
    _showToast(`${_items.length} Objekt${_items.length !== 1 ? 'e' : ''} kopiert`);
  }

  // ── Einfügen ─────────────────────────────────────────────────────
  async function paste() {
    if (!_items.length || !window.activeMapId || !window.editActive) return;
    const created = [];
    for (const tmpl of _items) {
      const payload = _buildPayload(tmpl, PASTE_OFFSET, PASTE_OFFSET);
      const obj = await api(`/api/maps/${window.activeMapId}/objects`, 'POST', payload);
      if (obj) {
        const el = createNode(obj);
        if (el) { makeDraggable(el); makeResizable(el); }
        created.push(obj);
      }
    }
    if (created.length) {
      // History-Eintrag: Add
      NV2_HISTORY.push({
        type  : 'add',
        mapId : window.activeMapId,
        items : created.map(o => ({ objectId: o.object_id, fullObj: JSON.parse(JSON.stringify(o)) })),
      });
      // Nach Paste: neue Nodes selektieren
      window.clearSelection?.();
      created.forEach(o => {
        const el = document.querySelector(`[data-object-id="${o.object_id}"]`);
        if (el) { window.selectedNodes.add(el); el.classList.add('nv2-selected'); }
      });
      // Nächstes Paste wieder mit Offset
      _items = created.map(o => JSON.parse(JSON.stringify(o)));
    }
  }

  // ── Duplizieren ──────────────────────────────────────────────────
  async function duplicate() {
    if (!window.selectedNodes?.size || !window.activeMapId || !window.editActive) return;
    const origItems = [...window.selectedNodes].map(el => {
      const objectId = el.dataset.objectId;
      const obj = window.activeMapCfg?.objects?.find(o => o.object_id === objectId);
      return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }).filter(Boolean);

    const created = [];
    for (const tmpl of origItems) {
      const payload = _buildPayload(tmpl, PASTE_OFFSET, PASTE_OFFSET);
      const obj = await api(`/api/maps/${window.activeMapId}/objects`, 'POST', payload);
      if (obj) {
        const el = createNode(obj);
        if (el) { makeDraggable(el); makeResizable(el); }
        created.push(obj);
      }
    }
    if (created.length) {
      NV2_HISTORY.push({
        type  : 'add',
        mapId : window.activeMapId,
        items : created.map(o => ({ objectId: o.object_id, fullObj: JSON.parse(JSON.stringify(o)) })),
      });
      window.clearSelection?.();
      created.forEach(o => {
        const el = document.querySelector(`[data-object-id="${o.object_id}"]`);
        if (el) { window.selectedNodes.add(el); el.classList.add('nv2-selected'); }
      });
    }
  }

  // ── Payload aus Template bauen ───────────────────────────────────
  function _buildPayload(tmpl, dx, dy) {
    const { object_id: _id, ...rest } = tmpl;   // object_id weglassen → Backend vergibt neue
    const payload = { ...rest };
    if (payload.x  != null) payload.x  = Math.min(95, (payload.x  ?? 0) + dx);
    if (payload.y  != null) payload.y  = Math.min(95, (payload.y  ?? 0) + dy);
    if (payload.x2 != null) payload.x2 = Math.min(95, (payload.x2 ?? 0) + dx);
    if (payload.y2 != null) payload.y2 = Math.min(95, (payload.y2 ?? 0) + dy);
    return payload;
  }

  // ── kleiner Toast ────────────────────────────────────────────────
  function _showToast(msg) {
    let t = document.getElementById('nv2-clipboard-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'nv2-clipboard-toast';
      t.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:var(--panel-mid,#1e2030);color:var(--text,#e0e0e0);padding:6px 16px;border-radius:6px;font-size:12px;z-index:9999;pointer-events:none;transition:opacity .3s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.style.opacity = '0', 1800);
  }

  return { copy, paste, duplicate };
})();
