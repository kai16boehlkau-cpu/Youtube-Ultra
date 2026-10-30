/* ============================================================
 * YouTube Ultra – PWA-Installation (Browser-App)
 * • Registriert den Service Worker (nur über http/https).
 * • Fangt beforeinstallprompt ab und zeigt einen eigenen Hinweis
 *   beim ersten Besuch – nur wenn die App noch NICHT installiert ist.
 * • Nach Installation (oder Ablehnung) wird nicht mehr gefragt.
 * ============================================================ */
(function (YU) {
  'use strict';

  var deferred = null;
  var banner = null;
  var LS_KEY = 'yu.install.dismissed';

  function isStandalone() {
    try {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: window-controls-overlay)').matches) return true;
    } catch (e) {}
    if (navigator.standalone === true) return true;   // iOS Safari
    return false;
  }

  function canPrompt() { return !!deferred && !isStandalone(); }

  function dismissedRecently() {
    try {
      var t = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
      return !!(t && (Date.now() - t) < 30 * 24 * 60 * 60 * 1000);   // 30 Tage nicht erneut fragen
    } catch (e) { return false; }
  }
  function markDismissed() { try { localStorage.setItem(LS_KEY, String(Date.now())); } catch (e) {} }
  function clearDismissed() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'App installieren');
    banner.hidden = true;
    banner.innerHTML =
      '<div class="install-banner__icon" aria-hidden="true">' +
        '<svg viewBox="0 0 32 32" width="30" height="30"><rect width="32" height="32" rx="8" fill="var(--card-2)"/>' +
        '<path d="M13 10.5v11l9-5.5z" fill="var(--accent)"/></svg>' +
      '</div>' +
      '<div class="install-banner__text">' +
        '<b>YouTube Ultra als App installieren</b>' +
        '<span>Vollbild-Startbildschirm & direkter Zugriff – ohne Browserleiste.</span>' +
      '</div>' +
      '<div class="install-banner__actions">' +
        '<button type="button" class="btn install-yes">Installieren</button>' +
        '<button type="button" class="btn btn--ghost install-no">Später</button>' +
      '</div>';
    document.body.appendChild(banner);
    banner.querySelector('.install-yes').addEventListener('click', doInstall);
    banner.querySelector('.install-no').addEventListener('click', function () { hide(); markDismissed(); });
    return banner;
  }

  function show() {
    if (!canPrompt() || dismissedRecently()) return;
    var b = ensureBanner();
    b.hidden = false;
    // setTimeout statt rAF: funktioniert auch in Hintergrund-Tabs
    setTimeout(function () { if (banner) banner.classList.add('is-open'); }, 30);
  }

  function hide() {
    if (!banner) return;
    banner.classList.remove('is-open');
    setTimeout(function () { if (banner) banner.hidden = true; }, 260);
  }

  function doInstall() {
    if (!deferred) { hide(); return; }
    hide();
    var p = deferred; deferred = null;
    p.prompt();
    p.userChoice.then(function (choice) {
      if (choice && choice.outcome === 'accepted') clearDismissed();
      else markDismissed();
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    setTimeout(show, 1200);   // kurze Verzügerung, damit die App erst lädt
  });

  window.addEventListener('appinstalled', function () {
    deferred = null; hide(); clearDismissed();
    if (YU.ui && YU.ui.toast) YU.ui.toast('App installiert – viel Spaß!', 'ok');
  });

  // Service Worker registrieren (http/https; file:// überspringen)
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (!/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    });
  }

  YU.install = { show: show, canPrompt: canPrompt, isStandalone: isStandalone, doInstall: doInstall };

  registerSW();
})(window.YU = window.YU || {});
