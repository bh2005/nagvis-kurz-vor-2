// NagVis 2 – i18n.js
// Leichtgewichtige Mehrsprachigkeit via JSON-Dictionaries.
// Muss als ERSTES Script geladen werden (vor allen anderen JS-Dateien).
'use strict';

// ── Globaler Zustand ─────────────────────────────────────────────────────────
window.I18N      = {};                                   // aktuelles Wörterbuch
window._nv2Lang  = localStorage.getItem('nv2_lang') || 'de';

// Promise das resolvet sobald die initiale Sprache geladen ist.
// app.js wartet darauf bevor es die UI rendert → kein Flash unübersetzter Strings.
window._i18nReady = null;


// ── Übersetzungs-Funktion ────────────────────────────────────────────────────

/**
 * Übersetzt einen Schlüssel mit optionaler Variablen-Ersetzung.
 *   t('overview')                  → "Übersicht"
 *   t('objects_count', {count:5})  → "5 Objekte"
 *   t('unknown_key')               → "unknown_key"  (Fallback = Schlüssel selbst)
 */
window.t = function(key, vars) {
  let s = window.I18N[key];
  if (s === undefined) s = key;          // Fallback: Schlüssel als Text
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (_, k) =>
      (vars[k] !== undefined ? vars[k] : `{${k}}`)
    );
  }
  return s;
};


// ── DOM-Walk ─────────────────────────────────────────────────────────────────

/**
 * Wendet alle data-i18n Attribute im DOM an.
 *
 * Unterstützte Attribute:
 *   data-i18n="key"               → el.textContent = t(key)
 *   data-i18n-placeholder="key"   → el.placeholder  = t(key)
 *   data-i18n-title="key"         → el.title         = t(key)
 *   data-i18n-html="key"          → el.innerHTML     = t(key)   (nur für vertrauenswürdige Strings!)
 */
window.applyI18n = function() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
};


// ── Sprache laden ────────────────────────────────────────────────────────────

/**
 * Lädt /lang/{code}.json, aktiviert die Sprache und refresht die UI.
 * Gibt ein Promise zurück das bei Erfolg { code, name, count } liefert.
 */
window.setLang = async function(code) {
  try {
    const r = await fetch(`/lang/${code}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const pack    = await r.json();
    const strings = pack.strings ?? pack;   // { meta, strings } oder direktes Dict
    const meta    = pack.meta    ?? {};

    window.I18N      = strings;
    window._nv2Lang  = code;
    localStorage.setItem('nv2_lang', code);
    // Offline-Cache: nächster Start kann sofort (synchron) laden
    try { localStorage.setItem(`nv2_langpack_${code}`, JSON.stringify(strings)); } catch { /* quota */ }

    document.documentElement.lang = code;
    applyI18n();

    // Dynamische Teile neu rendern die aktuell sichtbar sind
    _refreshDynamicUI();

    const name = meta.name ?? code;
    console.info(`[i18n] ${name} (${Object.keys(strings).length} Strings)`);
    return { code, name, count: Object.keys(strings).length };
  } catch (e) {
    console.warn(`[i18n] Sprache '${code}' konnte nicht geladen werden:`, e);
    throw e;
  }
};


// ── Lang-Pack Import ─────────────────────────────────────────────────────────

/**
 * Importiert ein Lang-Pack aus einem File-Objekt (JSON-Upload via <input type=file>).
 * Format: { "meta": { "lang":"fr", "name":"Français" }, "strings": { ... } }
 *         ODER direkt: { "overview": "Vue d'ensemble", ... }
 */
window.importLangPack = async function(file) {
  try {
    const text    = await file.text();
    const json    = JSON.parse(text);
    const meta    = json.meta    ?? {};
    const strings = json.strings ?? json;

    if (typeof strings !== 'object' || Array.isArray(strings)) {
      throw new Error(t('lang_pack_invalid'));
    }

    const code = meta.lang || file.name.replace(/\.json$/i, '');
    window.I18N     = strings;
    window._nv2Lang = code;
    localStorage.setItem('nv2_lang', code);
    try { localStorage.setItem(`nv2_langpack_${code}`, JSON.stringify(strings)); } catch { /* quota */ }

    document.documentElement.lang = code;
    applyI18n();
    _refreshDynamicUI();

    const name  = meta.name ?? code;
    const count = Object.keys(strings).length;
    console.info(`[i18n] Lang-Pack importiert: ${name} (${count} Strings)`);
    return { success: true, code, name, count };
  } catch (e) {
    console.error('[i18n] Import Fehler:', e);
    return { success: false, error: e.message };
  }
};


// ── Verfügbare Sprachen ──────────────────────────────────────────────────────

/** Gibt die Liste der eingebauten Sprachen zurück. */
window.getBuiltinLangs = function() {
  return [
    { code: 'de', name: 'Deutsch' },
    { code: 'en', name: 'English' },
  ];
};


// ── Dynamische UI-Teile refreshen ────────────────────────────────────────────

function _refreshDynamicUI() {
  // Theme-Labels synchron halten (Dark-Theme / Light-Theme)
  if (typeof setTheme === 'function' && typeof currentTheme !== 'undefined') {
    setTheme(currentTheme, false);
  }
  // Sidebar-Status neu setzen
  if (typeof _backendReachable !== 'undefined') {
    if (window._demoMode) {
      if (typeof setSidebarLive === 'function') setSidebarLive(true, t('demo_no_backend'));
      if (typeof setStatusBar  === 'function') setStatusBar(t('demo_static'));
    }
  }
  // Map-Übersicht / Sidebar-Map-Liste neu rendern
  if (typeof loadMaps === 'function' && typeof _allMaps !== 'undefined' && _allMaps.length) {
    if (typeof renderSidebarMaps === 'function') renderSidebarMaps(_allMaps);
    if (typeof renderOverview    === 'function') renderOverview(_allMaps);
  }
  // Suchfeld-Placeholder aktualisieren
  const _srch = document.getElementById('sidebar-search');
  if (_srch) _srch.placeholder = t('search_maps_placeholder');
  // Hosts-Panel neu rendern
  if (typeof hostCache !== 'undefined') {
    const hosts = Object.values(hostCache);
    if (typeof renderHostsPanel === 'function' && hosts.length) renderHostsPanel(hosts);
  }
}


// ── Initialisierung ──────────────────────────────────────────────────────────

(function _boot() {
  const code = window._nv2Lang;

  // 1. Synchron aus Cache laden damit t() sofort funktioniert (kein Flash)
  try {
    const cached = localStorage.getItem(`nv2_langpack_${code}`);
    if (cached) {
      window.I18N = JSON.parse(cached);
      document.documentElement.lang = code;
    }
  } catch { /* ignore */ }

  // 2. Frische Version vom Server laden (Promise für app.js)
  window._i18nReady = setLang(code).catch(() => {
    // Fehler beim Laden → t() arbeitet weiter mit Cache oder Schlüssel-Fallback
  });
})();
