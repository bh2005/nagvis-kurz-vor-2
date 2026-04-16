// NagVis 2 – align.js
// Align & Distribute für selektierte Nodes + Smart Guides beim Drag.
// Wird nach history.js, vor nodes.js geladen.
'use strict';

// ═══════════════════════════════════════════════════════════════════════
//  NV2_ALIGN  –  Ausrichten & Verteilen
// ═══════════════════════════════════════════════════════════════════════

window.NV2_ALIGN = (() => {

  // ── Hilfsfunktion: Geometrie eines DOM-Nodes in % ─────────────────
  // Gibt { el, objectId, x, y, w, h } zurück.
  // x/y = left/top in %, w/h geschätzt aus getBoundingClientRect relativ zum Canvas.
  function _geoms() {
    const canvas = document.getElementById('nv2-canvas');
    if (!canvas) return [];
    const cr = canvas.getBoundingClientRect();
    return [...window.selectedNodes].map(el => {
      const r  = el.getBoundingClientRect();
      const x  = parseFloat(el.style.left)  || 0;
      const y  = parseFloat(el.style.top)   || 0;
      const w  = (r.width  / cr.width)  * 100;
      const h  = (r.height / cr.height) * 100;
      return { el, objectId: el.dataset.objectId, x, y, w, h };
    });
  }

  // ── Kern: Positionen per PATCH speichern + History ─────────────────
  async function _commit(moves) {
    // moves = [{ el, objectId, oldX, oldY, newX, newY }]
    await Promise.all(moves.map(m =>
      api(`/api/maps/${window.activeMapId}/objects/${m.objectId}/pos`, 'PATCH',
        { x: m.newX, y: m.newY })
    ));
    moves.forEach(m => {
      m.el.style.left = `${m.newX}%`;
      m.el.style.top  = `${m.newY}%`;
    });
    window.NV2_HISTORY?.push({
      mapId: window.activeMapId,
      items: moves.map(m => ({
        objectId: m.objectId,
        before:   { x: m.oldX, y: m.oldY },
        after:    { x: m.newX, y: m.newY },
      })),
    });
  }

  // ══ ALIGN-Funktionen ════════════════════════════════════════════════

  async function alignLeft() {
    const gs = _geoms(); if (gs.length < 2) return;
    const minX = Math.min(...gs.map(g => g.x));
    await _commit(gs.map(g => ({ ...g, oldX: g.x, oldY: g.y, newX: minX, newY: g.y })));
  }

  async function alignCenterH() {
    const gs = _geoms(); if (gs.length < 2) return;
    const minX = Math.min(...gs.map(g => g.x));
    const maxX = Math.max(...gs.map(g => g.x + g.w));
    const midX = (minX + maxX) / 2;
    await _commit(gs.map(g => ({ ...g, oldX: g.x, oldY: g.y, newX: midX - g.w / 2, newY: g.y })));
  }

  async function alignRight() {
    const gs = _geoms(); if (gs.length < 2) return;
    const maxX = Math.max(...gs.map(g => g.x + g.w));
    await _commit(gs.map(g => ({ ...g, oldX: g.x, oldY: g.y, newX: maxX - g.w, newY: g.y })));
  }

  async function alignTop() {
    const gs = _geoms(); if (gs.length < 2) return;
    const minY = Math.min(...gs.map(g => g.y));
    await _commit(gs.map(g => ({ ...g, oldX: g.x, oldY: g.y, newX: g.x, newY: minY })));
  }

  async function alignMiddleV() {
    const gs = _geoms(); if (gs.length < 2) return;
    const minY = Math.min(...gs.map(g => g.y));
    const maxY = Math.max(...gs.map(g => g.y + g.h));
    const midY = (minY + maxY) / 2;
    await _commit(gs.map(g => ({ ...g, oldX: g.x, oldY: g.y, newX: g.x, newY: midY - g.h / 2 })));
  }

  async function alignBottom() {
    const gs = _geoms(); if (gs.length < 2) return;
    const maxY = Math.max(...gs.map(g => g.y + g.h));
    await _commit(gs.map(g => ({ ...g, oldX: g.x, oldY: g.y, newX: g.x, newY: maxY - g.h })));
  }

  // ══ DISTRIBUTE-Funktionen ═══════════════════════════════════════════

  async function distributeH() {
    const gs = _geoms(); if (gs.length < 3) return;
    const sorted = [...gs].sort((a, b) => a.x - b.x);
    const first  = sorted[0],  last = sorted[sorted.length - 1];
    const totalW = sorted.reduce((s, g) => s + g.w, 0);
    const gap    = (last.x + last.w - first.x - totalW) / (sorted.length - 1);
    let cursor   = first.x;
    const moves  = sorted.map((g, i) => {
      const newX = i === 0 ? g.x : cursor;
      cursor = newX + g.w + gap;
      return { ...g, oldX: g.x, oldY: g.y, newX, newY: g.y };
    });
    await _commit(moves);
  }

  async function distributeV() {
    const gs = _geoms(); if (gs.length < 3) return;
    const sorted = [...gs].sort((a, b) => a.y - b.y);
    const first  = sorted[0],  last = sorted[sorted.length - 1];
    const totalH = sorted.reduce((s, g) => s + g.h, 0);
    const gap    = (last.y + last.h - first.y - totalH) / (sorted.length - 1);
    let cursor   = first.y;
    const moves  = sorted.map((g, i) => {
      const newY = i === 0 ? g.y : cursor;
      cursor = newY + g.h + gap;
      return { ...g, oldX: g.x, oldY: g.y, newX: g.x, newY };
    });
    await _commit(moves);
  }

  // ══ GRID-LAYOUT ═════════════════════════════════════════════════════
  // Sortiert Nodes nach Größe (größte zuerst), legt sie in ein Raster
  // (Spaltenanzahl ≈ √n), zentriert das Ergebnis auf dem Canvas-Mittelpunkt.
  // Ohne aktive Selektion werden ALLE Nodes der Map bearbeitet.

  function _geomsOrAll() {
    const canvas = document.getElementById('nv2-canvas');
    if (!canvas) return [];
    const cr = canvas.getBoundingClientRect();
    const source = window.selectedNodes?.size >= 2
      ? [...window.selectedNodes]
      : [...document.querySelectorAll('#nv2-canvas .nv2-node, #nv2-canvas .nv2-textbox, #nv2-canvas .nv2-container')];
    return source.map(el => {
      const r  = el.getBoundingClientRect();
      const x  = parseFloat(el.style.left) || 0;
      const y  = parseFloat(el.style.top)  || 0;
      const w  = (r.width  / cr.width)  * 100;
      const h  = (r.height / cr.height) * 100;
      return { el, objectId: el.dataset.objectId, x, y, w, h, pw: r.width, ph: r.height };
    });
  }

  async function gridLayout() {
    const gs = _geomsOrAll(); if (gs.length < 2) return;

    const canvas = document.getElementById('nv2-canvas');
    const cr     = canvas.getBoundingClientRect();
    const GAP    = 8; // px zwischen Zellen

    // Größte zuerst
    const nodes = [...gs].sort((a, b) => (b.pw * b.ph) - (a.pw * a.ph));
    const cols  = Math.max(2, Math.round(Math.sqrt(nodes.length)));

    // Spaltenbreiten und Zeilenhöhen ermitteln
    const colW = new Array(cols).fill(0);
    const rowH = [];
    nodes.forEach((n, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      colW[c] = Math.max(colW[c], n.pw);
      rowH[r] = Math.max(rowH[r] ?? 0, n.ph);
    });

    // Kumulierte X/Y-Offsets pro Spalte/Zeile
    const colX = [0];
    for (let c = 1; c < cols; c++) colX[c] = colX[c - 1] + colW[c - 1] + GAP;
    const rowY = [0];
    for (let r = 1; r < rowH.length; r++) rowY[r] = rowY[r - 1] + rowH[r - 1] + GAP;

    // Gesamtgröße des Layouts in px
    const totalW = colX[cols - 1] + colW[cols - 1];
    const totalH = rowY[rowH.length - 1] + rowH[rowH.length - 1];

    // Ziel-Mittelpunkt:
    //   Selektion vorhanden → Schwerpunkt der aktuellen Positionen (kein Drift)
    //   Alle Nodes          → Canvas-Mitte (50 % / 50 %)
    const hasSelection = window.selectedNodes?.size >= 2;
    const centerX = hasSelection
      ? gs.reduce((s, g) => s + g.x + g.w / 2, 0) / gs.length
      : 50;
    const centerY = hasSelection
      ? gs.reduce((s, g) => s + g.y + g.h / 2, 0) / gs.length
      : 50;

    const moves = nodes.map((n, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      // Node innerhalb seiner Zelle zentrieren
      const cellPxX = colX[c] + (colW[c] - n.pw) / 2;
      const cellPxY = rowY[r] + (rowH[r]  - n.ph) / 2;
      // Relative Position vom Layout-Mittelpunkt → in %
      const newX = centerX + (cellPxX - totalW / 2) / cr.width  * 100;
      const newY = centerY + (cellPxY - totalH / 2) / cr.height * 100;
      return {
        el: n.el, objectId: n.objectId,
        oldX: n.x, oldY: n.y,
        newX: Math.max(0.5, Math.min(97, newX)),
        newY: Math.max(0.5, Math.min(97, newY)),
      };
    });

    await _commit(moves);
  }

  // ══ Align-Toolbar Sichtbarkeit ═══════════════════════════════════════

  function updateToolbar() {
    const bar = document.getElementById('nv2-align-bar');
    if (!bar) return;
    const n = window.selectedNodes?.size ?? 0;
    bar.style.display = window.editActive ? 'flex' : 'none';
    // Align/Distribute-Buttons nur bei ≥2 selektierten Nodes aktiv
    bar.querySelectorAll('.align-need2').forEach(b => b.disabled = n < 2);
    bar.querySelectorAll('.align-need3').forEach(b => b.disabled = n < 3);
  }

  return { alignLeft, alignCenterH, alignRight, alignTop, alignMiddleV, alignBottom, distributeH, distributeV, gridLayout, updateToolbar };
})();


// ═══════════════════════════════════════════════════════════════════════
//  SMART GUIDES
// ═══════════════════════════════════════════════════════════════════════

window.NV2_GUIDES = (() => {
  const SNAP_THRESHOLD = 1.2;   // % – Einrastabstand
  const SNAP_STRENGTH  = 0.4;   // % – wie stark eingerastet wird
  let _guideEls = [];

  // ── Alle Guide-Linien entfernen ───────────────────────────────────
  function clear() {
    _guideEls.forEach(el => el.remove());
    _guideEls = [];
  }

  // ── Guide-Linie zeichnen ──────────────────────────────────────────
  function _drawGuide(canvas, axis, value) {
    const el = document.createElement('div');
    el.className = 'nv2-smart-guide';
    if (axis === 'x') {
      el.style.cssText = `left:${value}%;top:0;width:1px;height:100%`;
    } else {
      el.style.cssText = `left:0;top:${value}%;width:100%;height:1px`;
    }
    canvas.appendChild(el);
    _guideEls.push(el);
  }

  // ── Snap-Berechnung für einen einzelnen dragged Node ─────────────
  // draggedIds  : Set<objectId> – alle aktuell gezogenen Nodes (bei Gruppe)
  // x, y        : aktuelle Position in %
  // w, h        : Breite/Höhe in %
  // Gibt { snapX, snapY } zurück – oder null wenn kein Snap
  function snap(draggedIds, x, y, w, h) {
    const canvas = document.getElementById('nv2-canvas');
    if (!canvas) return { snapX: null, snapY: null };
    const cr = canvas.getBoundingClientRect();

    // Referenz-Nodes: alle außer den gezogenen
    const others = [...document.querySelectorAll('.nv2-node,.nv2-textbox,.nv2-container')]
      .filter(el => !draggedIds.has(el.dataset.objectId));

    let bestX = null, bestXDist = SNAP_THRESHOLD;
    let bestY = null, bestYDist = SNAP_THRESHOLD;
    const guideXVals = new Set();
    const guideYVals = new Set();

    // Kanten des gezogenen Elements
    const dragEdgesX = [x, x + w / 2, x + w];
    const dragEdgesY = [y, y + h / 2, y + h];

    others.forEach(el => {
      const r  = el.getBoundingClientRect();
      const ox = parseFloat(el.style.left) || 0;
      const oy = parseFloat(el.style.top)  || 0;
      const ow = (r.width  / cr.width)  * 100;
      const oh = (r.height / cr.height) * 100;
      const refEdgesX = [ox, ox + ow / 2, ox + ow];
      const refEdgesY = [oy, oy + oh / 2, oy + oh];

      dragEdgesX.forEach((de, di) => {
        refEdgesX.forEach(re => {
          const dist = Math.abs(de - re);
          if (dist < bestXDist) {
            bestXDist = dist;
            // Verschiebung so dass dragEdge[di] auf refEdge liegt
            const offsets = [0, -w/2, -w];
            bestX = re + offsets[di];
            guideXVals.clear(); guideXVals.add(re);
          } else if (dist < SNAP_THRESHOLD && Math.abs(re - [...guideXVals][0] ?? 999) < 0.01) {
            guideXVals.add(re);
          }
        });
      });

      dragEdgesY.forEach((de, di) => {
        refEdgesY.forEach(re => {
          const dist = Math.abs(de - re);
          if (dist < bestYDist) {
            bestYDist = dist;
            const offsets = [0, -h/2, -h];
            bestY = re + offsets[di];
            guideYVals.clear(); guideYVals.add(re);
          } else if (dist < SNAP_THRESHOLD && Math.abs(re - [...guideYVals][0] ?? 999) < 0.01) {
            guideYVals.add(re);
          }
        });
      });
    });

    // Guides zeichnen
    clear();
    if (bestX !== null) guideXVals.forEach(v => _drawGuide(canvas, 'x', v));
    if (bestY !== null) guideYVals.forEach(v => _drawGuide(canvas, 'y', v));

    return { snapX: bestX, snapY: bestY };
  }

  return { snap, clear };
})();
