/* ============================================================
 * YouTube Ultra – Maus-Lichtschein (weiches blaues Glühen)
 * • Fixe Ebene (z-index 0), pointer-events: none → blockiert
 *   nie Klicks/Inhalt.
 * • Lerp-Interpolation in requestAnimationFrame (weich).
 * • prefers-reduced-motion → statisch/dezent.
 * • Touch → statischer, dezent positionierter Schein.
 * ============================================================ */
(function (YU) {
  'use strict';

  var el = null;
  var targetX = 0, targetY = 0, curX = 0, curY = 0;
  var rafId = null;
  var active = false;
  var reduced = false;

  var LERP = 0.5;       // Verfolgungsfaktor (0..1). 0.5 ≈ fast Echtzeit,
                        // noch mit minimaler Glättung gegen Zittern.
  var RADIUS = 460;     // Radius in px

  function prefersReduced() {
    return reduced ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function apply(x, y) {
    el.style.setProperty('--glow-x', Math.round(x) + 'px');
    el.style.setProperty('--glow-y', Math.round(y) + 'px');
  }

  function tick() {
    // Lerp: Ziel langsam einholen → weiche Bewegung
    curX += (targetX - curX) * LERP;
    curY += (targetY - curY) * LERP;
    apply(curX, curY);
    // Weiterlaufen, bis eingeholt (dann pausieren bis zur nächsten Bewegung)
    if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      active = false;
    }
  }

  function onMove(e) {
    if (!el || !YU.settings.get('glowEnabled')) return;
    if (prefersReduced()) return; // bei reduzierter Bewegung statisch
    targetX = e.clientX;
    targetY = e.clientY;
    if (!active) {
      active = true;
      if (curX === 0 && curY === 0) { curX = targetX; curY = targetY; }
      rafId = requestAnimationFrame(tick);
    }
  }

  function staticPosition() {
    // Dezent, statisch: oben mittig (kein Sprung bei Mausbewegung)
    targetX = curX = window.innerWidth * 0.5;
    targetY = curY = window.innerHeight * 0.22;
    apply(curX, curY);
  }

  var init = function () {
    el = document.getElementById('glow');
    if (!el) return;

    el.style.setProperty('--glow-r', RADIUS + 'px');
    staticPosition();

    var isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;

    if (isTouch || prefersReduced()) {
      // Touch / reduzierte Bewegung: statisch & dezent, keine Listener
      staticPosition();
      if (prefersReduced()) el.style.opacity = '0.55';
      window.addEventListener('resize', function () { if (prefersReduced() || isTouch) staticPosition(); });
      return;
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('resize', function () {
      // Ziel bei Größenänderung anpassen (ohne Sprung-Ansprung)
      targetX = Math.min(targetX, window.innerWidth);
      targetY = Math.min(targetY, window.innerHeight);
      if (!active) { apply(curX, curY); }
    });

    // Sichtbarkeit an Einstellungen koppeln
    YU.settings.onChange(function (s) {
      if (!s.glowEnabled) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null; active = false;
      }
      reduced = !!s.reducedMotion;
    });

    reduced = !!YU.settings.get('reducedMotion');
    // Bei System-Änderung reagieren
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      var handler = function () {
        reduced = mq.matches;
        if (reduced) {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = null; active = false;
          staticPosition();
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', handler);
      else if (mq.addListener) mq.addListener(handler);
    }
  };

  YU.glow = { init: init };
})(window.YU = window.YU || {});
