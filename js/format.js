/* ============================================================
 * YouTube Ultra – Formatierung (de-DE) & kleine Helfer
 * ============================================================ */
(function (YU) {
  'use strict';

  var nf = new Intl.NumberFormat('de-DE');
  var nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  /** @param {number} n @returns {string} z. B. „1,2 Mio. Aufrufe“ */
  function views(n) {
    if (!n || n < 1) return 'Aufrufe unbekannt';
    if (n < 1000) return n + ' Aufrufe';
    if (n < 1e6) return nf1.format(n / 1e3) + ' Tsd. Aufrufe';
    if (n < 1e9) return nf1.format(n / 1e6) + ' Mio. Aufrufe';
    return nf1.format(n / 1e9) + ' Mrd. Aufrufe';
  }

  /** @param {number} n @returns {string} kompakte Zahl ohne Wort */
  function compact(n) {
    if (!n || n < 1) return '–';
    if (n < 1e3) return String(n);
    if (n < 1e6) return nf1.format(n / 1e3) + ' Tsd.';
    if (n < 1e9) return nf1.format(n / 1e6) + ' Mio.';
    return nf1.format(n / 1e9) + ' Mrd.';
  }

  /** @param {number} s @returns {string} „12:34“ oder „1:02:03“ */
  function duration(s) {
    s = Math.max(0, Math.round(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var mm = (h > 0 ? String(m).padStart(2, '0') : String(m));
    return (h > 0 ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
  }

  /** @param {number} ms @returns {string} z. B. „vor 3 Tagen“ */
  function relTime(ms) {
    if (!ms) return '';
    var diff = Date.now() - ms;
    if (diff < 0) diff = 0;
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'gerade eben';
    if (min < 60) return 'vor ' + min + ' Min.';
    var h = Math.floor(min / 60);
    if (h < 24) return 'vor ' + h + ' Std.';
    var d = Math.floor(h / 24);
    if (d === 1) return 'gestern';
    if (d < 7) return 'vor ' + d + ' Tagen';
    var w = Math.floor(d / 7);
    if (w < 5) return 'vor ' + w + ' Woche' + (w === 1 ? '' : 'n');
    var mo = Math.floor(d / 30.4);
    if (mo < 12) return 'vor ' + mo + ' Monat' + (mo === 1 ? '' : 'en');
    var y = Math.floor(d / 365);
    return 'vor ' + y + ' Jahr' + (y === 1 ? '' : 'en');
  }

  /** @param {number} ms @returns {string} Datum de-DE */
  function date(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) { return ''; }
  }

  /** @param {number} ms @returns {string} Datum + Uhrzeit */
  function dateTime(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) { return date(ms); }
  }

  /** Tagesgruppe für Verlauf: Heute / Gestern / Datum */
  function dayKey(ms) {
    var d = new Date(ms), now = new Date();
    var startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ms >= startOfToday) return 'Heute';
    if (ms >= startOfToday - 86400000) return 'Gestern';
    return new Date(ms).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Thumbnail-URL mit fester Größe (i.ytimg.com) */
  function thumb(id, w) {
    w = w || 640;
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hq' + w + '.jpg';
  }

  /** Großes Thumbnail (720) mit Fallback-Pfad */
  function thumbBig(id) {
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/hq720.jpg';
  }

  /** sicheres Escapen von Text */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Initial für Avatar-Platzhalter */
  function initial(name) {
    var s = (name || '?').trim();
    return s ? s[0].toUpperCase() : '?';
  }

  /** Subs-Label */
  function subsLabel(n) {
    if (!n || n < 1) return '';
    return compact(n) + ' Abonnenten';
  }

  /** Debounce */
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /** Zufällige, deduplizierte Auswahl */
  function sample(arr, n) {
    var copy = arr.slice(), out = [];
    while (copy.length && out.length < n) {
      out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
  }

  function uniq(arr, keyFn) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      var k = keyFn ? keyFn(arr[i]) : arr[i];
      if (k && !seen[k]) { seen[k] = 1; out.push(arr[i]); }
    }
    return out;
  }

  YU.fmt = {
    views: views, compact: compact, duration: duration, relTime: relTime,
    date: date, dateTime: dateTime, dayKey: dayKey,
    thumb: thumb, thumbBig: thumbBig, esc: esc, initial: initial,
    subsLabel: subsLabel, debounce: debounce, clamp: clamp,
    sample: sample, uniq: uniq, nf: nf, nf2: nf2
  };
})(window.YU = window.YU || {});
