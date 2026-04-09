// NagVis 2 – minimap.js
// Floating Minimap: Übersicht aller Objekte der aktiven Map.
// Zeigt farbige Status-Punkte + aktuellen Viewport als blaues Rechteck.
// Toggle: Minimap-Button in den Zoom-Controls oder Taste "M".
'use strict';

window.NV2_MINIMAP = (() => {

  const MM_W    = 220;   // Canvas-Breite px
  const MM_H    = 160;   // Canvas-Höhe px
  const PAD     = 12;    // Innenabstand zum Rand

  // Status → CSS-Farbe
  const STATUS_CLR = {
    ok:          '#4caf50',
    warn:        '#ff9800',
    warning:     '#ff9800',
    crit:        '#f44336',
    critical:    '#f44336',
    down:        '#f44336',
    unknown:     '#9c27b0',
    unreachable: '#9c27b0',
    pending:     '#2196f3',
    unkn:        '#555',
  };

  let _canvas   = null;
  let _ctx      = null;
  let _visible  = false;
  let _rafId    = null;
  let _lastTs   = 0;

  // Gecachte Projektionsparameter (für Click→Pan)
  let _proj = { minX:0, minY:0, scale:1, offX:PAD, offY:PAD };

  // ── Objekte aus DOM auslesen ──────────────────────────────────────────
  function _getObjs() {
    const objs = window.activeMapCfg?.objects ?? [];
    const result = [];
    for (const o of objs) {
      if (o.type === 'line' || o.type === 'shape') continue; // keine sinnvolle Position
      const el = document.getElementById(`nv2-${o.object_id}`);
      if (!el) continue;
      result.push({
        x: parseFloat(el.style.left) || o.x || 0,
        y: parseFloat(el.style.top)  || o.y || 0,
        w: el.offsetWidth  || 32,
        h: el.offsetHeight || 32,
        status: el.dataset.status || 'unkn',
      });
    }
    return result;
  }

  // ── Minimap zeichnen ─────────────────────────────────────────────────
  function _draw() {
    if (!_ctx || !_visible) return;
    _ctx.clearRect(0, 0, MM_W, MM_H);

    const objs = _getObjs();

    // Hintergrund
    _ctx.fillStyle = 'rgba(14,18,26,0.88)';
    _ctx.fillRect(0, 0, MM_W, MM_H);

    if (!objs.length) {
      _ctx.fillStyle = 'rgba(255,255,255,0.15)';
      _ctx.font = '11px sans-serif';
      _ctx.textAlign = 'center';
      _ctx.fillText('(keine Objekte)', MM_W / 2, MM_H / 2);
      return;
    }

    // Bounding Box aller Objekte
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const o of objs) {
      x0 = Math.min(x0, o.x);
      y0 = Math.min(y0, o.y);
      x1 = Math.max(x1, o.x + o.w);
      y1 = Math.max(y1, o.y + o.h);
    }
    const cW = Math.max(x1 - x0, 1);
    const cH = Math.max(y1 - y0, 1);

    // Scale: Content in den verfügbaren Drawbereich einpassen
    const drawW = MM_W - PAD * 2;
    const drawH = MM_H - PAD * 2;
    const scale = Math.min(drawW / cW, drawH / cH);

    // Zentrieren
    const offX = PAD + (drawW - cW * scale) / 2;
    const offY = PAD + (drawH - cH * scale) / 2;

    // Projektion cachen (für Click→Pan)
    _proj = { minX: x0, minY: y0, scale, offX, offY };

    // Gitterrahmen
    _ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    _ctx.lineWidth = 1;
    _ctx.strokeRect(offX, offY, cW * scale, cH * scale);

    // Objekte zeichnen
    for (const o of objs) {
      const px = offX + (o.x - x0) * scale;
      const py = offY + (o.y - y0) * scale;
      const r  = Math.max(2.5, Math.min(5, (o.w * scale) / 2));
      _ctx.beginPath();
      _ctx.arc(px + r, py + r, r, 0, Math.PI * 2);
      _ctx.fillStyle = STATUS_CLR[o.status] ?? STATUS_CLR.unkn;
      _ctx.fill();
    }

    // Viewport-Rect
    const zoom = document.getElementById('nv2-canvas');
    const zs   = window.NV2_ZOOM?.getState?.();
    if (zs && zoom) {
      const { zoom: z, panX, panY } = zs;
      const wW = zoom.clientWidth;
      const wH = zoom.clientHeight;
      // Sichtbarer Bereich in Map-Koordinaten
      const vx = -panX / z;
      const vy = -panY / z;
      const vw = wW / z;
      const vh = wH / z;
      // In Minimap-Koordinaten
      const rx = offX + (vx - x0) * scale;
      const ry = offY + (vy - y0) * scale;
      const rw = vw * scale;
      const rh = vh * scale;
      _ctx.fillStyle   = 'rgba(41,182,212,0.08)';
      _ctx.fillRect(rx, ry, rw, rh);
      _ctx.strokeStyle = 'rgba(41,182,212,0.85)';
      _ctx.lineWidth   = 1.5;
      _ctx.strokeRect(rx, ry, rw, rh);
    }
  }

  // ── RAF-Loop (~10 fps wenn sichtbar) ─────────────────────────────────
  function _startLoop() {
    if (_rafId) return;
    function _loop(ts) {
      if (!_visible) { _rafId = null; return; }
      if (ts - _lastTs > 95) {
        _draw();
        _lastTs = ts;
      }
      _rafId = requestAnimationFrame(_loop);
    }
    _rafId = requestAnimationFrame(_loop);
  }

  function _stopLoop() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  // ── Click → Kamera zentrieren ─────────────────────────────────────────
  function _onClick(e) {
    if (!window.NV2_ZOOM) return;
    const rect = _canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const { scale, offX, offY, minX, minY } = _proj;
    const mapX = minX + (cx - offX) / scale;
    const mapY = minY + (cy - offY) / scale;
    const wrapper = document.getElementById('nv2-canvas');
    if (!wrapper) return;
    const { zoom: z } = NV2_ZOOM.getState();
    NV2_ZOOM.setState(z, wrapper.clientWidth  / 2 - mapX * z,
                         wrapper.clientHeight / 2 - mapY * z);
  }

  // ── Öffentliche API ──────────────────────────────────────────────────
  return {

    init() {
      _canvas = document.getElementById('minimap-canvas');
      if (!_canvas) return;
      _canvas.width  = MM_W;
      _canvas.height = MM_H;
      _ctx = _canvas.getContext('2d');
      _canvas.addEventListener('click', _onClick);
    },

    toggle() {
      _visible = !_visible;
      const panel = document.getElementById('nv2-minimap');
      const btn   = document.getElementById('btn-minimap');
      if (panel) panel.style.display = _visible ? 'flex' : 'none';
      if (btn)   btn.classList.toggle('active', _visible);
      if (_visible) { _draw(); _startLoop(); }
      else          { _stopLoop(); }
    },

    show() { if (!_visible) this.toggle(); },
    hide() { if (_visible)  this.toggle(); },

    /** Einmalig neu zeichnen (z.B. nach Objekt-Änderung) */
    update() { if (_visible) _draw(); },

    /** Zurücksetzen wenn Map geschlossen wird */
    reset() {
      _visible = false;
      _stopLoop();
      const panel = document.getElementById('nv2-minimap');
      if (panel) panel.style.display = 'none';
      const btn = document.getElementById('btn-minimap');
      if (btn)  btn.classList.remove('active');
    },
  };

})();
