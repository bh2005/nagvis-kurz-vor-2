/**
 * NagVis 2 – zoom_pan.js
 * ======================
 * Zoom & Pan für den Map-Canvas via CSS transform.
 * Kein Framework, kein Build-Step.
 *
 * API:
 *   NV2_ZOOM.init(wrapper, viewport)   – Initialisieren
 *   NV2_ZOOM.destroy()                 – Event-Listener entfernen
 *   NV2_ZOOM.reset()                   – Zoom + Pan zurücksetzen
 *   NV2_ZOOM.getState()                – { zoom, panX, panY }
 *   NV2_ZOOM.setState(zoom, panX, panY)
 *
 * wrapper  = das äußere Element (Scroll-/Clip-Container, z.B. #nv2-canvas)
 * viewport = das transformierte Element (z.B. #map-canvas-wrapper)
 */

'use strict';

window.NV2_ZOOM = (() => {

  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 5.0;
  const STEP     = 0.1;

  let _wrapper  = null;
  let _viewport = null;
  let _zoom     = 1;
  let _panX     = 0;
  let _panY     = 0;
  let _panning  = false;
  let _startX   = 0;
  let _startY   = 0;
  let _startPanX = 0;
  let _startPanY = 0;

  // ── Event-Listener-Referenzen (für destroy) ──────────────────────────
  let _onWheel, _onMouseDown, _onMouseMove, _onMouseUp, _onDblClick;

  // ── Transform anwenden ───────────────────────────────────────────────
  function _apply() {
    if (!_viewport) return;
    _viewport.style.transform       = `translate(${_panX}px, ${_panY}px) scale(${_zoom})`;
    _viewport.style.transformOrigin = '0 0';
    _updateZoomLabel();
  }

  function _updateZoomLabel() {
    const el = document.getElementById('nv2-zoom-level');
    if (el) el.textContent = Math.round(_zoom * 100) + '%';
    const resetBtn = document.getElementById('btn-zoom-reset');
    if (resetBtn) resetBtn.disabled = (_zoom === 1 && _panX === 0 && _panY === 0);
  }

  // ── Zoom zum Punkt (cx, cy) relativ zum wrapper ───────────────────────
  function _zoomTo(newZoom, cx, cy) {
    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const factor = newZoom / _zoom;
    _panX = cx - factor * (cx - _panX);
    _panY = cy - factor * (cy - _panY);
    _zoom = newZoom;
    _apply();
  }

  // ── Wheel → Zoom ──────────────────────────────────────────────────────
  function _handleWheel(e) {
    e.preventDefault();
    const rect = _wrapper.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? STEP : -STEP;
    _zoomTo(_zoom + delta * _zoom, cx, cy);
  }

  // ── Mittlere Maustaste / Space+Drag → Pan ────────────────────────────
  function _handleMouseDown(e) {
    // Mittlere Maustaste oder Space gedrückt
    if (e.button !== 1) return;
    e.preventDefault();
    _panning  = true;
    _startX   = e.clientX;
    _startY   = e.clientY;
    _startPanX = _panX;
    _startPanY = _panY;
    _wrapper.style.cursor = 'grabbing';
  }

  function _handleMouseMove(e) {
    if (!_panning) return;
    _panX = _startPanX + (e.clientX - _startX);
    _panY = _startPanY + (e.clientY - _startY);
    _apply();
  }

  function _handleMouseUp(e) {
    if (!_panning) return;
    _panning = false;
    _wrapper.style.cursor = '';
  }

  // ── Doppelklick → Zoom-In zum Punkt ──────────────────────────────────
  function _handleDblClick(e) {
    // Nur wenn kein Objekt getroffen
    if (e.target.closest('.nv2-node, .nv2-textbox, .nv2-container')) return;
    const rect = _wrapper.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;
    _zoomTo(_zoom * 1.3, cx, cy);
  }

  // ── Touch-Support (Pinch-Zoom) ────────────────────────────────────────
  let _lastTouchDist = null;
  let _lastTouchMidX = 0;
  let _lastTouchMidY = 0;

  function _touchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function _handleTouchStart(e) {
    if (e.touches.length === 2) {
      _lastTouchDist = _touchDist(e.touches);
      _lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      _lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    } else if (e.touches.length === 1) {
      _panning   = true;
      _startX    = e.touches[0].clientX;
      _startY    = e.touches[0].clientY;
      _startPanX = _panX;
      _startPanY = _panY;
    }
  }

  function _handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2 && _lastTouchDist !== null) {
      const dist  = _touchDist(e.touches);
      const midX  = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY  = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect  = _wrapper.getBoundingClientRect();
      _zoomTo(_zoom * (dist / _lastTouchDist), midX - rect.left, midY - rect.top);
      // Pan via Mittelpunkt-Verschiebung
      _panX += midX - _lastTouchMidX;
      _panY += midY - _lastTouchMidY;
      _lastTouchDist = dist;
      _lastTouchMidX = midX;
      _lastTouchMidY = midY;
      _apply();
    } else if (e.touches.length === 1 && _panning) {
      _panX = _startPanX + (e.touches[0].clientX - _startX);
      _panY = _startPanY + (e.touches[0].clientY - _startY);
      _apply();
    }
  }

  function _handleTouchEnd() {
    _lastTouchDist = null;
    _panning = false;
  }

  // ── Öffentliche API ───────────────────────────────────────────────────
  return {

    init(wrapper, viewport) {
      _wrapper  = wrapper;
      _viewport = viewport;
      _apply();

      _onWheel     = _handleWheel;
      _onMouseDown = _handleMouseDown;
      _onMouseMove = _handleMouseMove;
      _onMouseUp   = _handleMouseUp;
      _onDblClick  = _handleDblClick;

      _wrapper.addEventListener('wheel',      _onWheel,     { passive: false });
      _wrapper.addEventListener('mousedown',  _onMouseDown);
      window  .addEventListener('mousemove',  _onMouseMove);
      window  .addEventListener('mouseup',    _onMouseUp);
      _wrapper.addEventListener('dblclick',   _onDblClick);

      // Touch
      _wrapper.addEventListener('touchstart', _handleTouchStart, { passive: false });
      _wrapper.addEventListener('touchmove',  _handleTouchMove,  { passive: false });
      _wrapper.addEventListener('touchend',   _handleTouchEnd);

      // Zoom-Reset-Button
      const resetBtn = document.getElementById('btn-zoom-reset');
      if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
    },

    destroy() {
      if (!_wrapper) return;
      _wrapper.removeEventListener('wheel',      _onWheel);
      _wrapper.removeEventListener('mousedown',  _onMouseDown);
      window  .removeEventListener('mousemove',  _onMouseMove);
      window  .removeEventListener('mouseup',    _onMouseUp);
      _wrapper.removeEventListener('dblclick',   _onDblClick);
      _wrapper.removeEventListener('touchstart', _handleTouchStart);
      _wrapper.removeEventListener('touchmove',  _handleTouchMove);
      _wrapper.removeEventListener('touchend',   _handleTouchEnd);
      if (_viewport) _viewport.style.transform = '';
      _wrapper = _viewport = null;
    },

    reset() {
      _zoom = 1; _panX = 0; _panY = 0;
      _apply();
    },

    getState() {
      return { zoom: _zoom, panX: _panX, panY: _panY };
    },

    setState(zoom, panX, panY) {
      _zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      _panX = panX ?? _panX;
      _panY = panY ?? _panY;
      _apply();
    },

    zoomIn(factor = 1.1) {
      const rect = _wrapper?.getBoundingClientRect();
      if (!rect) return;
      _zoomTo(_zoom * factor, rect.width / 2, rect.height / 2);
    },

    zoomOut(factor = 1.1) {
      this.zoomIn(1 / factor);
    },
  };

})();