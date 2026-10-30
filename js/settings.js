/* ============================================================
 * YouTube Ultra – Einstellungen (nur kleine Daten in localStorage)
 * Alle Datenschutz-/Design-Regler liegen hier.
 * ============================================================ */
(function (YU) {
  'use strict';

  var DEFAULTS = {
    glowEnabled: true,          // Mauslichtschein
    reducedMotion: false,       // Animationen reduzieren
    accent: '',                 // '' = Standard Schwarzblau
    historyEnabled: true,       // Verlauf aufzeichnen
    personalization: true,      // Lokale Personalisierung
    apiKey: '',                 // Optionaler offizieller API-Schlüssel (nur lokal!)
    sidebarCollapsed: false,
    glowIntensity: 1,           // 0.5–1.5
    showReasons: true,          // „Warum sehe ich das?“-Hinweise
    searchHistoryEnabled: true
  };

  var cache = null;
  var listeners = [];

  function load() {
    if (cache) return cache;
    var raw = null;
    try { raw = localStorage.getItem(YU.config.settingsKey); } catch (e) { /* file:// ohne Storage */ }
    var parsed = {};
    if (raw) {
      try { parsed = JSON.parse(raw); } catch (e) { parsed = {}; }
    }
    cache = Object.assign({}, DEFAULTS, parsed);
    return cache;
  }

  function save() {
    try { localStorage.setItem(YU.config.settingsKey, JSON.stringify(cache)); } catch (e) { /* ignorieren */ }
    listeners.forEach(function (fn) { try { fn(cache); } catch (e) { /* ignorieren */ } });
  }

  var settings = {
    /** @param {string} key @returns {*} */
    get: function (key) { return load()[key]; },

    /** @param {string} key @param {*} value */
    set: function (key, value) {
      load()[key] = value;
      save();
      applyDom();
    },

    all: function () { return load(); },

    reset: function () {
      cache = Object.assign({}, DEFAULTS);
      save();
      applyDom();
    },

    onChange: function (fn) { listeners.push(fn); },

    /** Optische Regler auf die DOM anwenden */
    applyDom: applyDom
  };

  function applyDom() {
    var s = load();
    document.body.classList.toggle('no-glow', !s.glowEnabled);
    document.body.classList.toggle('reduced-motion', !!s.reducedMotion);
    document.body.classList.toggle('sidebar-collapsed', !!s.sidebarCollapsed);

    var root = document.documentElement;
    if (s.accent) {
      var light = lighten(s.accent, 0.28);
      root.style.setProperty('--accent', s.accent);
      root.style.setProperty('--accent-2', light);
      root.style.setProperty('--accent-soft', hexToRgba(s.accent, 0.14));
      root.style.setProperty('--accent-grad', 'linear-gradient(135deg, ' + s.accent + ', ' + light + ')');
      root.style.setProperty('--glow-color', hexToRgba(lighten(s.accent, 0.12), 0.34));
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-2');
      root.style.removeProperty('--accent-soft');
      root.style.removeProperty('--accent-grad');
      root.style.removeProperty('--glow-color');
    }
    document.body.style.setProperty('--glow-opacity', String(s.glowIntensity || 1));
  }

  function hexToRgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  /** Helligere Variante einer Hex-Farbe (0..1) – für Verlaufs-Endpunkte */
  function lighten(hex, amt) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    var r = Math.min(255, Math.round(((n >> 16) & 255) + 255 * amt));
    var g = Math.min(255, Math.round(((n >> 8) & 255) + 255 * amt));
    var b = Math.min(255, Math.round((n & 255) + 255 * amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  YU.settings = settings;
})(window.YU = window.YU || {});
